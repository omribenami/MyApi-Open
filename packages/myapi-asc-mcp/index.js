#!/usr/bin/env node
'use strict';

const { Server }               = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.MYAPI_BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
const KEY_FILE = path.join(os.homedir(), '.myapi', 'asc-mcp.json');

// Auth modes:
//   'asc'   (default) — Ed25519 signed requests. MYAPI_TOKEN is only used once
//           for registration. If that token is SCOPED (not master), the key is
//           permanently bound to those scopes server-side (least privilege).
//   'token' — plain Bearer auth with MYAPI_TOKEN on every request. No key, no
//           device approval (scoped tokens skip it). Right choice for handing
//           an agent a narrow, possibly short-lived scoped token.
const AUTH_MODE = (process.env.MYAPI_AUTH_MODE || 'asc').toLowerCase() === 'token' ? 'token' : 'asc';
const BEARER_TOKEN = process.env.MYAPI_TOKEN || null;
// Quick Connect: a one-time enrollment code minted on the dashboard. On first
// run the MCP exchanges it for a PRE-APPROVED registration of its locally
// generated Ed25519 key — no token ever reaches the agent, and the code is
// consumed (useless) after one use. Safe to leave in the config afterwards:
// the consumed code is recorded in the key file and never re-attempted.
// Setting a DIFFERENT code replaces this machine's key (and scope) entirely —
// a fresh keypair is enrolled and the server revokes the old one.
const ENROLL_CODE = process.env.MYAPI_ENROLL_CODE || null;

// ── Key management ────────────────────────────────────────────────────────────

function loadKey() {
  try { return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')); } catch { return null; }
}

function keyFingerprint(publicKeyBase64) {
  const raw = Buffer.from(publicKeyBase64, 'base64');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

function generateKeyData() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const rawPub    = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  const rawPubB64 = rawPub.toString('base64');
  const privPem   = privateKey.export({ format: 'pem', type: 'pkcs8' });
  const fingerprint = keyFingerprint(rawPubB64);
  return { publicKey: rawPubB64, privateKey: privPem, fingerprint, approved: false };
}

function saveKey(keyData) {
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify(keyData, null, 2), { mode: 0o600 });
}

function generateAndSaveKey() {
  const keyData = generateKeyData();
  saveKey(keyData);
  return keyData;
}

// ── HTTP — signed with Ed25519 ────────────────────────────────────────────────

function signedPayload(keyData) {
  const ts  = String(Math.floor(Date.now() / 1000));
  const fp  = keyFingerprint(keyData.publicKey);
  const msg = Buffer.from(`${ts}:${fp}`);
  const sig = crypto.sign(null, msg, crypto.createPrivateKey(keyData.privateKey)).toString('base64');
  return { ts, fp, sig };
}

function ascHeaders(keyData) {
  const { ts, sig } = signedPayload(keyData);
  return {
    'X-Agent-PublicKey': keyData.publicKey,
    'X-Agent-Signature': sig,
    'X-Agent-Timestamp': ts,
    'Content-Type':      'application/json',
  };
}

function bearerHeaders() {
  return { 'Authorization': `Bearer ${BEARER_TOKEN}`, 'Content-Type': 'application/json' };
}

