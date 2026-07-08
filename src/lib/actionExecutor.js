'use strict';

/**
 * Unified action executor for Automations (Triggers).
 *
 * Runs a single action in-process — the same capabilities the HTTP routes expose,
 * called directly (no self-HTTP). Used by the trigger worker; designed so the
 * /services and /afp routes can later become thin wrappers over it.
 *
 * Phase 1 supports:
 *   - service_proxy  (Composio toolkits via proxyComposioService)
 *   - afp_exec       (shell on a registered, owned device)
 * Phase 1.5 will add native OAuth service_proxy; Phase 3 the ai_prompt loop.
 *
 * Ownership/safety: every action is scoped to ownerId. AFP verifies the device
 * belongs to the owner before dispatching. Writes are audited + metered by the
 * caller via the standard path.
 */

const {
  isComposioVirtualService,
  isComposioConnectedService,
  proxyComposioService,
} = require('../services/composio-integration');
const db = require('../database');
const { getAfpDeviceById, createAuditLog, createNotification } = db;
const { creditsForRun, rawCostUsd } = require('./aiCredits');
const wallet = require('./aiWallet');
const afpRouter = require('../routes/afp'); // router with .dispatchCommand attached

async function executeServiceProxyAction(ownerId, action) {
  const service = String(action.service || action.serviceName || '').trim();
  if (!service) return { ok: false, statusCode: 400, error: 'service is required' };
  const apiPath = action.path || action.endpoint;
  const method = (action.method || 'GET').toUpperCase();

  if (isComposioVirtualService(service)) {
    const connected = await isComposioConnectedService(ownerId, service);
    if (!connected) {
      return { ok: false, statusCode: 409, error: `Service '${service}' is not connected through Composio for this account` };
    }
    const r = await proxyComposioService({
      userId: ownerId, serviceName: service, apiPath, httpMethod: method,
      reqBody: action.body || null, queryParams: action.query || null,
    });
    return { ok: r.ok, statusCode: r.statusCode, data: r.data, error: r.error?.message || null };
  }

  // Native OAuth services land in Phase 1.5 (token resolution lives in the route).
  return { ok: false, statusCode: 501, error: `Native service '${service}' not yet supported by automations (use its Composio toolkit, or wait for Phase 1.5)` };
}

async function executeAfpExecAction(ownerId, action) {
  const deviceId = String(action.deviceId || '').trim();
  const cmd = String(action.cmd || '').trim();
  if (!deviceId || !cmd) return { ok: false, statusCode: 400, error: 'deviceId and cmd are required' };

  let device;
  try { device = getAfpDeviceById(deviceId); } catch { return { ok: false, statusCode: 500, error: 'Device lookup failed' }; }
  if (!device || device.revoked_at) return { ok: false, statusCode: 404, error: 'AFP device not found' };
  if (String(device.user_id) !== String(ownerId)) return { ok: false, statusCode: 403, error: 'Device belongs to another account' };

  try {
    const result = await afpRouter.dispatchCommand(deviceId, 'exec', { cmd, cwd: action.cwd, timeout: action.timeout });
    return { ok: true, statusCode: 200, data: result };
  } catch (err) {
    const statusCode = err.code === 'DEVICE_OFFLINE' ? 503 : err.code === 'TIMEOUT' ? 504 : 500;
    return { ok: false, statusCode, error: err.message, code: err.code };
  }
}

/**
 * @param {object} a
 * @param {string} a.ownerId
 * @param {string} a.workspaceId
 * @param {string} a.actionType   'service_proxy' | 'afp_exec' | 'ai_prompt'
 * @param {object} a.action       parsed action_json
 * @param {object} [a.actor]      audit actor metadata
 * @returns {Promise<{ok, statusCode, data?, error?}>}
 */
