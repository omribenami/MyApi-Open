const crypto = require('crypto');
const { getDatabase } = require('../config/database');
const { lookupASN } = require('./asnLookup');
const logger = require('../utils/logger');

// In-memory sliding-window velocity tracker
const _velocity = new Map(); // tokenId -> number[]  (timestamps ms)
const VELOCITY_WINDOW_MS = 60 * 1000;
const VELOCITY_LIMITS = { master: 500, personal: 300, guest: 100 };
const VELOCITY_DEFAULT = 150;

// Paths exempt from security checks
const SKIP_PATH_RE = /^\/(health|favicon|api\/v1\/(health|ping|oauth\/callback|agentic\/device\/(poll|approve)))/;

function hashUA(ua) {
  if (!ua) return 'none';
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16);
}

function checkVelocity(tokenId, tokenType) {
  const limit = VELOCITY_LIMITS[tokenType] || VELOCITY_DEFAULT;
  const now = Date.now();
  const times = _velocity.get(tokenId) || [];
  times.push(now);
  const cutoff = now - VELOCITY_WINDOW_MS;
  const start = times.findIndex(t => t >= cutoff);
  const trimmed = start > 0 ? times.slice(start) : times;
  _velocity.set(tokenId, trimmed);
  return { count: trimmed.length, limit, exceeded: trimmed.length > limit };
}

