const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

class AuditLog {
  constructor() {
    this.db = getDatabase();
  }

  // Log an API access event
  log(data) {
    const {
      tokenId = null,
      tokenType = null,
      requester = null,
      action,
      endpoint = null,
      method = null,
      scope = null,
      status = null,
      ipAddress = null,
      userAgent = null,
      details = null
    } = data;

    const timestamp = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO audit_log (
        timestamp, token_id, token_type, requester, action, endpoint,
        method, scope, status, ip_address, user_agent, details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      timestamp,
      tokenId,
      tokenType,
      requester,
      action,
      endpoint,
      method,
      scope ? JSON.stringify(scope) : null,
      status,
      ipAddress,
      userAgent,
      details ? JSON.stringify(details).substring(0, 10000) : null
    );

    logger.info('Audit log entry created', {
      action,
      endpoint,
      tokenType,
      status
    });
  }

  // Get recent audit entries
  getRecent(limit = 100, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_log
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const entries = stmt.all(limit, offset);

    return entries.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      date: new Date(entry.timestamp).toISOString(),
      tokenId: entry.token_id,
      tokenType: entry.token_type,
      requester: entry.requester,
      action: entry.action,
      endpoint: entry.endpoint,
      method: entry.method,
      scope: entry.scope ? JSON.parse(entry.scope) : null,
      status: entry.status,
      ipAddress: entry.ip_address,
      userAgent: entry.user_agent,
      details: entry.details ? JSON.parse(entry.details) : null
    }));
  }

  // Get audit entries by token
  getByToken(tokenId, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_log
      WHERE token_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const entries = stmt.all(tokenId, limit);

    return entries.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      date: new Date(entry.timestamp).toISOString(),
      action: entry.action,
      endpoint: entry.endpoint,
      method: entry.method,
      status: entry.status,
      details: entry.details ? JSON.parse(entry.details) : null
    }));
  }

  // Get audit entries by time range
  getByTimeRange(startTime, endTime, limit = 1000) {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_log
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const entries = stmt.all(startTime, endTime, limit);

    return entries.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      date: new Date(entry.timestamp).toISOString(),
      tokenId: entry.token_id,
      tokenType: entry.token_type,
      requester: entry.requester,
      action: entry.action,
      endpoint: entry.endpoint,
      method: entry.method,
      scope: entry.scope ? JSON.parse(entry.scope) : null,
      status: entry.status,
      ipAddress: entry.ip_address,
      userAgent: entry.user_agent,
      details: entry.details ? JSON.parse(entry.details) : null
    }));
  }

  // Get statistics
  getStats() {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_log');
    const total = totalStmt.get().count;

    const last24hStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM audit_log
      WHERE timestamp >= ?
    `);
    const last24h = last24hStmt.get(Date.now() - 24 * 60 * 60 * 1000).count;

    const byTypeStmt = this.db.prepare(`
      SELECT token_type, COUNT(*) as count
      FROM audit_log
      WHERE token_type IS NOT NULL
      GROUP BY token_type
    `);
    const byType = byTypeStmt.all();

    const byActionStmt = this.db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_log
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `);
    const topActions = byActionStmt.all();

    return {
      total,
      last24h,
      byType: byType.reduce((acc, row) => {
        acc[row.token_type] = row.count;
        return acc;
      }, {}),
      topActions
    };
  }
}

module.exports = AuditLog;
