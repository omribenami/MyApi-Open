const crypto = require('crypto');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const db = require('../database');
const NotificationService = require('../services/notificationService');
const { setRequestActor } = require('../lib/request-context');

// ─── ASC: Ed25519 signature verification ─────────────────────────────────────

function verifyASCSignature(req, userId, tokenId) {
  const pubKeyB64  = req.headers['x-agent-publickey'];
  const sigB64     = req.headers['x-agent-signature'];
  const tsHeader   = req.headers['x-agent-timestamp'];

  if (!pubKeyB64 || !sigB64 || !tsHeader) return null; // not an ASC request

  // Replay protection: timestamp must be within the replay window (5 min).
  // Matches src/index.js ASC_REPLAY_WINDOW_SECONDS — keep in sync.
  const ts = parseInt(tsHeader, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return { valid: false, reason: 'timestamp_invalid' };
  }

  // Decode public key — must be 32 bytes (raw Ed25519)
  let pubKeyBuf;
  try {
    pubKeyBuf = Buffer.from(pubKeyB64, 'base64');
  } catch {
    return { valid: false, reason: 'publickey_invalid' };
  }
  if (pubKeyBuf.length !== 32) {
    return { valid: false, reason: 'publickey_invalid' };
  }

  // Compute key fingerprint (first 32 hex chars of SHA256)
  const keyFingerprint = crypto.createHash('sha256').update(pubKeyBuf).digest('hex').substring(0, 32);

  // Verify Ed25519 signature: message = "<timestamp>:<tokenId>"
  const message = Buffer.from(`${tsHeader}:${tokenId}`);
  let sigBuf;
  try {
    sigBuf = Buffer.from(sigB64, 'base64');
  } catch {
    return { valid: false, reason: 'signature_invalid' };
  }

  let sigValid = false;
  try {
    // Node 22 supports Ed25519 verify with raw 32-byte key via SubjectPublicKeyInfo wrapping
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex'); // SPKI prefix for Ed25519
    const spkiKey = Buffer.concat([spkiPrefix, pubKeyBuf]);
    const keyObj = crypto.createPublicKey({ key: spkiKey, format: 'der', type: 'spki' });
    sigValid = crypto.verify(null, message, keyObj, sigBuf);
  } catch {
    return { valid: false, reason: 'signature_invalid' };
  }

  if (!sigValid) return { valid: false, reason: 'signature_mismatch' };

  return { valid: true, keyFingerprint, pubKeyB64 };
}

// 24h cool-down on the "new device" / "suspicious device" email per (token, fingerprint).
// Without this, a flapping User-Agent triggers an email on every request. The dedupe
// boundary lives at the device_approvals_pending row: last_alert_sent_at is checked
// before send and written after send.
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function shouldSendDeviceAlert(tokenId, fingerprintHash) {
  try {
    const last = db.getLastAlertSentAt(tokenId, fingerprintHash);
    if (!last) return true;
    return (Date.now() - new Date(last).getTime()) > ALERT_COOLDOWN_MS;
  } catch (_) {
    return true; // fail open — better to over-notify than miss real theft on a DB hiccup
  }
}

