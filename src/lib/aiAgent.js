'use strict';

/**
 * Headless AI agent loop for AI-powered automations (ai_prompt actions).
 *
 * Provider-agnostic: Anthropic (Messages API), OpenAI and OpenRouter (both
 * OpenAI-compatible chat-completions). The model is given two owner-scoped
 * tools (call_service, run_shell) that reuse the exact executor paths as
 * deterministic automations, so every action is scoped to the trigger owner
 * and audited the same way.
 *
 * Each provider works in two key modes:
 *   - 'platform' : MyApi-provided key from env (ANTHROPIC/OPENAI/OPENROUTER_API_KEY).
 *   - 'byo'      : the user's own key for that provider, stored encrypted per user.
 *
 * The final assistant text is returned and delivered to the user as a
 * notification by the caller.
 */

const Anthropic = require('@anthropic-ai/sdk');
const db = require('../database');
const emailService = require('../services/emailService');
const { isComposioConnectedService, proxyComposioService } = require('../services/composio-integration');
const { executeServiceProxyAction, executeAfpExecAction } = require('./actionExecutor');

// Connected services that mean "send mail through the user's own mailbox".
const EMAIL_SLUGS = ['gmail', 'googlemail'];

// Build a Gmail API `raw` payload (base64url RFC 2822) for an HTML email.
function buildGmailRaw(to, subject, html) {
  const b64 = Buffer.from(String(html), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  const mime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '', b64,
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const MAX_TOOL_ITERATIONS = 5;     // bounded agentic loop (was 8)
const MAX_TOKENS = 4000;           // per-response output cap (was 16000) — summaries/notify don't need more
const TOOL_RESULT_CAP = 6000;
const PREF_KEY = 'automationAi'; // user_preferences slot: { [provider]: {keyEnc,last4,...} }

// ── Provider registry ─────────────────────────────────────────────────────────
// defaultModel is intentionally a CHEAP model: automations (summaries, reminders,
// digests) don't need a frontier model, and the platform pays for MyApi-mode runs.
// Power users can override per-automation via action.model with their own key.
const PROVIDERS = {
  anthropic: {
    label: 'Anthropic', env: 'ANTHROPIC_API_KEY', defaultModel: 'claude-haiku-4-5', kind: 'anthropic', baseURL: null,
    models: [
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', tier: 'cheapest' },
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', tier: 'balanced' },
      { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'most capable' },
    ],
  },
  openai: {
    label: 'OpenAI', env: 'OPENAI_API_KEY', defaultModel: 'gpt-4o-mini', kind: 'openai', baseURL: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'cheapest' },
      { id: 'gpt-4o', label: 'GPT-4o', tier: 'balanced' },
    ],
  },
  openrouter: {
    label: 'OpenRouter', env: 'OPENROUTER_API_KEY', defaultModel: 'openai/gpt-4o-mini', kind: 'openai', baseURL: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', tier: 'cheapest' },
      { id: 'openai/gpt-4o', label: 'GPT-4o', tier: 'balanced' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', tier: 'balanced' },
    ],
  },
};
const DEFAULT_PROVIDER = 'anthropic';

function normalizeProvider(p) {
  return PROVIDERS[p] ? p : DEFAULT_PROVIDER;
}

// Validate a key looks right for its provider (cheap guard, not authoritative).
function validateKeyForProvider(provider, key) {
  const k = String(key || '').trim();
  if (provider === 'anthropic') return /^sk-ant-/.test(k);
  if (provider === 'openrouter') return /^sk-or-/.test(k);
  if (provider === 'openai') return /^sk-/.test(k) && !/^sk-ant-/.test(k) && !/^sk-or-/.test(k);
  return false;
}

// ── BYO key storage (encrypted at rest, reusing the master-token cipher) ──────
function readSlot(userId) {
  const slot = (db.getUserPreferences(userId) || {})[PREF_KEY] || {};
  // Back-compat: an old single-key shape ({keyEnc,last4}) is treated as anthropic.
  if (slot.keyEnc && !slot.anthropic) return { anthropic: { keyEnc: slot.keyEnc, last4: slot.last4, updatedAt: slot.updatedAt } };
  return slot;
}

function setUserModelKey(userId, provider, rawKey) {
  const p = normalizeProvider(provider);
  const prefs = db.getUserPreferences(userId) || {};
  const slot = readSlot(userId);
  if (!rawKey) {
    delete slot[p];
  } else {
    const enc = db.encryptRawToken(String(rawKey).trim());
    if (!enc) throw new Error('Server is missing an encryption key; cannot store the model key.');
    slot[p] = { keyEnc: enc, last4: String(rawKey).trim().slice(-4), updatedAt: new Date().toISOString() };
  }
  prefs[PREF_KEY] = slot;
  db.setUserPreferences(userId, prefs);
  return { provider: p, configured: !!rawKey };
}

