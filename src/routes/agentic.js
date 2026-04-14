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
function requireAuth(req, res, next) {
  const userId = req.user?.id || req.tokenMeta?.ownerId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = userId;
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateUserCode() {
  // Format: XXXX-XXXX (8 uppercase letters, easy to type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity
  const pick = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${pick()}-${pick()}`;
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
router.post('/device/authorize', requireAuth, (req, res) => {
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
router.post('/device/approve/:id', requireAuth, (req, res) => {
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
 * AI agent registers its Ed25519 public key. Creates a pending approval.
 * Requires Bearer token auth (the agent must have a valid token).
 *
 * Body: { public_key: "<base64 Ed25519 public key>", label?: string }
 */
router.post('/asc/register', requireAuth, (req, res) => {
  try {
    const { public_key, label: rawLabel } = req.body || {};
    if (!public_key) return res.status(400).json({ error: 'public_key is required' });
    // Sanitize label — strip control chars, limit length, prevent URL injection
    const label = typeof rawLabel === 'string'
      ? rawLabel.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100)
      : undefined;

    // Accept Ed25519 public key in raw (32 bytes) or SPKI DER (44 bytes) format
    let keyBuf;
    try {
      keyBuf = Buffer.from(public_key, 'base64');
    } catch {
      return res.status(400).json({ error: 'public_key must be base64-encoded' });
    }
    // SPKI DER for Ed25519 is 44 bytes; raw is 32 bytes. Extract raw key either way.
    let rawKeyBuf;
    if (keyBuf.length === 32) {
      rawKeyBuf = keyBuf;
    } else if (keyBuf.length === 44) {
      // SPKI DER: 12-byte OID prefix + 32-byte raw key
      rawKeyBuf = keyBuf.slice(12);
    } else {
      return res.status(400).json({ error: 'public_key must be a 32-byte raw or 44-byte SPKI Ed25519 public key' });
    }
    // Normalize to raw base64 for consistent fingerprinting
    const normalizedPublicKey = rawKeyBuf.toString('base64');

    const userId = String(req.userId);
    const tokenId = req.tokenMeta?.tokenId;
    const keyFingerprint = ed25519KeyFingerprint(normalizedPublicKey);

    // Check if already registered
    const existing = db.getApprovedDeviceByKeyFingerprint(userId, keyFingerprint);
    if (existing && !existing.revoked_at) {
      return res.json({
        status: 'already_approved',
        key_fingerprint: keyFingerprint,
        device_id: existing.id,
      });
    }

    // Check if pending approval already exists
    const pending = db.getPendingApprovals(userId, tokenId);
    const existingPending = pending.find(p => p.device_fingerprint_hash === keyFingerprint);

    if (!existingPending) {
      const deviceLabel = label || `ASC Agent`;
      const summary = { name: deviceLabel, type: 'asc', key_fingerprint: keyFingerprint, public_key: normalizedPublicKey };
      db.createPendingApproval(tokenId, userId, keyFingerprint, summary, req.ip);
    }

    res.status(202).json({
      status: 'pending_approval',
      key_fingerprint: keyFingerprint,
      message: 'Your public key is awaiting approval in the dashboard. Once approved, sign each request with your private key.',
      instructions: {
        header_public_key: 'X-Agent-PublicKey: <base64 Ed25519 public key>',
        header_signature: 'X-Agent-Signature: <base64 Ed25519 signature of "timestamp:token_id">',
        header_timestamp: 'X-Agent-Timestamp: <unix seconds>',
        note: 'Timestamp must be within 60 seconds of server time.',
      },
    });
  } catch (err) {
    logger.error('[ASC] register error:', err.message);
    res.status(500).json({ error: 'Failed to register ASC key' });
  }
});

/**
 * GET /api/v1/agentic/asc/info
 * Returns signing instructions for the authenticated user.
 */
router.get('/asc/info', requireAuth, (req, res) => {
  res.json({
    algorithm: 'Ed25519',
    message_format: '"{timestamp}:{token_id}"',
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
const msg = Buffer.from(\`\${ts}:\${YOUR_TOKEN_ID}\`);
const sig = sign(null, msg, privateKey).toString('base64');
// Add headers: X-Agent-PublicKey, X-Agent-Signature, X-Agent-Timestamp`,
  });
});

module.exports = router;
