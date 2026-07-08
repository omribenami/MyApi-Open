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
  // This connection coexists with lib/db-abstraction.js's connection on the same
  // file — wait out writer contention instead of failing with SQLITE_BUSY.
  db.pragma('busy_timeout = 10000');
  // Match the main connection (src/database.js): FK enforcement is intentionally OFF
  // because legacy rows (owner_id='owner', workspace_id='system') predate the users/
  // workspaces tables. better-sqlite3 turns FKs ON by default, which made the security
  // monitor's notification inserts fail silently with FOREIGN KEY constraint errors.
  db.pragma('foreign_keys = OFF');

  // Create tables
  createTables();
  runSecurityMigrations();

  return db;
}

function runSecurityMigrations() {
  // Add suspension columns to both token tables (idempotent — ignore if already exist)
  const alterStmts = [
    // audit_log column backfill (older DBs missing token_id)
    `ALTER TABLE audit_log ADD COLUMN token_id TEXT`,
    // Token suspension
    `ALTER TABLE tokens ADD COLUMN suspended_at INTEGER`,
    `ALTER TABLE tokens ADD COLUMN suspension_reason TEXT`,
    `ALTER TABLE access_tokens ADD COLUMN suspended_at TEXT`,
    `ALTER TABLE access_tokens ADD COLUMN suspension_reason TEXT`,
    `ALTER TABLE device_approvals_pending ADD COLUMN approval_type TEXT DEFAULT 'device'`,
    `ALTER TABLE device_approvals_pending ADD COLUMN last_alert_sent_at TEXT`,
    // Token namespace prefix column (for fast prefix-based rejection)
    `ALTER TABLE tokens ADD COLUMN token_type_prefix TEXT`,
    // compliance_audit_logs schema drift: src/database.js creates it with
    // data_accessed, this module creates it with details — and writers exist for
    // both column names (createComplianceAuditLog vs logComplianceEvent/monitor).
    // Converge so every writer works regardless of which module created the table.
    `ALTER TABLE compliance_audit_logs ADD COLUMN details TEXT`,
    `ALTER TABLE compliance_audit_logs ADD COLUMN data_accessed TEXT`,
    // Accumulating allow-lists so a legitimately multi-homed agent token (e.g. used
    // from ChatGPT's datacenter AND a home residential ISP) is learned instead of
    // ping-ponging through suspend → security-alert → re-approve forever.
    `ALTER TABLE token_security_baselines ADD COLUMN known_org_types TEXT`,
    `ALTER TABLE token_security_baselines ADD COLUMN known_ua_hashes TEXT`,
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
      known_org_types TEXT,
      known_ua_hashes TEXT,
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

  // Policy engine tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS policy_rules (
      id TEXT PRIMARY KEY,
      token_id TEXT,
      host_pattern TEXT NOT NULL,
      path_pattern TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT '*',
      action TEXT NOT NULL CHECK(action IN ('block','manual_approval','rate_limit','allow')),
      rate_limit_count INTEGER,
      rate_limit_window_ms INTEGER,
      workspace_id TEXT,
      created_by TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_policy_rules_token ON policy_rules(token_id);
    CREATE INDEX IF NOT EXISTS idx_policy_rules_action ON policy_rules(action);

    CREATE TABLE IF NOT EXISTS pending_approvals (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      method TEXT NOT NULL,
      host TEXT NOT NULL,
      path TEXT NOT NULL,
      headers TEXT,
      body_preview TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied','expired')),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      decided_at INTEGER,
      decided_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pending_approvals_token ON pending_approvals(token_id);
    CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
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

  // NOTE: identity_vault / preferences / connectors tables were removed here — they
  // belonged to the legacy single-tenant Vault/PersonalBrain (src/vault/vault.js,
  // src/brain/brain.js, src/routes/api.js) which was never mounted. Live per-user
  // identity is served from users.profile_metadata, preferences from user_preferences,
  // and connectors are owned by src/database.js. See project_prod_readiness memory.

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

  // Backfill columns that older DBs may be missing
  try { db.exec(`ALTER TABLE audit_log ADD COLUMN token_id TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE audit_log ADD COLUMN token_type TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE audit_log ADD COLUMN user_agent TEXT`); } catch (_) {}

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_token ON audit_log(token_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(type);
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
