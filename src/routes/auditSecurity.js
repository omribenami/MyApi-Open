const express = require('express');
const { db, createAuditLog } = require('../database');

function buildWorkspaceRateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const workspaceId = req.workspaceId || req.query.workspace || 'personal';
    const actor = req.user?.id || req.tokenMeta?.ownerId || req.tokenMeta?.tokenId || req.ip || 'anonymous';
    const bucket = `${workspaceId}:${actor}`;
    const now = Date.now();

    const list = (hits.get(bucket) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - list[0])) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Workspace rate limit exceeded', retryAfter });
    }
    list.push(now);
    hits.set(bucket, list);
    res.set('X-Workspace-RateLimit-Remaining', String(Math.max(0, max - list.length)));
    return next();
  };
}

function createAuditSecurityRouter({ sessionDb, sessionStore }) {
  const router = express.Router();
  const securityLimiter = buildWorkspaceRateLimiter({
    windowMs: Number(process.env.WORKSPACE_SECURITY_WINDOW_MS || 60000),
    max: Number(process.env.WORKSPACE_SECURITY_MAX || (process.env.NODE_ENV === 'test' ? 20 : 60)),
  });

  router.use((req, res, next) => {
    const p = req.path || '';
    const sensitive = p.startsWith('/audit') || p.startsWith('/security/');
    if (!sensitive) return next();
    return securityLimiter(req, res, next);
  });

  router.get('/audit/logs', (req, res) => {
    try {
      const scope = String(req.tokenMeta?.scope || '');
      if (!(scope === 'full' || scope.includes('admin'))) {
        return res.status(403).json({ error: 'Only master/session/admin users can view audit logs' });
      }

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const actor = String(req.query.actor || '').trim();
      const action = String(req.query.action || '').trim();
      const resource = String(req.query.resource || '').trim();
      const dateFrom = String(req.query.dateFrom || req.query.from || '').trim();
      const dateTo = String(req.query.dateTo || req.query.to || '').trim();
      const workspaceId = req.workspaceId || req.query.workspace || null;

      const clauses = [];
      const params = [];
      if (workspaceId) {
        clauses.push('(workspace_id = ? OR workspace_id IS NULL)');
        params.push(workspaceId);
      }
      if (actor) {
        clauses.push('(actor_id = ? OR requester_id = ? OR json_extract(details, "$.actor") = ?)');
        params.push(actor, actor, actor);
      }
      if (action) {
        clauses.push('action LIKE ?');
        params.push(`%${action}%`);
      }
      if (resource) {
        clauses.push('resource LIKE ?');
        params.push(`%${resource}%`);
      }
      if (dateFrom) {
        clauses.push('timestamp >= ?');
        params.push(dateFrom);
      }
      if (dateTo) {
        clauses.push('timestamp <= ?');
        params.push(dateTo);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`);
      const total = countStmt.get(...params).count;

      const rowsStmt = db.prepare(`
        SELECT id, timestamp, workspace_id, requester_id, actor_id, actor_type, action, resource,
               endpoint, http_method, status_code, scope, ip, details
        FROM audit_log
        ${where}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `);

      const rows = rowsStmt.all(...params, limit, offset).map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        workspaceId: row.workspace_id,
        actor: row.actor_id || row.requester_id,
        actorType: row.actor_type || 'user',
        action: row.action,
        resource: row.resource,
        endpoint: row.endpoint,
        method: row.http_method,
        statusCode: row.status_code,
        scope: row.scope,
        ip: row.ip,
        details: row.details ? JSON.parse(row.details) : null,
      }));

      res.json({ data: rows, meta: { total, limit, offset } });
    } catch (err) {
      console.error('Error in audit/logs:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/audit/summary', (req, res) => {
    try {
      const scope = String(req.tokenMeta?.scope || '');
      if (!(scope === 'full' || scope.includes('admin'))) {
        return res.status(403).json({ error: 'Only master/session/admin users can view audit summary' });
      }
      const workspaceId = req.workspaceId || req.query.workspace || null;
      const where = workspaceId ? 'WHERE (workspace_id = ? OR workspace_id IS NULL)' : '';
      const arg = workspaceId ? [workspaceId] : [];

      const total = db.prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`).get(...arg).count;
      const last24h = db.prepare(`SELECT COUNT(*) as count FROM audit_log ${where ? where + ' AND' : 'WHERE'} timestamp >= ?`).get(...arg, new Date(Date.now() - 86400000).toISOString()).count;
      const byAction = db.prepare(`SELECT action, COUNT(*) as count FROM audit_log ${where} GROUP BY action ORDER BY count DESC LIMIT 10`).all(...arg);
      const byResource = db.prepare(`SELECT resource, COUNT(*) as count FROM audit_log ${where} GROUP BY resource ORDER BY count DESC LIMIT 10`).all(...arg);

      res.json({ data: { total, last24h, byAction, byResource } });
    } catch (err) {
      console.error('Error in audit/summary:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/security/sessions', (req, res) => {
    const userId = req.user?.id || req.tokenMeta?.ownerId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const sidCurrent = req.sessionID || null;
    const rows = sessionDb.prepare('SELECT sid, sess, expire FROM sessions ORDER BY expire DESC').all();
    const sessions = rows
      .map((r) => {
        let sess;
        try { sess = JSON.parse(r.sess); } catch { return null; }
        const sessUserId = sess?.user?.id || null;
        if (String(sessUserId || '') !== String(userId)) return null;
        return {
          id: r.sid,
          userId: sessUserId,
          isCurrent: sidCurrent === r.sid,
          expiresAt: r.expire ? new Date(r.expire).toISOString() : null,
          createdAt: sess?.cookie?.originalMaxAge ? new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 - sess.cookie.originalMaxAge)).toISOString() : null,
          ip: sess?.ip || null,
          userAgent: sess?.userAgent || null,
        };
      })
      .filter(Boolean);

    res.json({ data: sessions });
  });

  router.post('/security/sessions/revoke', express.json(), (req, res) => {
    const userId = req.user?.id || req.tokenMeta?.ownerId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { sessionId, all = false } = req.body || {};
    const currentSid = req.sessionID || null;

    const rows = sessionDb.prepare('SELECT sid, sess FROM sessions').all();
    const owned = rows.filter((r) => {
      try {
        const sess = JSON.parse(r.sess);
        return String(sess?.user?.id || '') === String(userId);
      } catch {
        return false;
      }
    });

    let targets = [];
    if (all) {
      targets = owned.map((r) => r.sid).filter((sid) => sid !== currentSid);
    } else if (sessionId) {
      const exists = owned.find((r) => r.sid === sessionId);
      if (!exists) return res.status(404).json({ error: 'Session not found' });
      targets = [sessionId];
    } else {
      return res.status(400).json({ error: 'Provide sessionId or all=true' });
    }

    for (const sid of targets) {
      sessionStore.destroy(sid, () => {});
    }

    createAuditLog({
      requesterId: req.tokenMeta?.tokenId || `sess_${userId}`,
      workspaceId: req.workspaceId || null,
      actorId: userId,
      actorType: 'user',
      action: all ? 'security_sessions_revoke_all' : 'security_session_revoke',
      resource: '/api/v1/security/sessions/revoke',
      endpoint: '/api/v1/security/sessions/revoke',
      httpMethod: 'POST',
      statusCode: 200,
      scope: req.tokenMeta?.scope || 'full',
      ip: req.ip,
      details: { revokedCount: targets.length },
    });

    return res.json({ success: true, revoked: targets.length });
  });

  return router;
}

module.exports = { createAuditSecurityRouter, buildWorkspaceRateLimiter };
