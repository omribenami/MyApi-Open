/**
 * Agentic Connection Routes
 * Handles OAuth Device Flow (RFC 8628) and ASC (Agentic Secure Connection)
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../database');
const logger = require('../utils/logger');
const { resolveRequesterPlan } = require('../lib/planEnforcement');

function requireAuth(req, res, next) {
  const userId = req.user?.id || req.tokenMeta?.ownerId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = userId;
  next();
}

// Agentic MCP/ASC is a paid feature: Pro or Heavy (plan id 'enterprise').
function requireAgenticPlan(req, res, next) {
  const plan = resolveRequesterPlan(req);
  if (plan !== 'pro' && plan !== 'enterprise' && plan !== 'beta') {
    return res.status(403).json({
      error: 'Agentic connections (MCP / ASC) require a Pro or Heavy plan',
      plan,
      feature: 'agentic_asc',
      upgradeHint: 'Upgrade to Pro ($9/mo) or Heavy ($29/mo) to use AI agent connections',
    });
  }
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateUserCode() {
  // Format: XXXX-XXXX (8 uppercase letters, easy to type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity
  const pick = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${pick()}-${pick()}`;
}

/**
 * Resolve the scope list a chosen token would bind onto an agent key.
 * Returns null for full access (master token / no binding), an array of scope
 * names otherwise. Throws { status, message } style errors via callback result.
 */
function resolveBindTokenScope(userId, bindTokenId) {
  const bindRow = db.db.prepare(
    'SELECT id, owner_id, scope, token_type, revoked_at FROM access_tokens WHERE id = ?'
  ).get(bindTokenId);
  if (!bindRow || String(bindRow.owner_id) !== String(userId)) {
    return { error: { status: 404, message: 'bind_token_id does not match any of your tokens' } };
  }
  if (bindRow.revoked_at) {
    return { error: { status: 400, message: 'Cannot bind to a revoked token — pick an active scoped token' } };
  }
  if (bindRow.scope === 'full' || bindRow.token_type === 'master') {
    return { scope: null }; // explicit full access
  }
  const scopeSet = new Set();
  if (typeof bindRow.scope === 'string' && bindRow.scope.startsWith('[')) {
    try { for (const s of JSON.parse(bindRow.scope)) if (typeof s === 'string') scopeSet.add(s); } catch (_) {}
  }
  try { for (const s of db.getTokenScopes(bindRow.id)) scopeSet.add(s); } catch (_) {}
  if (scopeSet.size === 0) {
    return { error: { status: 400, message: 'Selected token has no resolvable scopes' } };
  }
  return { scope: [...scopeSet] };
}