// Strict-mode (FEATURE_OAUTH_STRICT_DEVICE_BIND=true) email. Behind the cool-down.
function sendOAuthSuspiciousAlertOnce({ db, userId, tokenId, tokenLabel, fingerprint, approvalId, req }) {
  if (!shouldSendDeviceAlert(tokenId, fingerprint.fingerprintHash)) return;
  try {
    const userRow = db.db.prepare('SELECT email, display_name, username FROM users WHERE id = ?').get(userId);
    const oauthTokenName = tokenLabel || 'OAuth Token';

    NotificationService.emitNotification(userId, 'security_alert',
      `Security Alert: OAuth token used from a different device`,
      `Token "${oauthTokenName}" was used from an unrecognised device (${fingerprint.summary.ipAddress}). This token is bound to a specific device — cross-device use may indicate token theft.`,
      {
        relatedEntityType: 'device',
        relatedEntityId: approvalId,
        data: { ip: fingerprint.summary.ipAddress, os: fingerprint.summary.os, browser: fingerprint.summary.browser, tokenName: oauthTokenName },
        actionUrl: approvalId ? `/dashboard/devices?approval=${approvalId}` : '/dashboard/devices',
        skipEmail: true,
      }
    ).catch(err => console.error('[DeviceApproval] OAuth notification failed:', err.message));

    if (userRow?.email) {
      const EmailService = require('../services/emailService');
      const originalDevice = (() => {
        try {
          const approved = db.db.prepare('SELECT device_name, ip_address, approved_at FROM approved_devices WHERE token_id = ? AND user_id = ? AND revoked_at IS NULL ORDER BY approved_at ASC LIMIT 1').get(tokenId, userId);
          return approved ? { name: approved.device_name, ip: approved.ip_address, approvedAt: approved.approved_at } : null;
        } catch (_) { return null; }
      })();
      EmailService.sendNewDeviceApprovalEmail(
        userRow.email,
        userRow.display_name || userRow.username || 'there',
        {
          tokenName: oauthTokenName,
          tokenKind: 'oauth',
          ip: fingerprint.summary.ipAddress,
          os: fingerprint.summary.os,
          browser: fingerprint.summary.browser,
          endpoint: `${req.method} ${req.path}`,
          detectedAt: new Date().toISOString(),
          originalDevice,
          approvalId,
          suspiciousActivity: { suspicious: true, warnings: ['OAuth token used from a device it was not issued to — possible token theft or unauthorized sharing'], riskLevel: 'high' },
        }
      ).catch(err => console.error('[DeviceApproval] OAuth email failed:', err.message));
    }

    db.markAlertSent(approvalId);
  } catch (err) {
    console.error('[DeviceApproval] OAuth alert error:', err.message);
  }
}

/**
 * Device Approval Middleware
 * Checks if the requesting device is approved before allowing API access
 */

// Global alert emitter (will be set by index.js)
let globalAlertEmitter = null;

function setAlertEmitter(emitter) {
  globalAlertEmitter = emitter;
}

// Rate limit tracking (in-memory, should use Redis for production)
const approvalRateLimits = new Map(); // token_id -> { count, resetTime }

function getRateLimitKey(tokenId) {
  return `approval_${tokenId}`;
}

function checkApprovalRateLimit(tokenId) {
  const key = getRateLimitKey(tokenId);
  const now = Date.now();
  const limit = approvalRateLimits.get(key);
  
  if (!limit || now > limit.resetTime) {
    // New window
    approvalRateLimits.set(key, { count: 1, resetTime: now + 3600000 }); // 1 hour
    return true;
  }
  
  if (limit.count >= 5) { // Max 5 approval requests per hour
    return false;
  }
  
  limit.count++;
  return true;
}