async function rawApiCall(method, endpoint, body, keyData, query) {
  const headers = AUTH_MODE === 'token' ? bearerHeaders() : ascHeaders(keyData);
  let url = `${BASE_URL}/api/v1${endpoint}`;
  if (query && Object.keys(query).length) {
    url += '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(query).filter(([, v]) => v != null))
    ).toString();
  }
  const res  = await fetch(url, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// apiCall wraps rawApiCall with automatic self-restore on 401. The Ed25519 key is
// the permanent credential — any 401 with a structured asc_reason should be
// recoverable without user interaction, except `never_registered` which truly
// requires the dashboard approval flow.
async function apiCall(method, endpoint, body, keyData, query) {
  const first = await rawApiCall(method, endpoint, body, keyData, query);
  if (AUTH_MODE === 'token') return first; // bearer mode: no ASC restore path
  if (first.status !== 401) return first;

  const reason = first.data?.asc_reason;
  // Reasons that benefit from a /asc/restore round-trip: device_not_approved
  // means the device row is missing/revoked. Server tries to auto-restore inline
  // on the next signed request, but explicit /asc/restore also handles cases
  // where the row was hard-deleted and the inline restore failed.
  if (reason === 'device_not_approved') {
    const restored = await tryRestore(keyData);
    if (restored) {
      return rawApiCall(method, endpoint, body, keyData, query);
    }
  }

  return first;
}

function text(str) {
  return { content: [{ type: 'text', text: String(str) }] };
}

// ── Quick Connect enrollment ──────────────────────────────────────────────────

async function tryEnrollWithCode(keyData, previousKeyData) {
  try {
    const body = {
      code: ENROLL_CODE,
      public_key: keyData.publicKey,
      label: process.env.MYAPI_AGENT_LABEL || undefined,
    };
    // Prove ownership of the old key so the server revokes it — a new enroll
    // code REPLACES this machine's credential (and its scope), never adds to it.
    if (previousKeyData?.privateKey) {
      const { ts, sig } = signedPayload(previousKeyData);
      body.previous_public_key = previousKeyData.publicKey;
      body.previous_signature  = sig;
      body.previous_timestamp  = ts;
    }
    const res = await fetch(`${BASE_URL}/api/v1/agentic/asc/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status === 'approved') return { ok: true, scope: data.scope, replaced: data.replaced_fingerprint || null };
    return { ok: false, error: data.error || `HTTP ${res.status}`, nextAction: data.next_action };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Runs at most once per process: if MYAPI_ENROLL_CODE differs from the code that
// created the current key (recorded as keyData.enrollCode), the user minted a new
// code for this machine — enroll a FRESH key with the new code's scope and have
// the server revoke the old key. This is how scope gets narrowed (or widened)
// after the fact. A restart with the same already-consumed code is a no-op.
let enrollAttempted = false;
let enrollFailure   = null;
let enrollReplaced  = null;

async function ensureEnrolled() {
  const keyData = loadKey();
  if (!ENROLL_CODE || enrollAttempted) return keyData;
  if (keyData && keyData.enrollCode === ENROLL_CODE) return keyData;
  enrollAttempted = true;

  const newKey = generateKeyData();
  const enrolled = await tryEnrollWithCode(newKey, keyData?.approved ? keyData : null);
  if (enrolled.ok) {
    newKey.approved   = true;
    newKey.enrollCode = ENROLL_CODE;
    saveKey(newKey);
    enrolledThisSession = true;
    enrollReplaced = enrolled.replaced;
    return newKey;
  }
  enrollFailure = enrolled;
  return keyData;
}

// ── Self-restore ──────────────────────────────────────────────────────────────

async function tryRestore(keyData) {
  try {
    const { ts, sig } = signedPayload(keyData);
    const res = await fetch(`${BASE_URL}/api/v1/agentic/asc/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: keyData.publicKey, signature: sig, timestamp: ts }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.status === 'restored';
  } catch {
    return false;
  }
}

// ── Diagnose ──────────────────────────────────────────────────────────────────

async function callDiagnose(keyData) {
  try {
    const { ts, sig } = signedPayload(keyData);
    const res = await fetch(`${BASE_URL}/api/v1/agentic/asc/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: keyData.publicKey, signature: sig, timestamp: ts }),
    });
    return await res.json().catch(() => ({}));
  } catch (err) {
    return { error: err.message };
  }
}

// ── Status check ──────────────────────────────────────────────────────────────
// "active" requires a SIGNED probe to succeed — never just a key-status lookup.
// Returns: { approved: bool, reason?: string, diagnose?: object }

async function checkStatus(keyData) {
  // Make a signed probe call. If it returns 2xx, the connection is genuinely
  // working end-to-end. If it returns 401 with a structured reason, we surface
  // that reason directly. For anything else, fall back to /asc/diagnose for a
  // complete picture.
  // Probe /tokens/me/capabilities (not /identity): it works for FULL and
  // SCOPED credentials alike and returns the effective scope.
  const probe = await rawApiCall('GET', '/tokens/me/capabilities', null, keyData, {});
  if (probe.ok) return { approved: true, tokenInfo: probe.data?.token, capabilities: probe.data?.capabilities };

  if (probe.status === 401) {
    const reason = probe.data?.asc_reason || 'unknown';
    return { approved: false, reason, response: probe.data };
  }
  if (probe.status === 403 && probe.data?.feature === 'agentic_asc') {
    return { approved: false, reason: 'plan_required', response: probe.data };
  }

  // Unexpected — pull a diagnose to give the agent something actionable
  const diagnose = await callDiagnose(keyData);
  return { approved: false, reason: `http_${probe.status}`, response: probe.data, diagnose };
}

// ── MCP server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'myapi-asc-mcp', version: require('./package.json').version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'myapi_status',
      description:
        'CALL THIS FIRST on every new session. Verifies the ASC Ed25519 connection ' +
        'with a SIGNED probe (not just a key-existence lookup) and returns full ' +
        'operational context: identity, connected services, memory, and the API ' +
        'endpoint catalog. First-run setup, in priority order: (1) MYAPI_ENROLL_CODE ' +
        '(Quick Connect) — exchanges the one-time dashboard code for an instantly ' +
        'pre-approved key, zero further steps; (2) MYAPI_TOKEN — registers the keypair, ' +
        'user approves at ' + BASE_URL + '/dashboard/devices. Either way the Ed25519 key ' +
        'becomes the permanent credential. Requires a paid plan (Pro or Heavy).\n\n' +
        'SCOPED ACCESS: this MCP is NOT master-token-only. Two least-privilege options:\n' +
        '  1. Register with a SCOPED token (MYAPI_TOKEN = a token with e.g. services:gmail:read):\n' +
        '     the Ed25519 key is permanently bound to those scopes server-side.\n' +
        '  2. Set MYAPI_AUTH_MODE=token: every request uses MYAPI_TOKEN as a plain Bearer\n' +
        '     credential (no key, no device approval for scoped tokens).\n' +
        'Either way, myapi_status reports the effective scope — respect it: 403s outside\n' +
        'the grant are expected, not errors to retry.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'myapi_request',
      description:
        'Make any authenticated request to the MyApi API. Calls are signed with the ' +
        'ASC Ed25519 key (default) or sent with the Bearer token (MYAPI_AUTH_MODE=token). ' +
        'On 401 with asc_reason=device_not_approved, the MCP auto-restores and retries silently.\n\n' +
        'SCOPED CREDENTIALS: if myapi_status reported SCOPED access, only endpoints within ' +
        'the granted scopes work; everything else returns 403 by design. Check the scope ' +
        'list before calling, and surface missing scopes to the user instead of retrying.\n\n' +
        '⚠️ ALWAYS call myapi_status FIRST in a new session to verify the connection.\n' +
        '⚠️ If a request fails with an asc_reason you do not understand, call ' +
        'myapi_diagnose for a complete breakdown (clock skew, device status, plan).\n\n' +
        'KEY ENDPOINTS:\n' +
        '  GET  /gateway/context          — full context: identity + memory + services + endpoints\n' +
        '  GET  /identity                 — user identity (name, email, timezone, bio)\n' +
        '  PUT  /identity                 — update identity fields\n' +
        '  GET  /services                 — ALL services with status: native OAuth AND Composio-backed.\n' +
        '                                   Use the EXACT id from this list (e.g. gmail, notion, googlecalendar)\n' +
        '                                   — Composio services use their plain toolkit name, no prefix.\n' +
        '  GET  /services/{name}/methods  — documented operations for a service (call before first use)\n' +
        '  POST /services/{name}/proxy    — proxy any call to a connected service with body\n' +
        '                                   {path, method, body, query}. path = provider-native REST path.\n' +
        '                                   Works for native (e.g. /services/google/proxy) and Composio\n' +
        '                                   (e.g. /services/gmail/proxy) services alike.\n' +
        '  AFP — the user\'s OWN MACHINES (PCs/servers): file system + shell access.\n' +
        '  Use AFP whenever asked about the user\'s computer, server, docker, files, logs:\n' +
        '  GET  /afp/devices              — list registered machines (deviceId, name, platform, online)\n' +
        '  POST /afp/{deviceId}/exec      — run a shell command, body {cmd, cwd?, timeout?}\n' +
        '                                   e.g. {"cmd": "docker ps -a"} to check containers\n' +
        '  GET  /afp/{deviceId}/ls?path=  — list a directory;  /afp/{deviceId}/read?path= — read a file\n' +
        '  POST /afp/{deviceId}/write     — write a file, body {path, content}\n' +
        '  (AFP uses these direct routes — NOT /services/afp/proxy.)\n' +
        '  GET  /brain/knowledge-base     — user\'s knowledge base documents\n' +
        '  GET  /personas                 — AI personas defined by the user\n' +
        '  POST /memory                   — write a memory note that persists across sessions\n' +
        '  AUTOMATIONS — schedule proactive tasks MyApi runs on its own (Pro/Heavy plan):\n' +
        '  GET  /triggers                 — list the owner\'s automations\n' +
        '  POST /triggers                 — create one. Recommended shape:\n' +
        '                                   {name, kind:"schedule", schedule:{type:"daily",atHour:7,atMinute:0},\n' +
        '                                    timezone, actionType:"ai_prompt",\n' +
        '                                    action:{prompt:"plain-English task", services:["gmail","googlecalendar"]}}\n' +
        '                                   schedule.type ∈ once|interval|daily|weekly|monthly. ai_prompt runs an AI\n' +
        '                                   agent over the owner\'s CONNECTED services (it emails via their own mailbox).\n' +
        '  POST /triggers/{id}/run        — run an automation now (test); GET /triggers/{id}/runs — run history\n' +
        '  PATCH/DELETE /triggers/{id}    — edit / delete\n' +
        '  GET  /skills                   — available skills\n' +
        '  GET  /connectors               — OAuth connector status\n' +
        '  GET  /vault/tokens             — external API keys stored in the vault\n' +
        '  GET  /vault/credentials        — username/password credentials in the vault\n' +
        '  GET  /notifications            — user notifications\n' +
        '  GET  /export                   — export all user data\n\n' +
        'BROWSER-SESSION ENDPOINTS auto-rewritten to /identity for ASC: /auth/me, /users/me.\n' +
        'FORBIDDEN over ASC: /auth/login, /auth/logout, /auth/2fa/*, /auth/session-token, /oauth/*.\n\n' +
        'Do NOT prepend /api/v1 — it is added automatically.',
      inputSchema: {
        type: 'object',
        required: ['method', 'path'],
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method.' },
          path:   { type: 'string', description: 'API path starting with /. Do NOT include /api/v1.' },
          body:   { type: 'object', description: 'Request body for POST/PUT/PATCH.' },
          query:  { type: 'object', description: 'Query string parameters.' },
        },
      },
    },
    {
      name: 'myapi_diagnose',
      description:
        'Diagnose why an ASC request just failed. Returns clock skew vs. server, ' +
        'signature validity, device approval status, plan, and a one-line next_action ' +
        'string telling the agent exactly what to do. Call this when you see any ' +
        'unexpected 401/403 from myapi_request — it eliminates guesswork.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

// ── Tool: myapi_status ────────────────────────────────────────────────────────

function describeScope(tokenInfo) {
  const raw = tokenInfo?.scope;
  if (!raw || raw === 'full') return { scoped: false, list: [] };
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(list) ? { scoped: true, list } : { scoped: false, list: [] };
  } catch { return { scoped: true, list: [String(raw)] }; }
}

function scopeLines(tokenInfo) {
  const { scoped, list } = describeScope(tokenInfo);
  if (!scoped) return ['  Access:      FULL (master credential)'];
  return [
    `  Access:      SCOPED — this credential is limited to: ${list.join(', ')}`,
    '               Requests outside these scopes return 403. That is expected —',
    '               do NOT retry them; tell the user which scope is missing instead.',
  ];
}

// True once tryEnrollWithCode succeeded in this process — distinguishes "just
// enrolled" from "pre-existing approved key" in the status output below.
let enrolledThisSession = false;

async function handleStatus() {
  // ── Bearer/scoped-token mode: no key, no registration, no device approval ──
  if (AUTH_MODE === 'token') {
    if (!BEARER_TOKEN) {
      return text('MYAPI_AUTH_MODE=token requires MYAPI_TOKEN to be set in the MCP env config.');
    }
    const probe = await rawApiCall('GET', '/tokens/me/capabilities', null, null, {});
    if (!probe.ok) {
      return text([
        `⚠️ Bearer token rejected (${probe.status}).`,
        probe.data?.error || probe.data?.message || '',
        `Generate or check the token at ${BASE_URL}/dashboard/access-tokens.`,
      ].filter(Boolean).join('\n'));
    }
    const lines = [
      '✓ MyApi connection verified (Bearer token mode).',
      `  Server:      ${BASE_URL}`,
      ...scopeLines(probe.data?.token),
      '',
      'Use myapi_request for any API call.',
      '',
    ];
    const ctx = await rawApiCall('GET', '/gateway/context', null, null, {});
    if (ctx.ok && ctx.data) {
      lines.push('── User context ──────────────────────────────────────────');
      lines.push(JSON.stringify(ctx.data, null, 2));
    } else if (probe.data?.capabilities) {
      lines.push('── Token capabilities (context endpoint not in scope) ────');
      lines.push(JSON.stringify(probe.data.capabilities, null, 2));
    }
    return text(lines.join('\n'));
  }

  let keyData = (await ensureEnrolled()) || generateAndSaveKey();

  const status = await checkStatus(keyData);

  if (status.approved) {
    if (!keyData.approved) { keyData.approved = true; saveKey(keyData); }

    const scoped = describeScope(status.tokenInfo).scoped;
    const ctx = await apiCall('GET', '/gateway/context', null, keyData, {});

    const lines = [
      '✓ MyApi ASC connection verified (signed probe succeeded).',
      `  Fingerprint: ${keyFingerprint(keyData.publicKey)}`,
      `  Server:      ${BASE_URL}`,
      ...scopeLines(status.tokenInfo),
      ...(enrolledThisSession ? [
        '',
        '  Enrolled via Quick Connect — this key carries the code\'s access level.',
        ...(enrollReplaced ? [`  Previous key ${enrollReplaced} was revoked and replaced.`] : []),
      ] : []),
      ...(enrollFailure ? [
        '',
        `  Note: MYAPI_ENROLL_CODE is set but could not be consumed (${enrollFailure.error}).`,
        '  The access shown above comes from the previously enrolled key. To change this',
        '  machine\'s scope, mint a fresh code on the Connectors page and restart the MCP.',
      ] : []),
      '',
      'Use myapi_request for any API call. On unexpected failure, call myapi_diagnose.',
      '',
    ];

    if (!ctx.ok && scoped && status.capabilities) {
      lines.push('── Key capabilities (context endpoint not in scope) ─────');
      lines.push(JSON.stringify(status.capabilities, null, 2));
      return text(lines.join('\n'));
    }

    if (ctx.ok && ctx.data) {
      lines.push('── User context ──────────────────────────────────────────');
      lines.push(
        'For service calls (Google/GitHub/Slack/Notion/LinkedIn/...) ALWAYS consult ' +
        'connected_services BELOW first — each entry lists its proxy endpoint, exact ' +
        'paths, and request bodies. Do NOT invent paths.\n' +
        'Composio-backed services use their plain toolkit name (e.g. gmail, notion) — ' +
        'call them exactly like native services via ' +
        'POST /services/{name}/proxy with {path, method, body, query}, using the exact ' +
        'id from /services. If a service is missing here, GET /services lists everything.\n'
      );
      lines.push(JSON.stringify(ctx.data, null, 2));
    } else {
      lines.push('(Could not fetch gateway/context — call myapi_request GET /gateway/context to retry.)');
    }
    return text(lines.join('\n'));
  }

  // Not approved. Translate the structured reason to a single concrete next-action.
  const reason = status.reason;

  if (reason === 'device_not_approved') {
    // First-time registration path
    if (keyData.approved) { keyData.approved = false; saveKey(keyData); }

    // Quick Connect: enrollment already ran in ensureEnrolled(). Landing here
    // with ENROLL_CODE set means it failed (or the stored code's key was revoked
    // server-side) — surface why instead of silently falling through.
    if (ENROLL_CODE && !process.env.MYAPI_TOKEN) {
      const failure = enrollFailure
        || { error: 'this code was already used to enroll a key that is no longer approved' };
      return text([
        `⚠️ Quick Connect enrollment failed: ${failure.error}`,
        failure.nextAction ? `→ ${failure.nextAction}` : '→ Ask the user to generate a fresh code on the Connectors page (single-use, 15-minute expiry).',
      ].join('\n'));
    }

    const setupToken = process.env.MYAPI_TOKEN;
    if (!setupToken) {
      // Check if it's a brand-new key vs. one that was previously approved
      const diagnose = await callDiagnose(keyData);
      if (diagnose.device_status === 'revoked_restorable') {
        // tryRestore should have run already inside apiCall — surface why it failed
        return text([
          '⚠️ This key was previously approved but is currently revoked, and auto-restore failed.',
          `  Open ${BASE_URL}/dashboard/devices and re-approve fingerprint:`,
          `  ${keyFingerprint(keyData.publicKey)}`,
        ].join('\n'));
      }
      return text([
        '🔑 MyApi MCP setup required (one-time).',
        '',
        'MYAPI_TOKEN is not set. To finish setup:',
        `  1. Go to ${BASE_URL}/dashboard/access-tokens and create a personal token.`,
        '  2. Add it to your MCP config:',
        '       "env": { "MYAPI_TOKEN": "myapi_..." }',
        '  3. Restart your MCP and call myapi_status again.',
        '',
        'Once the key is approved, the token can be removed — the Ed25519 key is permanent.',
      ].join('\n'));
    }

    let regRes, regData;
    try {
      regRes = await fetch(`${BASE_URL}/api/v1/agentic/asc/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${setupToken}` },
        body: JSON.stringify({ public_key: keyData.publicKey, label: 'AI Agent (MCP)' }),
      });
      regData = await regRes.json().catch(() => ({}));
    } catch (err) {
      return text(`⚠️ Could not reach ${BASE_URL}. Check network and MYAPI_BASE_URL. (${err.message})`);
    }

    if (regRes.status === 401) {
      return text(`⚠️ MYAPI_TOKEN is invalid or revoked. Generate a new one at ${BASE_URL}/dashboard/access-tokens.`);
    }
    if (regRes.status === 403 && regData?.feature === 'agentic_asc') {
      return text([
        '🔒 Your MyApi plan does not include AI agent connections.',
        `Current plan: ${regData.plan}.`,
        regData.upgradeHint || 'Upgrade to Pro ($9/mo) or Heavy ($29/mo) to use MCP / ASC.',
      ].join('\n'));
    }
    if (regData?.status === 'already_approved') {
      keyData.approved = true; saveKey(keyData);
      return text('Connection active. Call myapi_status again to load full context.');
    }
    if (!regRes.ok) {
      return text(`⚠️ Registration failed (${regRes.status}): ${regData?.error || 'unknown error'}`);
    }
    const scopeNote = Array.isArray(regData?.scope)
      ? `This key will be SCOPED to: ${regData.scope.join(', ')} (inherited from the registering token).`
      : 'This key will have FULL account access (registered with a master token). To create a least-privilege agent instead, register with a scoped token from /dashboard/access-tokens.';
    return text([
      '⏳ MyApi setup: key submitted for approval.',
      '',
      scopeNote,
      '',
      `Ask the user to open ${BASE_URL}/dashboard/devices and click Approve.`,
      'Then call myapi_status again — the connection will be live automatically.',
      'After approval, MYAPI_TOKEN can be removed from your config (the key is permanent).',
      '',
      `Fingerprint: ${keyFingerprint(keyData.publicKey)}`,
    ].join('\n'));
  }

  if (reason === 'timestamp_stale') {
    const skew = status.response?.skew_seconds;
    return text([
      `⏱️  Clock skew detected (${skew}s). The agent host clock is too far from the server.`,
      'Fix: run `sudo systemctl restart systemd-timesyncd` (or your platform\'s NTP equivalent).',
      `Server time: ${status.response?.server_time}`,
    ].join('\n'));
  }

  if (reason === 'signature_invalid' || reason === 'publickey_invalid') {
    return text([
      `⚠️ Signed request rejected: ${reason}.`,
      'The Ed25519 key on this host appears corrupted.',
      `Delete ${KEY_FILE} and run myapi_status again to regenerate.`,
    ].join('\n'));
  }

  if (reason === 'plan_required') {
    return text([
      '🔒 ASC requires a paid plan (Pro or Heavy).',
      status.response?.upgradeHint || `Upgrade at ${BASE_URL}/dashboard/billing.`,
    ].join('\n'));
  }

  // Fallback — surface diagnose
  const diagnose = status.diagnose || (await callDiagnose(keyData));
  return text([
    `⚠️ ASC connection not active (reason: ${reason}).`,
    'Diagnose report:',
    JSON.stringify(diagnose, null, 2),
  ].join('\n'));
}

// ── Tool: myapi_request ───────────────────────────────────────────────────────

const FORBIDDEN = [
  /^\/auth\/login\b/,
  /^\/auth\/logout\b/,
  /^\/auth\/2fa\//,
  /^\/auth\/session-token\b/,
  /^\/oauth\//,
];

async function handleRequest(args) {
  let keyData = null;
  if (AUTH_MODE === 'token') {
    if (!BEARER_TOKEN) return text('MYAPI_AUTH_MODE=token requires MYAPI_TOKEN. Fix the MCP env config.');
  } else {
    keyData = await ensureEnrolled();
    if (!keyData?.approved) {
      return text('Not connected. Call myapi_status first to complete setup.');
    }
  }

  const { method, path: reqPath, body, query } = args || {};
  if (!method || !reqPath) return text('method and path are required.');
  if (!reqPath.startsWith('/')) return text('path must start with /');

  if (FORBIDDEN.some((rx) => rx.test(reqPath))) {
    return text(
      `⛔ ${reqPath} is a browser-session-only endpoint. Use /identity (user info) or ` +
      '/gateway/context (full context). The Ed25519 key authenticates every signed request — ' +
      'no /auth/* endpoint is needed.'
    );
  }

  const res = await apiCall(method, reqPath, body || null, keyData, query || {});

  // 401 with a structured asc_reason — surface concretely and persist key state.
  if (res.status === 401 && res.data?.asc_reason) {
    if (res.data.asc_reason === 'device_not_approved') {
      keyData.approved = false; saveKey(keyData);
    }
    return text([
      `⚠️ ASC request rejected (${res.data.asc_reason}).`,
      res.data.message || '',
      res.data.next_action ? `→ ${res.data.next_action}` : '',
      '',
      'Call myapi_diagnose for full details, or myapi_status to retry / recover.',
    ].filter(Boolean).join('\n'));
  }

  if (res.status === 403 && res.data?.feature) {
    return text([
      `🔒 ${res.data.error || 'Feature not available on current plan.'}`,
      `Plan: ${res.data.plan || 'unknown'}.`,
      res.data.upgradeHint || `Upgrade at ${BASE_URL}/dashboard/billing.`,
    ].join('\n'));
  }

  // 403 from the scope validator: the credential is scoped and this endpoint is
  // outside its grant. Explain instead of dumping raw JSON — the agent should
  // relay the missing scope to the user, not retry.
  if (res.status === 403) {
    const msg = res.data?.message || res.data?.error || '';
    if (/scope|permission|not allowed|forbidden/i.test(JSON.stringify(res.data || {}))) {
      return text([
        `🔒 403 — this credential is SCOPED and "${args.method} ${args.path}" is outside its grant.`,
        msg,
        res.data?.requiredScopes ? `Required: ${JSON.stringify(res.data.requiredScopes)}` : '',
        '',
        'Do not retry. Either work within the granted scopes (myapi_status lists them),',
        `or ask the user to issue a broader token at ${BASE_URL}/dashboard/access-tokens.`,
      ].filter(Boolean).join('\n'));
    }
  }

  return text(JSON.stringify(res.data, null, 2));
}

// ── Tool: myapi_diagnose ──────────────────────────────────────────────────────

async function handleDiagnose() {
  if (AUTH_MODE === 'token') {
    const probe = await rawApiCall('GET', '/tokens/me/capabilities', null, null, {});
    return text([
      '── Bearer-mode diagnose ──',
      `Server:       ${BASE_URL}`,
      `Token set:    ${BEARER_TOKEN ? 'yes' : 'NO — set MYAPI_TOKEN'}`,
      `Probe status: ${probe.status}`,
      `Scope:        ${probe.data?.token?.scope ?? 'unknown'}`,
      probe.ok ? '→ Connection healthy.' : `→ ${probe.data?.error || probe.data?.message || 'Token rejected — regenerate at /dashboard/access-tokens.'}`,
    ].join('\n'));
  }
  const keyData = loadKey();
  if (!keyData) {
    return text('No local ASC key found. Call myapi_status to generate one.');
  }
  const report = await callDiagnose(keyData);
  const lines = [
    '── ASC Diagnose ──',
    `Server:                ${BASE_URL}`,
    `Fingerprint:           ${report.key_fingerprint || keyFingerprint(keyData.publicKey)}`,
    `Server time:           ${report.server_time}`,
    `Clock skew (s):        ${report.clock_skew_seconds}`,
    `Replay window (s):     ${report.replay_window_seconds}`,
    `Timestamp valid:       ${report.timestamp_valid}`,
    `Signature valid:       ${report.signature_valid}`,
    `Device status:         ${report.device_status}`,
    `Plan:                  ${report.plan || 'unknown'}`,
    '',
    `→ ${report.next_action || 'No action suggested.'}`,
  ];
  return text(lines.join('\n'));
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  if (name === 'myapi_status')   return handleStatus();
  if (name === 'myapi_request')  return handleRequest(args);
  if (name === 'myapi_diagnose') return handleDiagnose();
  return text(`Unknown tool: ${name}`);
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
