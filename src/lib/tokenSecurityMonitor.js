const crypto = require('crypto');
const { getDatabase } = require('../config/database');
const { lookupASN } = require('./asnLookup');
const logger = require('../utils/logger');

// In-memory sliding-window velocity tracker
const _velocity = new Map(); // tokenId -> number[]  (timestamps ms)
const VELOCITY_WINDOW_MS = 60 * 1000;
const VELOCITY_LIMITS = { master: 500, personal: 300, guest: 100 };
const VELOCITY_DEFAULT = 150;

// Prune tokens whose entire window has expired so the map doesn't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - VELOCITY_WINDOW_MS;
  for (const [tokenId, times] of _velocity) {
    if (!times.length || times[times.length - 1] < cutoff) _velocity.delete(tokenId);
  }
}, 5 * 60 * 1000).unref();

// The monitor must never be silently inert: if the DB layer is unavailable we
// still block velocity-exceeded requests (we just can't persist a suspension),
// and we log loudly once so a wiring regression is visible in the logs.
let _dbUnavailableWarned = false;
function _dbUnavailable(err, vel, reasons, tokenId) {
  if (!_dbUnavailableWarned) {
    _dbUnavailableWarned = true;
    logger.error('[TokenSecurity] DB unavailable — anomaly detection degraded to velocity-only, suspensions NOT persisted. Is config/database initialized?', { error: err?.message });
  }
  if (vel.exceeded) {
    logger.warn('[TokenSecurity] Velocity exceeded with DB unavailable — blocking request without suspension', { tokenId, count: vel.count, limit: vel.limit });
    return {
      blocked: true,
      approvalId: null,
      reasons,
      message: 'Token temporarily blocked due to excessive request rate.',
    };
  }
  return { blocked: false };
}

// Paths exempt from security checks
const SKIP_PATH_RE = /^\/(health|favicon|api\/v1\/(health|ping|oauth\/callback|agentic\/device\/(poll|approve)))/;

function hashUA(ua) {
  if (!ua) return 'none';
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16);
}

function _parseSet(json) {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a.filter(Boolean) : []; }
  catch (_) { return []; }
}

// The set of org-types this token is already known to be used from. Falls back to
// the single legacy baseline_asn_org for rows created before known_org_types existed.
function _knownOrgTypes(baseline) {
  const set = new Set(_parseSet(baseline.known_org_types));
  if (set.size === 0 && baseline.baseline_asn_org) set.add(_orgTypeFromOrg(baseline.baseline_asn_org));
  return set;
}
function _knownUaHashes(baseline) {
  const set = new Set(_parseSet(baseline.known_ua_hashes));
  if (baseline.baseline_ua_hash) set.add(baseline.baseline_ua_hash);
  return set;
}

