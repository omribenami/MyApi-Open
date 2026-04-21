const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function initDatabase(dbPath) {
  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });
  db.pragma('journal_mode = WAL');

  // Create tables
  createTables();
  runSecurityMigrations();

  return db;
}

function runSecurityMigrations() {
  // Add suspension columns to both token tables (idempotent — ignore if already exist)
  const alterStmts = [
    `ALTER TABLE tokens ADD COLUMN suspended_at INTEGER`,
    `ALTER TABLE tokens ADD COLUMN suspension_reason TEXT`,
    `ALTER TABLE access_tokens ADD COLUMN suspended_at TEXT`,
    `ALTER TABLE access_tokens ADD COLUMN suspension_reason TEXT`,
    `ALTER TABLE device_approvals_pending ADD COLUMN approval_type TEXT DEFAULT 'device'`,
  ];
  for (const sql of alterStmts) {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  }

  // Token security baseline — one row per token, set on first authenticated request
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_security_baselines (
      token_id      TEXT PRIMARY KEY,
      baseline_asn  TEXT,
      baseline_asn_org TEXT,
      baseline_ua_hash TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asn_cache (
      ip_prefix  TEXT PRIMARY KEY,
      asn        TEXT,
      asn_org    TEXT,
      org_type   TEXT,
      cached_at  TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

function createTables() {
  // Tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('personal', 'guest')),
      token_hash TEXT NOT NULL UNIQUE,
      token_prefix TEXT,
      scope TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      revoked INTEGER DEFAULT 0,
      revoked_at INTEGER,
      metadata TEXT
    )
  `);

  // Audit log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      token_id TEXT,
      token_type TEXT,
      requester TEXT,
      action TEXT NOT NULL,
      endpoint TEXT,
      method TEXT,
      scope TEXT,
      status INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT
    )
  `);

  // Vault - Identity data (encrypted)
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity_vault (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value_encrypted TEXT NOT NULL,
      category TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT
    )
  `);

  // Preferences
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      category TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Connectors configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config_encrypted TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Tickets — power-user-only complaint/issue tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      date INTEGER,
      complainer TEXT,
      complaint TEXT,
      repro_steps TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'inprogress', 'closed')),
      fix_commit TEXT,
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('discord', 'manual', 'api')),
      source_message_id TEXT
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_token ON audit_log(token_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(type);
    CREATE INDEX IF NOT EXISTS idx_identity_category ON identity_vault(category);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
  `);

  // Enforce append-only semantics on audit_log (SOC2 CC7)
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_update
    BEFORE UPDATE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only');
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_delete
    BEFORE DELETE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only');
    END;
  `);

  // Compliance audit log (immutable, SOC2 CC7)
  db.exec(`
    CREATE TABLE IF NOT EXISTS compliance_audit_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'system',
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'system',
      entity_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT DEFAULT 'info',
      details TEXT,
      timestamp INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gw_compliance_ts ON compliance_audit_logs(timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_gw_compliance_action ON compliance_audit_logs(action)`);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_gw_compliance_no_update
    BEFORE UPDATE ON compliance_audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'compliance_audit_logs is append-only');
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_gw_compliance_no_delete
    BEFORE DELETE ON compliance_audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'compliance_audit_logs is append-only');
    END;
  `);
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};