async function checkRequest(req, tokenId, tokenType) {
  if (!tokenId) return { blocked: false };
  if (SKIP_PATH_RE.test(req.path)) return { blocked: false };

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  const ua = req.get('user-agent') || '';
  const uaHash = hashUA(ua);

  const reasons = [];

  // 1. Velocity check (synchronous, cheap)
  const vel = checkVelocity(tokenId, tokenType);
  if (vel.exceeded) {
    reasons.push(`Rate limit exceeded: ${vel.count} requests/min (limit ${vel.limit})`);
  }

  // 2. Baseline check (synchronous DB read)
  let db;
  try { db = getDatabase(); } catch (_) { return { blocked: false }; }

  let baseline;
  try {
    baseline = db.prepare('SELECT * FROM token_security_baselines WHERE token_id = ?').get(tokenId);
  } catch (_) {
    return { blocked: false }; // table not ready
  }

  // 3. ASN lookup — only await if we have a baseline to compare against
  //    Otherwise warm the cache in background and set baseline
  let asnInfo = { asn: 'unknown', asnOrg: 'Unknown', orgType: 'unknown' };
  if (baseline || vel.exceeded) {
    asnInfo = await lookupASN(ip);
  } else {
    // First request: set baseline, warm ASN cache in background, proceed
    lookupASN(ip).then(info => {
      try {
        const now = new Date().toISOString();
        db.prepare(`
          INSERT OR IGNORE INTO token_security_baselines (token_id, baseline_asn, baseline_asn_org, baseline_ua_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(tokenId, info.asn, info.asnOrg, uaHash, now, now);
      } catch (_) {}
    }).catch(() => {});
    // Still set baseline row immediately (without ASN until cache warms)
    try {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO token_security_baselines (token_id, baseline_asn, baseline_asn_org, baseline_ua_hash, created_at, updated_at)
        VALUES (?, NULL, NULL, ?, ?, ?)
      `).run(tokenId, uaHash, now, now);
    } catch (_) {}
    return { blocked: false };
  }

  // 4. Compare against baseline
  if (baseline) {
    // ASN org drift: flag only when org type changes between datacenter ↔ residential/vpn/tor
    if (baseline.baseline_asn_org && asnInfo.asnOrg !== 'Unknown') {
      if (baseline.baseline_asn_org !== asnInfo.asnOrg) {
        const baselineType = _orgTypeFromOrg(baseline.baseline_asn_org);
        if (baselineType !== asnInfo.orgType) {
          reasons.push(`Network changed: "${baseline.baseline_asn_org}" (${baselineType}) → "${asnInfo.asnOrg}" (${asnInfo.orgType})`);
        }
      }
    }

    // Always flag VPN/Tor regardless of baseline
    if (['vpn', 'tor'].includes(asnInfo.orgType)) {
      reasons.push(`Token used from ${asnInfo.orgType.toUpperCase()} exit: ${asnInfo.asnOrg}`);
    }

    // UA drift: only flag if baseline had a real UA (agents always send consistent UA)
    if (baseline.baseline_ua_hash && baseline.baseline_ua_hash !== 'none' && uaHash !== baseline.baseline_ua_hash) {
      reasons.push('User-Agent changed from baseline');
    }
  }

  if (reasons.length === 0) return { blocked: false };

  return handleAnomaly(req, tokenId, tokenType, ip, ua, uaHash, asnInfo, reasons, db);
}

function _orgTypeFromOrg(orgName) {
  if (!orgName) return 'unknown';
  const { classifyOrg } = require('./asnLookup');
  // fallback: simple heuristic
  const n = orgName.toLowerCase();
  if (/amazon|aws|google|microsoft|azure|digitalocean|linode|vultr|hetzner|ovh/.test(n)) return 'datacenter';
  if (/vpn|nordvpn|expressvpn|mullvad|proton/.test(n)) return 'vpn';
  if (/comcast|spectrum|verizon|at&t|orange|bt group/.test(n)) return 'residential';
  return 'unknown';
}

async function handleAnomaly(req, tokenId, tokenType, ip, ua, uaHash, asnInfo, reasons, db) {
  logger.warn('[TokenSecurity] Anomaly', { tokenId, reasons });

  // Suspend token (both tables, idempotent)
  const reason = reasons.join('; ');
  const now = new Date().toISOString();
  try {
    db.prepare(`UPDATE access_tokens SET suspended_at = ?, suspension_reason = ? WHERE id = ? AND suspended_at IS NULL`).run(now, reason, tokenId);
    db.prepare(`UPDATE tokens SET suspended_at = ?, suspension_reason = ? WHERE id = ? AND suspended_at IS NULL`).run(Date.now(), reason, tokenId);
  } catch (e) {
    logger.error('[TokenSecurity] Failed to suspend:', e.message);
  }

  // Get userId for notifications
  const userId = _getTokenOwnerId(tokenId, db);

  // Create pending security-alert approval (idempotent)
  let approvalId = null;
  try {
    const existing = db.prepare(`
      SELECT id FROM device_approvals_pending
      WHERE token_id = ? AND status = 'pending' AND approval_type = 'security_alert'
    `).get(tokenId);

    if (existing) {
      approvalId = existing.id;
    } else if (userId) {
      approvalId = `sec_${crypto.randomBytes(16).toString('hex')}`;
      const expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const deviceInfo = JSON.stringify({ userAgent: ua, ip, asnOrg: asnInfo.asnOrg, orgType: asnInfo.orgType, reasons, detectedAt: now });
      db.prepare(`
        INSERT INTO device_approvals_pending
          (id, device_fingerprint, device_fingerprint_hash, token_id, user_id, device_info_json, ip_address, status, created_at, expires_at, approval_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'security_alert')
      `).run(approvalId, `security_${tokenId}`, `security_${tokenId}`, tokenId, userId, deviceInfo, ip, now, expires);
    }
  } catch (e) {
    logger.error('[TokenSecurity] Failed to create approval:', e.message);
  }

  // Write compliance audit log
  try {
    db.prepare(`
      INSERT INTO compliance_audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, ip_address, user_agent, status, details, timestamp)
      VALUES (?, 'system', ?, 'token_security_anomaly', 'token', ?, ?, ?, 'warning', ?, ?)
    `).run(`tsec_${Date.now()}_${tokenId.slice(0, 8)}`, userId, tokenId, ip, ua, JSON.stringify({ reasons, asnInfo }), Date.now());
  } catch (_) {}

  // Notify user (fire-and-forget)
  if (userId) {
    _notifyUser(userId, tokenId, tokenType, reasons, approvalId, ip, asnInfo, db).catch(e =>
      logger.error('[TokenSecurity] Notification failed:', e.message)
    );
  }

  return {
    blocked: true,
    approvalId,
    reasons,
    message: 'Token suspended due to suspicious activity. Check your notifications to review and re-approve.',
  };
}

function _getTokenOwnerId(tokenId, db) {
  try {
    const row = db.prepare('SELECT owner_id FROM access_tokens WHERE id = ?').get(tokenId);
    if (row?.owner_id) return row.owner_id;
  } catch (_) {}
  try {
    const primary = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
    return primary?.id || null;
  } catch (_) { return null; }
}

async function _notifyUser(userId, tokenId, tokenType, reasons, approvalId, ip, asnInfo, db) {
  // Get token label
  let tokenName = tokenId.slice(0, 12) + '...';
  try {
    const t = db.prepare('SELECT label FROM access_tokens WHERE id = ?').get(tokenId)
            || db.prepare('SELECT name AS label FROM tokens WHERE id = ?').get(tokenId);
    if (t?.label) tokenName = t.label;
  } catch (_) {}

  // Get user email
  let user;
  try { user = db.prepare('SELECT email, display_name, username FROM users WHERE id = ?').get(userId); } catch (_) {}

  // Get workspace id
  let wsId = 'system';
  try {
    const ws = db.prepare('SELECT id FROM workspaces WHERE owner_id = ? LIMIT 1').get(userId);
    if (ws?.id) wsId = ws.id;
  } catch (_) {}

  // In-app notification
  try {
    const notifId = `notif_sec_${crypto.randomBytes(8).toString('hex')}`;
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO notifications (id, workspace_id, user_id, type, title, message, data, is_read, created_at, expires_at)
      VALUES (?, ?, ?, 'security_alert', ?, ?, ?, 0, ?, ?)
    `).run(
      notifId, wsId, userId,
      `Security Alert: Token Suspended`,
      `Token "${tokenName}" suspended — ${reasons[0]}`,
      JSON.stringify({ tokenId, approvalId, reasons, ip, asnInfo }),
      new Date().toISOString(), expires
    );
  } catch (e) {
    logger.debug('[TokenSecurity] In-app notification failed:', e.message);
  }

  // Email
  if (user?.email) {
    try {
      const EmailService = require('../services/emailService');
      const svc = new EmailService();
      await svc.sendSecurityAlertEmail(user.email, user.display_name || user.username || 'there', {
        tokenName, tokenId, tokenType, reasons, ip, asnInfo, approvalId,
        detectedAt: new Date().toISOString(),
      });
    } catch (e) {
      logger.error('[TokenSecurity] Email failed:', e.message);
    }
  }
}

module.exports = { checkRequest };