function getUserModelKey(userId, provider) {
  const slot = readSlot(userId)[normalizeProvider(provider)];
  if (!slot || !slot.keyEnc) return null;
  return db.decryptRawToken(slot.keyEnc);
}

// Per-provider settings summary for the UI.
function getAiSettings(userId) {
  const slot = readSlot(userId);
  const providers = {};
  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    const byoSlot = slot[id];
    providers[id] = {
      label: cfg.label,
      defaultModel: cfg.defaultModel,
      models: cfg.models || [],
      platformAvailable: !!String(process.env[cfg.env] || '').trim(),
      byo: byoSlot && byoSlot.keyEnc ? { configured: true, last4: byoSlot.last4 || null, updatedAt: byoSlot.updatedAt || null } : { configured: false },
    };
  }
  return { providers, defaultProvider: DEFAULT_PROVIDER };
}

function resolveApiKey(ownerId, keyMode, provider) {
  const cfg = PROVIDERS[provider];
  if (keyMode === 'byo') {
    const key = getUserModelKey(ownerId, provider);
    if (!key) return { error: `No personal ${cfg.label} key on file. Add one in Automations settings, or use the MyApi-provided ${cfg.label} agent.` };
    return { key };
  }
  const key = String(process.env[cfg.env] || '').trim();
  if (!key) return { error: `The MyApi ${cfg.label} agent is not configured on this server (${cfg.env} unset). Use a personal key (BYO) instead.` };
  return { key };
}

// ── Provider-neutral tool specs ───────────────────────────────────────────────
const TOOL_SPECS = [
  {
    name: 'call_service',
    description: 'Call one of the user\'s connected services (e.g. gmail, googlecalendar, slack, github, notion) through MyApi. Use the toolkit slug as the service name. Returns the upstream JSON response.',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Connected service slug, e.g. "gmail" or "googlecalendar".' },
        path: { type: 'string', description: 'API path/endpoint relative to the service, e.g. "/messages".' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method. Defaults to GET.' },
        body: { type: 'object', description: 'Request body for write methods.' },
        query: { type: 'object', description: 'Query-string parameters.' },
      },
      required: ['service'],
    },
  },
  {
    name: 'run_shell',
    description: 'Run a shell command on one of the user\'s registered devices via the AFP daemon. Only use a deviceId the user provided in the task. Returns stdout/stderr/exit code.',
    parameters: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'AFP device id (afp_...).' },
        cmd: { type: 'string', description: 'Shell command to run.' },
        cwd: { type: 'string', description: 'Working directory (optional).' },
      },
      required: ['deviceId', 'cmd'],
    },
  },
  {
    name: 'send_email',
    description: 'Email the user (or a given address). The email is automatically wrapped in the MyApi-branded template, so provide PLAIN TEXT in `body` — do NOT include HTML, headers, or build a raw MIME message, and do NOT use call_service/Gmail to send. This is the only correct way to send email from an automation.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email. Omit to send to the account owner.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Plain-text email body (the MyApi template adds branding around it).' },
      },
      required: ['subject', 'body'],
    },
  },
];
const ANTHROPIC_TOOLS = TOOL_SPECS.map((s) => ({ name: s.name, description: s.description, input_schema: s.parameters }));
const OPENAI_TOOLS = TOOL_SPECS.map((s) => ({ type: 'function', function: { name: s.name, description: s.description, parameters: s.parameters } }));

function capJson(obj) {
  let s;
  try { s = JSON.stringify(obj); } catch { return '[unserializable result]'; }
  return s.length > TOOL_RESULT_CAP ? s.slice(0, TOOL_RESULT_CAP) + '…[truncated]' : s;
}

async function runTool(ownerId, name, input, ctx = {}) {
  if (name === 'call_service') {
    return executeServiceProxyAction(ownerId, {
      service: input.service, path: input.path,
      method: input.method, body: input.body, query: input.query,
    });
  }
  if (name === 'run_shell') {
    return executeAfpExecAction(ownerId, { deviceId: input.deviceId, cmd: input.cmd, cwd: input.cwd });
  }
  if (name === 'send_email') {
    const to = String(input.to || '').trim() || ctx.ownerEmail;
    if (!to) return { ok: false, statusCode: 400, error: 'No recipient — the account has no email on file; ask the user to provide one.' };
    const subject = String(input.subject || '').trim() || 'Your MyApi automation';
    const body = String(input.body || '');

    // Automations act between the user's CONNECTED services — email goes through
    // the user's own mailbox (Gmail), never MyApi's own mail infrastructure.
    let via = ctx.emailVia;
    try { if (!via && await isComposioConnectedService(ownerId, 'gmail')) via = 'gmail'; } catch (_) {}
    if (!via) {
      return { ok: false, statusCode: 409, error: 'No email service is connected. Connect Gmail (and select it in the automation) to send email.' };
    }
    const html = emailService.buildAutomationEmailHtml(subject, body, ctx.automationName);
    const raw = buildGmailRaw(to, subject, html);
    const r = await proxyComposioService({
      userId: ownerId, serviceName: via,
      apiPath: '/gmail/v1/users/me/messages/send', httpMethod: 'POST', reqBody: { raw },
    });
    if (r.ok) return { ok: true, statusCode: 200, data: { sent: true, to, via } };
    return { ok: false, statusCode: r.statusCode || 502, error: r.error?.message || r.error || 'Email send via connected service failed' };
  }
  return { ok: false, statusCode: 400, error: `Unknown tool '${name}'` };
}