// ─── OAuth token device policy (shared) ──────────────────────────────────────
//
// OAuth-issued tokens (label ends with "(OAuth)") identify the agent by the bearer
// secret + OAuth client_id, NOT by device fingerprint. The user already authenticated
// in the browser and explicitly granted consent during the OAuth flow, so requiring a
// second "approve this device" step is redundant. AI agents also legitimately rotate
// across LB workers, omit User-Agent headers, and call from different IPs — binding
// them to a single SHA256(UA+platform) hash produced false-positive "suspicious device"
// alerts on every request. Real theft signals (ASN drift, VPN/Tor, velocity) are
// detected by lib/tokenSecurityMonitor.js, which runs after this middleware.
//
// FEATURE_OAUTH_STRICT_DEVICE_BIND=true restores the legacy strict path for one
// release as a rollback guardrail.
//
// Used by deviceApprovalMiddleware below AND by the manual Bearer-token path in
// routes/auth.js GET /auth/me (which is not wrapped in the middleware chain). Keep
// this the single source of truth so the two paths cannot disagree.
//
// Returns { allow: true } or { allow: false, status, body }.
function applyOAuthDevicePolicy(req, { userId, tokenId, tokenLabel }) {
  // ── Device identity ──────────────────────────────────────────────────────────
  // OAuth delegation tokens (ChatGPT, etc.) rotate token_id on every authorization
  // and refresh, and arrive from many egress IPs/UAs. Keying the "device" by
  // token_id + request fingerprint therefore spawns a brand-new device (and approval)
  // per token/IP — dozens for one logical client. Instead, key OAuth devices by the
  // stable OAuth client: ONE device per (user, client). Non-OAuth tokens keep the
  // per-token + per-request-fingerprint identity. ASC has its own stable key path.
  let oauthClientId = null;
  try {
    const row = db.db.prepare('SELECT oauth_client_id FROM access_tokens WHERE id = ?').get(tokenId);
    oauthClientId = row?.oauth_client_id || null;
  } catch (_) {}

  const clientIp = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || req.ip || 'unknown';

  const deviceKey = oauthClientId ? `oauth:${oauthClientId}` : tokenId;
  const fingerprint = oauthClientId
    ? { fingerprintHash: `oauth:${oauthClientId}`, summary: { os: 'OAuth', browser: oauthClientId, ipAddress: clientIp } }
    : DeviceFingerprint.fromRequest(req);

  // Step 1: Revocation check — fail closed while a revocation is the user's
  // LATEST decision for this entity. Revoking the device locks it down; approving
  // a pending device afterwards restores the relaxed OAuth mode. Comparing MAX
  // timestamps instead of "any revoked row exists" — a stale revoked row must not
  // poison the entity forever. ISO-8601 strings compare lexicographically; a
  // same-millisecond tie resolves in favor of the explicit approval.
  let revocationActive;
  try {
    const lastRevoked = db.db.prepare(
      'SELECT MAX(revoked_at) AS ts FROM approved_devices WHERE token_id = ? AND user_id = ? AND revoked_at IS NOT NULL'
    ).get(deviceKey, userId);
    const lastApproved = db.db.prepare(
      'SELECT MAX(approved_at) AS ts FROM approved_devices WHERE token_id = ? AND user_id = ? AND revoked_at IS NULL'
    ).get(deviceKey, userId);
    revocationActive = Boolean(lastRevoked?.ts && (!lastApproved?.ts || lastApproved.ts < lastRevoked.ts));
  } catch (err) {
    console.error('[Device Approval] Revocation check failed', { err: err.message, deviceKey, userId });
    return {
      allow: false,
      status: 503,
      body: {
        error: 'device_approval_error',
        code: 'DEVICE_APPROVAL_FAILED',
        message: 'Access denied — device check temporarily unavailable.',
      },
    };
  }
  if (revocationActive) {
    // Revoked — create a pending approval so the user can re-approve from the dashboard.
    // No email here: the revocation was user-initiated, the dashboard is the signal.
    const pendingApprovals = db.getPendingApprovals(userId, deviceKey);
    const existingPending = pendingApprovals.find(p => p.device_fingerprint_hash === fingerprint.fingerprintHash);
    if (!existingPending) {
      try {
        db.createPendingApproval(deviceKey, userId, fingerprint.fingerprintHash, fingerprint.summary, fingerprint.summary.ipAddress);
      } catch (_) {}
    }
    return {
      allow: false,
      status: 403,
      body: {
        error: 'device_not_approved',
        code: 'DEVICE_APPROVAL_REQUIRED',
        message: 'Access denied — waiting for the user to approve you in the dashboard.',
      },
    };
  }

  const existing = (() => {
    try { return db.getApprovedDeviceByHashAndToken(userId, fingerprint.fingerprintHash, deviceKey); } catch (_) { return null; }
  })();

  // Step 2 (strict, opt-in): legacy device-binding gate.
  if (process.env.FEATURE_OAUTH_STRICT_DEVICE_BIND === 'true') {
    if (existing && !existing.revoked_at) {
      try { db.updateDeviceLastUsed(existing.id); } catch (_) {}
      setRequestActor({ deviceId: existing.id, deviceName: existing.device_name || null });
      return { allow: true };
    }
    // Different fingerprint — require explicit approval, with 24h email cool-down.
    const pendingApprovals = db.getPendingApprovals(userId, deviceKey);
    const existingPending = pendingApprovals.find(p => p.device_fingerprint_hash === fingerprint.fingerprintHash);
    let oauthApprovalId = existingPending?.id || null;
    if (!existingPending) {
      try {
        oauthApprovalId = db.createPendingApproval(deviceKey, userId, fingerprint.fingerprintHash, fingerprint.summary, fingerprint.summary.ipAddress);
      } catch (_) {}
    }
    sendOAuthSuspiciousAlertOnce({
      db, userId, tokenId, tokenLabel,
      fingerprint, approvalId: oauthApprovalId, req,
    });
    return {
      allow: false,
      status: 403,
      body: {
        error: 'device_not_approved',
        code: 'DEVICE_APPROVAL_REQUIRED',
        message: 'Access denied — this token was issued to a different device. Ask the user to approve you in the dashboard.',
      },
    };
  }

  // Step 2 (default): visibility-only tracking.
  // Existing fingerprint → bump last_used. New fingerprint → silently auto-register
  // the (token, fingerprint) pair so the dashboard can list and revoke it. No 403,
  // no email. tokenSecurityMonitor.checkRequest (wired in src/index.js) is the
  // anomaly authority and will suspend the token if it sees real theft signals.
  if (existing && !existing.revoked_at) {
    try { db.updateDeviceLastUsed(existing.id); } catch (_) {}
    setRequestActor({ deviceId: existing.id, deviceName: existing.device_name || null });
    return { allow: true };
  }

  // An explicitly revoked fingerprint stays blocked even after the token has
  // returned to relaxed mode — the user can re-approve it from the dashboard.
  // (getApprovedDeviceByHashAndToken filters revoked rows, so look it up here.)
  const revokedRow = (() => {
    try {
      return db.db.prepare(
        'SELECT id FROM approved_devices WHERE user_id = ? AND device_fingerprint_hash = ? AND token_id = ? AND revoked_at IS NOT NULL'
      ).get(userId, fingerprint.fingerprintHash, deviceKey);
    } catch (_) { return null; }
  })();
  if (revokedRow) {
    const pendingApprovals = db.getPendingApprovals(userId, deviceKey);
    const existingPending = pendingApprovals.find(p => p.device_fingerprint_hash === fingerprint.fingerprintHash);
    if (!existingPending) {
      try {
        db.createPendingApproval(deviceKey, userId, fingerprint.fingerprintHash, fingerprint.summary, fingerprint.summary.ipAddress);
      } catch (_) {}
    }
    return {
      allow: false,
      status: 403,
      body: {
        error: 'device_not_approved',
        code: 'DEVICE_APPROVAL_REQUIRED',
        message: 'Access denied — this device was revoked. Ask the user to re-approve it in the dashboard.',
      },
    };
  }

  try {
    const newDeviceId = db.createApprovedDevice(
      deviceKey, userId, fingerprint.fingerprintHash,
      tokenLabel, fingerprint.summary, fingerprint.summary.ipAddress
    );
    if (newDeviceId) setRequestActor({ deviceId: newDeviceId, deviceName: tokenLabel || null });
  } catch (_) { /* duplicate-key race is fine */ }
  return { allow: true };
}

