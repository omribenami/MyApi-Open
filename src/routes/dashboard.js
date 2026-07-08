const logger = require('../utils/logger');
const express = require('express');
const {
  getApprovedDevices,
  getPendingApprovals,
  countConnectedOAuthServices,
  getAccessTokens,
  getPersonas,
  getSkills,
  getMyMarketplaceListings,
  getKBDocuments,
  getMemories,
  db,
} = require('../database');

const router = express.Router();

function requireAuth(req, res, next) {
  const userId =
    req.user?.id ||
    req.tokenMeta?.ownerId ||
    req.tokenMeta?.userId ||
    req.session?.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.userId = String(userId);
  next();
}

async function handleDashboardMetrics(req, res) {
  try {
    const userId = req.userId;

    // Multi-tenancy: Extract workspace context from request
    const workspaceId = req.workspaceId || req.session?.currentWorkspace || req.headers['x-workspace-id'] || null;

    const approvedDevices = getApprovedDevices(userId)?.length || 0;
    const pendingApprovals = getPendingApprovals(userId)?.length || 0;

    // Connected = native OAuth tokens + Composio-connected toolkits.
    // Total = full catalog (native + all configured Composio toolkits) — the old
    // hardcoded 12-service list undercounted both sides after the Composio expansion.
    let connectedServices = countConnectedOAuthServices(userId);
    let totalServices = 12;
    try {
      const { getComposioServiceCatalog, isComposioConfigured } = require('../services/composio-integration');
      if (isComposioConfigured()) {
        const catalog = await getComposioServiceCatalog(userId); // TTL-cached sync
        connectedServices += catalog.filter((s) => s.status === 'connected').length;
        totalServices = 12 + catalog.length;
      }
    } catch (_) { /* metrics must not break on Composio errors */ }

    const activeTokens = (getAccessTokens(userId, workspaceId) || []).filter((t) => !t.revokedAt).length;
    const personas = (getPersonas(userId, workspaceId) || []).length;
    const skills = (getSkills(userId, workspaceId) || []).length;
    // Personal dashboard = THIS user's data only: count the user's OWN published
    // listings, not the platform-wide marketplace total (that lives in admin analytics).
    const marketplace = (getMyMarketplaceListings(userId, workspaceId) || []).length;
    const knowledge = (getKBDocuments(userId) || []).length;
    const memories = (getMemories(userId, workspaceId) || []).length;

    // Get recent meaningful activity — exclude internal/system noise.
    // Each row names its actor (device from device management, or token label)
    // so it's clear WHO performed the action.
    //
    // SECURITY: scope strictly to THIS user. A row belongs to the user when its
    // actor_id is the user id, its requester_id is the user id (token calls), or
    // its requester_id is the user's dashboard session (sess_<userId>). Without
    // this clause every user saw the whole platform's activity feed.
    const sessionRequesterId = `sess_${userId}`;
    const auditRows = db.prepare(`
      SELECT action, resource, timestamp, auth_type, token_label, device_name FROM audit_log
      WHERE (actor_id = ? OR requester_id = ? OR requester_id = ?)
        AND requester_id NOT IN ('system', 'anonymous', 'unknown')
        AND action NOT IN ('uncaught_exception', 'db_integrity_warning', 'blocked_sensitive_file_access')
      ORDER BY timestamp DESC LIMIT 5
    `).all(userId, userId, sessionRequesterId);
    const recentActivity = auditRows.map((item) => {
      const action = item.action || '';
      const resource = item.resource || '';
      const parts = [action, resource].filter(Boolean);
      const raw = parts.join(' ');
      const description = raw.charAt(0).toUpperCase() + raw.slice(1);
      const actor = item.auth_type === 'session'
        ? 'Dashboard'
        : (item.device_name || item.token_label || null);
      return { type: action, description, actor, authType: item.auth_type || null, createdAt: item.timestamp || null };
    });
    const lastActivityTime = recentActivity[0]?.createdAt || null;

    // API activity (7d), split by actor — token/agent calls only, never
    // dashboard browsing. Gives the dashboard a truthful per-device view of
    // who is actually using the API.
    let apiActivity = { totalCalls7d: 0, byActor: [] };
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      // SECURITY: scope to THIS user's own API calls (token/agent/device calls,
      // never dashboard browsing). A call is the user's when actor_id or
      // requester_id is the user id. Previously unscoped — every user saw the
      // whole platform's API-call counts and other users' device/token names.
      const actorRows = db.prepare(`
        SELECT
          COALESCE(device_name, token_label, requester_id) AS actor,
          MAX(auth_type) AS auth_type,
          MAX(device_id) AS device_id,
          COUNT(*) AS calls,
          MAX(timestamp) AS last_call
        FROM audit_log
        WHERE timestamp >= ?
          AND (actor_id = ? OR requester_id = ?)
          AND (auth_type IS NULL OR auth_type != 'session')
          AND requester_id NOT LIKE 'sess\\_%' ESCAPE '\\'
          AND requester_id NOT IN ('system', 'anonymous', 'unknown')
          AND action NOT IN ('auth_fail', 'uncaught_exception', 'db_integrity_warning')
        GROUP BY COALESCE(device_name, token_label, requester_id)
        ORDER BY calls DESC
        LIMIT 6
      `).all(since, userId, userId);
      apiActivity = {
        totalCalls7d: actorRows.reduce((sum, r) => sum + r.calls, 0),
        byActor: actorRows.map((r) => ({
          actor: r.actor,
          authType: r.auth_type || 'bearer',
          deviceId: r.device_id || null,
          calls: r.calls,
          lastCall: r.last_call,
        })),
      };
    } catch (_) { /* enrichment only — never break metrics */ }

    // Unread security alert notifications (device approval cross-device, token anomalies)
    let securityAlerts = 0;
    let securityAlertDetails = [];
    try {
      const alertRows = db.prepare(`
        SELECT id, title, message, data, created_at FROM notifications
        WHERE user_id = ? AND type = 'security_alert' AND is_read = 0
        ORDER BY created_at DESC LIMIT 5
      `).all(userId);
      securityAlerts = alertRows.length;
      securityAlertDetails = alertRows.map(r => ({
        id: r.id,
        title: r.title,
        message: r.message,
        createdAt: r.created_at,
        data: (() => { try { return JSON.parse(r.data); } catch (_) { return {}; } })(),
      }));
    } catch (_) {}

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json({
      approvedDevices,
      pendingApprovals,
      securityAlerts,
      securityAlertDetails,
      connectedServices,
      totalServices,
      activeTokens,
      personas,
      skills,
      marketplace,
      knowledge,
      memories,
      lastActivityTime,
      recentActivity,
      apiActivity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching dashboard metrics:', error);
    return res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Device Activity — "which of my devices & agents are calling the API, and
// what are they calling?" Aggregates THIS user's own audit_log (token/agent/
// device calls only — never dashboard browsing) into a per-device, per-service
// view with daily trend, error rate and rate-limit counts. Backs the device
// activity dashboard (the drill-down donut + linked detail/trend/table).
// ─────────────────────────────────────────────────────────────────────────
const RANGE_CONFIG = {
  '24h': { ms: 24 * 3600 * 1000, buckets: 24, bucketMs: 3600 * 1000, label: 'hour' },
  '7d': { ms: 7 * 86400000, buckets: 7, bucketMs: 86400000, label: 'day' },
  '30d': { ms: 30 * 86400000, buckets: 30, bucketMs: 86400000, label: 'day' },
};

function bucketLabel(date, mode) {
  if (mode === 'hour') {
    const h = date.getHours();
    return `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Pull the service name out of a service-proxy audit resource path, e.g.
// "/services/github/proxy" -> "github". Returns null for non-service calls.
function serviceFromResource(resource) {
  if (!resource) return null;
  const m = /^\/services\/([^/]+)\/proxy/.exec(resource);
  return m ? m[1].toLowerCase() : null;
}

// Build the full set of identities that represent THIS user's own API traffic.
// A personal account commonly has two ids in the audit log: the real user id
// (usr_…) and the legacy bootstrap 'owner' id used by early master tokens —
// plus every access token the user owns (whose id appears as requester_id on
// token/agent calls). Scoping to a single id is what makes the dashboard look
// empty when the request authenticates as the 'owner' alias instead of usr_….
function getActivityIdentity(userId) {
  const principals = new Set([String(userId)]);
  try {
    const ownerEmail = String(process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || '').trim().toLowerCase();
    let isOwner = String(userId) === 'owner';
    if (!isOwner && ownerEmail) {
      const u = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
      isOwner = String(u?.email || '').toLowerCase() === ownerEmail;
    }
    if (isOwner) {
      principals.add('owner');
      if (ownerEmail) {
        const ou = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(ownerEmail);
        if (ou?.id) principals.add(String(ou.id));
      }
    }
  } catch (_) { /* fall back to the single id */ }
  // Token ids owned by any of these principals — they appear as requester_id on
  // the token/agent calls those tokens make.
  const requesterIds = new Set(principals);
  try {
    const ph = [...principals].map(() => '?').join(',');
    db.prepare(`SELECT id FROM access_tokens WHERE owner_id IN (${ph})`).all(...principals)
      .forEach((r) => requesterIds.add(String(r.id)));
  } catch (_) { /* tokens are a refinement, not required */ }
  return { principals: [...principals], requesterIds: [...requesterIds] };
}

// Turn a raw client identity (device_name / token_label / requester_id) into a
// readable label. Bare ids and IPs become friendly names; overlong labels (an
// agent once set a paragraph as its token label) are truncated.
function humanizeClient(raw) {
  const v = String(raw || '').trim();
  if (!v) return 'Unknown client';
  if (v === 'owner' || /^usr_/.test(v)) return 'You · personal token';
  if (/^tok_/.test(v)) return 'API token';
  if (/^trg_/.test(v)) return 'Automation';
  if (/^afp_/.test(v)) return 'Device';
  if (/^(\d{1,3}\.\d{1,3}\.|[0-9a-f]{1,4}:)/i.test(v)) return 'Unattributed request';
  return v.length > 46 ? v.slice(0, 44) + '…' : v;
}

function actorTypeLabel(authType) {
  const t = String(authType || '').toLowerCase();
  if (/agent|asc/.test(t)) return 'Agent';
  if (/afp|device/.test(t)) return 'Device';
  if (/trigger|trg/.test(t)) return 'Automation';
  if (/session/.test(t)) return 'Dashboard';
  return 'API token';
}

function relativeTime(iso) {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'never';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

async function handleDeviceActivity(req, res) {
  try {
    const userId = req.userId;
    const range = RANGE_CONFIG[req.query.range] ? req.query.range : '7d';
    const cfg = RANGE_CONFIG[range];

    // Bucket window is aligned to the bucket size so labels are stable.
    const now = Date.now();
    const start = now - cfg.ms;

    const since = new Date(start).toISOString();
    const { principals, requesterIds } = getActivityIdentity(userId);
    let rows = [];
    try {
      // SECURITY: scope to THIS user's full identity set (real id + legacy
      // 'owner' alias + the user's own token ids). Never includes dashboard
      // browsing (session auth / sess_ requester).
      const actorPh = principals.map(() => '?').join(',');
      const reqPh = requesterIds.map(() => '?').join(',');
      rows = db.prepare(`
        SELECT
          timestamp,
          COALESCE(device_name, token_label, requester_id) AS client,
          device_id,
          auth_type,
          resource,
          scope,
          status_code
        FROM audit_log
        WHERE timestamp >= ?
          AND (actor_id IN (${actorPh}) OR requester_id IN (${reqPh}))
          AND (auth_type IS NULL OR auth_type != 'session')
          AND requester_id NOT LIKE 'sess\\_%' ESCAPE '\\'
          AND requester_id NOT IN ('system', 'anonymous', 'unknown')
          AND action NOT IN ('auth_fail', 'uncaught_exception', 'db_integrity_warning', 'blocked_sensitive_file_access')
        ORDER BY timestamp ASC
      `).all(since, ...principals, ...requesterIds);
    } catch (_) {
      rows = [];
    }

    // Build bucket labels (oldest → newest).
    const labels = [];
    for (let i = cfg.buckets - 1; i >= 0; i--) {
      labels.push(bucketLabel(new Date(now - i * cfg.bucketMs), cfg.label));
    }
    const bucketIndex = (tsMs) => {
      const idx = Math.floor((tsMs - start) / cfg.bucketMs);
      return Math.max(0, Math.min(cfg.buckets - 1, idx));
    };

    const devMap = new Map();
    const allDaily = new Array(cfg.buckets).fill(0);

    for (const r of rows) {
      const key = r.client || 'unknown';
      let d = devMap.get(key);
      if (!d) {
        d = {
          id: key,
          label: humanizeClient(key),
          type: actorTypeLabel(r.auth_type),
          authType: r.auth_type || 'bearer',
          deviceId: r.device_id || null,
          value: 0,
          errors: 0,
          limited: 0,
          lastSeenMs: 0,
          daily: new Array(cfg.buckets).fill(0),
          svc: {},
          scopes: new Set(),
        };
        devMap.set(key, d);
      }
      const tsMs = new Date(r.timestamp).getTime();
      const bi = bucketIndex(tsMs);
      d.value += 1;
      d.daily[bi] += 1;
      allDaily[bi] += 1;
      if (tsMs > d.lastSeenMs) d.lastSeenMs = tsMs;
      if (!d.deviceId && r.device_id) d.deviceId = r.device_id;
      const sc = Number(r.status_code);
      if (Number.isFinite(sc) && sc >= 400) d.errors += 1;
      if (sc === 429) d.limited += 1;
      const svc = serviceFromResource(r.resource);
      if (svc) d.svc[svc] = (d.svc[svc] || 0) + 1;
      if (r.scope) {
        String(r.scope).split(/[\s,]+/).filter(Boolean).slice(0, 4).forEach((s) => d.scopes.add(s));
      }
    }

    const ageMs = (lastSeenMs) => now - lastSeenMs;
    const statusFor = (lastSeenMs) => {
      const age = ageMs(lastSeenMs);
      if (age < 86400000) return 'active';
      if (age < 30 * 86400000) return 'idle';
      return 'paused';
    };

    const devices = Array.from(devMap.values())
      .map((d) => {
        const services = Object.entries(d.svc)
          .map(([key, value]) => ({ key, value }))
          .sort((a, b) => b.value - a.value);
        return {
          id: d.id,
          label: d.label,
          type: d.type,
          authType: d.authType,
          deviceId: d.deviceId,
          status: statusFor(d.lastSeenMs),
          lastSeen: relativeTime(new Date(d.lastSeenMs).toISOString()),
          value: d.value,
          errPct: d.value > 0 ? Math.round((d.errors / d.value) * 1000) / 10 : 0,
          limited: d.limited,
          daily: d.daily,
          services,
          scopes: Array.from(d.scopes).slice(0, 8),
        };
      })
      .sort((a, b) => b.value - a.value);

    const grand = devices.reduce((s, d) => s + d.value, 0);
    const totalErrors = devices.reduce((s, d) => s + Math.round((d.errPct / 100) * d.value), 0);
    const limited = devices.reduce((s, d) => s + d.limited, 0);
    const active = devices.filter((d) => d.status === 'active').length;

    // Aggregate service totals across all devices.
    const svcAgg = {};
    for (const d of devices) {
      for (const s of d.services) svcAgg[s.key] = (svcAgg[s.key] || 0) + s.value;
    }
    const serviceTotals = Object.entries(svcAgg)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.json({
      range,
      bucketLabels: labels,
      grand,
      deviceCount: devices.length,
      activeCount: active,
      errorRate: grand > 0 ? Math.round((totalErrors / grand) * 1000) / 10 : 0,
      rateLimited: limited,
      allDaily,
      serviceTotals,
      devices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching device activity:', error);
    return res.status(500).json({ error: 'Failed to load device activity' });
  }
}

// Support both old and new frontend bundles.
router.get('/metrics', requireAuth, handleDashboardMetrics);
router.get('/stats', requireAuth, handleDashboardMetrics);
router.get('/device-activity', requireAuth, handleDeviceActivity);

module.exports = router;