const SYSTEM_PROMPT = [
  'You are MyApi\'s automation agent. You run unattended, on a schedule or trigger, on behalf of one user.',
  'You act only through the provided tools, which are already scoped to this user\'s connected services and devices.',
  'Be decisive: when you have enough information to act, act. Do not ask questions — the user is not watching.',
  'For minor choices, pick a reasonable option and proceed. Do not take destructive actions (delete, send irreversibly) unless the task explicitly asks for them.',
  '',
  'You only ever act through the user\'s connected services — never any MyApi system infrastructure.',
  'To EMAIL, ALWAYS use the send_email tool with a plain-text body — it sends through the user\'s own connected mailbox (e.g. Gmail) and applies the MyApi-branded template automatically. Never build a raw MIME message yourself. If send_email reports that no email service is connected, say so in your summary rather than trying another route.',
  '',
  'call_service makes a REAL HTTP request to the service\'s own REST API (it is a raw proxy). Use the provider\'s official endpoint path and request body. Common recipes:',
  '• Gmail — read: GET /gmail/v1/users/me/messages?q=is:unread ; then GET /gmail/v1/users/me/messages/{id}. (To send mail, use the send_email tool, not Gmail.)',
  '• Google Calendar — today\'s events: GET /calendar/v3/calendars/primary/events with query {timeMin, timeMax, singleEvents:"true", orderBy:"startTime"} (RFC3339 times).',
  '• Slack — post a message: POST /chat.postMessage with body {channel, text}.',
  'If a call returns an error, read it and correct the path or body before giving up.',
  '',
  'When done, end with a short plain-language summary of what you did and any result the user needs — this message is delivered to the user as a notification. Lead with the outcome. If something failed, say so plainly.',
].join('\n');

// Thinking/effort params are model-dependent: Haiku rejects both; Fable has
// thinking always-on (omit the param); Opus/Sonnet-4.6 take adaptive + effort.
function anthropicExtras(model) {
  const m = String(model).toLowerCase();
  if (m.includes('haiku')) return {};
  if (m.includes('fable') || m.includes('mythos')) return { output_config: { effort: 'medium' } };
  return { thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } };
}

// ── Anthropic Messages loop ───────────────────────────────────────────────────
async function runAnthropic({ apiKey, model, ownerId, task, ctx = {} }) {
  const client = new Anthropic({ apiKey });
  const messages = [{ role: 'user', content: task }];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let toolCalls = 0, finalText = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let resp;
    try {
      resp = await client.messages.create({
        model, max_tokens: MAX_TOKENS,
        ...anthropicExtras(model),
        system: SYSTEM_PROMPT, tools: ANTHROPIC_TOOLS, messages,
      });
    } catch (err) {
      return { ok: false, statusCode: err?.status || 502, error: `Model request failed: ${err?.message || err}`, usage, iterations: i, toolCalls };
    }
    usage.input_tokens += resp.usage?.input_tokens || 0;
    usage.output_tokens += resp.usage?.output_tokens || 0;
    if (resp.stop_reason === 'refusal') return { ok: false, statusCode: 200, error: 'The AI declined this task for safety reasons.', usage, iterations: i + 1, toolCalls };

    const text = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (text) finalText = text;
    const toolUses = (resp.content || []).filter((b) => b.type === 'tool_use');
    if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { ok: true, statusCode: 200, text: finalText || '(no output)', usage, iterations: i + 1, toolCalls };
    }
    messages.push({ role: 'assistant', content: resp.content });
    const results = [];
    for (const tu of toolUses) {
      toolCalls += 1;
      let out;
      try { out = await runTool(ownerId, tu.name, tu.input || {}, ctx); } catch (e) { out = { ok: false, error: e.message }; }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: capJson(out), is_error: !out.ok });
    }
    messages.push({ role: 'user', content: results });
  }
  return { ok: true, statusCode: 200, text: finalText || '(reached step limit)', usage, iterations: MAX_TOOL_ITERATIONS, toolCalls, hitLimit: true };
}

