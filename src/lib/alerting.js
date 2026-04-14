/**
 * Security Alerting Module — SOC 2 Phase 3 (3.3)
 *
 * Tracks security events in memory and sends email alerts when thresholds are exceeded.
 *
 * Thresholds:
 *   - Failed logins:        5+ from the same IP within 5 minutes
 *   - Scope violations:     3+ from the same IP within 1 minute
 *   - Device approval abuse: 10+ requests from the same IP within 10 minutes
 *
 * Alerts are suppressed for 15 minutes after the first firing to prevent alert storms.
 * Alert destination: SECURITY_ALERT_EMAIL env var (falls back to ADMIN_EMAIL).
 */

const THRESHOLDS = {
  failed_login:  { count: 5,  windowMs: 5  * 60 * 1000, label: 'failed login attempts',         windowLabel: '5 minutes'  },
  scope_violation: { count: 3, windowMs: 60 * 1000,      label: 'scope violations',              windowLabel: '1 minute'   },
  device_abuse:  { count: 10, windowMs: 10 * 60 * 1000,  label: 'device approval requests',      windowLabel: '10 minutes' },
};

const SUPPRESSION_WINDOW_MS = 15 * 60 * 1000; // 15 min between repeat alerts for same IP+type

// IP -> [timestamp, ...]
const trackers = {
  failed_login:    new Map(),
  scope_violation: new Map(),
  device_abuse:    new Map(),
};

// `${type}:${ip}` -> last alerted timestamp
const suppressionMap = new Map();

function pruneOld(map, windowMs) {
  const cutoff = Date.now() - windowMs;
  for (const [key, timestamps] of map.entries()) {
    const fresh = timestamps.filter(t => t > cutoff);
    if (fresh.length === 0) map.delete(key);
    else map.set(key, fresh);
  }
}

function isSuppressed(suppressKey) {
  const last = suppressionMap.get(suppressKey);
  return last && (Date.now() - last) < SUPPRESSION_WINDOW_MS;
}

/**
 * Sanitize IP address for safe inclusion in email headers/body.
 * Strips anything that isn't a valid IPv4/IPv6/bracket character.
 * Prevents email header injection via crafted IP strings containing \r\n.
 */
function sanitizeAlertIP(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return 'unknown';
  // Allow: digits, dots, colons, hex a-f, brackets (IPv6), hyphen
  const safe = rawIp.replace(/[^0-9a-fA-F:.\[\]-]/g, '');
  return safe.slice(0, 45) || 'unknown'; // max IPv6 addr length
}

function sendAlert(type, ip, count) {
  const safeIp = sanitizeAlertIP(ip);
  const suppressKey = `${type}:${safeIp}`;
  if (isSuppressed(suppressKey)) return;
  suppressionMap.set(suppressKey, Date.now());

  const alertEmail = process.env.SECURITY_ALERT_EMAIL || process.env.ADMIN_EMAIL;
  if (!alertEmail) return;

  const cfg = THRESHOLDS[type];
  const subject = `[SECURITY ALERT] ${count} ${cfg.label} from ${safeIp}`;
  const body = [
    `Security threshold exceeded on MyApi.`,
    ``,
    `Event:    ${type.replace(/_/g, ' ')}`,
    `IP:       ${safeIp}`,
    `Count:    ${count} in the last ${cfg.windowLabel}`,
    `Time:     ${new Date().toISOString()}`,
    ``,
    `Review audit logs immediately. If this is unexpected, consider blocking this IP.`,
  ].join('\n');

  try {
    // Lazy-require to avoid circular deps and allow tests to run without full server
    const db = require('../database');
    if (typeof db.queueEmail === 'function') {
      db.queueEmail('system', alertEmail, subject, body);
    }
  } catch (_) {
    // Email queueing is best-effort; never throw from an alerting side-effect
  }
}

function track(type, ip) {
  const cfg = THRESHOLDS[type];
  const tracker = trackers[type];

  pruneOld(tracker, cfg.windowMs);

  const now = Date.now();
  const list = tracker.get(ip) || [];
  list.push(now);
  tracker.set(ip, list);

  const recent = list.filter(t => t > now - cfg.windowMs);
  tracker.set(ip, recent); // keep only in-window entries

  if (recent.length >= cfg.count) {
    sendAlert(type, ip, recent.length);
  }
}

module.exports = {
  trackFailedLogin(ip)        { track('failed_login',    ip || 'unknown'); },
  trackScopeViolation(ip)     { track('scope_violation', ip || 'unknown'); },
  trackDeviceApprovalAbuse(ip){ track('device_abuse',    ip || 'unknown'); },

  // Exported for testing
  _suppressionMap: suppressionMap,
  _trackers: trackers,
};