async function executeAiPromptAction(ownerId, workspaceId, action, actor) {
  const { runAiPrompt } = require('./aiAgent'); // lazy: aiAgent imports this module
  const keyMode = action.keyMode === 'byo' ? 'byo' : 'platform';
  const notify = (msg) => { try { createNotification(workspaceId || 'default', ownerId, 'automation', 'MyApi AI', String(msg).slice(0, 500)); } catch (_) {} };

  // Platform-mode (MyApi-provided AI) is gated by the prepaid wallet + spend
  // limit. BYO uses the user's own key — free to the platform, no caps.
  let preStatus = null;
  if (keyMode === 'platform') {
    preStatus = wallet.spendStatus(ownerId);
    if (preStatus.policy.monthlyRunCap && preStatus.used.runs >= preStatus.policy.monthlyRunCap) {
      return { ok: false, statusCode: 429, error: `You've reached this month's MyApi-AI run limit (${preStatus.policy.monthlyRunCap}). Use your own API key for unlimited runs, or upgrade.` };
    }
    // Top up first if the balance is empty and auto-reload is on.
    if (preStatus.available <= 0 && preStatus.policy.platform && !preStatus.limitReached && preStatus.wallet.autoReload.enabled) {
      await wallet.attemptAutoReload(ownerId, workspaceId, notify);
      preStatus = wallet.spendStatus(ownerId);
    }
    const gate = wallet.canRunPlatform(preStatus);
    if (!gate.ok) return gate;
  }

  const r = await runAiPrompt({
    ownerId, workspaceId,
    prompt: action.prompt || action.instruction,
    service: action.service,
    services: action.services,
    provider: action.provider,
    model: action.model,
    keyMode,
    automationName: actor?.triggerName || null,
  });

  // Meter MyApi-mode usage as credits (BYO is free to the platform). Charged to
  // the user as credits = provider cost × markup; billed via the Stripe meter.
  let credits = 0;
  if (keyMode === 'platform' && r.usage && (r.usage.input_tokens || r.usage.output_tokens)) {
    try {
      credits = creditsForRun(r.model, r.usage);
      db.recordAiUsageEvent({
        userId: ownerId, workspaceId, triggerId: actor?.triggerId || null, keyMode: 'platform',
        provider: r.provider, model: r.model,
        inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens,
        costCents: Math.round(rawCostUsd(r.model, r.usage) * 100), credits,
      });
      // Draw the over-allowance portion from the prepaid balance, then alert /
      // auto-reload based on the fresh month-to-date picture.
      wallet.deductForRun(ownerId, credits, preStatus ? preStatus.includedRemaining : 0);
      const post = wallet.spendStatus(ownerId);
      wallet.maybeAlert(ownerId, post, notify);
      if (post.wallet.autoReload.enabled && post.balance < post.wallet.autoReload.whenBelowCredits && !post.limitReached) {
        await wallet.attemptAutoReload(ownerId, workspaceId, notify);
      }
    } catch (_) { /* metering must not break the run */ }
  }

  // Deliver the AI's summary to the user as an in-app notification.
  if (r.ok && r.text) {
    try {
      createNotification(
        workspaceId || 'default', ownerId, 'automation',
        actor?.triggerName ? `Automation: ${actor.triggerName}` : 'Automation completed',
        String(r.text).slice(0, 1000),
        { usage: r.usage, toolCalls: r.toolCalls, provider: r.provider, model: r.model, credits, triggerId: actor?.triggerId || null }
      );
    } catch (_) { /* notification is best-effort */ }
  }
  return { ok: r.ok, statusCode: r.statusCode, ran: true, toolCalls: r.toolCalls || 0, data: r.ok ? { text: r.text, usage: r.usage, toolCalls: r.toolCalls, credits, model: r.model } : undefined, error: r.error || null };
}

// How many plan API-calls an automation result bills: AI runs bill one per
// service action the agent took (min 1 if the run executed); deterministic
// actions bill 1 when attempted successfully; blocked/failed pre-flight → 0.
function countApiCalls(actionType, res) {
  if (actionType === 'ai_prompt') return res.ran ? Math.max(1, res.toolCalls || 0) : 0;
  if (actionType === 'service_proxy' || actionType === 'afp_exec') return res.ok ? 1 : 0;
  return 0;
}

async function executeAction({ ownerId, workspaceId, actionType, action, actor = {} }) {
  let res;
  try {
    if (actionType === 'service_proxy')      res = await executeServiceProxyAction(ownerId, action || {});
    else if (actionType === 'afp_exec')      res = await executeAfpExecAction(ownerId, action || {});
    else if (actionType === 'ai_prompt')     res = await executeAiPromptAction(ownerId, workspaceId, action || {}, actor);
    else                                     res = { ok: false, statusCode: 400, error: `Unknown action_type '${actionType}'` };
  } catch (err) {
    res = { ok: false, statusCode: 500, error: err.message };
  }

  // Count the automation's service activity against the plan's API-call quota —
  // scheduled runs never touch the HTTP accounting middleware, so we meter here.
  // AI runs bill one call per service action the agent performed (min 1 for a
  // run that executed); deterministic actions bill 1 when the call was attempted.
  const apiCalls = countApiCalls(actionType, res);
  if (apiCalls > 0) {
    try {
      // Bill the trigger's workspace (matches what the quota gate reads); fall
      // back to the owner's primary workspace if it's missing.
      let billWs = workspaceId && workspaceId !== 'default' ? workspaceId : null;
      if (!billWs) { try { billWs = db.getWorkspaces(ownerId)?.[0]?.id || null; } catch (_) {} }
      if (billWs) db.incrementUsageDaily(billWs, new Date().toISOString().slice(0, 10), { api_calls: apiCalls });
    } catch (_) { /* metering must not break execution */ }
  }

  try {
    createAuditLog({
      requesterId: actor.triggerId || ownerId,
      action: `automation:${actionType}`,
      resource: action?.service || action?.deviceId || 'automation',
      ip: null,
      authType: 'trigger',
      details: { ok: res.ok, statusCode: res.statusCode, workspaceId, apiCalls, error: res.error || null },
    });
  } catch (_) { /* audit must not break execution */ }

  return { ...res, apiCalls };
}

module.exports = { executeAction, executeServiceProxyAction, executeAfpExecAction, countApiCalls };