// ── OpenAI-compatible chat-completions loop (OpenAI + OpenRouter) ─────────────
async function runOpenAiCompatible({ apiKey, baseURL, model, ownerId, task, extraHeaders = {}, ctx = {} }) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: task }];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let toolCalls = 0, finalText = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let data;
    try {
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages, tools: OPENAI_TOOLS, tool_choice: 'auto' }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        return { ok: false, statusCode: resp.status, error: `Model request failed (${resp.status}): ${body.slice(0, 200)}`, usage, iterations: i, toolCalls };
      }
      data = await resp.json();
    } catch (err) {
      return { ok: false, statusCode: 502, error: `Model request failed: ${err.message}`, usage, iterations: i, toolCalls };
    }
    usage.input_tokens += data.usage?.prompt_tokens || 0;
    usage.output_tokens += data.usage?.completion_tokens || 0;

    const msg = data.choices?.[0]?.message;
    if (!msg) return { ok: false, statusCode: 502, error: 'Empty model response', usage, iterations: i + 1, toolCalls };
    if (typeof msg.content === 'string' && msg.content.trim()) finalText = msg.content.trim();

    const calls = msg.tool_calls || [];
    if (calls.length === 0) return { ok: true, statusCode: 200, text: finalText || '(no output)', usage, iterations: i + 1, toolCalls };

    messages.push(msg); // assistant turn carrying tool_calls
    for (const c of calls) {
      toolCalls += 1;
      let args = {};
      try { args = JSON.parse(c.function?.arguments || '{}'); } catch { /* leave empty */ }
      let out;
      try { out = await runTool(ownerId, c.function?.name, args, ctx); } catch (e) { out = { ok: false, error: e.message }; }
      messages.push({ role: 'tool', tool_call_id: c.id, content: capJson(out) });
    }
  }
  return { ok: true, statusCode: 200, text: finalText || '(reached step limit)', usage, iterations: MAX_TOOL_ITERATIONS, toolCalls, hitLimit: true };
}

/**
 * @param {object} a
 * @param {string} a.ownerId
 * @param {string} a.workspaceId
 * @param {string} a.prompt
 * @param {string} [a.provider]  'anthropic' | 'openai' | 'openrouter'
 * @param {string} [a.model]
 * @param {string} [a.keyMode]   'platform' | 'byo'
 */
async function runAiPrompt({ ownerId, workspaceId, prompt, service, services, provider, model, keyMode = 'platform', automationName }) {
  const instruction = String(prompt || '').trim();
  if (!instruction) return { ok: false, statusCode: 400, error: 'ai_prompt action needs a non-empty prompt', usage: {}, iterations: 0, toolCalls: 0 };
  // Which connected services this automation may use (one or many).
  const list = (Array.isArray(services) ? services : [])
    .concat(service ? [service] : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
  const svcLine = list.length
    ? `This automation can use these connected services — call the call_service tool with the matching service slug for each: ${list.join(', ')}.\n\n`
    : '';
  const task = `${svcLine}Task: ${instruction}`;

  const providerId = normalizeProvider(provider);
  const cfg = PROVIDERS[providerId];
  const resolved = resolveApiKey(ownerId, keyMode === 'byo' ? 'byo' : 'platform', providerId);
  if (resolved.error) return { ok: false, statusCode: 412, error: resolved.error, usage: {}, iterations: 0, toolCalls: 0 };

  const usedModel = String(model || cfg.defaultModel);
  let ownerEmail = null;
  try { ownerEmail = db.getUserById(ownerId)?.email || null; } catch { /* best-effort */ }
  // If the automation includes the user's own mailbox, send email through it.
  const emailVia = list.find((s) => EMAIL_SLUGS.includes(String(s).toLowerCase())) || null;
  const ctx = { ownerEmail, automationName: automationName || null, emailVia };

  let result;
  if (cfg.kind === 'anthropic') {
    result = await runAnthropic({ apiKey: resolved.key, model: usedModel, ownerId, task, ctx });
  } else {
    const extraHeaders = providerId === 'openrouter'
      ? { 'HTTP-Referer': 'https://myapiai.com', 'X-Title': 'MyApi Automations' }
      : {};
    result = await runOpenAiCompatible({ apiKey: resolved.key, baseURL: cfg.baseURL, model: usedModel, ownerId, task, extraHeaders, ctx });
  }
  return { ...result, provider: providerId, model: usedModel };
}

module.exports = {
  runAiPrompt, setUserModelKey, getUserModelKey, getAiSettings,
  validateKeyForProvider, normalizeProvider, PROVIDERS, DEFAULT_PROVIDER,
};
