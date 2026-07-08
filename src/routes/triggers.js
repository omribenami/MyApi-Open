'use strict';

/**
 * Automations (Triggers) API — CRUD + run-now + run history.
 * Mounted under /api/v1/triggers (authenticate + Pro/Heavy plan gate in index.js).
 * Phase 1: schedule-kind triggers with service_proxy / afp_exec actions.
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { computeNextRun, isValidSchedule, describeSchedule } = require('../lib/schedule');
const { executeAction } = require('../lib/actionExecutor');
const { setUserModelKey, getAiSettings, validateKeyForProvider, normalizeProvider, PROVIDERS } = require('../lib/aiAgent');
const { planAi, monthStartIso } = require('../lib/aiCredits');
const wallet = require('../lib/aiWallet');

function ownerId(req) {
  return String(req.session?.user?.id || req.user?.id || req.tokenMeta?.ownerId || '');
}
function workspaceId(req) {
  const explicit = req.workspaceId || req.session?.currentWorkspace || req.headers['x-workspace-id'];
  if (explicit) return explicit;
  // Token/ASC agents rarely send a workspace — resolve the owner's primary one
  // so agent- and dashboard-created automations share the same workspace.
  try { const ws = db.getWorkspaces(ownerId(req)); if (ws && ws[0]?.id) return ws[0].id; } catch (_) {}
  return 'default';
}

const ACTION_TYPES = new Set(['service_proxy', 'afp_exec', 'ai_prompt']);

// Validate + normalize a trigger payload. Returns { ok, error } or { ok:true, value }.
function validateBody(body) {
  const name = String(body?.name || '').trim();
  if (!name) return { ok: false, error: 'name is required' };

  const kind = body.kind === 'event' ? 'event' : 'schedule';
  const actionType = String(body.actionType || body.action_type || '');
  if (!ACTION_TYPES.has(actionType)) {
    return { ok: false, error: `actionType must be one of: ${[...ACTION_TYPES].join(', ')}` };
  }

  const actionJson = body.actionJson || body.action || {};
  if (actionType === 'service_proxy' && !(actionJson.service || actionJson.serviceName)) {
    return { ok: false, error: 'service_proxy action needs { service, path, method?, body?, query? }' };
  }
  if (actionType === 'afp_exec' && !(actionJson.deviceId && actionJson.cmd)) {
    return { ok: false, error: 'afp_exec action needs { deviceId, cmd }' };
  }
  if (actionType === 'ai_prompt') {
    if (!String(actionJson.prompt || actionJson.instruction || '').trim()) {
      return { ok: false, error: 'ai_prompt action needs a { prompt } describing what the AI should do' };
    }
    if (actionJson.keyMode && !['platform', 'byo'].includes(actionJson.keyMode)) {
      return { ok: false, error: 'ai_prompt keyMode must be "platform" (MyApi AI) or "byo" (your own key)' };
    }
    if (actionJson.provider && !PROVIDERS[actionJson.provider]) {
      return { ok: false, error: `ai_prompt provider must be one of: ${Object.keys(PROVIDERS).join(', ')}` };
    }
  }

  let scheduleJson = null;
  if (kind === 'schedule') {
    scheduleJson = body.scheduleJson || body.schedule || null;
    if (!isValidSchedule(scheduleJson)) {
      return { ok: false, error: 'schedule must be { type: once|interval|daily|weekly|monthly, ... }' };
    }
    // Platform (MyApi-provided) AI is throttled: no sub-hourly schedules — they
    // would cost the platform more than the plan. BYO keys are unrestricted.
    const platformAi = actionType === 'ai_prompt' && actionJson.keyMode !== 'byo';
    if (platformAi && scheduleJson.type === 'interval' && Number(scheduleJson.everyMinutes) < 60) {
      return { ok: false, error: 'MyApi-provided AI can run at most once per hour. For more frequent runs, use your own API key.' };
    }
  } else {
    if (!body.eventToolkit || !body.eventType) {
      return { ok: false, error: 'event triggers need eventToolkit + eventType' };
    }
  }

  return {
    ok: true,
    value: {
      name, kind, actionType, actionJson, scheduleJson,
      timezone: body.timezone || 'UTC',
      eventToolkit: body.eventToolkit || null,
      eventType: body.eventType || null,
      enabled: body.enabled !== false,
    },
  };
}

function serialize(t) {
  const parse = (j, f) => { try { return j ? JSON.parse(j) : f; } catch { return f; } };
  const schedule = parse(t.schedule_json, null);
  return {
    id: t.id,
    name: t.name,
    enabled: !!t.enabled,
    kind: t.kind,
    schedule,
    scheduleLabel: schedule ? describeSchedule(schedule) : null,
    timezone: t.timezone,
    eventToolkit: t.event_toolkit,
    eventType: t.event_type,
    actionType: t.action_type,
    action: parse(t.action_json, {}),
    nextRunAt: t.next_run_at,
    lastRunAt: t.last_run_at,
    createdAt: t.created_at,
  };
}

// GET /api/v1/triggers
router.get('/', (req, res) => {
  try {
    const rows = db.listTriggers(ownerId(req), workspaceId(req));
    res.json({ ok: true, data: rows.map(serialize) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list automations' });
  }
});

// POST /api/v1/triggers
// Free-plan beta users get automations, but AI runs must use their own key —
// the platform wallet stays Pro/Heavy-only. Returns an error string or null.
function byoOnlyViolation(req, actionType, actionJson) {
  if (!req.betaFreeAutomations) return null;
  if (actionType !== 'ai_prompt') return null;
  if ((actionJson || {}).keyMode === 'byo') return null;
  return 'During the beta, AI automations on the free plan use your own API key: set action.keyMode to "byo" and add your key under AI settings.';
}

router.post('/', (req, res) => {
  const v = validateBody(req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });
  const byoErr = byoOnlyViolation(req, v.value.actionType, v.value.actionJson);
  if (byoErr) return res.status(400).json({ error: byoErr, code: 'BYO_KEY_REQUIRED' });
  try {
    const nextRunAt = v.value.kind === 'schedule'
      ? computeNextRun(v.value.scheduleJson, v.value.timezone, new Date())
      : null;
    const t = db.createTrigger({
      workspaceId: workspaceId(req), ownerId: ownerId(req),
      name: v.value.name, kind: v.value.kind, scheduleJson: v.value.scheduleJson,
      timezone: v.value.timezone, eventToolkit: v.value.eventToolkit, eventType: v.value.eventType,
      actionType: v.value.actionType, actionJson: v.value.actionJson,
      enabled: v.value.enabled, nextRunAt,
    });
    res.status(201).json({ ok: true, data: serialize(t) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create automation' });
  }
});

// ── AI settings (registered before /:id so "ai" isn't read as a trigger id) ──
// GET /api/v1/triggers/ai/settings — per-provider availability + MyApi-AI wallet.
router.get('/ai/settings', (req, res) => {
  const oid = ownerId(req);
  const s = wallet.spendStatus(oid);
  const w = s.wallet;
  res.json({
    ok: true,
    ...getAiSettings(oid),
    plan: s.planId,
    myapiAi: {
      allowed: s.policy.platform,
      includedCredits: s.included,
      includedRemaining: s.includedRemaining,
      monthlyRunCap: s.policy.monthlyRunCap,
      minIntervalMinutes: s.policy.minIntervalMinutes,
      usedCredits: s.used.credits,
      usedRuns: s.used.runs,
      overageCredits: s.overageUsed,           // charged beyond the included allowance
      balanceCredits: s.balance,               // prepaid balance remaining
      available: s.available,                  // includedRemaining + balance
      limitReached: s.limitReached,
      // user controls
      spendLimitCredits: w.spendLimitCredits,
      alertPercent: w.alertPercent,
      autoReload: w.autoReload,
    },
  });
});

// PUT /api/v1/triggers/ai/wallet — update spend controls (limit / alert % / auto-reload).
router.put('/ai/wallet', (req, res) => {
  const b = req.body || {};
  const patch = {};
  if ('spendLimitCredits' in b) {
    const v = b.spendLimitCredits;
    patch.spendLimitCredits = (v == null || v === '') ? null : Math.max(0, Math.round(Number(v) || 0));
  }
  if ('alertPercent' in b) patch.alertPercent = Math.min(100, Math.max(0, Math.round(Number(b.alertPercent) || 0)));
  if (b.autoReload && typeof b.autoReload === 'object') {
    patch.autoReload = {
      enabled: !!b.autoReload.enabled,
      whenBelowCredits: Math.max(0, Math.round(Number(b.autoReload.whenBelowCredits) || 0)),
      topUpCredits: Math.max(100, Math.round(Number(b.autoReload.topUpCredits) || 1000)),
    };
  }
  try {
    wallet.saveWallet(ownerId(req), patch);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/v1/triggers/ai/topup — buy credits via Stripe Checkout. { amountCents }
router.post('/ai/topup', async (req, res) => {
  const amountCents = Number(req.body?.amountCents);
  try {
    const r = await wallet.createTopUpCheckout(ownerId(req), workspaceId(req), amountCents);
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json({ ok: true, url: r.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const KEY_HINT = {
  anthropic: 'an Anthropic key (starts with "sk-ant-")',
  openai: 'an OpenAI key (starts with "sk-")',
  openrouter: 'an OpenRouter key (starts with "sk-or-")',
};

// PUT /api/v1/triggers/ai/key — store this user's own key for one provider (BYO).
router.put('/ai/key', (req, res) => {
  const provider = normalizeProvider(req.body?.provider);
  if (req.body?.provider && !PROVIDERS[req.body.provider]) {
    return res.status(400).json({ error: `provider must be one of: ${Object.keys(PROVIDERS).join(', ')}` });
  }
  const key = String(req.body?.key || '').trim();
  if (!key) return res.status(400).json({ error: 'key is required' });
  if (!validateKeyForProvider(provider, key)) {
    return res.status(400).json({ error: `That does not look like ${KEY_HINT[provider]}.` });
  }
  try {
    setUserModelKey(ownerId(req), provider, key);
    res.json({ ok: true, provider, ...getAiSettings(ownerId(req)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/v1/triggers/ai/key?provider=... — remove a stored BYO key.
router.delete('/ai/key', (req, res) => {
  const provider = normalizeProvider(req.body?.provider || req.query?.provider);
  try {
    setUserModelKey(ownerId(req), provider, null);
    res.json({ ok: true, provider, ...getAiSettings(ownerId(req)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function ownedTrigger(req, res) {
  const t = db.getTriggerById(req.params.id);
  if (!t || String(t.owner_id) !== ownerId(req)) { res.status(404).json({ error: 'Automation not found' }); return null; }
  return t;
}

// GET /api/v1/triggers/:id
router.get('/:id', (req, res) => {
  const t = ownedTrigger(req, res); if (!t) return;
  res.json({ ok: true, data: serialize(t), runs: db.listTriggerRuns(t.id, 10).map(serializeRun) });
});

// PATCH /api/v1/triggers/:id
router.patch('/:id', (req, res) => {
  const t = ownedTrigger(req, res); if (!t) return;
  const b = req.body || {};
  const fields = {};
  if (typeof b.name === 'string') fields.name = b.name.trim();
  if (typeof b.enabled === 'boolean') fields.enabled = b.enabled;
  if (b.timezone) fields.timezone = b.timezone;
  if (b.scheduleJson || b.schedule) {
    const sched = b.scheduleJson || b.schedule;
    if (!isValidSchedule(sched)) return res.status(400).json({ error: 'invalid schedule' });
    fields.scheduleJson = sched;
    fields.nextRunAt = computeNextRun(sched, fields.timezone || t.timezone || 'UTC', new Date());
  }
  if (b.actionJson || b.action) fields.actionJson = b.actionJson || b.action;
  if (fields.actionJson) {
    const byoErr = byoOnlyViolation(req, t.action_type, fields.actionJson);
    if (byoErr) return res.status(400).json({ error: byoErr, code: 'BYO_KEY_REQUIRED' });
  }
  try {
    const updated = db.updateTrigger(t.id, fields);
    res.json({ ok: true, data: serialize(updated) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

// DELETE /api/v1/triggers/:id
router.delete('/:id', (req, res) => {
  const t = ownedTrigger(req, res); if (!t) return;
  db.deleteTrigger(t.id);
  res.json({ ok: true });
});

// POST /api/v1/triggers/:id/run — run now (manual test)
router.post('/:id/run', async (req, res) => {
  const t = ownedTrigger(req, res); if (!t) return;
  const parse = (j, f) => { try { return j ? JSON.parse(j) : f; } catch { return f; } };
  const run = db.createTriggerRun({ triggerId: t.id, workspaceId: t.workspace_id, ownerId: t.owner_id, status: 'running', triggerKind: 'manual' });
  try {
    const result = await executeAction({
      ownerId: t.owner_id, workspaceId: t.workspace_id,
      actionType: t.action_type, action: parse(t.action_json, {}), actor: { triggerId: t.id, triggerName: t.name },
    });
    const finished = db.finishTriggerRun(run.id, result.ok ? 'done' : 'failed', result);
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, run: serializeRun(finished), result });
  } catch (e) {
    db.finishTriggerRun(run.id, 'failed', { error: e.message });
    res.status(500).json({ error: 'Run failed', message: e.message });
  }
});

// GET /api/v1/triggers/:id/runs
router.get('/:id/runs', (req, res) => {
  const t = ownedTrigger(req, res); if (!t) return;
  res.json({ ok: true, data: db.listTriggerRuns(t.id, req.query.limit).map(serializeRun) });
});

function serializeRun(r) {
  if (!r) return null;
  const parse = (j, f) => { try { return j ? JSON.parse(j) : f; } catch { return f; } };
  return {
    id: r.id, status: r.status, kind: r.trigger_kind,
    result: parse(r.result_json, null), attempts: r.attempts,
    createdAt: r.created_at, finishedAt: r.finished_at,
  };
}

module.exports = router;