function ed25519KeyFingerprint(publicKeyBase64) {
  const raw = Buffer.from(publicKeyBase64, 'base64');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

// ─── OAuth Device Flow (RFC 8628) ─────────────────────────────────────────────

/**
 * POST /api/v1/agentic/device/authorize
 * AI agent initiates device flow. Requires a Bearer token so the platform
 * knows which account to link the new agent token to.
 *
 * Body: { label: "My Claude Agent", scope?: "read" }
 */
router.post('/device/authorize', requireAuth, requireAgenticPlan, (req, res) => {
  try {
    const { label, scope } = req.body || {};
    const clientId = label || 'AI Agent';

    const id = `dc_${crypto.randomBytes(16).toString('hex')}`;
    const deviceCode = crypto.randomBytes(32).toString('hex');
    const userCode = generateUserCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    // Store the requesting user_id so we know which account to provision under
    const row = { id, deviceCode, userCode, clientId, scope, expiresAt };
    db.createDeviceCode(row);
    // Pre-link to the authenticated user so /activate knows whose account this is
    db.db.prepare('UPDATE oauth_device_codes SET user_id = ? WHERE id = ?').run(String(req.userId), id);

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${baseUrl}/dashboard/activate`,
      verification_uri_complete: `${baseUrl}/dashboard/activate?code=${userCode}`,
      expires_in: 900,
      interval: 5,
    });
  } catch (err) {
    logger.error('[DeviceFlow] authorize error:', err.message);
    res.status(500).json({ error: 'Failed to create device authorization' });
  }
});

/**
 * POST /api/v1/agentic/device/token
 * AI agent polls for the access token after user approves.
 * Public endpoint.
 *
 * Body: { device_code, client_id }
 */
router.post('/device/token', (req, res) => {
  try {
    const { device_code } = req.body || {};
    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    db.expireOldDeviceCodes();
    const code = db.getDeviceCodeByDeviceCode(device_code);

    if (!code) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Device code not found or expired' });
    }

    if (code.status === 'expired' || new Date(code.expires_at) < new Date()) {
      return res.status(400).json({ error: 'expired_token', error_description: 'Device code has expired. Please start the flow again.' });
    }
    if (code.status === 'denied') {
      return res.status(400).json({ error: 'access_denied', error_description: 'The user denied this request.' });
    }
    if (code.status === 'pending') {
      return res.status(428).json({ error: 'authorization_pending', error_description: 'The user has not yet approved this request.' });
    }
    if (code.status === 'approved' && code.access_token_id) {
      // Decrypt the stored token and return it to the agent
      const tokenRow = db.db.prepare('SELECT encrypted_token, label, scope FROM access_tokens WHERE id = ?').get(code.access_token_id);
      if (!tokenRow) {
        return res.status(500).json({ error: 'server_error', error_description: 'Token not found' });
      }
      let rawToken;
      try {
        rawToken = db.decryptRawToken(tokenRow.encrypted_token);
      } catch {
        return res.status(500).json({ error: 'server_error', error_description: 'Failed to retrieve token' });
      }
      return res.json({
        access_token: rawToken,
        token_type: 'Bearer',
        scope: tokenRow.scope,
        label: tokenRow.label,
      });
    }

    return res.status(500).json({ error: 'server_error', error_description: 'Unexpected state' });
  } catch (err) {
    logger.error('[DeviceFlow] token error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * GET /api/v1/agentic/device/pending
 * Dashboard: list pending device codes waiting for user approval.
 */
router.get('/device/pending', requireAuth, (req, res) => {
  try {
    db.expireOldDeviceCodes();
    const codes = db.getPendingDeviceCodes(req.userId);
    res.json({ codes });
  } catch (err) {
    logger.error('[DeviceFlow] pending error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pending device codes' });
  }
});

/**
 * POST /api/v1/agentic/device/approve/:id
 * Dashboard: user approves a pending device code → issues a scoped access token.
 *
 * Body: { label?, scope? }
 */
router.post('/device/approve/:id', requireAuth, requireAgenticPlan, (req, res) => {
  try {
    const code = db.db.prepare('SELECT * FROM oauth_device_codes WHERE id = ?').get(req.params.id);
    if (!code) return res.status(404).json({ error: 'Device code not found' });
    if (code.status !== 'pending') return res.status(400).json({ error: `Already ${code.status}` });
    if (new Date(code.expires_at) < new Date()) return res.status(410).json({ error: 'Device code expired' });

    const { label, scope } = req.body || {};
    const tokenLabel = label || `${code.client_id} (Device Flow)`;
    const tokenScope = scope || code.scope || 'full';

    // Create a properly hashed + encrypted scoped access token for this agent
    const tokenValue = `myapi_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = bcrypt.hashSync(tokenValue, 10);
    // createAccessToken(hash, ownerId, scope, label, expiresAt, allowedPersonas, workspaceId, rawToken, tokenType)
    const tokenId = db.createAccessToken(tokenHash, String(req.userId), tokenScope, tokenLabel, null, null, null, tokenValue, 'agent');

    db.approveDeviceCode(code.id, String(req.userId), tokenId);

    db.createAuditLog({
      requesterId: req.userId,
      action: 'device_flow_approved',
      resource: 'access_token',
      scope: tokenId,
      ip: req.ip,
      details: { client_id: code.client_id, label: tokenLabel, scope: tokenScope },
    });

    res.json({ success: true, message: 'Device approved and token issued.' });
  } catch (err) {
    logger.error('[DeviceFlow] approve error:', err.message);
    res.status(500).json({ error: 'Failed to approve device code' });
  }
});

/**
 * POST /api/v1/agentic/device/deny/:id
 * Dashboard: user denies a pending device code.
 */
router.post('/device/deny/:id', requireAuth, (req, res) => {
  try {
    const code = db.db.prepare('SELECT * FROM oauth_device_codes WHERE id = ?').get(req.params.id);
    if (!code) return res.status(404).json({ error: 'Device code not found' });
    if (code.status !== 'pending') return res.status(400).json({ error: `Already ${code.status}` });

    db.denyDeviceCode(code.id);
    res.json({ success: true });
  } catch (err) {
    logger.error('[DeviceFlow] deny error:', err.message);
    res.status(500).json({ error: 'Failed to deny device code' });
  }
});

// ─── ASC (Agentic Secure Connection) ─────────────────────────────────────────

/**
 * POST /api/v1/agentic/asc/register
 * Requires a Bearer token (the user's personal access token). The token identifies
 * the account that owns the agent and gates the call on the user's plan.
 *
 * One-time only — once approved, the Ed25519 key is the permanent credential and
 * the bearer token can be removed from the MCP config.
 *
 * Body: { public_key: string, label?: string }
 */
router.post('/asc/register', requireAuth, requireAgenticPlan, (req, res) => {
  try {
    const { public_key, label: rawLabel } = req.body || {};
    if (!public_key) return res.status(400).json({ error: 'public_key is required' });

    const label = typeof rawLabel === 'string'
      ? rawLabel.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100)
      : 'AI Agent';

    // Validate and normalize the Ed25519 public key (raw 32-byte or SPKI 44-byte)
    let keyBuf;
    try { keyBuf = Buffer.from(public_key, 'base64'); } catch {
      return res.status(400).json({ error: 'public_key must be base64-encoded' });
    }
    let rawKeyBuf;
    if (keyBuf.length === 32)      rawKeyBuf = keyBuf;
    else if (keyBuf.length === 44) rawKeyBuf = keyBuf.slice(12); // strip 12-byte SPKI header
    else return res.status(400).json({ error: 'public_key must be a 32-byte raw or 44-byte SPKI Ed25519 key' });

    const normalizedPublicKey = rawKeyBuf.toString('base64');
    const keyFingerprint = ed25519KeyFingerprint(normalizedPublicKey);
    const userId = String(req.userId);

    // Scoped ASC binding: registering with a scoped (non-master) token binds the
    // Ed25519 key to that token's scopes — the agent key inherits least-privilege
    // instead of full account access. Master/session tokens keep legacy full bind,
    // UNLESS the caller explicitly picks a scoped token via bind_token_id (the
    // dashboard "Access level" picker): then the key inherits THAT token's scopes.
    let boundScope = null;
    const bindTokenId = typeof req.body?.bind_token_id === 'string' ? req.body.bind_token_id.trim() : null;
    if (bindTokenId) {
      const resolved = resolveBindTokenScope(req.userId, bindTokenId);
      if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });
      boundScope = resolved.scope;
    }
    const rawScope = req.tokenMeta?.scope;
    const isFullToken = rawScope === 'full'
      || req.tokenMeta?.tokenType === 'master'
      || String(req.tokenMeta?.tokenId || '').startsWith('sess_');
    if (!bindTokenId && !isFullToken) {
      const scopeSet = new Set();
      if (typeof rawScope === 'string' && rawScope.startsWith('[')) {
        try { for (const s of JSON.parse(rawScope)) if (typeof s === 'string') scopeSet.add(s); } catch (_) {}
      } else if (Array.isArray(rawScope)) {
        for (const s of rawScope) if (typeof s === 'string') scopeSet.add(s);
      }
      try { for (const s of db.getTokenScopes(req.tokenMeta.tokenId)) scopeSet.add(s); } catch (_) {}
      boundScope = [...scopeSet];
      if (boundScope.length === 0) {
        return res.status(400).json({
          error: 'Cannot register an agent key with a token that has no resolvable scopes',
        });
      }
    }

    // Already approved and active → tell the MCP immediately
    const approved = db.getApprovedDeviceByKeyFingerprint(userId, keyFingerprint);
    if (approved && !approved.revoked_at) {
      let approvedScope = null;
      try { approvedScope = approved.scope ? JSON.parse(approved.scope) : null; } catch (_) {}
      return res.json({ status: 'already_approved', key_fingerprint: keyFingerprint, scope: approvedScope || 'full' });
    }

    // Create or reuse pending entry (idempotent)
    db.createAscSelfRegistration(userId, keyFingerprint, normalizedPublicKey, label, req.ip, boundScope);

    db.createAuditLog({
      requesterId: userId,
      action: 'asc_key_registered',
      resource: 'approved_device',
      scope: keyFingerprint,
      ip: req.ip,
      details: { label, fingerprint: keyFingerprint },
    });

    return res.status(202).json({
      status: 'pending_approval',
      key_fingerprint: keyFingerprint,
      scope: boundScope || 'full',
      message: 'Key submitted. Ask the user to go to their MyApi dashboard → Devices and click Approve.'
        + (boundScope ? ` This key will be limited to: ${boundScope.join(', ')}.` : ''),
      approve_url: 'https://www.myapiai.com/dashboard/devices',
    });
  } catch (err) {
    logger.error('[ASC] register error:', err.message);
    res.status(500).json({ error: 'Failed to register ASC key' });
  }
});