/**
 * Main device approval middleware
 * Should be applied to all API endpoints that require device approval
 */
function deviceApprovalMiddleware(req, res, next) {
  // Session-authenticated requests (dashboard users) do not require device approval.
  // Sessions are protected by CORS + HttpOnly cookies — no agent fingerprinting needed.
  // The dashboard sends both a session cookie AND a Bearer masterToken; if the session
  // is valid, skip device approval regardless of whether a token is also present.
  if (req.authType === 'session' || (req.session && req.session.user)) {
    return next();
  }

  // Extract user context from token metadata ONLY (no session fallback)
  // Note: Referer/Origin headers are caller-controlled and must NOT be used to bypass device approval.
  const userId = req.tokenMeta?.ownerId;
  const tokenId = req.tokenMeta?.tokenId;
  const isMasterToken = req.tokenMeta?.tokenType === 'master' || req.tokenMeta?.scope === 'full';
  const tokenKind = isMasterToken ? 'master' : 'guest';
  
  // Skip device check if not a Bearer token
  if (!userId || !tokenId) {
    return next();
  }

  // ── ASC: Ed25519 signed request ──────────────────────────────────────────
  const ascResult = verifyASCSignature(req, userId, tokenId);
  if (ascResult !== null) {
    // Headers were present — this is an ASC request
    if (!ascResult.valid) {
      return res.status(401).json({
        error: 'asc_signature_invalid',
        code: 'ASC_INVALID',
        reason: ascResult.reason,
        message: 'Request signature is invalid or timestamp is too old.',
      });
    }
    // Signature valid — check if this key is approved
    const ascDevice = db.getApprovedDeviceByKeyFingerprint(userId, ascResult.keyFingerprint);
    if (ascDevice && !ascDevice.revoked_at) {
      db.updateDeviceLastUsed(ascDevice.id);
      setRequestActor({ deviceId: ascDevice.id, deviceName: ascDevice.device_name || 'ASC Agent' });
      return next();
    }
    if (ascDevice && ascDevice.revoked_at) {
      return res.status(403).json({
        error: 'device_not_approved',
        code: 'DEVICE_APPROVAL_REQUIRED',
        message: 'Access denied — waiting for the user to approve you in the dashboard.',
        key_fingerprint: ascResult.keyFingerprint,
      });
    }
    // Key not registered at all — create pending approval
    const pending = db.getPendingApprovals(userId, tokenId);
    const existingPending = pending.find(p => p.device_fingerprint_hash === ascResult.keyFingerprint);
    if (!existingPending) {
      db.createPendingApproval(tokenId, userId, ascResult.keyFingerprint,
        { type: 'asc', key_fingerprint: ascResult.keyFingerprint, public_key: ascResult.pubKeyB64 }, req.ip);
    }
    return res.status(403).json({
      error: 'device_not_approved',
      code: 'DEVICE_APPROVAL_REQUIRED',
      message: 'Access denied — waiting for the user to approve you in the dashboard.',
      key_fingerprint: ascResult.keyFingerprint,
    });
  }

  try {
    const tokenRow = db.db.prepare('SELECT label, requires_approval FROM access_tokens WHERE id = ?').get(tokenId);
    if (tokenRow?.label && tokenRow.label.endsWith('(OAuth)')) {
      const verdict = applyOAuthDevicePolicy(req, { userId, tokenId, tokenLabel: tokenRow.label });
      if (verdict.allow) return next();
      return res.status(verdict.status).json(verdict.body);
    }
    if (!isMasterToken && !tokenRow?.requires_approval) {
      return next(); // scoped token without approval requirement — pass through
    }
  } catch (_) {
    // If lookup fails, fall through to full device check
  }

  try {
    // Generate fingerprint from request
    const currentFingerprint = DeviceFingerprint.fromRequest(req);
    const fingerprintHash = currentFingerprint.fingerprintHash;

    // Check if device is already approved for THIS token.
    // Token-scoped lookup prevents an approval granted to a master token (or any
    // other token) from auto-authorizing a different guest token on the same
    // device. Each (token, device) pair must be explicitly approved.
    const approvedDevice = db.getApprovedDeviceByHashAndToken(userId, fingerprintHash, tokenId);

    if (approvedDevice && !approvedDevice.revoked_at) {
      // Device is approved, update last used
      db.updateDeviceLastUsed(approvedDevice.id);

      // Attach device info to request
      req.device = {
        id: approvedDevice.id,
        name: approvedDevice.device_name,
        fingerprint: fingerprintHash,
        approvedAt: approvedDevice.approved_at,
        scope: approvedDevice.scope || 'full',
      };
      setRequestActor({ deviceId: approvedDevice.id, deviceName: approvedDevice.device_name || null });

      // Set cache-control headers to prevent stale device status
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      return next();
    }

    // SECURITY: Do NOT silently auto-approve new device fingerprints because an older
    // device on the same token was approved. This was a bypass allowing any new device
    // to access a token without explicit user confirmation.
    // Each new fingerprint must go through the explicit approval flow below.

    // Device not approved - return 403 immediately
    // (Do NOT rate limit the rejection itself, only the approval request creation)
    
    // Get token info for device name generation (must be before rate-limit block that uses tokenName)
    const tokenInfo = db.db.prepare('SELECT label, token_type FROM access_tokens WHERE id = ?').get(tokenId);
    const tokenName = tokenInfo?.label || (isMasterToken ? 'Master Token' : 'Guest Token');

    // But first, check if approval already pending
    const pendingApprovals = db.getPendingApprovals(userId, tokenId);
    const existingPending = pendingApprovals.find(p => p.device_fingerprint_hash === fingerprintHash);

    // Check rate limit ONLY for new approval requests (not for the 403 response itself)
    const canCreateApproval = checkApprovalRateLimit(tokenId);

    if (!existingPending && !canCreateApproval) {
      // RATE LIMITED - but we still return 403 to maintain security posture
      // (The rate limit applies only to creating NEW pending approvals)
      return res.status(403).json({
        error: 'device_not_approved',
        message: 'Access denied — waiting for the user to approve you in the dashboard.',
        code: 'DEVICE_NOT_APPROVED',
        token: { kind: tokenKind, name: tokenName },
        approval_pending: false,
        approval_id: null,
      });
    }

    // Create pending approval if not already exists
    let approvalId = null;
    let isNewApproval = false;
    if (!existingPending) {
      isNewApproval = true;
      approvalId = db.createPendingApproval(
        tokenId,
        userId,
        fingerprintHash,
        currentFingerprint.summary,
        currentFingerprint.summary.ipAddress
      );
      
      // Emit notification and log activity for new device approval request
      const deviceInfo = `${currentFingerprint.summary.os} · ${currentFingerprint.summary.browser}`;
      NotificationService.emitNotification(userId, 'device_approval_requested',
        `New Device Requesting Access (${tokenKind === 'master' ? 'Master Token' : 'Guest Token'}: "${tokenName}")`,
        `A new device is requesting access via ${tokenKind} token "${tokenName}" from ${currentFingerprint.summary.ipAddress}`,
        {
          relatedEntityType: 'device',
          relatedEntityId: approvalId,
          data: {
            deviceInfo,
            ipAddress: currentFingerprint.summary.ipAddress,
            os: currentFingerprint.summary.os,
            browser: currentFingerprint.summary.browser,
            tokenKind,
            tokenName,
          },
          actionUrl: '/dashboard/devices',
          skipEmail: true, // sendNewDeviceApprovalEmail handles the transactional email
        }
      ).catch(err => console.error('Failed to emit device approval notification:', err));
      
      // Log activity
      NotificationService.logActivity(userId, 'device_approval_requested', 'device', {
        resourceId: approvalId,
        resourceName: deviceInfo,
        actorType: 'system',
        details: {
          ip_address: currentFingerprint.summary.ipAddress,
          os: currentFingerprint.summary.os,
          browser: currentFingerprint.summary.browser,
        },
        result: 'pending',
        ipAddress: currentFingerprint.summary.ipAddress,
      });

      // Emit alert event for new device approval request (legacy WebSocket)
      if (globalAlertEmitter) {
        globalAlertEmitter.emit('device:pending_approval', {
          userId,
          deviceId: approvalId,
          deviceName: currentFingerprint.summary.os || 'Unknown Device',
          ip: currentFingerprint.summary.ipAddress,
          userAgent: currentFingerprint.summary.browser || 'Unknown',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      approvalId = existingPending.id;
    }

    // Check for suspicious activity
    const allApprovals = db.getDeviceApprovalHistory(userId, tokenId, 10);
    const suspiciousAnalysis = DeviceFingerprint.analyzeSuspiciousActivity(
      currentFingerprint,
      allApprovals.map(a => ({
        // device_name is a string, not JSON - don't parse it
        summary: a.device_name ? { name: a.device_name } : {},
        fingerprint: { ipAddress: a.ip_address }
      }))
    );

    // Email notification for new device — fire-and-forget, gated by the 24h cool-down
    // so a flapping fingerprint can't trigger one email per request.
    if (isNewApproval && shouldSendDeviceAlert(tokenId, fingerprintHash)) {
      try {
        const userRow = db.db.prepare('SELECT email, display_name, username FROM users WHERE id = ?').get(userId);
        if (userRow?.email) {
          const EmailService = require('../services/emailService');
          const originalDevice = allApprovals.length > 0 ? allApprovals[0] : null;
          EmailService.sendNewDeviceApprovalEmail(
            userRow.email,
            userRow.display_name || userRow.username || 'there',
            {
              tokenName,
              tokenKind,
              ip: currentFingerprint.summary.ipAddress,
              os: currentFingerprint.summary.os,
              browser: currentFingerprint.summary.browser,
              endpoint: `${req.method} ${req.path}`,
              detectedAt: new Date().toISOString(),
              originalDevice: originalDevice
                ? { name: originalDevice.device_name, ip: originalDevice.ip_address, approvedAt: originalDevice.approved_at }
                : null,
              approvalId,
              suspiciousActivity: suspiciousAnalysis,
            }
          ).catch(err => console.error('[DeviceApproval] Email failed:', err.message));
          db.markAlertSent(approvalId);
        }
      } catch (err) {
        console.error('[DeviceApproval] Email dispatch error:', err.message);
      }
    }

    // Log the approval request
    db.createAuditLog({
      timestamp: new Date().toISOString(),
      requesterId: userId,
      action: 'device_approval_requested',
      resource: 'device',
      scope: tokenId,
      ip: req.ip,
      details: JSON.stringify({
        device_fingerprint: fingerprintHash,
        approval_id: approvalId,
        suspicious: suspiciousAnalysis.suspicious,
        risk_level: suspiciousAnalysis.riskLevel,
        warnings: suspiciousAnalysis.warnings,
      })
    });

    // Trigger notification (will be handled by route handler if needed)
    req.pendingDeviceApproval = {
      approvalId,
      tokenName,
      deviceInfo: currentFingerprint.summary,
      ipAddress: currentFingerprint.summary.ipAddress,
      suspiciousActivity: suspiciousAnalysis,
    };

    // Prevent caching of device approval responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Return 403 Forbidden with pending approval info
    // Use explicit error codes so frontend can handle appropriately
    return res.status(403).json({
      error: 'device_not_approved',
      code: 'DEVICE_APPROVAL_REQUIRED',
      message: 'Access denied — waiting for the user to approve you in the dashboard.',
      token: {
        kind: tokenKind,
        name: tokenName,
      },
      approval: {
        id: approvalId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        expiresIn: '24 hours',
      },
      device: currentFingerprint.summary,
      ipAddress: currentFingerprint.summary.ipAddress,
      suspiciousActivity: suspiciousAnalysis.warnings.length > 0 ? suspiciousAnalysis : null,
      ...(isMasterToken ? {
        recommendation: {
          message: 'Using a master token is not recommended for AI agents. Each agent should have its own identity.',
          alternatives: [
            { method: 'device_flow', label: 'OAuth Device Flow', description: 'Get a dedicated token with one browser approval.', url: '/dashboard/connectors' },
            { method: 'asc', label: 'ASC (Agentic Secure Connection)', description: 'Use an Ed25519 keypair for cryptographic identity per agent.', url: '/dashboard/connectors' },
          ],
        },
      } : {}),
    });
  } catch (error) {
    console.error('[Device Approval Middleware CRITICAL ERROR]', {
      message: error.message,
      stack: error.stack,
      userId,
      tokenId,
      path: req.path,
    });
    // FAIL CLOSED: On error, DENY access instead of allowing it
    // This is critical for security - we must not let errors bypass the gate
    return res.status(403).json({
      error: 'device_approval_error',
      code: 'DEVICE_APPROVAL_FAILED',
      message: 'Access denied — waiting for the user to approve you in the dashboard.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Lightweight device check - only for logging, doesn't block
 * Use this to track device usage without enforcing approvals
 */
function deviceTrackingMiddleware(req, res, next) {
  try {
    const tokenId = req.tokenId;
    const userId = req.userId;
    
    if (!tokenId || !userId) return next();

    const fingerprint = DeviceFingerprint.fromRequest(req);
    
    // Just attach device info to request for logging
    req.deviceFingerprint = fingerprint.fingerprintHash;
    req.deviceSummary = fingerprint.summary;
    
    // Check if approved for logging purposes
    const approved = db.getApprovedDeviceByHash(userId, fingerprint.fingerprintHash);
    if (approved && !approved.revoked_at) {
      db.updateDeviceLastUsed(approved.id);
    }
    
    next();
  } catch (error) {
    console.error('Device tracking middleware error:', error);
    next();
  }
}

/**
 * Optional: Skip device approval for certain routes
 * Use this for public endpoints that shouldn't require device approval
 */
function skipDeviceApproval(req, res, next) {
  req.skipDeviceApproval = true;
  next();
}

module.exports = {
  deviceApprovalMiddleware,
  applyOAuthDevicePolicy,
  deviceTrackingMiddleware,
  skipDeviceApproval,
  setAlertEmitter,
};