// Merge a newly-seen org-type / UA into the token's allow-lists. Called both when a
// request legitimately introduces a new UA and (via the route layer) when the user
// approves a security alert — so an approved network is never flagged again.
function learnNetwork(db, tokenId, orgType, uaHash) {
  try {
    const row = db.prepare('SELECT known_org_types, known_ua_hashes, baseline_asn_org, baseline_ua_hash FROM token_security_baselines WHERE token_id = ?').get(tokenId);
    if (!row) return;
    const orgs = _knownOrgTypes(row);
    const uas = _knownUaHashes(row);
    if (orgType && orgType !== 'unknown' && orgType !== 'private') orgs.add(orgType);
    if (uaHash) uas.add(uaHash);
    db.prepare('UPDATE token_security_baselines SET known_org_types = ?, known_ua_hashes = ?, updated_at = ? WHERE token_id = ?')
      .run(JSON.stringify([...orgs]), JSON.stringify([...uas]), new Date().toISOString(), tokenId);
  } catch (_) {}
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
  try { db = getDatabase(); } catch (e) { return _dbUnavailable(e, vel, reasons, tokenId); }

  // OAuth-delegated tokens (ChatGPT and other OAuth clients) legitimately roam across
  // networks: the agent runs on the provider's datacenter AND from the user's phone /
  // home (residential), so the same token flips between datacenter and residential
  // constantly. Network/UA drift is therefore pure false-positive for them and would
  // suspend the token on every switch (an endless security-alert/approval loop). These
  // tokens are short-lived, scoped to the OAuth grant, and rotate; the bearer secret +
  // velocity are the right controls. Skip network/UA anomaly detection — velocity only.
  try {
    const meta = db.prepare('SELECT oauth_client_id FROM access_tokens WHERE id = ?').get(tokenId);
    if (meta?.oauth_client_id) {
      if (vel.exceeded) {
        return handleAnomaly(req, tokenId, tokenType, ip, ua, uaHash, { asn: 'n/a', asnOrg: 'n/a', orgType: 'n/a' }, reasons, db);
      }
      return { blocked: false };
    }
  } catch (_) { /* fall through to standard checks */ }

  let baseline;
  try {
    baseline = db.prepare('SELECT * FROM token_security_baselines WHERE token_id = ?').get(tokenId);
  } catch (e) {
    return _dbUnavailable(e, vel, reasons, tokenId); // table not ready
  }

  // 3. ASN lookup — only await if we have a baseline to compare against
  //    Otherwise warm the cache in background and set baseline
  let asnInfo = { asn: 'unknown', asnOrg: 'Unknown', orgType: 'unknown' };
  if (baseline || vel.exceeded) {
    asnInfo = await lookupASN(ip);
  } else {
    // First request: set the baseline row immediately (without ASN), then backfill
    // the ASN fields once the async lookup resolves. This must be an UPDATE — the
    // row already exists by then, so an INSERT OR IGNORE would silently no-op and
    // leave baseline_asn NULL forever, permanently disabling network-drift detection.
    try {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO token_security_baselines (token_id, baseline_asn, baseline_asn_org, baseline_ua_hash, created_at, updated_at)
        VALUES (?, NULL, NULL, ?, ?, ?)
      `).run(tokenId, uaHash, now, now);
    } catch (_) {}
    lookupASN(ip).then(info => {
      if (!info || info.asn === 'unknown') return; // don't lock in a useless baseline
      try {
        const orgTypes = (info.orgType && info.orgType !== 'unknown' && info.orgType !== 'private')
          ? JSON.stringify([info.orgType]) : null;
        db.prepare(`
          UPDATE token_security_baselines
          SET baseline_asn = ?, baseline_asn_org = ?, known_org_types = ?, known_ua_hashes = ?, updated_at = ?
          WHERE token_id = ? AND baseline_asn IS NULL
        `).run(info.asn, info.asnOrg, orgTypes, JSON.stringify([uaHash]), new Date().toISOString(), tokenId);
      } catch (_) {}
    }).catch(() => {});
    return { blocked: false };
  }

  // 4. Compare against baseline.
  //
  // MyApi is an agent gateway: a single high-trust token is legitimately used from
  // many origins at once (ChatGPT's datacenter, a home agent on a residential ISP,
  // the dashboard on mobile). So we use accumulating allow-lists rather than a single
  // baseline that ping-pongs. A network/UA is flagged only the FIRST time it appears;
  // once the user approves it (or it's learned), it never churns again. Velocity and
  // VPN/Tor are still always enforced.
  if (baseline) {
    const knownOrgs = _knownOrgTypes(baseline);
    const knownUas = _knownUaHashes(baseline);

    // Network drift: flag only a genuinely NEW, real (classified) org-type. A type the
    // token has been seen/approved from before is not suspicious.
    if (asnInfo.orgType && asnInfo.orgType !== 'unknown' && asnInfo.orgType !== 'private'
        && !knownOrgs.has(asnInfo.orgType)) {
      reasons.push(`New network type: "${asnInfo.asnOrg}" (${asnInfo.orgType}) — token previously used only from [${[...knownOrgs].join(', ') || 'unknown'}]`);
    }

    // VPN/Tor exit is always worth confirming — unless the user has already approved
    // that exit type for this token (prevents infinite churn for a deliberate VPN user).
    if (['vpn', 'tor'].includes(asnInfo.orgType) && !knownOrgs.has(asnInfo.orgType)) {
      if (!reasons.some(r => r.includes(asnInfo.asnOrg))) {
        reasons.push(`Token used from ${asnInfo.orgType.toUpperCase()} exit: ${asnInfo.asnOrg}`);
      }
    }

    // User-Agent drift is NOT a suspension trigger: a shared agent token sends many
    // different UAs (ChatGPT, the local agent, a browser), so UA drift is almost pure
    // false-positive here and a weak anti-theft signal. Learn it silently instead.
    if (uaHash && !knownUas.has(uaHash)) {
      learnNetwork(db, tokenId, null, uaHash);
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
    `).run(`tsec_${crypto.randomBytes(8).toString('hex')}`, userId, tokenId, ip, ua, JSON.stringify({ reasons, asnInfo }), Date.now());
  } catch (_) {}

  // Notify user (fire-and-forget). 24h cool-down per (token, security_alert) avoids
  // spamming the user when the same anomaly trips repeatedly. The token is already
  // suspended above, so missing a duplicate notification is safe.
  if (userId && _shouldNotify(db, tokenId)) {
    _notifyUser(userId, tokenId, tokenType, reasons, approvalId, ip, asnInfo, db).catch(e =>
      logger.error('[TokenSecurity] Notification failed:', e.message)
    );
    _markNotified(db, approvalId);
  }

  return {
    blocked: true,
    approvalId,
    reasons,
    message: 'Token suspended due to suspicious activity. Check your notifications to review and re-approve.',
  };
}

const NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function _shouldNotify(db, tokenId) {
  try {
    const row = db.prepare(`
      SELECT last_alert_sent_at FROM device_approvals_pending
      WHERE token_id = ? AND approval_type = 'security_alert'
      ORDER BY created_at DESC LIMIT 1
    `).get(tokenId);
    if (!row?.last_alert_sent_at) return true;
    return (Date.now() - new Date(row.last_alert_sent_at).getTime()) > NOTIFY_COOLDOWN_MS;
  } catch (_) {
    return true;
  }
}

function _markNotified(db, approvalId) {
  if (!approvalId) return;
  try {
    db.prepare(`UPDATE device_approvals_pending SET last_alert_sent_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), approvalId);
  } catch (_) {}
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

module.exports = { checkRequest, learnNetwork };