/**
 * POST /api/v1/agentic/asc/enroll-code
 * Quick Connect step 1 (dashboard): mint a one-time, 15-minute enrollment code.
 * The code carries the chosen access level (full, or a scoped token's scopes via
 * bind_token_id). Because the code is minted by an authenticated full-access
 * session, redeeming it counts as pre-approved — no separate Devices click.
 * The code is NOT a credential: single-use, short-lived, hashed at rest.
 */
router.post('/asc/enroll-code', requireAuth, requireAgenticPlan, (req, res) => {
  try {
    // Only full-access credentials (dashboard session / master token) may mint —
    // a scoped token must not be able to mint codes broader than itself.
    const isFull = req.tokenMeta?.scope === 'full'
      || req.tokenMeta?.tokenType === 'master'
      || String(req.tokenMeta?.tokenId || '').startsWith('sess_');
    if (!isFull) {
      return res.status(403).json({ error: 'Only a dashboard session or master token can mint enrollment codes' });
    }

    let boundScope = null;
    const bindTokenId = typeof req.body?.bind_token_id === 'string' ? req.body.bind_token_id.trim() : null;
    if (bindTokenId) {
      const resolved = resolveBindTokenScope(req.userId, bindTokenId);
      if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });
      boundScope = resolved.scope;
    }

    const label = typeof req.body?.label === 'string'
      ? req.body.label.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100)
      : 'AI Agent (Quick Connect)';

    const code = 'MYAPI-' + crypto.randomBytes(4).toString('hex').toUpperCase()
      + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    db.db.prepare(`
      INSERT INTO asc_enroll_codes (id, code_hash, user_id, scope, label, created_at, expires_at, created_ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'enr_' + crypto.randomBytes(8).toString('hex'), codeHash, String(req.userId),
      boundScope ? JSON.stringify(boundScope) : null, label,
      now.toISOString(), expiresAt, req.ip
    );

    db.createAuditLog({
      requesterId: String(req.userId),
      action: 'asc_enroll_code_minted',
      resource: 'asc_enroll_codes',
      scope: boundScope ? boundScope.join(',') : 'full',
      ip: req.ip,
      details: { label, scoped: !!boundScope },
    });

    return res.status(201).json({ code, expires_at: expiresAt, scope: boundScope || 'full', label });
  } catch (err) {
    logger.error('[ASC] enroll-code error:', err.message);
    res.status(500).json({ error: 'Failed to mint enrollment code' });
  }
});

/**
 * POST /api/v1/agentic/asc/enroll  (public, rate-limited)
 * Quick Connect step 2 (agent side): the MCP generates an Ed25519 keypair
 * locally and exchanges the one-time code for a PRE-APPROVED registration.
 * Body: { code, public_key, label?,
 *         previous_public_key?, previous_signature?, previous_timestamp? }
 *
 * Replacement: when the previous_* fields prove ownership of an already-approved
 * key belonging to the same user (Ed25519 signature over `${timestamp}:${fingerprint}`,
 * same scheme as /asc/restore), that old device is revoked after the new key is
 * approved. This lets a machine re-enroll with a fresh code to REPLACE its
 * credential — narrowing or widening scope — instead of accumulating keys.
 */
router.post('/asc/enroll', (req, res) => {
  try {
    const { code, public_key, label: rawLabel } = req.body || {};
    if (!code || !public_key) {
      return res.status(400).json({ error: 'code and public_key are required' });
    }

    const codeHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
    const row = db.db.prepare('SELECT * FROM asc_enroll_codes WHERE code_hash = ?').get(codeHash);
    // Uniform error: don't reveal whether a code exists vs. expired vs. used
    const reject = () => res.status(400).json({
      error: 'Invalid, expired, or already-used enrollment code',
      next_action: 'Ask the user to generate a fresh code on the Connectors page (codes are single-use and expire after 15 minutes).',
    });
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return reject();

    // Validate and normalize the Ed25519 public key
    let keyBuf;
    try { keyBuf = Buffer.from(public_key, 'base64'); } catch { return res.status(400).json({ error: 'public_key must be base64-encoded' }); }
    let rawKeyBuf;
    if (keyBuf.length === 32) rawKeyBuf = keyBuf;
    else if (keyBuf.length === 44) rawKeyBuf = keyBuf.slice(12);
    else return res.status(400).json({ error: 'public_key must be a 32-byte raw or 44-byte SPKI Ed25519 key' });
    const normalizedPublicKey = rawKeyBuf.toString('base64');
    const keyFingerprint = ed25519KeyFingerprint(normalizedPublicKey);

    // Consume the code atomically — a concurrent duplicate loses the race
    const consumed = db.db.prepare(
      'UPDATE asc_enroll_codes SET used_at = ?, used_ip = ? WHERE code_hash = ? AND used_at IS NULL'
    ).run(new Date().toISOString(), req.ip, codeHash);
    if (consumed.changes === 0) return reject();

    let scope = null;
    try { scope = row.scope ? JSON.parse(row.scope) : null; } catch (_) {}
    const label = (typeof rawLabel === 'string' && rawLabel.trim())
      ? rawLabel.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100)
      : row.label || 'AI Agent (Quick Connect)';

    // Pre-approved: the user consented when they minted the code in the dashboard
    const existing = db.getApprovedDeviceByKeyFingerprintGlobal(keyFingerprint);
    if (!existing) {
      db.createApprovedDeviceASC('asc_self_reg', row.user_id, keyFingerprint, normalizedPublicKey, label, { type: 'asc', enrolledVia: 'quick_connect' }, req.ip, scope);
    }

    db.createAuditLog({
      requesterId: row.user_id,
      action: 'asc_enrolled_via_code',
      resource: 'approved_device',
      scope: scope ? scope.join(',') : 'full',
      ip: req.ip,
      details: { label, fingerprint: keyFingerprint },
    });

    // Optional key replacement: revoke the caller's previous key once the new
    // one is approved. Requires proof of ownership of the old private key AND
    // that the old device belongs to the same user the code was minted for —
    // a stolen enroll code must not be able to revoke someone else's device.
    let replacedFingerprint = null;
    const { previous_public_key, previous_signature, previous_timestamp } = req.body || {};
    if (previous_public_key && previous_signature && previous_timestamp) {
      try {
        const prevBuf = Buffer.from(previous_public_key, 'base64');
        const prevRaw = prevBuf.length === 44 ? prevBuf.slice(12) : prevBuf;
        if (prevRaw.length === 32) {
          const prevFp = ed25519KeyFingerprint(prevRaw.toString('base64'));
          const ts = parseInt(previous_timestamp, 10);
          const tsValid = !isNaN(ts) && Math.abs(Math.floor(Date.now() / 1000) - ts) <= 300;
          const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), prevRaw]);
          const keyObj = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
          const msg = Buffer.from(`${previous_timestamp}:${prevFp}`);
          let sigValid = false;
          try { sigValid = crypto.verify(null, msg, keyObj, Buffer.from(previous_signature, 'base64')); } catch (_) {}
          const oldDevice = tsValid && sigValid && prevFp !== keyFingerprint
            ? db.getApprovedDeviceByKeyFingerprintGlobal(prevFp) : null;
          if (oldDevice && String(oldDevice.user_id) === String(row.user_id)) {
            // markDeviceReplaced (not plain revoke): replaced keys must never
            // auto-restore, or the old access level would resurrect itself.
            db.markDeviceReplaced(oldDevice.id, keyFingerprint);
            replacedFingerprint = prevFp;
            db.createAuditLog({
              requesterId: row.user_id,
              action: 'asc_key_replaced',
              resource: 'approved_device',
              scope: scope ? scope.join(',') : 'full',
              ip: req.ip,
              details: { old_fingerprint: prevFp, new_fingerprint: keyFingerprint },
            });
          }
        }
      } catch (err) {
        logger.warn('[ASC] enroll key-replacement skipped:', err.message);
      }
    }

    return res.json({
      status: 'approved',
      key_fingerprint: keyFingerprint,
      scope: scope || 'full',
      replaced_fingerprint: replacedFingerprint,
      message: 'Enrolled and approved. The Ed25519 key is now the permanent credential — the code is consumed and useless.',
    });
  } catch (err) {
    logger.error('[ASC] enroll error:', err.message);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

/**
 * GET /api/v1/agentic/asc/token-id
 * Returns the token ID for the current bearer token — required for ASC request signing.
 */
router.get('/asc/token-id', requireAuth, (req, res) => {
  const tokenId = req.tokenMeta?.tokenId;
  if (!tokenId) return res.status(400).json({ error: 'Could not resolve token ID for this token' });
  res.json({ tokenId });
});

/**
 * GET /api/v1/agentic/asc/info
 * Returns signing instructions for the authenticated user.
 */
router.get('/asc/info', requireAuth, (req, res) => {
  res.json({
    algorithm: 'Ed25519',
    message_format: '"{timestamp}:{key_fingerprint}"',
    headers: {
      'X-Agent-PublicKey': 'Base64-encoded Ed25519 public key (32 bytes)',
      'X-Agent-Signature': 'Base64-encoded Ed25519 signature of the message',
      'X-Agent-Timestamp': 'Unix timestamp (seconds). Must be within 60s of server time.',
    },
    example_node: `const { generateKeyPairSync, sign } = require('crypto');
// One-time: generate and save keypair
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const pubKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('base64');
const privKeyRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);

// Each request:
const ts = Math.floor(Date.now() / 1000).toString();
const msg = Buffer.from(\`\${ts}:\${KEY_FINGERPRINT}\`); // fingerprint = sha256(rawPublicKey).hex.slice(0,32)
const sig = sign(null, msg, privateKey).toString('base64');
// Add headers: X-Agent-PublicKey, X-Agent-Signature, X-Agent-Timestamp`,
  });
});

module.exports = router;
