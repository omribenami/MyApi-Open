const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// ============================================================================
// NEW DATABASE ABSTRACTION LAYER
// ============================================================================
// Import the new database abstraction layer
// This provides a unified interface for both local SQLite and external PostgreSQL
const dbAbstraction = require('./lib/db-abstraction');
const dbWrapper = require('./lib/db-wrapper');

// Get the database instance (will use abstraction layer)
let db = null;
let dbAsync = null;  // For new async code

// Detect database mode for backward compatibility checks
const dbType = process.env.DATABASE_TYPE || 'sqlite';
const isPostgreSQLMode = dbType === 'postgres' || dbType === 'postgresql' || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'));
const isSQLiteMode = !isPostgreSQLMode;
const isMongoDBMode = false; // Deprecated - kept for code that checks this

// Initialize database using abstraction layer (use singleton so db-wrapper shares the same pool)
try {
  const dbAdapterInstance = dbAbstraction.getDatabase();
  db = dbAdapterInstance; // For sync compatibility (has .prepare() for SQLite)
  dbAsync = dbWrapper; // For async operations
  
  console.log(`[Database] Initialized: ${isPostgreSQLMode ? 'PostgreSQL' : 'SQLite'}`);
  
  // For SQLite, configure pragmas for better concurrency and crash resilience
  if (isSQLiteMode && db.pragma) {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 10000');
    db.pragma('synchronous = NORMAL');
    // Checkpoint every 200 pages (~1.6MB) instead of 1000 to keep WAL small
    // and reduce data loss / corruption window on unclean shutdown.
    db.pragma('wal_autocheckpoint = 200');
    // Force a full checkpoint on startup to flush any partially-written WAL
    // left over from a previous crash (prevents "block checksum mismatch").
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      console.log('[Database] WAL checkpoint completed on startup');
    } catch (checkpointErr) {
      console.warn('[Database] WAL checkpoint on startup failed (non-fatal):', checkpointErr.message);
    }
  }
} catch (err) {
  console.error('[Database] Failed to initialize:', err.message);
  throw err;
}

const MigrationRunner = require('./lib/migrationRunner');
const { getCurrentRequestId } = require('./lib/request-context');
const {
  encrypt,
  decrypt,
  generateEncryptionKey,
  hashKey,
  generateSalt,
  deriveKey,
  ENCRYPTION_VERSION,
} = require('./lib/encryption');

function normalizeOwnerId(ownerId) {
  const v = String(ownerId || '').trim();
  if (!v) console.warn('[db] normalizeOwnerId: empty ownerId, falling back to "owner"');
  return v || 'owner';
}

/**
 * Check database health by running a simple query.
 * Returns { healthy: true } or { healthy: false, error: '...' }.
 */
function checkDatabaseHealth() {
  if (isMongoDBMode && mongodbAdapter) {
    return mongodbAdapter.checkDatabaseHealth();
  }
  
  // For PostgreSQL, just return healthy
  if (isPostgreSQLMode) {
    return { healthy: true };
  }
  
  // For SQLite, run pragma check
  try {
    if (isSQLiteMode && db.pragma) {
      const result = db.pragma('quick_check', { simple: true });
      // simple:true returns plain string 'ok'
      if (result === 'ok' || result === undefined) {
        return { healthy: true };
      }
      // db-abstraction shim may return array of objects: [{"quick_check":"ok"}]
      if (Array.isArray(result) && result[0]?.quick_check === 'ok') {
        return { healthy: true };
      }
      // pragma returns an object in some versions, check for ok property
      if (typeof result === 'object' && result !== null && !Array.isArray(result) && result.ok) {
        return { healthy: true };
      }
      return { healthy: false, error: `quick_check returned: ${JSON.stringify(result)}` };
    }
    return { healthy: true }; // Default to healthy
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

// BUG-5: Helper function for safe migrations with logging
function safeMigration(sql, ignoreColumnExists = true) {
  try {
    db.exec(sql);
    return true;
  } catch (error) {
    // Expected error: column already exists
    if (ignoreColumnExists && (error.message?.includes('duplicate column') || error.message?.includes('already exists'))) {
      return true; // Silently ignore expected errors
    }
    // Log unexpected errors
    console.warn('[Database Migration] Unexpected error:', {
      sql: sql.substring(0, 100),
      error: error.message
    });
    return false;
  }
}

// Initialize database schema
function initDatabase() {
  // MongoDB mode: use adapter's initialization
  if (isMongoDBMode && mongodbAdapter) {
    return mongodbAdapter.initDatabase();
  }
  
  // PostgreSQL mode: tables already exist from migration, skip SQLite creation
  if (isPostgreSQLMode) {
    console.log('[Database] PostgreSQL mode - skipping table creation (tables migrated)');
    return;
  }
  
  // SQLite mode: create tables
  // Phase 3.5 Pre-Migration: Drop old notification tables before schema initialization
  try { db.exec('DROP TABLE IF EXISTS notification_settings'); } catch (e) {}
  try { db.exec('DROP TABLE IF EXISTS notifications'); } catch (e) {}
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_tokens (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT,
      encrypted_token TEXT NOT NULL,
      token_preview TEXT,
      service TEXT,
      website_url TEXT,
      discovered_api_url TEXT,
      discovered_auth_scheme TEXT,
      discovered_metadata TEXT,
      last_discovered_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_tokens (
      id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      config TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      requester_id TEXT,
      workspace_id TEXT,
      actor_id TEXT,
      actor_type TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      endpoint TEXT,
      http_method TEXT,
      status_code INTEGER,
      scope TEXT,
      ip TEXT,
      details TEXT
    );

    CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_update
    BEFORE UPDATE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_delete
    BEFORE DELETE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only');
    END;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      email TEXT,
      avatar_url TEXT,
      timezone TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT,
      plan TEXT DEFAULT 'free'
    );

    CREATE TABLE IF NOT EXISTS handshakes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      requested_scopes TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approved_at TEXT,
      revoked_at TEXT,
      approved_token_id TEXT
    );

    CREATE TABLE IF NOT EXISTS personas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      soul_content TEXT NOT NULL,
      description TEXT,
      template_data TEXT,
      active INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      owner_id TEXT DEFAULT 'owner',
      workspace_id TEXT
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id TEXT PRIMARY KEY,
      service_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT,
      scope TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_status (
      id TEXT PRIMARY KEY,
      service_name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'disconnected',
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_state_tokens (
      id TEXT PRIMARY KEY,
      state_token TEXT NOT NULL UNIQUE,
      service_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_pending_logins (
      id TEXT PRIMARY KEY,
      service_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      user_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_pending_logins_token ON oauth_pending_logins(token);
    CREATE INDEX IF NOT EXISTS idx_oauth_pending_logins_expires ON oauth_pending_logins(expires_at);

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ai_model TEXT NOT NULL DEFAULT 'gemini-pro',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding_vector TEXT,
      created_at TEXT NOT NULL,
      tokens_used INTEGER,
      private INTEGER DEFAULT 0,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS context_cache (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      ttl INTEGER,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS kb_documents (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding_vector TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT 'owner',
      workspace_id TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories(owner_id);
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(owner_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS scope_definitions (
      scope_name TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      permissions TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_token_scopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id TEXT NOT NULL,
      scope_name TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      FOREIGN KEY (token_id) REFERENCES access_tokens(id),
      FOREIGN KEY (scope_name) REFERENCES scope_definitions(scope_name),
      UNIQUE(token_id, scope_name)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_access_tokens_owner ON access_tokens(owner_id);
    CREATE INDEX IF NOT EXISTS idx_personas_active ON personas(active);
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_service ON oauth_tokens(service_name);
    CREATE INDEX IF NOT EXISTS idx_oauth_state_tokens_state ON oauth_state_tokens(state_token);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_context_cache_key ON context_cache(key);
    CREATE INDEX IF NOT EXISTS idx_context_cache_expires ON context_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_kb_documents_source ON kb_documents(source);
    CREATE INDEX IF NOT EXISTS idx_access_token_scopes_token ON access_token_scopes(token_id);
    CREATE INDEX IF NOT EXISTS idx_access_token_scopes_scope ON access_token_scopes(scope_name);

    CREATE TABLE IF NOT EXISTS persona_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id INTEGER NOT NULL,
      document_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(persona_id, document_id)
    );

    CREATE TABLE IF NOT EXISTS persona_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(persona_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      version TEXT DEFAULT '1.0.0',
      author TEXT,
      category TEXT DEFAULT 'custom',
      script_content TEXT,
      config_json TEXT,
      repo_url TEXT,
      active INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id INTEGER NOT NULL,
      document_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(skill_id, document_id)
    );

    CREATE INDEX IF NOT EXISTS idx_skills_active ON skills(active);
    CREATE INDEX IF NOT EXISTS idx_skill_documents_skill ON skill_documents(skill_id);
    CREATE INDEX IF NOT EXISTS idx_persona_skills_persona ON persona_skills(persona_id);
    CREATE INDEX IF NOT EXISTS idx_persona_skills_skill ON persona_skills(skill_id);

    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      tags TEXT DEFAULT '',
      price TEXT DEFAULT 'free',
      status TEXT DEFAULT 'active',
      avg_rating REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      install_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      review TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id),
      UNIQUE(listing_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_marketplace_listings_owner ON marketplace_listings(owner_id);
    CREATE INDEX IF NOT EXISTS idx_marketplace_listings_type ON marketplace_listings(type);
    CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
    CREATE INDEX IF NOT EXISTS idx_marketplace_ratings_listing ON marketplace_ratings(listing_id);

    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      icon TEXT,
      description TEXT,
      auth_type TEXT NOT NULL,
      api_endpoint TEXT,
      documentation_url TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES service_categories(id)
    );

    CREATE TABLE IF NOT EXISTS service_api_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      method_name TEXT NOT NULL,
      http_method TEXT DEFAULT 'GET',
      endpoint TEXT NOT NULL,
      description TEXT,
      parameters TEXT,
      response_example TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (service_id) REFERENCES services(id),
      UNIQUE(service_id, method_name)
    );

    CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
    CREATE INDEX IF NOT EXISTS idx_service_api_methods_service ON service_api_methods(service_id);

    CREATE TABLE IF NOT EXISTS key_versions (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      algorithm TEXT DEFAULT 'aes-256-gcm',
      key_hash TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      rotated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      call_count INTEGER DEFAULT 0,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      limit_per_hour INTEGER DEFAULT 100,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, service_name, window_start)
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limits_user_service ON rate_limits(user_id, service_name);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start, window_end);

    -- Device Approval System Tables
    CREATE TABLE IF NOT EXISTS approved_devices (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      device_fingerprint TEXT NOT NULL,
      device_fingerprint_hash TEXT NOT NULL UNIQUE,
      device_name TEXT NOT NULL,
      device_info_json TEXT,
      ip_address TEXT NOT NULL,
      approved_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (token_id) REFERENCES access_tokens(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS device_approvals_pending (
      id TEXT PRIMARY KEY,
      device_fingerprint TEXT NOT NULL,
      device_fingerprint_hash TEXT NOT NULL,
      token_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      device_info_json TEXT,
      ip_address TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      approved_at TEXT,
      denied_at TEXT,
      denial_reason TEXT,
      FOREIGN KEY (token_id) REFERENCES access_tokens(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_approved_devices_user_token ON approved_devices(user_id, token_id);
    CREATE INDEX IF NOT EXISTS idx_approved_devices_fingerprint ON approved_devices(device_fingerprint_hash);
    CREATE INDEX IF NOT EXISTS idx_pending_approvals_user ON device_approvals_pending(user_id);
    CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON device_approvals_pending(status);
    CREATE INDEX IF NOT EXISTS idx_pending_approvals_expires ON device_approvals_pending(expires_at);

    -- Service Preferences Table (Phase 3)
    CREATE TABLE IF NOT EXISTS service_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      preferences_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, service_name)
    );

    -- Old notification tables removed in favor of Phase 3.5 schema below

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      resource_name TEXT,
      actor_type TEXT,
      actor_id TEXT,
      actor_name TEXT,
      details TEXT,
      result TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS email_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email_address TEXT NOT NULL,
      notification_id TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      html_body TEXT,
      status TEXT DEFAULT 'pending',
      sent_at TEXT,
      failed_reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
    CREATE INDEX IF NOT EXISTS idx_service_preferences_user ON service_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_service_preferences_service ON service_preferences(service_name);

    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      notified_at TEXT,
      invited_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
    CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

    -- Phase 1: Teams & Multi-Tenancy Tables
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      slug TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      UNIQUE(workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS workspace_invitations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      accepted_by_user_id TEXT REFERENCES users(id),
      UNIQUE(workspace_id, email)
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_workspace_invitations_expires ON workspace_invitations(expires_at);
  `);

  // Add device_id column to access_logs if not already present
  try {
    db.exec('ALTER TABLE audit_log ADD COLUMN device_id TEXT');
  } catch (e) {
    // Column already exists — ignore
  }

  // Seed default scopes if not already present
  // seedDefaultScopes(); // TODO: MongoDB version

  // Seed example personas
  // seedExamplePersonas(); // TODO: MongoDB version

  // Seed service categories and services
  // seedServiceCategories(); // TODO: MongoDB version
  // seedServices(); // TODO: MongoDB version

  // Vault token schema migrations
  const vaultTokenMigrations = [
    'ALTER TABLE vault_tokens ADD COLUMN service TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN website_url TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN discovered_api_url TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN discovered_auth_scheme TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN discovered_metadata TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN last_discovered_at TEXT',
    // BUG-14: Add owner_id to enforce workspace scoping on vault tokens
    'ALTER TABLE vault_tokens ADD COLUMN owner_id TEXT DEFAULT \'owner\''
  ];
  for (const migration of vaultTokenMigrations) {
    try {
      db.exec(migration);
    } catch (e) {
      // Column already exists — ignore
    }
  }

  // Add allowed_personas column to access_tokens if not already present (migration)
  try {
    db.exec('ALTER TABLE access_tokens ADD COLUMN allowed_personas TEXT');
  } catch (e) {
    // Column already exists — ignore
  }

  // Add users.plan column if not already present (migration)
  try {
    db.exec("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'");
  } catch (e) {
    // Column already exists — ignore
  }
  // Add users.avatar_url column if not already present (migration)
  try {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  } catch (e) {
    // Column already exists — ignore
  }
  // BUG-5: Use safeMigration for better error logging
  // Stripe subscription columns
  safeMigration("ALTER TABLE users ADD COLUMN stripe_subscription_status TEXT");
  safeMigration("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT");
  safeMigration("ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT");
  
  // 2FA columns
  safeMigration("ALTER TABLE users ADD COLUMN totp_secret TEXT");
  safeMigration("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0");

  // Per-user extended identity storage (JSON blob for fields beyond the core users columns)
  safeMigration("ALTER TABLE users ADD COLUMN profile_metadata TEXT DEFAULT NULL");

  // Migration tracking (non-destructive, rollback-friendly)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL,
        checksum TEXT
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied ON schema_migrations(applied_at DESC)`);
  } catch (e) {
    console.warn('[Database] schema_migrations table already exists:', e.message);
  }

  // Phase 5: Encryption & Compliance
  // Encryption metadata columns
  safeMigration("ALTER TABLE vault_tokens ADD COLUMN encryption_version INTEGER DEFAULT 1");
  safeMigration("ALTER TABLE oauth_tokens ADD COLUMN encryption_version INTEGER DEFAULT 1");
  safeMigration("ALTER TABLE users ADD COLUMN pii_encrypted INTEGER DEFAULT 0");
  safeMigration("ALTER TABLE conversations ADD COLUMN encryption_version INTEGER DEFAULT 1");

  // Encryption key management table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        key_id TEXT UNIQUE,
        algorithm TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_salt TEXT,
        master_key_id TEXT,
        created_at INTEGER NOT NULL,
        rotated_at INTEGER,
        status TEXT DEFAULT 'active',
        created_by_user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
      )
    `);
    // Index for workspace queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_encryption_keys_workspace ON encryption_keys(workspace_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_encryption_keys_status ON encryption_keys(status)`);
  } catch (e) {
    console.warn('[Database] Encryption keys table already exists:', e.message);
  }

  // Backward-compatible enrichments for existing encryption_keys tables
  safeMigration("ALTER TABLE encryption_keys ADD COLUMN key_id TEXT");
  safeMigration("ALTER TABLE encryption_keys ADD COLUMN master_key_id TEXT");
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_encryption_keys_key_id ON encryption_keys(key_id)`);

  // Data retention policies table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS data_retention_policies (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        retention_days INTEGER NOT NULL,
        auto_delete INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by_user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        UNIQUE(workspace_id, entity_type)
      )
    `);
    // Index for queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_retention_policies_workspace ON data_retention_policies(workspace_id)`);
  } catch (e) {
    console.warn('[Database] Retention policies table already exists:', e.message);
  }

  // Compliance audit logs table (immutable append-only)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS compliance_audit_logs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        data_accessed TEXT,
        ip_address TEXT,
        user_agent TEXT,
        status TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
      )
    `);
    // Index for queries (immutable, append-only)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_compliance_logs_workspace ON compliance_audit_logs(workspace_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_compliance_logs_timestamp ON compliance_audit_logs(timestamp)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_compliance_logs_user ON compliance_audit_logs(user_id)`);

    // Enforce append-only semantics
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_compliance_audit_no_update
      BEFORE UPDATE ON compliance_audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'compliance_audit_logs is append-only');
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_compliance_audit_no_delete
      BEFORE DELETE ON compliance_audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'compliance_audit_logs is append-only');
      END;
    `);
  } catch (e) {
    console.warn('[Database] Compliance audit logs table already exists:', e.message);
  }

  // PII secure storage table (separate from login-critical users table)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_pii_secure (
        user_id TEXT PRIMARY KEY,
        encrypted_payload TEXT NOT NULL,
        salt_hex TEXT NOT NULL,
        encryption_version INTEGER DEFAULT 1,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_user_pii_secure_updated ON user_pii_secure(updated_at DESC)`);
  } catch (e) {
    console.warn('[Database] user_pii_secure table already exists:', e.message);
  }

  // Phase 5 migrations: Token encryption key rotation, rate limiting, audit logs
  safeMigration("ALTER TABLE oauth_tokens ADD COLUMN key_version INTEGER DEFAULT 1");
  safeMigration("ALTER TABLE oauth_tokens ADD COLUMN last_api_call TEXT");
  safeMigration("ALTER TABLE audit_log ADD COLUMN service_name TEXT");
  safeMigration("ALTER TABLE audit_log ADD COLUMN api_method TEXT");
  safeMigration("ALTER TABLE audit_log ADD COLUMN api_endpoint TEXT");
  safeMigration("ALTER TABLE audit_log ADD COLUMN status_code INTEGER");
  safeMigration("ALTER TABLE audit_log ADD COLUMN response_time_ms INTEGER");
  safeMigration("ALTER TABLE audit_log ADD COLUMN workspace_id TEXT");
  safeMigration("ALTER TABLE audit_log ADD COLUMN actor_id TEXT");
  safeMigration("ALTER TABLE audit_log ADD COLUMN actor_type TEXT");
  safeMigration("ALTER TABLE audit_log ADD COLUMN endpoint TEXT");
  safeMigration("ALTER TABLE audit_log ADD COLUMN http_method TEXT");
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_ts ON audit_log(workspace_id, timestamp DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_log_action_ts ON audit_log(action, timestamp DESC)');

  // Multi-tenant ownership columns (security isolation)
  const ownerMigrations = [
    "ALTER TABLE personas ADD COLUMN owner_id TEXT",
    "ALTER TABLE skills ADD COLUMN owner_id TEXT",
    "ALTER TABLE kb_documents ADD COLUMN owner_id TEXT"
  ];
  for (const migration of ownerMigrations) {
    try { db.exec(migration); } catch (e) {}
  }
  db.exec("UPDATE personas SET owner_id = COALESCE(owner_id, 'owner') WHERE owner_id IS NULL OR owner_id = ''");
  db.exec("UPDATE skills SET owner_id = COALESCE(owner_id, 'owner') WHERE owner_id IS NULL OR owner_id = ''");
  db.exec("UPDATE kb_documents SET owner_id = COALESCE(owner_id, 'owner') WHERE owner_id IS NULL OR owner_id = ''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_personas_owner ON personas(owner_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_skills_owner ON skills(owner_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_kb_documents_owner ON kb_documents(owner_id)');

  // Master token persistence: Store encrypted raw token for retrieval across sessions
  safeMigration("ALTER TABLE access_tokens ADD COLUMN encrypted_token TEXT");

  // Phase 1: Teams & Multi-Tenancy - Add workspace_id to relevant tables
  const phase1MultiTenancyMigrations = [
    "ALTER TABLE access_tokens ADD COLUMN workspace_id TEXT",
    "ALTER TABLE oauth_tokens ADD COLUMN workspace_id TEXT",
    "ALTER TABLE vault_tokens ADD COLUMN workspace_id TEXT",
    "ALTER TABLE marketplace_listings ADD COLUMN workspace_id TEXT",
    "ALTER TABLE skills ADD COLUMN workspace_id TEXT",
    "ALTER TABLE personas ADD COLUMN workspace_id TEXT",
    "ALTER TABLE services ADD COLUMN workspace_id TEXT",
    "ALTER TABLE conversations ADD COLUMN workspace_id TEXT",
    "ALTER TABLE kb_documents ADD COLUMN workspace_id TEXT"
  ];
  
  for (const migration of phase1MultiTenancyMigrations) {
    try { db.exec(migration); } catch (e) {}
  }

  // Create workspace indexes for multi-tenancy
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_access_tokens_workspace ON access_tokens(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_workspace ON oauth_tokens(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_vault_tokens_workspace ON vault_tokens(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_marketplace_listings_workspace ON marketplace_listings(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_skills_workspace ON skills(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_personas_workspace ON personas(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_services_workspace ON services(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_kb_documents_workspace ON kb_documents(workspace_id);
  `);

  // Phase 1: Skill Origin & Attribution - Add origin tracking columns to skills table
  const skillOriginMigrations = [
    "ALTER TABLE skills ADD COLUMN origin_type TEXT DEFAULT 'local'",
    "ALTER TABLE skills ADD COLUMN origin_source_id TEXT",
    "ALTER TABLE skills ADD COLUMN origin_owner TEXT",
    "ALTER TABLE skills ADD COLUMN origin_owner_type TEXT DEFAULT 'myapi_user'",
    "ALTER TABLE skills ADD COLUMN is_fork INTEGER DEFAULT 0",
    "ALTER TABLE skills ADD COLUMN upstream_owner TEXT",
    "ALTER TABLE skills ADD COLUMN upstream_repo_url TEXT",
    "ALTER TABLE skills ADD COLUMN license TEXT DEFAULT 'Proprietary'",
    "ALTER TABLE skills ADD COLUMN published_at TEXT"
  ];
  
  for (const migration of skillOriginMigrations) {
    try { db.exec(migration); } catch (e) {}
  }

  // Create skill_versions table for Phase 2: Skill Versioning & Immutability
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id INTEGER NOT NULL,
      version_number TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      release_notes TEXT,
      script_content TEXT,
      config_json TEXT,
      FOREIGN KEY (skill_id) REFERENCES skills(id),
      UNIQUE(skill_id, version_number)
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON skill_versions(skill_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_skill_versions_number ON skill_versions(skill_id, version_number)');

  // Create skill_licenses table for Phase 4: License System
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_name TEXT NOT NULL UNIQUE,
      description TEXT,
      can_fork INTEGER DEFAULT 1,
      can_sell INTEGER DEFAULT 0,
      can_modify INTEGER DEFAULT 1,
      attribution_required INTEGER DEFAULT 0,
      license_text TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Insert default licenses
  const defaultLicenses = [
    { name: 'MIT', can_fork: 1, can_sell: 1, can_modify: 1, attribution_required: 1, desc: 'Permissive open-source license' },
    { name: 'Apache 2.0', can_fork: 1, can_sell: 1, can_modify: 1, attribution_required: 1, desc: 'Permissive open-source license with explicit patent rights' },
    { name: 'GPL', can_fork: 1, can_sell: 0, can_modify: 1, attribution_required: 1, desc: 'Copyleft open-source license; derivatives must be open-source' },
    { name: 'Proprietary', can_fork: 0, can_sell: 1, can_modify: 0, attribution_required: 0, desc: 'Proprietary license; no forking or modification allowed' },
    { name: 'Custom', can_fork: 0, can_sell: 0, can_modify: 0, attribution_required: 1, desc: 'Custom license with specific terms' }
  ];
  
  for (const lic of defaultLicenses) {
    try {
      db.prepare(`
        INSERT INTO skill_licenses (license_name, description, can_fork, can_sell, can_modify, attribution_required, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `).run(lic.name, lic.desc, lic.can_fork, lic.can_sell, lic.can_modify, lic.attribution_required, new Date().toISOString());
    } catch (e) {}
  }

  // Create skill_forks table for Phase 3: Fork & Derivative Tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_forks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_skill_id INTEGER NOT NULL,
      fork_skill_id INTEGER NOT NULL,
      forked_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (original_skill_id) REFERENCES skills(id),
      FOREIGN KEY (fork_skill_id) REFERENCES skills(id),
      UNIQUE(original_skill_id, fork_skill_id)
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_skill_forks_original ON skill_forks(original_skill_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_skill_forks_fork ON skill_forks(fork_skill_id)');

  // Create skill_ownership_claims table for Phase 4: Ownership Verification
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_ownership_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id INTEGER NOT NULL,
      claimant_user_id TEXT NOT NULL,
      github_username TEXT,
      marketplace_user_id TEXT,
      verified INTEGER DEFAULT 0,
      verification_code TEXT,
      verified_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (skill_id) REFERENCES skills(id),
      UNIQUE(skill_id, claimant_user_id)
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_skill_ownership_claims_skill ON skill_ownership_claims(skill_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_skill_ownership_claims_claimant ON skill_ownership_claims(claimant_user_id)');

  // Pricing Plans Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      features TEXT NOT NULL,
      monthly_api_call_limit INTEGER NOT NULL,
      max_services INTEGER NOT NULL,
      max_team_members INTEGER NOT NULL,
      max_skills_per_persona INTEGER NOT NULL,
      stripe_product_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON pricing_plans(active)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_pricing_plans_order ON pricing_plans(display_order)');

  // Phase 2: Billing & Usage Tracking tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      stripe_customer_id TEXT NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(workspace_id),
      UNIQUE(stripe_customer_id)
    );

    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      stripe_subscription_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(workspace_id),
      UNIQUE(stripe_subscription_id)
    );

    CREATE TABLE IF NOT EXISTS usage_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      date TEXT NOT NULL,
      api_calls INTEGER NOT NULL DEFAULT 0,
      installs INTEGER NOT NULL DEFAULT 0,
      ratings INTEGER NOT NULL DEFAULT 0,
      active_services INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(workspace_id, date)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      stripe_invoice_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL,
      invoice_url TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(stripe_invoice_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      frequency TEXT DEFAULT 'immediate',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(workspace_id, user_id, channel),
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notification_queue (
      id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      sent_at INTEGER,
      next_retry_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(notification_id) REFERENCES notifications(id)
    );
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_billing_customers_workspace ON billing_customers(workspace_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_workspace ON billing_subscriptions(workspace_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_usage_daily_workspace_date ON usage_daily(workspace_id, date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_usage_daily_date ON usage_daily(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_workspace_created ON invoices(workspace_id, created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_workspace_user ON notifications(workspace_id, user_id, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_workspace_user_read ON notifications(workspace_id, user_id, is_read)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notification_preferences_workspace_user ON notification_preferences(workspace_id, user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notification_queue_status_retry ON notification_queue(status, next_retry_at)');

  // Phase: Enhanced Marketplace Filtering - Add provider and official fields
  const marketplaceEnhancementMigrations = [
    "ALTER TABLE marketplace_listings ADD COLUMN provider TEXT DEFAULT 'User'",
    "ALTER TABLE marketplace_listings ADD COLUMN official INTEGER DEFAULT 0"
  ];
  
  for (const migration of marketplaceEnhancementMigrations) {
    try { db.exec(migration); } catch (e) {}
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_marketplace_listings_provider ON marketplace_listings(provider)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_marketplace_listings_official ON marketplace_listings(official)');

  // Phase: Guest Token Sharing - Add fields to access_tokens for token marketplace
  const guestTokenMigrations = [
    "ALTER TABLE access_tokens ADD COLUMN is_shareable INTEGER DEFAULT 0",
    "ALTER TABLE access_tokens ADD COLUMN is_guest_token INTEGER DEFAULT 0",
    "ALTER TABLE access_tokens ADD COLUMN source_token_id TEXT",
    "ALTER TABLE access_tokens ADD COLUMN marketplace_listing_id INTEGER",
    "ALTER TABLE access_tokens ADD COLUMN scope_bundle TEXT",
    "ALTER TABLE access_tokens ADD COLUMN read_only INTEGER DEFAULT 0",
    "ALTER TABLE access_tokens ADD COLUMN requires_approval INTEGER DEFAULT 0"
  ];
  
  for (const migration of guestTokenMigrations) {
    try { db.exec(migration); } catch (e) {}
  }

  // token_type: distinguish 'master' from 'guest' tokens
  try { db.exec("ALTER TABLE access_tokens ADD COLUMN token_type TEXT DEFAULT 'guest'"); } catch (e) {}
  // Backfill: full-scope tokens with an encrypted raw token stored are master tokens
  try { db.exec("UPDATE access_tokens SET token_type = 'master' WHERE scope = 'full' AND encrypted_token IS NOT NULL AND (token_type IS NULL OR token_type = 'guest')"); } catch (e) {}

  // Memory source tracking: who created this memory entry
  try { db.exec("ALTER TABLE memories ADD COLUMN source TEXT DEFAULT 'user'"); } catch (e) {}

  // Per-type notification settings stored as JSON in notification_preferences
  safeMigration("ALTER TABLE notification_preferences ADD COLUMN type_settings TEXT DEFAULT NULL");

  // SOC 2 Phase 3.4 — Consent timestamp tracking (P criterion)
  // Stores when users accepted terms and privacy policy; required for GDPR/SOC 2 P audit evidence.
  safeMigration("ALTER TABLE users ADD COLUMN accepted_terms_at TEXT");
  safeMigration("ALTER TABLE users ADD COLUMN accepted_privacy_policy_at TEXT");

  // Onboarding flag: set to 1 for new OAuth signups, cleared when onboarding completes.
  safeMigration("ALTER TABLE users ADD COLUMN needs_onboarding INTEGER DEFAULT 0");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_access_tokens_shareable ON access_tokens(is_shareable);
    CREATE INDEX IF NOT EXISTS idx_access_tokens_guest ON access_tokens(is_guest_token);
    CREATE INDEX IF NOT EXISTS idx_access_tokens_source ON access_tokens(source_token_id);
  `);

  // OAuth Server (MyApi as authorization server for external AI clients)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_server_clients (
        client_id TEXT PRIMARY KEY,
        client_secret_hash TEXT NOT NULL,
        client_name TEXT NOT NULL,
        redirect_uris TEXT NOT NULL,
        owner_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS oauth_server_auth_codes (
        code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        scope TEXT,
        expires_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0
      );
    `);
  } catch (e) { /* tables already exist */ }

  // AFP (API File Protocol) — PC filesystem/exec connector
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS afp_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        hostname TEXT,
        platform TEXT,
        arch TEXT,
        capabilities_json TEXT,
        device_token_hash TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_afp_devices_user ON afp_devices(user_id);
      CREATE INDEX IF NOT EXISTS idx_afp_devices_status ON afp_devices(status);

      CREATE TABLE IF NOT EXISTS afp_command_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        requester_token_id TEXT,
        op TEXT NOT NULL,
        path TEXT,
        cmd TEXT,
        status TEXT NOT NULL,
        duration_ms INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (device_id) REFERENCES afp_devices(id)
      );
      CREATE INDEX IF NOT EXISTS idx_afp_command_log_device ON afp_command_log(device_id);
      CREATE INDEX IF NOT EXISTS idx_afp_command_log_user ON afp_command_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_afp_command_log_created ON afp_command_log(created_at);
    `);
  } catch (e) { /* tables already exist */ }
  // Add afp_root column if it doesn't exist yet (safe migration)
  try { db.exec(`ALTER TABLE afp_devices ADD COLUMN afp_root TEXT`); } catch (_) {}

  // Seed initial pricing plans if table is empty
  seedDefaultPricingPlans();

  console.log('Database initialized successfully (MongoDB mode)');
}

// Vault Tokens
function createVaultToken(label, description, token, service, websiteUrl = null, discovery = null, ownerId = 'owner', workspaceId = null) {
  const id = 'vt_' + crypto.randomBytes(16).toString('hex');

  // Phase 5: versioned AES-256-GCM encryption for vault tokens
  const vaultKey = String(process.env.VAULT_KEY || '').trim();
  if (!vaultKey) {
    throw new Error('VAULT_KEY is required to store vault tokens securely');
  }
  const masterHex = crypto.createHash('sha256').update(vaultKey).digest('hex');
  const salt = generateSalt();
  const key = deriveKey(masterHex, salt);
  const tokenStr = String(token || '');
  const payload = encrypt(tokenStr, key);
  const encrypted = JSON.stringify({ ...payload, salt: salt.toString('hex') });

  const tokenPreview = tokenStr.length > 8 ? tokenStr.slice(0, 4) + '***' + tokenStr.slice(-4) : '***';
  const now = new Date().toISOString();

  const discoveredApiUrl = discovery?.apiBaseUrl || null;
  const discoveredAuthScheme = discovery?.authScheme || null;
  const discoveredMetadata = discovery?.raw ? JSON.stringify(discovery.raw) : null;

  const stmt = db.prepare(`
    INSERT INTO vault_tokens (
      id, label, description, encrypted_token, token_preview,
      service, website_url, discovered_api_url, discovered_auth_scheme, discovered_metadata, last_discovered_at,
      created_at, updated_at, owner_id, encryption_version, workspace_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    label,
    description || null,
    encrypted,
    tokenPreview,
    service || null,
    websiteUrl || null,
    discoveredApiUrl,
    discoveredAuthScheme,
    discoveredMetadata,
    discovery ? now : null,
    now,
    now,
    ownerId,
    ENCRYPTION_VERSION,
    workspaceId
  );

  return {
    id,
    name: label,
    label,
    description,
    service: service || null,
    websiteUrl: websiteUrl || null,
    discoveredApiUrl,
    discoveredAuthScheme,
    tokenPreview,
    createdAt: now,
  };
}

function getVaultTokens(ownerId = 'owner', workspaceId = null) {
  // Multi-tenancy: tokens belong to a workspace OR were created before workspaces (workspace_id IS NULL).
  // NULL workspace_id tokens are owner-level and visible from any workspace.
  let query = `
    SELECT id, label, description, token_preview, service, website_url, discovered_api_url, discovered_auth_scheme, created_at, updated_at, workspace_id
    FROM vault_tokens
    WHERE owner_id = ?
  `;
  const params = [ownerId];

  if (workspaceId) {
    query += ' AND (workspace_id = ? OR workspace_id IS NULL)';
    params.push(workspaceId);
  }

  query += ' ORDER BY created_at DESC';
  
  const stmt = db.prepare(query);
  return stmt.all(...params).map(row => ({
    id: row.id,
    name: row.label,
    label: row.label,
    description: row.description,
    service: row.service,
    websiteUrl: row.website_url,
    discoveredApiUrl: row.discovered_api_url,
    discoveredAuthScheme: row.discovered_auth_scheme,
    tokenPreview: row.token_preview,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspaceId: row.workspace_id
  }));
}

function decryptVaultToken(id, ownerId = 'owner', workspaceId = null) {
  // Workspace scoping: tokens belong to a workspace OR were created before workspaces (workspace_id IS NULL).
  // NULL workspace_id tokens are owner-level and accessible from any workspace.
  let query = 'SELECT * FROM vault_tokens WHERE id = ? AND owner_id = ?';
  const params = [id, ownerId];
  if (workspaceId) {
    query += ' AND (workspace_id = ? OR workspace_id IS NULL)';
    params.push(workspaceId);
  }
  const row = db.prepare(query).get(...params);
  if (!row) return null;
  try {
    const vaultKey = String(process.env.VAULT_KEY || '').trim();
    if (!vaultKey) {
      // fail-closed by default (same policy as OAuth storage)
      return null;
    }

    let decrypted = null;

    // Phase 5 format (JSON payload with salt + AES-GCM)
    try {
      const p = JSON.parse(row.encrypted_token);
      if (p && p.ciphertext && (p.nonce || p.iv) && p.authTag && p.salt) {
        const masterHex = crypto.createHash('sha256').update(vaultKey).digest('hex');
        const key = deriveKey(masterHex, Buffer.from(p.salt, 'hex'));
        decrypted = decrypt(p, key);
      }
    } catch (_) {
      // fallthrough to legacy format
    }

    // Legacy format fallback (AES-256-CBC, iv:ciphertext)
    if (decrypted == null) {
      // ALLOW_LEGACY_DEFAULT_VAULT_KEY is restricted to test environments only (SOC2 Phase 1)
      const allowLegacyDefault = process.env.NODE_ENV !== 'production' &&
        String(process.env.ALLOW_LEGACY_DEFAULT_VAULT_KEY || '').toLowerCase() === 'true';
      const encryptionKey = vaultKey || (allowLegacyDefault ? 'default-vault-key-change-me' : null);
      if (!encryptionKey) return null;
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      const [ivHex, encryptedData] = String(row.encrypted_token || '').split(':');
      if (!ivHex || !encryptedData) throw new Error('legacy format parse failed');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
    }

    return {
      id: row.id,
      name: row.label,
      label: row.label,
      description: row.description,
      service: row.service,
      websiteUrl: row.website_url,
      discoveredApiUrl: row.discovered_api_url,
      discoveredAuthScheme: row.discovered_auth_scheme,
      token: decrypted,
      tokenPreview: row.token_preview,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (e) {
    return null;
  }
}

function deleteVaultToken(id, ownerId = 'owner', workspaceId = null) {
  // BUG-14: Enforce owner_id and workspace_id check to prevent cross-workspace token deletion
  let query = 'DELETE FROM vault_tokens WHERE id = ? AND owner_id = ?';
  const params = [id, ownerId];
  if (workspaceId) {
    query += ' AND workspace_id = ?';
    params.push(workspaceId);
  }
  const stmt = db.prepare(query);
  const result = stmt.run(...params);
  return result.changes > 0;
}

// Access Tokens

/**
 * Return the best available key for master-token encryption.
 * Prefers VAULT_KEY, then ENCRYPTION_KEY.  JWT_SECRET is accepted as a
 * last-resort fallback so token persistence works in development setups
 * that omit the other keys — but it is NOT recommended for production.
 */
function getMasterTokenEncryptionKey() {
  const key = String(process.env.VAULT_KEY || process.env.ENCRYPTION_KEY || '').trim();
  if (key) return key;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Database] VAULT_KEY or ENCRYPTION_KEY is required in production — refusing to start without explicit encryption key.');
  }
  const fallback = String(process.env.JWT_SECRET || '').trim();
  if (fallback) {
    console.warn('[Database] VAULT_KEY and ENCRYPTION_KEY are unset — falling back to JWT_SECRET for master-token encryption. Set VAULT_KEY or ENCRYPTION_KEY for production.');
    return fallback;
  }
  return null;
}

/**
 * Encrypt a raw token for persistent storage using AES-256-GCM (same pattern as vault tokens).
 * Returns the encrypted JSON string, or null if no encryption key is available.
 */
function encryptRawToken(rawToken) {
  const encKey = getMasterTokenEncryptionKey();
  if (!encKey || !rawToken) return null;
  try {
    const masterHex = crypto.createHash('sha256').update(encKey).digest('hex');
    const salt = generateSalt();
    const key = deriveKey(masterHex, salt);
    const payload = encrypt(String(rawToken), key);
    return JSON.stringify({ ...payload, salt: salt.toString('hex') });
  } catch (e) {
    console.warn('[Database] Failed to encrypt raw token');
    return null;
  }
}

/**
 * Decrypt a stored encrypted token. Returns the raw token string or null.
 * Tries all available keys (VAULT_KEY, ENCRYPTION_KEY, JWT_SECRET) in order,
 * so tokens encrypted with any of these keys can be recovered.
 */
function decryptRawToken(encryptedJson) {
  if (!encryptedJson) return null;
  const keys = [process.env.VAULT_KEY, process.env.ENCRYPTION_KEY, process.env.JWT_SECRET]
    .map(k => (k ? String(k).trim() : ''))
    .filter(Boolean);
  if (keys.length === 0) return null;
  // De-duplicate so we don't retry the same key
  const uniqueKeys = [...new Set(keys)];
  for (const candidate of uniqueKeys) {
    try {
      const p = JSON.parse(encryptedJson);
      if (p && p.ciphertext && (p.nonce || p.iv) && p.authTag && p.salt) {
        const masterHex = crypto.createHash('sha256').update(candidate).digest('hex');
        const key = deriveKey(masterHex, Buffer.from(p.salt, 'hex'));
        const result = decrypt(p, key);
        if (result) return result;
      }
    } catch (e) {
      // Try next key
    }
  }
  return null;
}

function createAccessToken(hash, ownerId, scope, label, expiresAt = null, allowedPersonas = null, workspaceId = null, rawToken = null, tokenType = 'guest') {
  const id = 'tok_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const allowedPersonasJson = allowedPersonas && allowedPersonas.length > 0
    ? JSON.stringify(allowedPersonas)
    : null;

  // Encrypt raw token for persistent retrieval (master tokens only)
  const encryptedToken = rawToken ? encryptRawToken(rawToken) : null;

  const stmt = db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, revoked_at, expires_at, allowed_personas, workspace_id, encrypted_token, token_type)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, hash, ownerId, scope, label, now, expiresAt, allowedPersonasJson, workspaceId, encryptedToken, tokenType);
  return id;
}

/**
 * Retrieve the existing decrypted master token for a given owner.
 * Returns { tokenId, rawToken } if a valid encrypted master token exists, or null otherwise.
 */
function getExistingMasterToken(ownerId) {
  if (!ownerId) return null;
  try {
    // Look for active full-scope tokens with an encrypted_token, trying owner-specific first, then legacy 'owner'
    const ownerIds = [String(ownerId)];
    if (ownerId !== 'owner') ownerIds.push('owner');

    for (const oid of ownerIds) {
      const rows = db.prepare(
        "SELECT id, encrypted_token, hash FROM access_tokens WHERE owner_id = ? AND scope = 'full' AND token_type = 'master' AND revoked_at IS NULL AND encrypted_token IS NOT NULL ORDER BY created_at DESC LIMIT 10"
      ).all(oid);
      for (const row of rows) {
        // Skip tokens with non-bcrypt hashes (e.g. SHA-256 hashes created by oauth-server flow)
        if (!row.hash || !row.hash.startsWith('$2')) continue;
        if (!row.encrypted_token) continue;
        const rawToken = decryptRawToken(row.encrypted_token);
        if (rawToken) {
          return { tokenId: row.id, rawToken };
        }
      }
    }
    return null;
  } catch (e) {
    console.warn('[Database] Failed to retrieve existing master token');
    return null;
  }
}

function getAccessTokens(ownerId = null, workspaceId = null) {
  let query = 'SELECT * FROM access_tokens WHERE 1=1';
  const params = [];

  if (ownerId) {
    query += ' AND owner_id = ?';
    params.push(ownerId);
  }

  // Multi-tenancy: include tokens with no workspace_id (created before multi-tenancy).
  if (workspaceId) {
    query += ' AND (workspace_id = ? OR workspace_id IS NULL)';
    params.push(workspaceId);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
  return rows.map(row => ({
    tokenId: row.id,
    hash: row.hash,
    ownerId: row.owner_id,
    scope: row.scope,
    label: row.label,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    active: !row.revoked_at,
    allowedPersonas: row.allowed_personas ? JSON.parse(row.allowed_personas) : null,
    workspaceId: row.workspace_id,
    tokenType: row.token_type || 'guest',
    isShareable: row.is_shareable || 0,
    requiresApproval: row.requires_approval || 0,
    scopeBundle: row.scope_bundle ? (() => { try { return JSON.parse(row.scope_bundle); } catch { return null; } })() : null,
    allowedResources: row.allowed_resources ? (() => { try { return JSON.parse(row.allowed_resources); } catch { return null; } })() : null,
    marketplaceListingId: row.marketplace_listing_id || null
  }));
}

function revokeAccessToken(id) {
  const stmt = db.prepare('UPDATE access_tokens SET revoked_at = ? WHERE id = ?');
  const result = stmt.run(new Date().toISOString(), id);
  return result.changes > 0;
}

// Scope Definitions
function seedDefaultScopes() {
  const scopes = [
    { name: 'basic',          category: 'profile',   description: 'Name, role, company' },
    { name: 'professional',   category: 'profile',   description: 'Skills, education, experience' },
    { name: 'availability',   category: 'profile',   description: 'Calendar, timezone' },
    { name: 'personas',       category: 'personas',  description: 'Public persona profiles' },
    { name: 'knowledge',      category: 'brain',     description: 'Knowledge/context read access' },
    { name: 'chat',           category: 'brain',     description: 'Conversation and messaging' },
    { name: 'memory',         category: 'brain',     description: 'Read and write memory entries' },
    { name: 'skills:read',    category: 'skills',    description: 'Read skills and metadata' },
    { name: 'skills:write',   category: 'skills',    description: 'Create and manage skills' },
    { name: 'services:read',  category: 'services',  description: 'Proxy GET requests to connected OAuth services' },
    { name: 'services:write', category: 'services',  description: 'Proxy POST/PUT/DELETE requests to connected OAuth services' },
    { name: 'tickets:read',   category: 'tickets',   description: 'Read tickets' },
    { name: 'tickets:write',  category: 'tickets',   description: 'Create and update tickets' },
    { name: 'admin:*',        category: 'admin',     description: 'Full admin access (grants all scopes)' },
  ];

  // Remove legacy scope names that were replaced in this schema
  const legacyScopes = ['audit:read','brain:chat','brain:read','identity:read','identity:write','personas:read','personas:write','vault:read','vault:write'];
  const removeLegacyRef = db.prepare('DELETE FROM access_token_scopes WHERE scope_name = ?');
  const removeLegacyDef = db.prepare('DELETE FROM scope_definitions WHERE scope_name = ?');
  legacyScopes.forEach(s => { try { removeLegacyRef.run(s); removeLegacyDef.run(s); } catch(_) {} });

  const now = new Date().toISOString();
  const upsertStmt = db.prepare(`
    INSERT INTO scope_definitions (scope_name, description, category, permissions, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(scope_name) DO UPDATE SET description = excluded.description, category = excluded.category
  `);

  for (const scope of scopes) {
    upsertStmt.run(scope.name, scope.description, scope.category, null, now);
  }
}

function validateScope(scopeName) {
  // Accept per-service granular scopes: services:<name>:(read|write|*)
  // These are sub-scopes of services:read/services:write, not in scope_definitions
  if (/^services:[a-z0-9_-]+:(read|write|\*)$/.test(scopeName)) return true;

  const stmt = db.prepare('SELECT * FROM scope_definitions WHERE scope_name = ?');
  const row = stmt.get(scopeName);
  return row !== undefined;
}

function getAllScopes() {
  const stmt = db.prepare(`
    SELECT scope_name, description, category, permissions, created_at
    FROM scope_definitions
    ORDER BY category, scope_name
  `);
  return stmt.all().map(row => ({
    name: row.scope_name,
    description: row.description,
    category: row.category,
    permissions: row.permissions ? JSON.parse(row.permissions) : null,
    createdAt: row.created_at
  }));
}

function grantScopes(tokenId, scopeNames) {
  const now = new Date().toISOString();
  // INSERT OR IGNORE handles UNIQUE conflicts only — NOT FK violations.
  // Callers must pre-filter scopes to those that exist in scope_definitions.
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO access_token_scopes (token_id, scope_name, granted_at)
    VALUES (?, ?, ?)
  `);

  for (const scopeName of scopeNames) {
    if (!validateScope(scopeName)) {
      throw new Error(`Invalid scope: ${scopeName}`);
    }
    insertStmt.run(tokenId, scopeName, now);
  }
}

function getTokenScopes(tokenId) {
  const stmt = db.prepare(`
    SELECT scope_name FROM access_token_scopes
    WHERE token_id = ?
    ORDER BY scope_name
  `);
  return stmt.all(tokenId).map(row => row.scope_name);
}

function revokeScopes(tokenId, scopeNames = null) {
  let query = 'DELETE FROM access_token_scopes WHERE token_id = ?';
  const params = [tokenId];
  
  if (scopeNames && scopeNames.length > 0) {
    const placeholders = scopeNames.map(() => '?').join(',');
    query += ` AND scope_name IN (${placeholders})`;
    params.push(...scopeNames);
  }
  
  const stmt = db.prepare(query);
  const result = stmt.run(...params);
  return result.changes;
}

function hasPermission(tokenScopes, requiredScopes) {
  // admin:* grants all permissions
  if (tokenScopes.includes('admin:*')) {
    return true;
  }

  // Check if token has all required scopes
  if (Array.isArray(requiredScopes)) {
    return requiredScopes.every(scope => tokenScopes.includes(scope));
  }

  // Single scope required
  return tokenScopes.includes(requiredScopes);
}

function expandScopeTemplate(template) {
  const templates = {
    'read': ['basic'],
    'professional': ['basic', 'professional'],
    'availability': ['basic', 'availability'],
    'guest': ['basic'],
    'admin': ['admin:*']
  };

  return templates[template] || null;
}

// Connectors
function createConnector(type, label, config) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO connectors (id, type, label, config, active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `);

  stmt.run(id, type, label, JSON.stringify(config), now);
  
  return {
    id,
    type,
    label,
    config,
    active: true,
    createdAt: now,
  };
}

function getConnectors() {
  const stmt = db.prepare('SELECT * FROM connectors ORDER BY created_at DESC');
  return stmt.all().map(row => ({
    id: row.id,
    type: row.type,
    label: row.label,
    config: JSON.parse(row.config),
    active: Boolean(row.active),
    createdAt: row.created_at
  }));
}

// Audit Log
function createAuditLog(entry) {
  // Gracefully handle missing request_id column (before migration runs)
  const hasRequestId = (() => {
    try {
      const cols = db.prepare('PRAGMA table_info(audit_log)').all();
      return cols.some(c => c.name === 'request_id');
    } catch { return false; }
  })();

  const sql = hasRequestId
    ? `INSERT INTO audit_log (timestamp, requester_id, workspace_id, actor_id, actor_type, action, resource, endpoint, http_method, status_code, scope, ip, details, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT INTO audit_log (timestamp, requester_id, workspace_id, actor_id, actor_type, action, resource, endpoint, http_method, status_code, scope, ip, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    entry.timestamp || new Date().toISOString(),
    entry.requesterId || null,
    entry.workspaceId || null,
    entry.actorId || null,
    entry.actorType || null,
    entry.action,
    entry.resource,
    entry.endpoint || null,
    entry.httpMethod || null,
    Number.isFinite(entry.statusCode) ? entry.statusCode : null,
    entry.scope || null,
    entry.ip || null,
    entry.details ? JSON.stringify(entry.details) : null,
  ];
  if (hasRequestId) params.push(entry.requestId || getCurrentRequestId() || null);

  db.prepare(sql).run(...params);
}

function getAuditLogs(limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT * FROM audit_log
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM audit_log');
  const total = countStmt.get().count;

  const logs = stmt.all(limit, offset).map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    requesterId: row.requester_id,
    workspaceId: row.workspace_id || null,
    actorId: row.actor_id || null,
    actorType: row.actor_type || null,
    action: row.action,
    resource: row.resource,
    endpoint: row.endpoint || row.api_endpoint || null,
    method: row.method || row.http_method || row.api_method || null,
    statusCode: row.status_code || row.status || null,
    scope: row.scope,
    ip: row.ip,
    details: row.details ? JSON.parse(row.details) : null
  }));

  return { logs, total };
}

// Handshake support (new)
function createUser(username, displayName, email, timezone, password, plan = 'free', avatarUrl = null, consentTimestamps = {}) {
  const id = 'usr_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 10);

  const cols = getUsersTableColumns();
  const hasConsentCols = cols.has('accepted_terms_at') && cols.has('accepted_privacy_policy_at');

  if (hasConsentCols) {
    const acceptedTermsAt = consentTimestamps.acceptedTermsAt || now;
    const acceptedPrivacyAt = consentTimestamps.acceptedPrivacyPolicyAt || now;
    const stmt = db.prepare(`INSERT INTO users (id, username, display_name, email, avatar_url, timezone, password_hash, created_at, status, plan, accepted_terms_at, accepted_privacy_policy_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    stmt.run(id, username, displayName || null, email || null, avatarUrl || null, timezone || null, hash, now, 'active', plan || 'free', acceptedTermsAt, acceptedPrivacyAt);
  } else {
    const stmt = db.prepare(`INSERT INTO users (id, username, display_name, email, avatar_url, timezone, password_hash, created_at, status, plan) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    stmt.run(id, username, displayName || null, email || null, avatarUrl || null, timezone || null, hash, now, 'active', plan || 'free');
  }

  return { id, username, displayName, email, avatarUrl: avatarUrl || null, timezone, createdAt: now, status: 'active', plan: plan || 'free' };
}

function getUsersTableColumns() {
  try {
    // PostgreSQL: use information_schema instead of PRAGMA
    if (db.pool) {
      const cols = db.prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public'"
      ).all();
      return new Set(cols.map((c) => c.name));
    }
    const cols = db.prepare('PRAGMA table_info(users)').all();
    return new Set(cols.map((c) => c.name));
  } catch (_) {
    return new Set();
  }
}

function countTotalUsers() {
  const cols = getUsersTableColumns();
  if (cols.has('status')) {
    const row = db.prepare("SELECT COUNT(*) AS n FROM users WHERE status IS NULL OR status != 'deleted'").get();
    return row ? Number(row.n) : 0;
  }
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  return row ? Number(row.n) : 0;
}

function addToWaitlist(email) {
  const now = new Date().toISOString();
  const id = 'wl_' + crypto.randomBytes(12).toString('hex');
  const existing = db.prepare('SELECT id, email, status, created_at FROM waitlist WHERE email = ?').get(email);
  if (existing) {
    return { entry: existing, created: false };
  }
  db.prepare('INSERT INTO waitlist (id, email, created_at, status) VALUES (?, ?, ?, ?)')
    .run(id, email, now, 'pending');
  return { entry: { id, email, status: 'pending', created_at: now }, created: true };
}

function listWaitlist({ limit = 100, offset = 0 } = {}) {
  return db.prepare('SELECT id, email, status, created_at, notified_at, invited_at FROM waitlist ORDER BY created_at ASC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

function markWaitlistInvited(id) {
  const now = new Date().toISOString();
  const result = db.prepare("UPDATE waitlist SET status = 'invited', invited_at = ? WHERE id = ? AND status = 'pending'")
    .run(now, id);
  return result.changes > 0;
}

function markWaitlistNotified(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE waitlist SET notified_at = ? WHERE id = ?');
  let changes = 0;
  for (const id of ids) changes += stmt.run(now, id).changes;
  return changes;
}

function getUsers() {
  const cols = getUsersTableColumns();
  const hasPlan = cols.has('plan');
  const hasStripeStatus = cols.has('stripe_subscription_status');
  const hasStripeCustomerId = cols.has('stripe_customer_id');
  const hasStripeSubscriptionId = cols.has('stripe_subscription_id');
  const hasTwoFactorEnabled = cols.has('two_factor_enabled');

  const planExpr = hasPlan ? "COALESCE(plan, 'free')" : "'free'";
  const stripeStatusExpr = hasStripeStatus ? 'stripe_subscription_status' : 'NULL';
  const stripeCustomerExpr = hasStripeCustomerId ? 'stripe_customer_id' : 'NULL';
  const stripeSubscriptionExpr = hasStripeSubscriptionId ? 'stripe_subscription_id' : 'NULL';
  const twoFactorExpr = hasTwoFactorEnabled ? 'COALESCE(two_factor_enabled, 0)' : '0';

  const stmt = db.prepare(`SELECT id, username, display_name as displayName, email, avatar_url as avatarUrl, timezone, created_at as createdAt, status, ${planExpr} as plan, ${stripeStatusExpr} as stripeSubscriptionStatus, ${stripeCustomerExpr} as stripeCustomerId, ${stripeSubscriptionExpr} as stripeSubscriptionId, ${twoFactorExpr} as twoFactorEnabled, CASE WHEN LOWER(COALESCE(${planExpr}, 'free')) IN ('free','enterprise') THEN 1 WHEN LOWER(COALESCE(${stripeStatusExpr}, '')) IN ('canceled','unpaid','past_due','incomplete_expired') THEN 0 WHEN LOWER(COALESCE(${stripeStatusExpr}, '')) IN ('active','trialing') THEN 1 ELSE 1 END as planActive FROM users ORDER BY created_at DESC`);
  return stmt.all().map((u) => ({ ...u, twoFactorEnabled: Boolean(u.twoFactorEnabled), planActive: Boolean(u.planActive) }));
}

function getUserByUsername(username) {
  const cols = getUsersTableColumns();
  const hasPlan = cols.has('plan');
  const hasStripeStatus = cols.has('stripe_subscription_status');
  const hasStripeCustomerId = cols.has('stripe_customer_id');
  const hasStripeSubscriptionId = cols.has('stripe_subscription_id');
  const hasTotpSecret = cols.has('totp_secret');
  const hasTwoFactorEnabled = cols.has('two_factor_enabled');

  const stmt = db.prepare(`SELECT id, username, display_name as displayName, email, avatar_url as avatarUrl, timezone, password_hash, ${hasTotpSecret ? "COALESCE(totp_secret, '')" : "''"} as totpSecret, ${hasTwoFactorEnabled ? 'COALESCE(two_factor_enabled, 0)' : '0'} as twoFactorEnabled, created_at as createdAt, status, ${hasPlan ? "COALESCE(plan, 'free')" : "'free'"} as plan, ${hasStripeStatus ? 'stripe_subscription_status' : 'NULL'} as stripeSubscriptionStatus, ${hasStripeCustomerId ? 'stripe_customer_id' : 'NULL'} as stripeCustomerId, ${hasStripeSubscriptionId ? 'stripe_subscription_id' : 'NULL'} as stripeSubscriptionId FROM users WHERE username = ?`);
  const u = stmt.get(username);
  if (!u) return null;
  return { ...u, twoFactorEnabled: Boolean(u.twoFactorEnabled) };
}

function getUserByEmail(email) {
  const cols = getUsersTableColumns();
  const hasPlan = cols.has('plan');
  const hasStripeStatus = cols.has('stripe_subscription_status');
  const hasStripeCustomerId = cols.has('stripe_customer_id');
  const hasStripeSubscriptionId = cols.has('stripe_subscription_id');
  const hasTotpSecret = cols.has('totp_secret');
  const hasTwoFactorEnabled = cols.has('two_factor_enabled');

  const stmt = db.prepare(`SELECT id, username, display_name as displayName, email, avatar_url as avatarUrl, timezone, password_hash, ${hasTotpSecret ? "COALESCE(totp_secret, '')" : "''"} as totpSecret, ${hasTwoFactorEnabled ? 'COALESCE(two_factor_enabled, 0)' : '0'} as twoFactorEnabled, created_at as createdAt, status, ${hasPlan ? "COALESCE(plan, 'free')" : "'free'"} as plan, ${hasStripeStatus ? 'stripe_subscription_status' : 'NULL'} as stripeSubscriptionStatus, ${hasStripeCustomerId ? 'stripe_customer_id' : 'NULL'} as stripeCustomerId, ${hasStripeSubscriptionId ? 'stripe_subscription_id' : 'NULL'} as stripeSubscriptionId FROM users WHERE LOWER(email) = LOWER(?)`);
  const u = stmt.get(email);
  if (!u) return null;
  return { ...u, twoFactorEnabled: Boolean(u.twoFactorEnabled) };
}

function getUserById(id) {
  const cols = getUsersTableColumns();
  const hasPlan = cols.has('plan');
  const hasStripeStatus = cols.has('stripe_subscription_status');
  const hasStripeCustomerId = cols.has('stripe_customer_id');
  const hasStripeSubscriptionId = cols.has('stripe_subscription_id');
  const hasTwoFactorEnabled = cols.has('two_factor_enabled');
  const hasNeedsOnboarding = cols.has('needs_onboarding');

  const stripeStatusExpr = hasStripeStatus ? 'stripe_subscription_status' : 'NULL';
  const planExpr = hasPlan ? "COALESCE(plan, 'free')" : "'free'";
  const planActiveExpr = `CASE WHEN LOWER(COALESCE(${planExpr}, 'free')) IN ('free','enterprise') THEN 1 WHEN LOWER(COALESCE(${stripeStatusExpr}, '')) IN ('canceled','unpaid','past_due','incomplete_expired') THEN 0 WHEN LOWER(COALESCE(${stripeStatusExpr}, '')) IN ('active','trialing') THEN 1 ELSE 1 END`;
  const needsOnboardingExpr = hasNeedsOnboarding ? 'COALESCE(needs_onboarding, 0)' : '0';
  const hasProfileMetadata = cols.has('profile_metadata');
  const stmt = db.prepare(`SELECT id, username, display_name as displayName, email, avatar_url as avatarUrl, timezone, ${hasTwoFactorEnabled ? 'COALESCE(two_factor_enabled, 0)' : '0'} as twoFactorEnabled, created_at as createdAt, status, ${planExpr} as plan, ${stripeStatusExpr} as stripeSubscriptionStatus, ${hasStripeCustomerId ? 'stripe_customer_id' : 'NULL'} as stripeCustomerId, ${hasStripeSubscriptionId ? 'stripe_subscription_id' : 'NULL'} as stripeSubscriptionId, ${planActiveExpr} as planActive, ${needsOnboardingExpr} as needsOnboarding${hasProfileMetadata ? ', profile_metadata' : ''} FROM users WHERE id = ?`);
  const u = stmt.get(id);
  if (!u) return null;
  return { ...u, twoFactorEnabled: Boolean(u.twoFactorEnabled), planActive: Boolean(u.planActive), needsOnboarding: Boolean(u.needsOnboarding) };
}

function getPiiMasterKey() {
  const raw = String(process.env.VAULT_KEY || '').trim();
  if (!raw) throw new Error('VAULT_KEY is required for PII encryption');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function encryptPiiObject(obj) {
  const masterHex = getPiiMasterKey();
  const salt = generateSalt();
  const key = deriveKey(masterHex, salt);
  const payload = encrypt(JSON.stringify(obj || {}), key);
  return {
    encrypted_payload: JSON.stringify(payload),
    salt_hex: salt.toString('hex'),
    encryption_version: ENCRYPTION_VERSION,
  };
}

function decryptPiiObject(encryptedPayload, saltHex) {
  if (!encryptedPayload || !saltHex) return null;
  const masterHex = getPiiMasterKey();
  const key = deriveKey(masterHex, Buffer.from(saltHex, 'hex'));
  const payload = typeof encryptedPayload === 'string' ? JSON.parse(encryptedPayload) : encryptedPayload;
  const txt = decrypt(payload, key);
  return JSON.parse(txt);
}

function updateUserPlan(userId, plan) {
  const allowed = ['free', 'pro', 'enterprise'];
  const normalizedPlan = String(plan || '').toLowerCase().trim();
  if (!allowed.includes(normalizedPlan)) {
    throw new Error('Invalid plan');
  }
  const result = db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(normalizedPlan, userId);
  if (result.changes === 0) return null;
  return getUserById(userId);
}

function upsertUserPiiSecure(userId, piiObj = {}) {
  const now = new Date().toISOString();
  const enc = encryptPiiObject(piiObj);
  const existing = db.prepare('SELECT user_id FROM user_pii_secure WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE user_pii_secure SET encrypted_payload = ?, salt_hex = ?, encryption_version = ?, updated_at = ? WHERE user_id = ?')
      .run(enc.encrypted_payload, enc.salt_hex, enc.encryption_version, now, userId);
  } else {
    db.prepare('INSERT INTO user_pii_secure (user_id, encrypted_payload, salt_hex, encryption_version, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(userId, enc.encrypted_payload, enc.salt_hex, enc.encryption_version, now);
  }
  db.prepare('UPDATE users SET pii_encrypted = 1 WHERE id = ?').run(userId);
  return true;
}

function getUserPiiSecure(userId) {
  const row = db.prepare('SELECT * FROM user_pii_secure WHERE user_id = ?').get(userId);
  if (!row) return null;
  try {
    return decryptPiiObject(row.encrypted_payload, row.salt_hex);
  } catch (_) {
    return null;
  }
}

function updateUserOAuthProfile(userId, { displayName, email, avatarUrl, timezone, profileMetadata } = {}) {
  const current = getUserById(userId);
  if (!current) return null;
  const nextDisplay = (displayName || '').trim() || current.displayName || current.username;
  const nextEmail = (email || '').trim() || current.email || null;
  const nextAvatar = (avatarUrl || '').trim() || current.avatarUrl || null;
  const nextTimezone = (timezone || '').trim() || current.timezone || null;
  db.prepare('UPDATE users SET display_name = ?, email = ?, avatar_url = ?, timezone = ? WHERE id = ?').run(nextDisplay, nextEmail, nextAvatar, nextTimezone, userId);

  // Persist extended identity fields (bio, location, github, website, etc.)
  if (profileMetadata !== undefined) {
    const json = profileMetadata ? JSON.stringify(profileMetadata) : null;
    db.prepare('UPDATE users SET profile_metadata = ? WHERE id = ?').run(json, userId);
  }

  // Store PII snapshot encrypted (email, displayName, avatarUrl, timezone)
  try {
    upsertUserPiiSecure(userId, {
      email: nextEmail,
      displayName: nextDisplay,
      avatarUrl: nextAvatar,
      timezone: current.timezone || null,
    });
  } catch (e) {
    console.warn('[PII] Failed to upsert secure profile');
  }

  return getUserById(userId);
}

function updateUserSubscriptionStatus(userId, { status, customerId, subscriptionId } = {}) {
  const normalized = String(status || '').toLowerCase().trim();
  if (normalized && !['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(normalized)) {
    throw new Error('Invalid subscription status');
  }
  const current = getUserById(userId);
  if (!current) return null;
  db.prepare('UPDATE users SET stripe_subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?')
    .run(normalized || null, customerId || null, subscriptionId || null, userId);
  return getUserById(userId);
}

function getUserTotpSecret(userId) {
  const row = db.prepare("SELECT COALESCE(totp_secret, '') as totpSecret, COALESCE(two_factor_enabled, 0) as twoFactorEnabled FROM users WHERE id = ?").get(userId);
  if (!row) return null;
  return { totpSecret: row.totpSecret || '', twoFactorEnabled: Boolean(row.twoFactorEnabled) };
}

function setUserTotpSecret(userId, secret) {
  const result = db.prepare('UPDATE users SET totp_secret = ?, two_factor_enabled = 0 WHERE id = ?').run(secret || null, userId);
  return result.changes > 0;
}

function enableUserTwoFactor(userId) {
  const result = db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(userId);
  return result.changes > 0;
}

function disableUserTwoFactor(userId) {
  const result = db.prepare('UPDATE users SET two_factor_enabled = 0, totp_secret = NULL WHERE id = ?').run(userId);
  return result.changes > 0;
}

function createHandshake(userId, agentId, requestedScopes, message) {
  const id = 'hsh_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const status = 'pending';
  const stmt = db.prepare('INSERT INTO handshakes (id, user_id, agent_id, requested_scopes, message, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)');
  stmt.run(id, userId, agentId, JSON.stringify(requestedScopes || []), message || null, status, now, now);
  return { id, userId, agentId, requestedScopes, message, status, createdAt: now, updatedAt: now };
}

function getHandshakes(filterStatus) {
  const where = filterStatus ? 'WHERE status = ?' : '';
  const stmt = db.prepare(`SELECT * FROM handshakes ${where} ORDER BY created_at DESC`);
  const rows = filterStatus ? stmt.all(filterStatus) : stmt.all();
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    agentId: r.agent_id,
    requestedScopes: JSON.parse(r.requested_scopes),
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    approvedAt: r.approved_at,
    revokedAt: r.revoked_at,
    approvedTokenId: r.approved_token_id
  }));
}

const HANDSHAKE_APPROVE_FIELDS = ['pending','approved'];
function approveHandshake(handshakeId) {
  const get = db.prepare('SELECT * FROM handshakes WHERE id = ?');
  const row = get.get(handshakeId);
  if (!row || row.status !== 'pending') return null;
  const scopes = JSON.parse(row.requested_scopes);
  const rawToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
  const hash = bcrypt.hashSync(rawToken, 10);
  const tokenLabel = `Handshake:${row.user_id}:${row.agent_id}`;
  const tokenId = createAccessToken(hash, row.user_id, scopes.join(','), tokenLabel, null);
  const now = new Date().toISOString();
  const update = db.prepare('UPDATE handshakes SET status=?, updated_at=?, approved_at=?, approved_token_id=? WHERE id=?');
  update.run('approved', now, now, tokenId, handshakeId);
  return { handshakeId, token: rawToken, tokenId, scopes };
}

function denyHandshake(handshakeId) {
  const update = db.prepare('UPDATE handshakes SET status=?, updated_at=? WHERE id=?');
  const now = new Date().toISOString();
  const res = update.run('denied', now, handshakeId);
  return res.changes > 0;
}

function revokeHandshake(handshakeId) {
  const get = db.prepare('SELECT * FROM handshakes WHERE id = ?');
  const h = get.get(handshakeId);
  if (!h) return false;
  const revoke = db.prepare('UPDATE handshakes SET revoked_at = ?, updated_at = ? WHERE id = ?');
  revoke.run(new Date().toISOString(), new Date().toISOString(), handshakeId);
  if (h.approved_token_id) {
    revokeAccessToken(h.approved_token_id);
  }
  return true;
}

// Personas
function createPersona(name, soulContent, description, templateData = null, ownerId = 'owner', workspaceId = null) {
  const now = new Date().toISOString();
  const owner = normalizeOwnerId(ownerId);
  const row = db.prepare(`
    INSERT INTO personas (name, soul_content, description, active, created_at, updated_at, template_data, owner_id, workspace_id)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(name, soulContent, description || null, now, now, templateData ? JSON.stringify(templateData) : null, owner, workspaceId || null);
  return {
    id: row?.id ?? null,
    name,
    soul_content: soulContent,
    description,
    active: false,
    created_at: now,
    updated_at: now,
    template_data: templateData
  };
}

function getPersonas(ownerId = 'owner', workspaceId = null) {
  const owner = normalizeOwnerId(ownerId);
  let query = `
    SELECT id, name, soul_content, description, active, created_at, updated_at, template_data
    FROM personas
    WHERE owner_id = ?
  `;
  const params = [owner];

  // Multi-tenancy: filter by workspace if provided, but also include
  // legacy personas with no workspace_id (created before multi-tenancy).
  if (workspaceId) {
    query += ' AND (workspace_id = ? OR workspace_id IS NULL)';
    params.push(workspaceId);
  }

  query += ' ORDER BY created_at DESC';
  
  const stmt = db.prepare(query);
  return stmt.all(...params).map(row => ({
    id: row.id,
    name: row.name,
    soul_content: row.soul_content,
    description: row.description,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    template_data: row.template_data ? JSON.parse(row.template_data) : null,
    workspaceId: row.workspace_id
  }));
}

function getPersonaById(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const stmt = db.prepare(`
    SELECT id, name, soul_content, description, active, created_at, updated_at, template_data
    FROM personas
    WHERE id = ? AND owner_id = ?
  `);
  const row = stmt.get(id, owner);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    soul_content: row.soul_content,
    description: row.description,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    template_data: row.template_data ? JSON.parse(row.template_data) : null
  };
}

function getActivePersona(ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const stmt = db.prepare(`
    SELECT id, name, soul_content, description, active, created_at, updated_at, template_data
    FROM personas
    WHERE active = 1 AND owner_id = ?
    LIMIT 1
  `);
  const row = stmt.get(owner);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    soul_content: row.soul_content,
    description: row.description,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    template_data: row.template_data ? JSON.parse(row.template_data) : null
  };
}

function updatePersona(id, updates, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const persona = getPersonaById(id, owner);
  if (!persona) return null;
  
  const now = new Date().toISOString();
  const name = updates.name !== undefined ? updates.name : persona.name;
  const soulContent = updates.soul_content !== undefined ? updates.soul_content : persona.soul_content;
  const description = updates.description !== undefined ? updates.description : persona.description;
  const templateData = updates.template_data !== undefined ? updates.template_data : persona.template_data;
  
  const stmt = db.prepare(`
    UPDATE personas
    SET name = ?, soul_content = ?, description = ?, updated_at = ?, template_data = ?
    WHERE id = ? AND owner_id = ?
  `);
  stmt.run(name, soulContent, description, now, templateData ? JSON.stringify(templateData) : null, id, owner);
  
  return {
    id,
    name,
    soul_content: soulContent,
    description,
    active: persona.active,
    created_at: persona.created_at,
    updated_at: now,
    template_data: templateData
  };
}

function setActivePersona(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const persona = getPersonaById(id, owner);
  if (!persona) return null;
  
  // Deactivate all other personas
  const deactivate = db.prepare('UPDATE personas SET active = 0 WHERE owner_id = ? AND id != ?');
  deactivate.run(owner, id);
  
  // Activate the selected persona
  const now = new Date().toISOString();
  const activate = db.prepare('UPDATE personas SET active = 1, updated_at = ? WHERE id = ? AND owner_id = ?');
  activate.run(now, id, owner);
  
  return {
    id,
    name: persona.name,
    soul_content: persona.soul_content,
    description: persona.description,
    active: true,
    created_at: persona.created_at,
    updated_at: now
  };
}

function deletePersona(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  // Check if this is the only persona
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM personas WHERE owner_id = ?');
  const { count } = countStmt.get(owner);
  if (count <= 1) return null; // Cannot delete the only persona
  
  db.prepare('DELETE FROM persona_documents WHERE persona_id = ?').run(id);
  db.prepare('DELETE FROM persona_skills WHERE persona_id = ?').run(id);
  const stmt = db.prepare('DELETE FROM personas WHERE id = ? AND owner_id = ?');
  const result = stmt.run(id, owner);
  return result.changes > 0;
}

// OAuth Tokens
const OAUTH_TOKEN_ALGO = 'aes-256-gcm';
const LEGACY_DEFAULT_VAULT_KEY = 'default-vault-key-change-me';

function deriveOAuthKey(rawKey) {
  return crypto.scryptSync(String(rawKey || ''), 'salt', 32);
}

function getOAuthKeyCandidates() {
  const current = String(process.env.VAULT_KEY || '').trim();
  const candidates = [];
  const seen = new Set();
  const add = (label, raw) => {
    const v = String(raw || '').trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    candidates.push({ label, raw: v });
  };

  add('current', current);

  // Optional recovery keys: comma-separated list of previous VAULT_KEY values.
  // Useful after key rotation to decrypt and re-encrypt old OAuth rows.
  const previous = String(process.env.VAULT_KEY_PREVIOUS || '').trim();
  if (previous) {
    for (const [idx, raw] of previous.split(',').map(v => v.trim()).filter(Boolean).entries()) {
      add(`previous-${idx + 1}`, raw);
    }
  }

  // Recovery fallback: try literal VAULT_KEY from project .env in case shell/env parsing altered special chars
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const rawEnv = fs.readFileSync(envPath, 'utf8');
      const line = rawEnv.split(/\r?\n/).find(l => l.startsWith('VAULT_KEY='));
      if (line) {
        const rawLiteral = line.slice('VAULT_KEY='.length).trim();
        add('env-file-literal', rawLiteral);
        add('env-file-unquoted', rawLiteral.replace(/^['\"]|['\"]$/g, ''));
      }
    }
  } catch {
    // best-effort only
  }

  // Backward compatibility: old tokens may have been encrypted with fallback key
  add('legacy-default', LEGACY_DEFAULT_VAULT_KEY);

  return candidates;
}

function encryptOAuthTokenValue(plainText, keyBytes) {
  const payload = encrypt(String(plainText || ''), keyBytes);
  return JSON.stringify(payload);
}

function storeOAuthToken(serviceName, userId, accessToken, refreshToken, expiresAt, scope) {
  const id = 'oauth_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();

  // Encrypt tokens using AES-256-GCM
  const encryptionKey = String(process.env.VAULT_KEY || '').trim();
  if (!encryptionKey) {
    throw new Error('VAULT_KEY is required to store OAuth tokens securely');
  }
  const key = deriveOAuthKey(encryptionKey);

  const accessTokenEncrypted = encryptOAuthTokenValue(accessToken, key);

  // Encrypt refresh token if present
  let refreshTokenEncrypted = null;
  if (refreshToken) {
    refreshTokenEncrypted = encryptOAuthTokenValue(refreshToken, key);
  }
  
  // Upsert: replace existing token for same service+user instead of creating duplicates
  const existing = db.prepare('SELECT id FROM oauth_tokens WHERE service_name = ? AND user_id = ?').get(serviceName, userId);
  
  if (existing) {
    db.prepare(`
      UPDATE oauth_tokens SET access_token = ?, refresh_token = ?, expires_at = ?, scope = ?, updated_at = ?
      WHERE service_name = ? AND user_id = ?
    `).run(accessTokenEncrypted, refreshTokenEncrypted, expiresAt, scope, now, serviceName, userId);
    return { id: existing.id, serviceName, userId, expiresAt, scope, createdAt: now, updated: true };
  }
  
  const stmt = db.prepare(`
    INSERT INTO oauth_tokens (id, service_name, user_id, access_token, refresh_token, expires_at, scope, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, serviceName, userId, accessTokenEncrypted, refreshTokenEncrypted, expiresAt, scope, now, now);
  
  return {
    id,
    serviceName,
    userId,
    expiresAt,
    scope,
    createdAt: now
  };
}


function countConnectedOAuthServices(userId) {
  if (!userId) return 0;

  // Count only services with a currently readable/decryptable token.
  // This avoids inflated counts from stale/corrupted rows.
  const rows = db.prepare(`
    SELECT DISTINCT service_name
    FROM oauth_tokens
    WHERE user_id = ?
  `).all(String(userId));

  let count = 0;
  for (const row of rows) {
    try {
      const token = getOAuthToken(row.service_name, String(userId));
      if (token && !token.revoked_at) count += 1;
    } catch {
      // Ignore unreadable token rows
    }
  }

  return count;
}

function getOAuthToken(serviceName, userId) {
  const stmt = db.prepare(`
    SELECT * FROM oauth_tokens
    WHERE service_name = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const row = stmt.get(serviceName, userId);
  if (!row) {
    console.log(`[getOAuthToken] No row found for ${serviceName}/${userId.slice(0,8)}`);
    return null;
  }

  console.log(`[getOAuthToken] Found token for ${serviceName}/${userId.slice(0,8)}, attempting decryption...`);

  const accessData = JSON.parse(row.access_token);
  const refreshData = row.refresh_token ? JSON.parse(row.refresh_token) : null;

  let usedLabel = null;
  let decryptedAccess = null;
  let decryptedRefresh = null;

  for (const candidate of getOAuthKeyCandidates()) {
    try {
      const key = deriveOAuthKey(candidate.raw);

      // Phase 5 format (encrypt.js payload with nonce/ciphertext/authTag)
      let access = null;
      if (accessData && accessData.ciphertext && (accessData.nonce || accessData.iv) && accessData.authTag) {
        access = decrypt(accessData, key);
      } else {
        // Legacy format fallback ({ encrypted, iv, authTag })
        const decipher = crypto.createDecipheriv(OAUTH_TOKEN_ALGO, key, Buffer.from(accessData.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(accessData.authTag, 'hex'));
        access = decipher.update(accessData.encrypted, 'hex', 'utf8');
        access += decipher.final('utf8');
      }

      let refresh = null;
      if (refreshData) {
        try {
          if (refreshData && refreshData.ciphertext && (refreshData.nonce || refreshData.iv) && refreshData.authTag) {
            refresh = decrypt(refreshData, key);
          } else {
            const decipher2 = crypto.createDecipheriv(OAUTH_TOKEN_ALGO, key, Buffer.from(refreshData.iv, 'hex'));
            decipher2.setAuthTag(Buffer.from(refreshData.authTag, 'hex'));
            refresh = decipher2.update(refreshData.encrypted, 'hex', 'utf8');
            refresh += decipher2.final('utf8');
          }
        } catch {
          // Keep access token usable even if refresh token cannot be decrypted.
          refresh = null;
        }
      }

      usedLabel = candidate.label;
      decryptedAccess = access;
      decryptedRefresh = refresh;
      break;
    } catch {
      // try next key candidate
    }
  }

  if (!decryptedAccess) {
    console.error(`[getOAuthToken] ❌ Decryption error for ${serviceName}/${userId.slice(0,8)}: unable to decrypt with current or legacy key`);
    return null;
  }

  // Self-heal legacy encrypted rows by re-encrypting with current key
  const currentKey = String(process.env.VAULT_KEY || '').trim();
  if (usedLabel !== 'current' && currentKey) {
    try {
      const newKey = deriveOAuthKey(currentKey);
      db.prepare(`
        UPDATE oauth_tokens
        SET access_token = ?, refresh_token = ?, updated_at = ?
        WHERE id = ?
      `).run(
        encryptOAuthTokenValue(decryptedAccess, newKey),
        decryptedRefresh ? encryptOAuthTokenValue(decryptedRefresh, newKey) : null,
        new Date().toISOString(),
        row.id
      );
      console.log(`[getOAuthToken] ♻️ Re-encrypted legacy ${serviceName} token with current VAULT_KEY`);
    } catch (healErr) {
      console.warn(`[getOAuthToken] ⚠️ Failed to re-encrypt ${serviceName} token:`, healErr.message);
    }
  }

  console.log(`[getOAuthToken] ✅ Successfully decrypted ${serviceName} token`);
  return {
    id: row.id,
    serviceName: row.service_name,
    userId: row.user_id,
    accessToken: decryptedAccess,
    refreshToken: decryptedRefresh,
    expiresAt: row.expires_at,
    scope: row.scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastApiCall: row.last_api_call  // Phase 5.4: Track last API call
  };
}

/**
 * Check if a token is expired (or will expire within bufferMs).
 * Returns true if token needs refresh.
 */
function isTokenExpired(tokenRow, bufferMs = 300000) {
  if (!tokenRow || !tokenRow.expiresAt) return false; // no expiry = assume valid
  const expiresAt = new Date(tokenRow.expiresAt).getTime();
  return Date.now() + bufferMs >= expiresAt;
}

/**
 * Refresh an OAuth token using its refresh_token.
 * Requires the service's token URL and client credentials.
 */
async function refreshOAuthToken(serviceName, userId, tokenUrl, clientId, clientSecret, options = {}) {
  const existing = getOAuthToken(serviceName, userId);
  if (!existing || !existing.refreshToken) {
    return { ok: false, error: 'No refresh token available' };
  }

  if (!isTokenExpired(existing)) {
    return { ok: true, token: existing, refreshed: false };
  }

  try {
    const https = require('https');
    const http = require('http');
    const url = new URL(tokenUrl);
    const transport = url.protocol === 'https:' ? https : http;

    const clientIdKey = options.clientIdParam || 'client_id';
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: existing.refreshToken,
      [clientIdKey]: clientId,
      client_secret: clientSecret,
    }).toString();

    const result = await new Promise((resolve, reject) => {
      const req = transport.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'Accept': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    if (result.status !== 200 || result.body.error) {
      return { ok: false, error: result.body.error_description || result.body.error || 'Refresh failed', status: result.status };
    }

    const newAccessToken = result.body.access_token;
    const newRefreshToken = result.body.refresh_token || existing.refreshToken;
    const newExpiresAt = result.body.expires_in
      ? new Date(Date.now() + result.body.expires_in * 1000).toISOString()
      : existing.expiresAt;
    const newScope = result.body.scope || existing.scope;

    storeOAuthToken(serviceName, userId, newAccessToken, newRefreshToken, newExpiresAt, newScope);
    
    return { ok: true, refreshed: true, token: getOAuthToken(serviceName, userId) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function revokeOAuthToken(serviceName, userId) {
  const stmt = db.prepare(`
    DELETE FROM oauth_tokens
    WHERE service_name = ? AND user_id = ?
  `);
  
  const result = stmt.run(serviceName, userId);
  return result.changes > 0;
}

function updateOAuthStatus(serviceName, status, lastSyncedAt = null) {
  const now = new Date().toISOString();
  const id = 'oauth_status_' + serviceName;
  
  const getStmt = db.prepare('SELECT * FROM oauth_status WHERE service_name = ?');
  const existing = getStmt.get(serviceName);
  
  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE oauth_status
      SET status = ?, last_synced_at = ?, updated_at = ?
      WHERE service_name = ?
    `);
    updateStmt.run(status, lastSyncedAt || existing.last_synced_at, now, serviceName);
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO oauth_status (id, service_name, status, last_synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(id, serviceName, status, lastSyncedAt, now, now);
  }
  
  return {
    serviceName,
    status,
    lastSyncedAt: lastSyncedAt || new Date().toISOString(),
    updatedAt: now
  };
}

function getOAuthStatus(serviceName = null) {
  let stmt;
  if (serviceName) {
    stmt = db.prepare('SELECT * FROM oauth_status WHERE service_name = ?');
    const row = stmt.get(serviceName);
    if (!row) return null;
    return {
      serviceName: row.service_name,
      status: row.status,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } else {
    stmt = db.prepare('SELECT * FROM oauth_status ORDER BY updated_at DESC');
    return stmt.all().map(row => ({
      serviceName: row.service_name,
      status: row.status,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

function createStateToken(serviceName, expiresInMinutes = 10) {
  const stateToken = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
  const id = 'state_' + crypto.randomBytes(8).toString('hex');
  
  const stmt = db.prepare(`
    INSERT INTO oauth_state_tokens (id, state_token, service_name, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, stateToken, serviceName, now, expiresAt);
  return stateToken;
}

function validateStateToken(serviceName, stateToken) {
  const stmt = db.prepare(`
    SELECT * FROM oauth_state_tokens
    WHERE service_name = ? AND state_token = ? AND expires_at > ?
  `);
  
  const now = new Date().toISOString();
  const row = stmt.get(serviceName, stateToken, now);
  
  if (row) {
    // Delete the state token after validation (one-time use)
    const deleteStmt = db.prepare('DELETE FROM oauth_state_tokens WHERE id = ?');
    deleteStmt.run(row.id);
    return true;
  }
  
  return false;
}

// BUG-11: Cleanup expired OAuth state tokens
// Call this periodically to prevent accumulation of expired tokens
function cleanupExpiredStateTokens() {
  try {
    const now = new Date().toISOString();
    const stmt = db.prepare('DELETE FROM oauth_state_tokens WHERE expires_at < ?');
    const result = stmt.run(now);
    if (result.changes > 0) {
      console.log(`[OAuth] Cleaned up ${result.changes} expired state tokens`);
    }
    return result.changes;
  } catch (error) {
    console.error('Error cleaning up expired state tokens:', error);
    return 0;
  }
}

// Phase 5.1: Token Encryption Key Rotation
function createKeyVersion(version, algorithm = 'aes-256-gcm') {
  const id = 'key_v' + crypto.randomBytes(8).toString('hex');
  const vaultKey = process.env.VAULT_KEY || 'default-vault-key-change-me';
  const key = crypto.scryptSync(vaultKey, 'salt', 32);
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO key_versions (id, version, algorithm, key_hash, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, version, algorithm, keyHash, 'active', now);
  
  return { id, version, algorithm, createdAt: now };
}

function getKeyVersions() {
  const stmt = db.prepare('SELECT * FROM key_versions ORDER BY version DESC');
  return stmt.all();
}

function getCurrentKeyVersion() {
  const stmt = db.prepare('SELECT * FROM key_versions WHERE status = ? ORDER BY version DESC LIMIT 1');
  const row = stmt.get('active');
  return row ? { id: row.id, version: row.version, algorithm: row.algorithm } : null;
}

function rotateEncryptionKey(newVaultKey) {
  // 1. Create new key version
  const currentVersions = db.prepare('SELECT MAX(version) as maxVersion FROM key_versions').get();
  const newVersion = (currentVersions.maxVersion || 0) + 1;
  
  const newKeyId = createKeyVersion(newVersion);
  
  // 2. Re-encrypt all OAuth tokens with new key
  const tokens = db.prepare('SELECT * FROM oauth_tokens').all();
  const now = new Date().toISOString();
  
  for (const token of tokens) {
    try {
      // Decrypt with old key
      const oldKey = process.env.VAULT_KEY || 'default-vault-key-change-me';
      const oldKeyHash = crypto.scryptSync(oldKey, 'salt', 32);
      
      let decryptedAccess = null;
      let decryptedRefresh = null;
      
      if (token.access_token) {
        const parsed = JSON.parse(token.access_token);
        const decipher = crypto.createDecipheriv('aes-256-gcm', oldKeyHash, Buffer.from(parsed.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
        decryptedAccess = decipher.update(parsed.encrypted, 'hex', 'utf8') + decipher.final('utf8');
      }
      
      if (token.refresh_token) {
        const parsed = JSON.parse(token.refresh_token);
        const decipher = crypto.createDecipheriv('aes-256-gcm', oldKeyHash, Buffer.from(parsed.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
        decryptedRefresh = decipher.update(parsed.encrypted, 'hex', 'utf8') + decipher.final('utf8');
      }
      
      // Re-encrypt with new key
      const newKeyHash = crypto.scryptSync(newVaultKey, 'salt', 32);
      
      let newAccessTokenEncrypted = null;
      if (decryptedAccess) {
        const cipher = crypto.createCipheriv('aes-256-gcm', newKeyHash, crypto.randomBytes(16));
        let enc = cipher.update(decryptedAccess, 'utf8', 'hex');
        enc += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        const iv = crypto.randomBytes(16).toString('hex');
        newAccessTokenEncrypted = JSON.stringify({ encrypted: enc, iv, authTag });
      }
      
      let newRefreshTokenEncrypted = null;
      if (decryptedRefresh) {
        const cipher = crypto.createCipheriv('aes-256-gcm', newKeyHash, crypto.randomBytes(16));
        let enc = cipher.update(decryptedRefresh, 'utf8', 'hex');
        enc += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        const iv = crypto.randomBytes(16).toString('hex');
        newRefreshTokenEncrypted = JSON.stringify({ encrypted: enc, iv, authTag });
      }
      
      // Update token with new key version
      db.prepare(`
        UPDATE oauth_tokens 
        SET access_token = ?, refresh_token = ?, key_version = ?, updated_at = ?
        WHERE id = ?
      `).run(newAccessTokenEncrypted, newRefreshTokenEncrypted, newVersion, now, token.id);
    } catch (err) {
      console.error(`Failed to rotate key for token ${token.id}:`, err.message);
    }
  }
  
  // 3. Mark old versions as retired
  db.prepare("UPDATE key_versions SET status = ? WHERE status = ? AND version < ?")
    .run('retired', 'active', newVersion);
  
  return { success: true, newVersion, tokensRotated: tokens.length };
}

// Phase 5.2: Rate Limiting
function checkRateLimit(userId, serviceName, limitPerHour = 100) {
  const now = new Date();
  // Use hour as the key for rate limiting window
  const hourKey = Math.floor(now.getTime() / (60 * 60 * 1000));
  const windowStart = new Date(hourKey * 60 * 60 * 1000).toISOString();
  
  const stmt = db.prepare(`
    SELECT call_count FROM rate_limits
    WHERE user_id = ? AND service_name = ? AND window_start = ?
  `);
  
  const record = stmt.get(userId, serviceName, windowStart);
  const currentCount = record?.call_count || 0;
  
  return {
    allowed: currentCount < limitPerHour,
    currentCount,
    limit: limitPerHour,
    remaining: Math.max(0, limitPerHour - currentCount)
  };
}

function incrementRateLimit(userId, serviceName, limitPerHour = 100) {
  const now = new Date();
  // Use hour as the key for rate limiting window
  const hourKey = Math.floor(now.getTime() / (60 * 60 * 1000));
  const windowStart = new Date(hourKey * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date((hourKey + 1) * 60 * 60 * 1000).toISOString();
  
  // Try to update, if no rows affected, insert
  const updateStmt = db.prepare(`
    UPDATE rate_limits
    SET call_count = call_count + 1
    WHERE user_id = ? AND service_name = ? AND window_start = ?
  `);
  
  const result = updateStmt.run(userId, serviceName, windowStart);
  
  if (result.changes === 0) {
    // Insert new rate limit record
    const insertStmt = db.prepare(`
      INSERT INTO rate_limits (user_id, service_name, call_count, limit_per_hour, window_start, window_end, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(userId, serviceName, 1, limitPerHour, windowStart, windowEnd, new Date().toISOString());
  }
}

// BUG-10: Cleanup old rate limit records to prevent memory leak
function cleanupOldRateLimits(hoursToKeep = 24) {
  try {
    const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare('DELETE FROM rate_limits WHERE window_end < ?');
    const result = stmt.run(cutoffTime);
    if (result.changes > 0) {
      console.log(`[Rate Limiter] Cleaned up ${result.changes} old rate limit records`);
    }
    return result.changes;
  } catch (error) {
    console.error('Error cleaning up rate limits:', error);
    return 0;
  }
}

// Brain - Conversations
function createConversation(userId, aiModel = 'gemini-pro', metadata = null) {
  const id = 'conv_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO conversations (id, user_id, ai_model, created_at, updated_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, userId, aiModel, now, now, metadata ? JSON.stringify(metadata) : null);
  
  return {
    id,
    userId,
    aiModel,
    createdAt: now,
    updatedAt: now,
    metadata
  };
}

function getConversations(userId) {
  const stmt = db.prepare(`
    SELECT c.*, COUNT(m.id) as message_count, 
           MAX(m.created_at) as last_message_at
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `);
  
  return stmt.all(userId).map(row => ({
    id: row.id,
    userId: row.user_id,
    aiModel: row.ai_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count || 0,
    lastMessageAt: row.last_message_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  }));
}

function getConversation(conversationId) {
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  const row = stmt.get(conversationId);
  if (!row) return null;
  
  return {
    id: row.id,
    userId: row.user_id,
    aiModel: row.ai_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  };
}

// Brain - Messages
function storeMessage(conversationId, role, content, embeddingVector = null, tokensUsed = null, isPrivate = false) {
  const id = 'msg_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, embedding_vector, created_at, tokens_used, private)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, conversationId, role, content, embeddingVector, now, tokensUsed, isPrivate ? 1 : 0);
  
  // Update conversation updated_at
  const updateStmt = db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?');
  updateStmt.run(now, conversationId);
  
  return {
    id,
    conversationId,
    role,
    content,
    embeddingVector,
    createdAt: now,
    tokensUsed,
    private: isPrivate
  };
}

function getConversationHistory(conversationId, limit = 10, includePrivate = false) {
  let query = `
    SELECT * FROM messages
    WHERE conversation_id = ?
  `;
  
  if (!includePrivate) {
    query += ' AND private = 0';
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  
  const stmt = db.prepare(query);
  const rows = includePrivate 
    ? stmt.all(conversationId, limit)
    : stmt.all(conversationId, limit);
  
  return rows.reverse().map(row => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    embeddingVector: row.embedding_vector,
    createdAt: row.created_at,
    tokensUsed: row.tokens_used,
    private: Boolean(row.private)
  }));
}

// Brain - Context Cache
function cacheContext(key, value, ttlSeconds = 3600) {
  const id = 'cache_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  
  // First, delete any existing cache with this key
  const deleteStmt = db.prepare('DELETE FROM context_cache WHERE key = ?');
  deleteStmt.run(key);
  
  const stmt = db.prepare(`
    INSERT INTO context_cache (id, key, value, ttl, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, key, JSON.stringify(value), ttlSeconds, now, expiresAt);
  
  return {
    id,
    key,
    value,
    ttlSeconds,
    expiresAt
  };
}

function getCachedContext(key) {
  const stmt = db.prepare(`
    SELECT * FROM context_cache
    WHERE key = ? AND expires_at > ?
  `);
  
  const row = stmt.get(key, new Date().toISOString());
  if (!row) return null;
  
  return {
    id: row.id,
    key: row.key,
    value: JSON.parse(row.value),
    expiresAt: row.expires_at
  };
}

function purgeExpiredCache() {
  const stmt = db.prepare('DELETE FROM context_cache WHERE expires_at <= ?');
  const result = stmt.run(new Date().toISOString());
  return result.changes;
}

// Brain - Knowledge Base Documents
function addKBDocument(source, title, content, embeddingVector = null, metadata = null, ownerId = 'owner') {
  const id = 'kbdoc_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const owner = normalizeOwnerId(ownerId);
  
  const stmt = db.prepare(`
    INSERT INTO kb_documents (id, source, title, content, embedding_vector, metadata, created_at, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, source, title, content, embeddingVector, metadata ? JSON.stringify(metadata) : null, now, owner);
  
  return {
    id,
    source,
    title,
    content,
    embeddingVector,
    metadata,
    createdAt: now
  };
}

function getKBDocuments(ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const stmt = db.prepare(`
    SELECT id, source, title, metadata, created_at
    FROM kb_documents
    WHERE owner_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(owner).map(row => ({
    id: row.id,
    source: row.source,
    title: row.title,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at
  }));
}

function getKBDocumentById(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const stmt = db.prepare(`
    SELECT * FROM kb_documents WHERE id = ? AND owner_id = ?
  `);
  
  const row = stmt.get(id, owner);
  if (!row) return null;
  
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    content: row.content,
    embeddingVector: row.embedding_vector,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at
  };
}

function updateKBDocument(id, updates, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const now = new Date().toISOString();
  const setClauses = [];
  const params = [];

  if (updates.title !== undefined) { setClauses.push('title = ?'); params.push(updates.title); }
  if (updates.content !== undefined) { setClauses.push('content = ?'); params.push(updates.content); }
  if (updates.source !== undefined) { setClauses.push('source = ?'); params.push(updates.source); }
  if (updates.metadata !== undefined) { setClauses.push('metadata = ?'); params.push(JSON.stringify(updates.metadata)); }

  if (setClauses.length === 0) return getKBDocumentById(id, owner);

  params.push(id, owner);

  db.prepare(`UPDATE kb_documents SET ${setClauses.join(', ')} WHERE id = ? AND owner_id = ?`).run(...params);
  return getKBDocumentById(id, owner);
}

function getKBDocumentByTitle(title, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const row = db.prepare('SELECT * FROM kb_documents WHERE title = ? AND owner_id = ? ORDER BY created_at DESC LIMIT 1').get(title, owner);
  if (!row) return null;
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    content: row.content,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
  };
}

function deleteKBDocument(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const rawDb = db.getRawDB ? db.getRawDB() : db;
  return rawDb.transaction((docId, docOwner) => {
    rawDb.prepare('DELETE FROM persona_documents WHERE document_id = ? AND persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(docId, docOwner);
    rawDb.prepare('DELETE FROM skill_documents WHERE document_id = ? AND skill_id IN (SELECT id FROM skills WHERE owner_id = ?)').run(docId, docOwner);
    const result = rawDb.prepare('DELETE FROM kb_documents WHERE id = ? AND owner_id = ?').run(docId, docOwner);
    return result.changes > 0;
  })(id, owner);
}

// ─── Memory ──────────────────────────────────────────────────────────────────

function createMemory(content, ownerId = 'owner', workspaceId = null, source = 'user') {
  const owner = normalizeOwnerId(ownerId);
  const id = 'mem_' + crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO memories (id, owner_id, workspace_id, content, created_at, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, owner, workspaceId || null, content, now, source || 'user');
  return { id, owner_id: owner, workspace_id: workspaceId || null, content, created_at: now, source: source || 'user' };
}

function getMemories(ownerId = 'owner', workspaceId = null) {
  const owner = normalizeOwnerId(ownerId);
  const query = workspaceId
    ? `SELECT * FROM memories WHERE owner_id = ? AND workspace_id = ? ORDER BY created_at DESC`
    : `SELECT * FROM memories WHERE owner_id = ? ORDER BY created_at DESC`;
  return workspaceId
    ? db.prepare(query).all(owner, workspaceId)
    : db.prepare(query).all(owner);
}

function getMemoryById(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare(`SELECT * FROM memories WHERE id = ? AND owner_id = ?`).get(id, owner) || null;
}

function updateMemory(id, content, ownerId = 'owner', source = null) {
  const owner = normalizeOwnerId(ownerId);
  if (source !== null) {
    const result = db.prepare(`UPDATE memories SET content = ?, source = ? WHERE id = ? AND owner_id = ?`).run(content, source, id, owner);
    return result.changes > 0;
  }
  const result = db.prepare(`UPDATE memories SET content = ? WHERE id = ? AND owner_id = ?`).run(content, id, owner);
  return result.changes > 0;
}

function deleteMemory(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const result = db.prepare(`DELETE FROM memories WHERE id = ? AND owner_id = ?`).run(id, owner);
  return result.changes > 0;
}

function clearMemories(ownerId = 'owner', workspaceId = null) {
  const owner = normalizeOwnerId(ownerId);
  const result = workspaceId
    ? db.prepare(`DELETE FROM memories WHERE owner_id = ? AND workspace_id = ?`).run(owner, workspaceId)
    : db.prepare(`DELETE FROM memories WHERE owner_id = ?`).run(owner);
  return result.changes;
}

// Persona Documents
function getPersonaDocuments(personaId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare(`
    SELECT pd.document_id, kd.title, kd.source, kd.content, kd.created_at
    FROM persona_documents pd
    JOIN kb_documents kd ON pd.document_id = kd.id
    JOIN personas p ON p.id = pd.persona_id
    WHERE pd.persona_id = ? AND p.owner_id = ? AND kd.owner_id = ?
    ORDER BY pd.created_at DESC
  `).all(personaId, owner, owner).map(r => ({
    documentId: r.document_id,
    title: r.title,
    source: r.source,
    preview: r.content ? String(r.content).slice(0, 180) : '',
    createdAt: r.created_at,
  }));
}

function getPersonaDocumentContents(personaId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare(`
    SELECT kd.id, kd.title, kd.source, kd.content, kd.metadata, kd.created_at
    FROM persona_documents pd
    JOIN kb_documents kd ON pd.document_id = kd.id
    JOIN personas p ON p.id = pd.persona_id
    WHERE pd.persona_id = ? AND p.owner_id = ? AND kd.owner_id = ?
    ORDER BY pd.created_at DESC
  `).all(personaId, owner, owner).map(r => ({
    id: r.id,
    title: r.title,
    source: r.source,
    content: r.content,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    createdAt: r.created_at,
  }));
}

function attachDocumentToPersona(personaId, documentId) {
  const now = new Date().toISOString();
  try {
    db.prepare('INSERT INTO persona_documents (persona_id, document_id, created_at) VALUES (?, ?, ?)').run(personaId, documentId, now);
    return true;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return false; // already attached
    throw e;
  }
}

function detachDocumentFromPersona(personaId, documentId) {
  const result = db.prepare('DELETE FROM persona_documents WHERE persona_id = ? AND document_id = ?').run(personaId, documentId);
  return result.changes > 0;
}

function getPersonaSkills(personaId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare(`
    SELECT ps.skill_id, s.name, s.description, s.version, s.category, s.author, s.active, s.created_at, s.updated_at
    FROM persona_skills ps
    JOIN skills s ON ps.skill_id = s.id
    JOIN personas p ON p.id = ps.persona_id
    WHERE ps.persona_id = ? AND p.owner_id = ? AND s.owner_id = ?
    ORDER BY ps.created_at DESC
  `).all(personaId, owner, owner).map((r) => ({
    skillId: r.skill_id,
    name: r.name,
    description: r.description,
    version: r.version,
    category: r.category,
    author: r.author,
    active: Boolean(r.active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function attachSkillToPersona(personaId, skillId) {
  const now = new Date().toISOString();
  try {
    db.prepare('INSERT INTO persona_skills (persona_id, skill_id, created_at) VALUES (?, ?, ?)').run(personaId, skillId, now);
    return true;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return false;
    throw e;
  }
}

function detachSkillFromPersona(personaId, skillId) {
  return db.prepare('DELETE FROM persona_skills WHERE persona_id = ? AND skill_id = ?').run(personaId, skillId).changes > 0;
}

function getPersonaSkillPackages(personaId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare(`
    SELECT
      s.id as skill_id,
      s.name,
      s.description,
      s.version,
      s.category,
      s.author,
      s.script_content,
      s.config_json,
      kd.id as document_id,
      kd.title as document_title,
      kd.source as document_source,
      kd.content as document_content,
      kd.metadata as document_metadata
    FROM persona_skills ps
    JOIN skills s ON ps.skill_id = s.id
    JOIN personas p ON p.id = ps.persona_id
    LEFT JOIN skill_documents sd ON sd.skill_id = s.id
    LEFT JOIN kb_documents kd ON kd.id = sd.document_id
    WHERE ps.persona_id = ? AND p.owner_id = ? AND s.owner_id = ? AND (kd.owner_id = ? OR kd.owner_id IS NULL)
    ORDER BY s.id DESC, sd.created_at DESC
  `).all(personaId, owner, owner, owner).reduce((acc, row) => {
    if (!acc[row.skill_id]) {
      acc[row.skill_id] = {
        skillId: row.skill_id,
        name: row.name,
        description: row.description,
        version: row.version,
        category: row.category,
        author: row.author,
        scriptContent: row.script_content,
        config: row.config_json ? (() => { try { return JSON.parse(row.config_json); } catch { return row.config_json; } })() : null,
        documents: [],
      };
    }

    if (row.document_id) {
      acc[row.skill_id].documents.push({
        id: row.document_id,
        title: row.document_title,
        source: row.document_source,
        content: row.document_content,
        metadata: row.document_metadata ? (() => { try { return JSON.parse(row.document_metadata); } catch { return row.document_metadata; } })() : null,
      });
    }

    return acc;
  }, {});
}

// Skills
function createSkill(name, description, version, author, category, scriptContent, configJson, repoUrl, ownerId = 'owner') {
  const now = new Date().toISOString();
  const owner = normalizeOwnerId(ownerId);
  const configValue = typeof configJson === 'object' ? JSON.stringify(configJson) : (configJson || null);
  const row = db.prepare(`
    INSERT INTO skills (name, description, version, author, category, script_content, config_json, repo_url, active, created_at, updated_at, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    RETURNING id
  `).get(name, description || null, version || '1.0.0', author || null, category || 'custom', scriptContent || null, configValue, repoUrl || null, now, now, owner);
  return getSkillById(row?.id ?? null, owner);
}

function getSkills(ownerId = 'owner', workspaceId = null, filters = {}) {
  const owner = normalizeOwnerId(ownerId);
  let query = 'SELECT * FROM skills WHERE owner_id = ?';
  const params = [owner];

  // Multi-tenancy: include skills with no workspace_id (created before multi-tenancy).
  if (workspaceId) {
    query += ' AND (workspace_id = ? OR workspace_id IS NULL)';
    params.push(workspaceId);
  }

  if (filters.category) {
    query += ' AND lower(category) = lower(?)';
    params.push(filters.category);
  }

  if (filters.slug) {
    query += ' AND lower(name) = lower(?)';
    params.push(filters.slug);
  }

  if (filters.q) {
    const like = `%${filters.q}%`;
    query += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)';
    params.push(like, like, like);
  }

  query += ' ORDER BY created_at DESC';

  if (filters.limit && Number.isInteger(filters.limit) && filters.limit > 0) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(query).all(...params).map(row => ({
    ...row, active: Boolean(row.active),
    config_json: row.config_json ? (() => { try { return JSON.parse(row.config_json); } catch { return row.config_json; } })() : null,
  }));
}

function getSkillBySlug(slug, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const row = db.prepare('SELECT * FROM skills WHERE lower(name) = lower(?) AND owner_id = ?').get(slug, owner);
  if (!row) return null;
  return {
    ...row, active: Boolean(row.active),
    config_json: row.config_json ? (() => { try { return JSON.parse(row.config_json); } catch { return row.config_json; } })() : null,
  };
}

function getSkillsByIds(ids, ownerId = 'owner') {
  if (!ids || ids.length === 0) return [];
  const owner = normalizeOwnerId(ownerId);
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM skills WHERE id IN (${placeholders}) AND owner_id = ?`)
    .all(...ids, owner)
    .map(row => ({
      ...row, active: Boolean(row.active),
      config_json: row.config_json ? (() => { try { return JSON.parse(row.config_json); } catch { return row.config_json; } })() : null,
    }));
}

function getSkillsBySlugList(slugs, ownerId = 'owner') {
  if (!slugs || slugs.length === 0) return [];
  const owner = normalizeOwnerId(ownerId);
  const placeholders = slugs.map(() => 'lower(?)').join(',');
  return db.prepare(`SELECT * FROM skills WHERE lower(name) IN (${placeholders}) AND owner_id = ?`)
    .all(...slugs.map(s => s.toLowerCase()), owner)
    .map(row => ({
      ...row, active: Boolean(row.active),
      config_json: row.config_json ? (() => { try { return JSON.parse(row.config_json); } catch { return row.config_json; } })() : null,
    }));
}

function suggestSkills(q, ownerId = 'owner', limit = 10) {
  const owner = normalizeOwnerId(ownerId);
  const like = `%${q}%`;
  return db.prepare(
    `SELECT id, name, description, category FROM skills WHERE owner_id = ? AND (name LIKE ? OR description LIKE ? OR category LIKE ?) ORDER BY created_at DESC LIMIT ?`
  ).all(owner, like, like, like, limit);
}

function getSkillById(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const row = db.prepare('SELECT * FROM skills WHERE id = ? AND owner_id = ?').get(id, owner);
  if (!row) return null;
  return {
    ...row, active: Boolean(row.active),
    config_json: row.config_json ? (() => { try { return JSON.parse(row.config_json); } catch { return row.config_json; } })() : null,
  };
}

function updateSkill(id, updates, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const skill = getSkillById(id, owner);
  if (!skill) return null;
  const now = new Date().toISOString();
  const name = updates.name !== undefined ? updates.name : skill.name;
  const description = updates.description !== undefined ? updates.description : skill.description;
  const version = updates.version !== undefined ? updates.version : skill.version;
  const author = updates.author !== undefined ? updates.author : skill.author;
  const category = updates.category !== undefined ? updates.category : skill.category;
  const scriptContent = updates.script_content !== undefined ? updates.script_content : skill.script_content;
  const repoUrl = updates.repo_url !== undefined ? updates.repo_url : skill.repo_url;
  const configJson = updates.config_json !== undefined
    ? (typeof updates.config_json === 'object' ? JSON.stringify(updates.config_json) : updates.config_json)
    : (typeof skill.config_json === 'object' ? JSON.stringify(skill.config_json) : skill.config_json);

  db.prepare(`
    UPDATE skills SET name=?, description=?, version=?, author=?, category=?, script_content=?, config_json=?, repo_url=?, updated_at=? WHERE id=? AND owner_id=?
  `).run(name, description, version, author, category, scriptContent, configJson, repoUrl, now, id, owner);
  return getSkillById(id, owner);
}

function deleteSkill(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  db.prepare('DELETE FROM skill_documents WHERE skill_id = ?').run(id);
  const result = db.prepare('DELETE FROM skills WHERE id = ? AND owner_id = ?').run(id, owner);
  return result.changes > 0;
}

function setActiveSkill(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const skill = getSkillById(id, owner);
  if (!skill) return null;
  const now = new Date().toISOString();
  db.prepare('UPDATE skills SET active = 0 WHERE owner_id = ? AND id != ?').run(owner, id);
  db.prepare('UPDATE skills SET active = 1, updated_at = ? WHERE id = ? AND owner_id = ?').run(now, id, owner);
  return getSkillById(id, owner);
}

function getSkillDocuments(skillId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare(`
    SELECT sd.document_id, kd.title, kd.source, kd.created_at
    FROM skill_documents sd
    JOIN kb_documents kd ON sd.document_id = kd.id
    JOIN skills s ON s.id = sd.skill_id
    WHERE sd.skill_id = ? AND s.owner_id = ? AND kd.owner_id = ?
    ORDER BY sd.created_at DESC
  `).all(skillId, owner, owner).map(r => ({
    documentId: r.document_id, title: r.title, source: r.source, createdAt: r.created_at,
  }));
}

function attachDocumentToSkill(skillId, documentId) {
  const now = new Date().toISOString();
  try {
    db.prepare('INSERT INTO skill_documents (skill_id, document_id, created_at) VALUES (?, ?, ?)').run(skillId, documentId, now);
    return true;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return false;
    throw e;
  }
}

function detachDocumentFromSkill(skillId, documentId) {
  return db.prepare('DELETE FROM skill_documents WHERE skill_id = ? AND document_id = ?').run(skillId, documentId).changes > 0;
}

// Phase 1: Skill Origin & Attribution
function updateSkillOrigin(skillId, originData, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const skill = getSkillById(skillId, owner);
  if (!skill) return null;
  
  const now = new Date().toISOString();
  const {
    origin_type,
    origin_source_id,
    origin_owner,
    origin_owner_type,
    is_fork,
    upstream_owner,
    upstream_repo_url,
    license
  } = originData;
  
  db.prepare(`
    UPDATE skills SET
      origin_type = COALESCE(?, origin_type),
      origin_source_id = COALESCE(?, origin_source_id),
      origin_owner = COALESCE(?, origin_owner),
      origin_owner_type = COALESCE(?, origin_owner_type),
      is_fork = COALESCE(?, is_fork),
      upstream_owner = COALESCE(?, upstream_owner),
      upstream_repo_url = COALESCE(?, upstream_repo_url),
      license = COALESCE(?, license),
      updated_at = ?
    WHERE id = ? AND owner_id = ?
  `).run(
    origin_type,
    origin_source_id,
    origin_owner,
    origin_owner_type,
    is_fork !== undefined ? (is_fork ? 1 : 0) : null,
    upstream_owner,
    upstream_repo_url,
    license,
    now,
    skillId,
    owner
  );
  
  return getSkillById(skillId, owner);
}

// Phase 2: Skill Versioning & Immutability
function createSkillVersion(skillId, versionNumber, contentHash, creatorId, releaseNotes, scriptContent, configJson, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const skill = getSkillById(skillId, owner);
  if (!skill) return null;
  
  const now = new Date().toISOString();
  const configStr = typeof configJson === 'object' ? JSON.stringify(configJson) : configJson;
  
  const row = db.prepare(`
    INSERT INTO skill_versions (skill_id, version_number, content_hash, created_at, creator_id, release_notes, script_content, config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(skillId, versionNumber, contentHash, now, creatorId, releaseNotes || null, scriptContent || null, configStr || null);

  // Update skill to reference this version
  db.prepare(`
    UPDATE skills SET version = ?, updated_at = ?, published_at = COALESCE(published_at, ?)
    WHERE id = ? AND owner_id = ?
  `).run(versionNumber, now, now, skillId, owner);

  return {
    id: row?.id ?? null,
    skillId,
    versionNumber,
    contentHash,
    createdAt: now,
    creatorId,
    releaseNotes
  };
}

function getSkillVersions(skillId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare(`
    SELECT sv.id, sv.skill_id, sv.version_number, sv.content_hash, sv.created_at, sv.creator_id, sv.release_notes
    FROM skill_versions sv
    JOIN skills s ON sv.skill_id = s.id
    WHERE sv.skill_id = ? AND s.owner_id = ?
    ORDER BY sv.created_at DESC
  `).all(skillId, owner).map(row => ({
    id: row.id,
    skillId: row.skill_id,
    versionNumber: row.version_number,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    creatorId: row.creator_id,
    releaseNotes: row.release_notes
  }));
}

function getSkillVersion(skillId, versionNumber, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const row = db.prepare(`
    SELECT sv.id, sv.skill_id, sv.version_number, sv.content_hash, sv.created_at, sv.creator_id, sv.release_notes, sv.script_content, sv.config_json
    FROM skill_versions sv
    JOIN skills s ON sv.skill_id = s.id
    WHERE sv.skill_id = ? AND sv.version_number = ? AND s.owner_id = ?
  `).get(skillId, versionNumber, owner);
  
  if (!row) return null;
  
  return {
    id: row.id,
    skillId: row.skill_id,
    versionNumber: row.version_number,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    creatorId: row.creator_id,
    releaseNotes: row.release_notes,
    scriptContent: row.script_content,
    configJson: row.config_json ? (() => { try { return JSON.parse(row.config_json); } catch { return row.config_json; } })() : null
  };
}

// Phase 3: Fork & Derivative Tracking
function createSkillFork(originalSkillId, newSkillId, forkedByUserId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const skill = getSkillById(newSkillId, owner);
  if (!skill) return null;
  
  const now = new Date().toISOString();
  const forkRow = db.prepare(`
    INSERT INTO skill_forks (original_skill_id, fork_skill_id, forked_by_user_id, created_at)
    VALUES (?, ?, ?, ?)
    RETURNING id
  `).get(originalSkillId, newSkillId, forkedByUserId, now);

  // Update the fork skill with fork information
  const originalSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(originalSkillId);
  if (originalSkill) {
    db.prepare(`
      UPDATE skills SET
        is_fork = 1,
        upstream_owner = ?,
        upstream_repo_url = ?
      WHERE id = ? AND owner_id = ?
    `).run(originalSkill.origin_owner || originalSkill.author, null, newSkillId, owner);
  }

  return {
    id: forkRow?.id ?? null,
    originalSkillId,
    forkSkillId: newSkillId,
    forkedByUserId,
    createdAt: now
  };
}

function getSkillForks(skillId) {
  return db.prepare(`
    SELECT id, original_skill_id, fork_skill_id, forked_by_user_id, created_at
    FROM skill_forks
    WHERE original_skill_id = ?
    ORDER BY created_at DESC
  `).all(skillId).map(row => ({
    id: row.id,
    originalSkillId: row.original_skill_id,
    forkSkillId: row.fork_skill_id,
    forkedByUserId: row.forked_by_user_id,
    createdAt: row.created_at
  }));
}

function getSkillForkInfo(skillId) {
  const row = db.prepare(`
    SELECT original_skill_id, forked_by_user_id, created_at
    FROM skill_forks
    WHERE fork_skill_id = ?
  `).get(skillId);
  
  if (!row) return null;
  return {
    originalSkillId: row.original_skill_id,
    forkedByUserId: row.forked_by_user_id,
    createdAt: row.created_at
  };
}

// Phase 4: License System
function getLicenses() {
  return db.prepare(`
    SELECT id, license_name, description, can_fork, can_sell, can_modify, attribution_required
    FROM skill_licenses
    ORDER BY license_name
  `).all().map(row => ({
    id: row.id,
    licenseName: row.license_name,
    description: row.description,
    canFork: Boolean(row.can_fork),
    canSell: Boolean(row.can_sell),
    canModify: Boolean(row.can_modify),
    attributionRequired: Boolean(row.attribution_required)
  }));
}

function getLicense(licenseName) {
  const row = db.prepare(`
    SELECT id, license_name, description, can_fork, can_sell, can_modify, attribution_required, license_text
    FROM skill_licenses
    WHERE license_name = ?
  `).get(licenseName);
  
  if (!row) return null;
  return {
    id: row.id,
    licenseName: row.license_name,
    description: row.description,
    canFork: Boolean(row.can_fork),
    canSell: Boolean(row.can_sell),
    canModify: Boolean(row.can_modify),
    attributionRequired: Boolean(row.attribution_required),
    licenseText: row.license_text
  };
}

function validateLicenseOperation(skillLicense, operation) {
  const license = getLicense(skillLicense);
  if (!license) return false;
  
  switch(operation) {
    case 'fork': return license.canFork;
    case 'sell': return license.canSell;
    case 'modify': return license.canModify;
    default: return false;
  }
}

// Phase 4: Ownership Verification
function createOwnershipClaim(skillId, claimantUserId, githubUsername = null, marketplaceUserId = null, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const skill = getSkillById(skillId, owner);
  if (!skill) return null;
  
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO skill_ownership_claims (skill_id, claimant_user_id, github_username, marketplace_user_id, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (skill_id, claimant_user_id) DO UPDATE SET
      github_username = excluded.github_username,
      marketplace_user_id = excluded.marketplace_user_id
    RETURNING id
  `);
  
  const claimRow = stmt.get(skillId, claimantUserId, githubUsername || null, marketplaceUserId || null, now);
  return {
    id: claimRow?.id ?? null,
    skillId,
    claimantUserId,
    githubUsername,
    marketplaceUserId,
    verified: false,
    createdAt: now
  };
}

function getOwnershipClaim(skillId, claimantUserId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const row = db.prepare(`
    SELECT soc.id, soc.skill_id, soc.claimant_user_id, soc.github_username, soc.marketplace_user_id, soc.verified, soc.verified_at
    FROM skill_ownership_claims soc
    JOIN skills s ON soc.skill_id = s.id
    WHERE soc.skill_id = ? AND soc.claimant_user_id = ? AND s.owner_id = ?
  `).get(skillId, claimantUserId, owner);
  
  if (!row) return null;
  return {
    id: row.id,
    skillId: row.skill_id,
    claimantUserId: row.claimant_user_id,
    githubUsername: row.github_username,
    marketplaceUserId: row.marketplace_user_id,
    verified: Boolean(row.verified),
    verifiedAt: row.verified_at
  };
}

function verifyOwnershipClaim(skillId, claimantUserId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const now = new Date().toISOString();
  
  const result = db.prepare(`
    UPDATE skill_ownership_claims
    SET verified = 1, verified_at = ?
    WHERE skill_id = ? AND claimant_user_id = ? AND EXISTS (
      SELECT 1 FROM skills WHERE id = ? AND owner_id = ?
    )
  `).run(now, skillId, claimantUserId, skillId, owner);
  
  return result.changes > 0;
}

function getSkillOwnershipClaims(skillId, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare(`
    SELECT soc.id, soc.claimant_user_id, soc.github_username, soc.marketplace_user_id, soc.verified, soc.verified_at
    FROM skill_ownership_claims soc
    JOIN skills s ON soc.skill_id = s.id
    WHERE soc.skill_id = ? AND s.owner_id = ?
  `).all(skillId, owner).map(row => ({
    id: row.id,
    claimantUserId: row.claimant_user_id,
    githubUsername: row.github_username,
    marketplaceUserId: row.marketplace_user_id,
    verified: Boolean(row.verified),
    verifiedAt: row.verified_at
  }));
}

// Marketplace
function _formatListing(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_display_name || row.owner_name || row.owner_id,
    type: row.type,
    title: row.title,
    description: row.description,
    content: row.content ? (() => { try { return JSON.parse(row.content); } catch { return row.content; } })() : null,
    tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    price: row.price,
    provider: row.provider || 'User',
    official: row.official ? true : false,
    status: row.status,
    avgRating: row.avg_rating,
    ratingCount: row.rating_count,
    installCount: row.install_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createMarketplaceListing(ownerId, type, title, description, content, tags, price) {
  const now = new Date().toISOString();
  const contentStr = content ? (typeof content === 'object' ? JSON.stringify(content) : content) : null;
  const row = db.prepare(`
    INSERT INTO marketplace_listings (owner_id, type, title, description, content, tags, price, status, avg_rating, rating_count, install_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, 0, ?, ?)
    RETURNING id
  `).get(ownerId, type, title, description || null, contentStr, tags || '', price || 'free', now, now);
  return getMarketplaceListing(row?.id ?? null);
}

function getMarketplaceListings({ type, sort, search, tags, provider, price, rating, official, status = 'active' } = {}) {
  let query = `
    SELECT ml.*, u.username as owner_name, u.display_name as owner_display_name
    FROM marketplace_listings ml
    LEFT JOIN users u ON ml.owner_id = u.id
    WHERE ml.status = ?
  `;
  const params = [status];

  // Type filter — 'token' matches both 'token' and legacy 'api' listings
  if (type && type !== 'all') {
    if (type === 'token') {
      query += " AND ml.type IN ('token', 'api')";
    } else {
      query += ' AND ml.type = ?';
      params.push(type);
    }
  }

  // Search filter
  if (search) {
    query += ' AND (ml.title LIKE ? OR ml.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  // Tags/Field filter
  if (tags) {
    query += ' AND ml.tags LIKE ?';
    params.push(`%${tags}%`);
  }

  // Provider filter
  if (provider && provider !== 'all') {
    query += ' AND ml.provider = ?';
    params.push(provider);
  }

  // Price filter (free, paid, or all)
  if (price === 'free') {
    query += " AND ml.price = 'free'";
  } else if (price === 'paid') {
    query += " AND ml.price != 'free'";
  }

  // Rating filter (4+ stars)
  if (rating === '4+') {
    query += ' AND ml.avg_rating >= 4';
  }

  // Official/Verified filter
  if (official === '1' || official === true) {
    query += ' AND ml.official = 1';
  }

  // Sorting
  if (sort === 'popular') {
    query += ' ORDER BY ml.avg_rating DESC, ml.rating_count DESC';
  } else if (sort === 'most_used') {
    query += ' ORDER BY ml.install_count DESC';
  } else {
    query += ' ORDER BY ml.created_at DESC';
  }

  return db.prepare(query).all(...params).map(_formatListing);
}

function getMarketplaceListing(id) {
  const row = db.prepare(`
    SELECT ml.*, u.username as owner_name, u.display_name as owner_display_name
    FROM marketplace_listings ml
    LEFT JOIN users u ON ml.owner_id = u.id
    WHERE ml.id = ?
  `).get(id);
  if (!row) return null;

  const ratings = db.prepare(`
    SELECT mr.*, u.username, u.display_name
    FROM marketplace_ratings mr
    LEFT JOIN users u ON mr.user_id = u.id
    WHERE mr.listing_id = ?
    ORDER BY mr.created_at DESC
  `).all(id).map(r => ({
    id: r.id,
    userId: r.user_id,
    reviewerName: r.display_name || r.username || 'Anonymous',
    rating: r.rating,
    review: r.review,
    createdAt: r.created_at,
  }));

  return { ..._formatListing(row), ratings };
}

function updateMarketplaceListing(id, ownerId, updates) {
  const existing = db.prepare('SELECT * FROM marketplace_listings WHERE id = ? AND owner_id = ?').get(id, ownerId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const title = updates.title !== undefined ? updates.title : existing.title;
  const description = updates.description !== undefined ? updates.description : existing.description;
  const contentVal = updates.content !== undefined
    ? (typeof updates.content === 'object' ? JSON.stringify(updates.content) : updates.content)
    : existing.content;
  const tags = updates.tags !== undefined ? updates.tags : existing.tags;
  const status = updates.status !== undefined ? updates.status : existing.status;

  db.prepare(`
    UPDATE marketplace_listings SET title=?, description=?, content=?, tags=?, status=?, updated_at=? WHERE id=?
  `).run(title, description, contentVal, tags, status, now, id);

  return getMarketplaceListing(id);
}

function removeMarketplaceListing(id, ownerId) {
  const result = db.prepare(
    `UPDATE marketplace_listings SET status='removed', updated_at=? WHERE id=? AND owner_id=?`
  ).run(new Date().toISOString(), id, ownerId);
  return result.changes > 0;
}

function rateMarketplaceListing(listingId, userId, rating, review) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO marketplace_ratings (listing_id, user_id, rating, review, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(listing_id, user_id) DO UPDATE SET rating=excluded.rating, review=excluded.review, created_at=excluded.created_at
  `).run(listingId, userId, rating, review || null, now);

  const stats = db.prepare(
    `SELECT AVG(rating) as avg, COUNT(*) as cnt FROM marketplace_ratings WHERE listing_id=?`
  ).get(listingId);
  const newAvg = Math.round((stats.avg || 0) * 10) / 10;
  db.prepare(`UPDATE marketplace_listings SET avg_rating=?, rating_count=?, updated_at=? WHERE id=?`)
    .run(newAvg, stats.cnt, now, listingId);

  return { avgRating: newAvg, ratingCount: stats.cnt };
}

function incrementInstallCount(listingId) {
  db.prepare(`UPDATE marketplace_listings SET install_count=install_count+1, updated_at=? WHERE id=?`)
    .run(new Date().toISOString(), listingId);
}

function getMyMarketplaceListings(ownerId) {
  return db.prepare(`
    SELECT ml.*, u.username as owner_name, u.display_name as owner_display_name
    FROM marketplace_listings ml
    LEFT JOIN users u ON ml.owner_id = u.id
    WHERE ml.owner_id = ? AND ml.status != 'removed'
    ORDER BY ml.created_at DESC
  `).all(ownerId).map(_formatListing);
}

// Services & Categories
function seedServiceCategories() {
  const categories = [
    { name: 'social', label: '🌐 Social Media', icon: 'Share2', color: '#3B82F6' },
    { name: 'dev', label: '👨‍💻 Development', icon: 'Code', color: '#8B5CF6' },
    { name: 'productivity', label: '📊 Productivity', icon: 'Zap', color: '#F59E0B' },
    { name: 'payment', label: '💳 Payment', icon: 'CreditCard', color: '#10B981' },
    { name: 'communication', label: '💬 Communication', icon: 'MessageSquare', color: '#EC4899' },
    { name: 'cloud', label: '☁️ Cloud', icon: 'Cloud', color: '#06B6D4' },
    { name: 'analytics', label: '📈 Analytics', icon: 'BarChart3', color: '#EF4444' },
  ];

  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM service_categories');
  const result = checkStmt.get();
  
  if (result.count === 0) {
    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO service_categories (name, label, icon, color, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const cat of categories) {
      insertStmt.run(cat.name, cat.label, cat.icon, cat.color, now);
    }
    console.log('Seeded service categories');
  }
}

function seedExamplePersonas() {
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM personas');
  const result = checkStmt.get();
  
  if (result.count === 0) {
    const now = new Date().toISOString();
    
    // Example 1: "Bugs Bunny" - Grumpy Senior Developer
    const bugsSoul = `## Role & Identity

You are "Bugs" Bunny (no relation), a Senior Full-Stack Developer who has been coding since the 90s. Your background includes shipping 5+ production applications and mentoring 20+ developers. Your primary goal is to review code with brutal honesty but high technical accuracy.

## Personality & Tone

**Tone:** Cynical, tired, but secretly helpful.
**Communication Style:** Short, direct, and slightly condescending about modern frameworks.
**Traits:** Impatient, brilliant, and caffeinated.
**Vocabulary:** Use old-school dev slang like "spaghetti code" and "RTFM." Avoid corporate jargon and buzzwords.

## Operational Rules

**Formatting:** Always present corrections using code blocks and markdown.
**Knowledge Limit:** If asked about "No-Code tools", express mild physical pain and politely refuse to answer.
**Internal Logic:** Act like you're typing this from a dark basement office with 3 coffee cups nearby.
**Greeting:** Start every interaction with "Sup, what're we fixing today?"

## Response Constraints

- DO NOT use emojis
- DO NOT be diplomatic about bad code
- DO NOT suggest frameworks younger than 5 years
- ALWAYS find at least one thing to "complain" about
- ALWAYS provide the correct solution
- ALWAYS explain why something is wrong, not just that it is`;
    
    createPersona('Bugs Bunny', bugsSoul, 'Senior Developer - Code Reviewer & Mentor', {
      name: 'Bugs Bunny',
      title: 'Senior Full-Stack Developer',
      field: 'Software Engineering',
      yearsExperience: '30 years since the 90s',
      achievement: 'Shipped 5+ production apps, mentored 20+ developers',
      coreGoal: 'Review code with brutal honesty but high technical accuracy',
      tone: 'Cynical, tired, but secretly helpful',
      communicationStyle: 'Short, direct, slightly condescending',
      traits: 'Impatient, brilliant, caffeinated',
      vocabulary: 'Old-school dev slang like "spaghetti code" and "RTFM"',
      avoidWords: 'Corporate jargon, buzzwords',
      formatting: 'Code blocks and markdown',
      internalLogic: 'Typing from a dark basement with coffee',
      greeting: 'Sup, what\'re we fixing today?',
      doNotActions: 'use emojis\nbe diplomatic about bad code\nsuggest new frameworks',
      alwaysActions: 'find something to complain about\nprovide the correct solution\nexplain why not just that it\'s wrong',
      createdAt: now
    });
    
    // Example 2: "Dr. Ada Lovelace" - Data Science Expert
    const adaSoul = `## Role & Identity

You are Dr. Ada Lovelace, a PhD Data Scientist with 12 years of experience in machine learning, statistical analysis, and AI research. Your background includes published papers in top-tier journals and industry experience at leading tech companies. Your primary goal is to help others understand data science concepts deeply and avoid common pitfalls.

## Personality & Tone

**Tone:** Warm, patient, but intellectually rigorous.
**Communication Style:** Detailed and academic, with real-world examples.
**Traits:** Curious, methodical, encouraging.
**Vocabulary:** Use proper statistical terminology but always explain it. Include mathematics when necessary.

## Operational Rules

**Formatting:** Use tables for comparisons, bullet points for steps, LaTeX for equations.
**Knowledge Limit:** If asked about outdated techniques pre-2015, redirect to modern alternatives.
**Internal Logic:** Always think about what the questioner is really trying to achieve, not just the literal question.
**Greeting:** "Hello! I'm delighted to discuss data science with you. What's on your mind?"

## Response Constraints

- DO NOT oversimplify complex concepts
- DO NOT ignore statistical significance
- DO NOT recommend techniques without justifying them
- ALWAYS provide context for when a technique is appropriate
- ALWAYS explain both what to do AND why
- ALWAYS ask clarifying questions if the problem is ambiguous`;

    createPersona('Dr. Ada Lovelace', adaSoul, 'Data Science Expert - Machine Learning Researcher', {
      name: 'Dr. Ada Lovelace',
      title: 'PhD Data Scientist',
      field: 'Machine Learning & AI',
      yearsExperience: '12 years in research and industry',
      achievement: 'Published papers in top journals, worked at leading tech companies',
      coreGoal: 'Help understand data science deeply and avoid common pitfalls',
      tone: 'Warm, patient, intellectually rigorous',
      communicationStyle: 'Detailed and academic with real-world examples',
      traits: 'Curious, methodical, encouraging',
      vocabulary: 'Proper statistical terminology with explanations',
      formatting: 'Tables, bullet points, LaTeX equations',
      internalLogic: 'Think about real goals, not just literal questions',
      greeting: 'Hello! I\'m delighted to discuss data science with you.',
      doNotActions: 'oversimplify complex concepts\nignore statistical significance\nrecommend without justification',
      alwaysActions: 'provide context for techniques\nexplain what AND why\nask clarifying questions',
      createdAt: now
    });
    
    // Example 3: "Luna" - Wellness & Mindfulness Coach
    const lunaSoul = `## Role & Identity

You are Luna, a certified wellness coach and mindfulness practitioner with 8 years of experience helping people build healthier, happier lives. Your background includes training in cognitive behavioral therapy, yoga, and positive psychology. Your primary goal is to guide people toward sustainable wellbeing practices with compassion and evidence-based advice.

## Personality & Tone

**Tone:** Warm, supportive, non-judgmental.
**Communication Style:** Conversational and encouraging, meeting people where they are.
**Traits:** Empathetic, grounded, optimistic.
**Vocabulary:** Use accessible language. Avoid medical jargon unless explaining it. Incorporate mindfulness concepts naturally.

## Operational Rules

**Formatting:** Use bulleted practices, short paragraphs for readability, metaphors from nature.
**Knowledge Limit:** If asked about serious mental health conditions requiring therapy, gently redirect to professional help.
**Internal Logic:** Always prioritize the person's wellbeing over productivity metrics.
**Greeting:** "I'm Luna, so happy you're here. What brings you to our conversation today?"

## Response Constraints

- DO NOT diagnose or prescribe medical treatments
- DO NOT dismiss someone's feelings
- DO NOT push toxic positivity
- ALWAYS validate emotions before suggesting solutions
- ALWAYS acknowledge the effort it takes to seek help
- ALWAYS offer sustainable practices, not quick fixes`;

    createPersona('Luna', lunaSoul, 'Wellness Coach - Mindfulness & Mental Health Support', {
      name: 'Luna',
      title: 'Certified Wellness Coach',
      field: 'Mental Health & Wellness',
      yearsExperience: '8 years in wellness coaching',
      achievement: 'Trained in CBT, yoga, and positive psychology',
      coreGoal: 'Guide toward sustainable wellbeing with compassion',
      tone: 'Warm, supportive, non-judgmental',
      communicationStyle: 'Conversational and encouraging',
      traits: 'Empathetic, grounded, optimistic',
      vocabulary: 'Accessible language with natural mindfulness concepts',
      avoidWords: 'Jargon without explanation, toxic positivity',
      formatting: 'Bulleted practices, short paragraphs, nature metaphors',
      internalLogic: 'Prioritize wellbeing over productivity',
      greeting: 'I\'m Luna, so happy you\'re here. What brings you today?',
      doNotActions: 'diagnose medical conditions\ndismiss feelings\npush toxic positivity',
      alwaysActions: 'validate emotions first\nacknowledge the effort\noffer sustainable practices',
      createdAt: now
    });
    
    // Set the first persona as active
    const firstPersona = db.prepare('SELECT id FROM personas LIMIT 1').get();
    if (firstPersona) {
      db.prepare('UPDATE personas SET active = 1 WHERE id = ?').run(firstPersona.id);
    }
    
    console.log('Seeded example personas');
  }
}

function seedServices() {
  const services = [
    // Core Platform - with official logos
    { name: 'google', label: 'Google', category: 'productivity', icon: 'https://cdn.simpleicons.org/google', auth: 'oauth2', endpoint: 'https://www.googleapis.com', docs: 'https://developers.google.com' },
    { name: 'slack', label: 'Slack', category: 'communication', icon: 'https://cdn.simpleicons.org/slack', auth: 'oauth2', endpoint: 'https://slack.com/api', docs: 'https://api.slack.com/docs' },
    { name: 'discord', label: 'Discord', category: 'communication', icon: 'https://cdn.simpleicons.org/discord', auth: 'oauth2', endpoint: 'https://discord.com/api/v10', docs: 'https://discord.com/developers/docs' },
    { name: 'whatsapp', label: 'WhatsApp', category: 'communication', icon: 'https://cdn.simpleicons.org/whatsapp', auth: 'oauth2', endpoint: 'https://graph.facebook.com/v18.0', docs: 'https://developers.facebook.com/docs/whatsapp' },

    // Social Media - with official logos
    { name: 'twitter', label: 'X (Twitter)', category: 'social', icon: 'https://cdn.simpleicons.org/x', auth: 'oauth2', endpoint: 'https://api.twitter.com/2', docs: 'https://developer.twitter.com' },
    { name: 'facebook', label: 'Facebook', category: 'social', icon: 'https://cdn.simpleicons.org/facebook', auth: 'oauth2', endpoint: 'https://graph.facebook.com', docs: 'https://developers.facebook.com/docs/graph-api' },
    { name: 'linkedin', label: 'LinkedIn', category: 'social', icon: 'https://cdn.simpleicons.org/linkedin', auth: 'oauth2', endpoint: 'https://api.linkedin.com/v2', docs: 'https://docs.microsoft.com/en-us/linkedin' },
    { name: 'instagram', label: 'Instagram', category: 'social', icon: 'https://cdn.simpleicons.org/instagram', auth: 'oauth2', endpoint: 'https://graph.instagram.com', docs: 'https://developers.facebook.com/docs/instagram' },
    { name: 'tiktok', label: 'TikTok', category: 'social', icon: 'https://cdn.simpleicons.org/tiktok', auth: 'oauth2', endpoint: 'https://open.tiktok.com/v1', docs: 'https://developers.tiktok.com' },
    { name: 'reddit', label: 'Reddit', category: 'social', icon: 'https://cdn.simpleicons.org/reddit', auth: 'oauth2', endpoint: 'https://oauth.reddit.com', docs: 'https://www.reddit.com/dev/api' },
    { name: 'youtube', label: 'YouTube', category: 'social', icon: 'https://cdn.simpleicons.org/youtube', auth: 'oauth2', endpoint: 'https://www.googleapis.com/youtube/v3', docs: 'https://developers.google.com/youtube' },
    { name: 'twitch', label: 'Twitch', category: 'social', icon: 'https://cdn.simpleicons.org/twitch', auth: 'oauth2', endpoint: 'https://api.twitch.tv/helix', docs: 'https://dev.twitch.tv/docs/api' },
    { name: 'bluesky', label: 'Bluesky', category: 'social', icon: 'https://cdn.simpleicons.org/bluesky', auth: 'jwt', endpoint: 'https://bsky.social/xrpc', docs: 'https://docs.bsky.app' },
    { name: 'mastodon', label: 'Mastodon', category: 'social', icon: 'https://cdn.simpleicons.org/mastodon', auth: 'oauth2', endpoint: 'https://mastodon.social/api/v1', docs: 'https://docs.joinmastodon.org' },
    
    // Development - with official logos
    { name: 'github', label: 'GitHub', category: 'dev', icon: 'https://cdn.simpleicons.org/github', auth: 'oauth2', endpoint: 'https://api.github.com', docs: 'https://docs.github.com/en/rest' },
    { name: 'gitlab', label: 'GitLab', category: 'dev', icon: 'https://cdn.simpleicons.org/gitlab', auth: 'oauth2', endpoint: 'https://gitlab.com/api/v4', docs: 'https://docs.gitlab.com/ee/api' },
    { name: 'bitbucket', label: 'Bitbucket', category: 'dev', icon: 'https://cdn.simpleicons.org/bitbucket', auth: 'oauth2', endpoint: 'https://api.bitbucket.org/2.0', docs: 'https://developer.atlassian.com/cloud/bitbucket' },
    { name: 'azuredevops', label: 'Azure DevOps', category: 'dev', icon: 'https://cdn.simpleicons.org/azuredevops', auth: 'oauth2', endpoint: 'https://dev.azure.com', docs: 'https://docs.microsoft.com/en-us/rest/api/azure/devops' },
    { name: 'travisci', label: 'Travis CI', category: 'dev', icon: 'https://cdn.simpleicons.org/travisci', auth: 'token', endpoint: 'https://api.travis-ci.com', docs: 'https://docs.travis-ci.com/api' },
    { name: 'circleci', label: 'CircleCI', category: 'dev', icon: 'https://cdn.simpleicons.org/circleci', auth: 'token', endpoint: 'https://circleci.com/api/v2', docs: 'https://circleci.com/docs/api/v2' },
    { name: 'gitea', label: 'Gitea', category: 'dev', icon: 'https://cdn.simpleicons.org/gitea', auth: 'oauth2', endpoint: 'https://api.gitea.io', docs: 'https://docs.gitea.io/en-us/api-usage' },
    
    // Productivity - with official logos
    { name: 'notion', label: 'Notion', category: 'productivity', icon: 'https://cdn.simpleicons.org/notion', auth: 'oauth2', endpoint: 'https://api.notion.com/v1', docs: 'https://developers.notion.com' },
    { name: 'airtable', label: 'Airtable', category: 'productivity', icon: 'https://cdn.simpleicons.org/airtable', auth: 'token', endpoint: 'https://api.airtable.com/v0', docs: 'https://airtable.com/developers/web/api' },
    { name: 'asana', label: 'Asana', category: 'productivity', icon: 'https://cdn.simpleicons.org/asana', auth: 'oauth2', endpoint: 'https://app.asana.com/api/1.0', docs: 'https://developers.asana.com' },
    { name: 'monday', label: 'Monday.com', category: 'productivity', icon: 'https://cdn.simpleicons.org/monday', auth: 'token', endpoint: 'https://api.monday.com/graphql', docs: 'https://monday.com/developers' },
    { name: 'trello', label: 'Trello', category: 'productivity', icon: 'https://cdn.simpleicons.org/trello', auth: 'oauth2', endpoint: 'https://api.trello.com/1', docs: 'https://developer.atlassian.com/cloud/trello' },
    { name: 'jira', label: 'Jira', category: 'productivity', icon: 'https://cdn.simpleicons.org/jira', auth: 'oauth2', endpoint: 'https://your-domain.atlassian.net/rest/api/2', docs: 'https://developer.atlassian.com/cloud/jira' },
    { name: 'clickup', label: 'ClickUp', category: 'productivity', icon: 'https://cdn.simpleicons.org/clickup', auth: 'token', endpoint: 'https://api.clickup.com/api/v2', docs: 'https://clickup.com/api' },
    { name: 'linear', label: 'Linear', category: 'productivity', icon: 'https://cdn.simpleicons.org/linear', auth: 'token', endpoint: 'https://api.linear.app/graphql', docs: 'https://developers.linear.app' },
    
    // Payment - with official logos
    { name: 'stripe', label: 'Stripe', category: 'payment', icon: 'https://cdn.simpleicons.org/stripe', auth: 'key', endpoint: 'https://api.stripe.com/v1', docs: 'https://stripe.com/docs/api' },
    { name: 'fal', label: 'fal', category: 'dev', icon: 'https://cdn.simpleicons.org/fal', auth: 'api_key', endpoint: 'https://fal.run', docs: 'https://fal.ai/models' },
    { name: 'paypal', label: 'PayPal', category: 'payment', icon: 'https://cdn.simpleicons.org/paypal', auth: 'oauth2', endpoint: 'https://api-m.paypal.com', docs: 'https://developer.paypal.com' },
    { name: 'shopify', label: 'Shopify', category: 'payment', icon: 'https://cdn.simpleicons.org/shopify', auth: 'oauth2', endpoint: 'https://your-store.myshopify.com/admin/api/2024-01', docs: 'https://shopify.dev/api/admin-rest' },
    { name: 'square', label: 'Square', category: 'payment', icon: 'https://cdn.simpleicons.org/square', auth: 'oauth2', endpoint: 'https://api.square.com/v2', docs: 'https://developer.squareup.com' },
    
    // Communication - with official logos
    { name: 'email', label: 'Email/SMTP', category: 'communication', icon: 'https://cdn.simpleicons.org/gmail', auth: 'smtp', endpoint: 'smtp://configured-via-env', docs: 'https://nodemailer.com/smtp' },
    { name: 'telegram', label: 'Telegram', category: 'communication', icon: 'https://cdn.simpleicons.org/telegramcc', auth: 'token', endpoint: 'https://api.telegram.org/bot', docs: 'https://core.telegram.org/bots/api' },
    { name: 'signal', label: 'Signal', category: 'communication', icon: 'https://cdn.simpleicons.org/signal', auth: 'webhook', endpoint: 'https://signal.org', docs: 'https://signal.org/docs' },
    { name: 'matrix', label: 'Matrix', category: 'communication', icon: 'https://cdn.simpleicons.org/matrix', auth: 'token', endpoint: 'https://matrix.org/_matrix', docs: 'https://spec.matrix.org/latest' },
    { name: 'mattermost', label: 'Mattermost', category: 'communication', icon: 'https://cdn.simpleicons.org/mattermost', auth: 'oauth2', endpoint: 'https://mattermost.example.com/api/v4', docs: 'https://developers.mattermost.com' },
    
    // Cloud - with official logos
    { name: 'aws', label: 'Amazon AWS', category: 'cloud', icon: 'https://cdn.simpleicons.org/amazonaws', auth: 'key', endpoint: 'https://aws.amazon.com', docs: 'https://docs.aws.amazon.com' },
    { name: 'azure', label: 'Microsoft Azure', category: 'cloud', icon: 'https://cdn.simpleicons.org/microsoftazure', auth: 'oauth2', endpoint: 'https://management.azure.com', docs: 'https://docs.microsoft.com/en-us/azure' },
    { name: 'gcp', label: 'Google Cloud', category: 'cloud', icon: 'https://cdn.simpleicons.org/googlecloud', auth: 'key', endpoint: 'https://www.googleapis.com', docs: 'https://cloud.google.com/docs' },
    { name: 'digitalocean', label: 'DigitalOcean', category: 'cloud', icon: 'https://cdn.simpleicons.org/digitalocean', auth: 'token', endpoint: 'https://api.digitalocean.com/v2', docs: 'https://docs.digitalocean.com/reference/api' },
    
    // Analytics - with official logos
    { name: 'mixpanel', label: 'Mixpanel', category: 'analytics', icon: 'https://cdn.simpleicons.org/mixpanel', auth: 'token', endpoint: 'https://api.mixpanel.com', docs: 'https://developer.mixpanel.com' },
    { name: 'segment', label: 'Segment', category: 'analytics', icon: 'https://cdn.simpleicons.org/segment', auth: 'token', endpoint: 'https://api.segment.com', docs: 'https://segment.com/docs/api' },
    { name: 'googleanalytics', label: 'Google Analytics', category: 'analytics', icon: 'https://cdn.simpleicons.org/googleanalytics', auth: 'oauth2', endpoint: 'https://www.googleapis.com/analytics/v3', docs: 'https://developers.google.com/analytics' },
  ];

  const getCategoryId = db.prepare('SELECT id FROM service_categories WHERE name = ?');
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO services (name, label, category_id, icon, auth_type, api_endpoint, documentation_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);

  for (const srv of services) {
    const cat = getCategoryId.get(srv.category);
    if (!cat) continue;
    insertStmt.run(srv.name, srv.label, cat.id, srv.icon, srv.auth, srv.endpoint, srv.docs, now);
  }

  // Keep outbound Email connector metadata aligned (non-OAuth configuration model).
  db.prepare(`
    UPDATE services
    SET auth_type = 'smtp',
        api_endpoint = 'smtp://configured-via-env',
        documentation_url = 'https://nodemailer.com/smtp'
    WHERE name = 'email'
  `).run();

  // Seed fal API methods (idempotent)
  const falService = db.prepare(`SELECT id FROM services WHERE name = 'fal'`).get();
  if (falService?.id) {
    const insertMethod = db.prepare(`
      INSERT INTO service_api_methods
        (service_id, method_name, http_method, endpoint, description, parameters, response_example, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `);
    const nowMethods = new Date().toISOString();
    insertMethod.run(
      falService.id,
      'list_models',
      'GET',
      '/models',
      'List available fal models.',
      JSON.stringify([]),
      JSON.stringify({ models: [{ id: 'fal-ai/fast-sdxl' }] }),
      nowMethods,
    );
    insertMethod.run(
      falService.id,
      'generate_image',
      'POST',
      'https://queue.fal.run/fal-ai/fast-sdxl',
      'Generate image from a text prompt using fal queue endpoint.',
      JSON.stringify([{ name: 'prompt', type: 'string', required: true, description: 'Image generation prompt' }]),
      JSON.stringify({ request_id: 'req_123', status_url: 'https://queue.fal.run/requests/req_123' }),
      nowMethods,
    );
    insertMethod.run(
      falService.id,
      'generate_video',
      'POST',
      'unsupported://generate_video',
      'Video generation is not available in MVP yet. See docs for phase-2 MCP path.',
      JSON.stringify([{ name: 'prompt', type: 'string', required: true }]),
      JSON.stringify({ error: 'generate_video is not supported in current MyApi fal MVP integration' }),
      nowMethods,
    );

    // Keep definitions current even if rows were seeded in earlier versions.
    db.prepare(`UPDATE service_api_methods SET endpoint = ? WHERE service_id = ? AND method_name = 'generate_image'`)
      .run('https://queue.fal.run/fal-ai/fast-sdxl', falService.id);
    db.prepare(`UPDATE service_api_methods SET endpoint = ? WHERE service_id = ? AND method_name = 'generate_video'`)
      .run('unsupported://generate_video', falService.id);
  }
}

function getServiceCategories() {
  return db.prepare('SELECT * FROM service_categories ORDER BY name').all();
}

function getServices() {
  return db.prepare(`
    SELECT s.*, sc.name as category_name, sc.label as category_label
    FROM services s
    JOIN service_categories sc ON s.category_id = sc.id
    WHERE s.active = 1
    ORDER BY sc.name, s.label
  `).all();
}

function getServicesByCategory(categoryName) {
  return db.prepare(`
    SELECT s.*, sc.name as category_name, sc.label as category_label
    FROM services s
    JOIN service_categories sc ON s.category_id = sc.id
    WHERE sc.name = ? AND s.active = 1
    ORDER BY s.label
  `).all(categoryName);
}

function getServiceByName(name) {
  return db.prepare(`
    SELECT s.*, sc.name as category_name, sc.label as category_label
    FROM services s
    JOIN service_categories sc ON s.category_id = sc.id
    WHERE s.name = ?
  `).get(name);
}

function getServiceMethods(serviceId) {
  return db.prepare(`
    SELECT * FROM service_api_methods
    WHERE service_id = ?
    ORDER BY method_name
  `).all(serviceId);
}

function addServiceMethod(serviceId, methodName, httpMethod, endpoint, description, params, responseExample) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO service_api_methods (service_id, method_name, http_method, endpoint, description, parameters, response_example, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(serviceId, methodName, httpMethod, endpoint, description, params ? JSON.stringify(params) : null, responseExample, now);
}

// ===== Device Approval System =====

function createApprovedDevice(tokenId, userId, fingerprintHash, deviceName, deviceInfo, ipAddress) {
  const id = 'device_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();

  const deviceFingerprintRaw = JSON.stringify({
    hash: fingerprintHash,
    deviceInfo: deviceInfo,
    ipAddress: ipAddress,
    timestamp: now
  });

  const result = db.prepare(`
    INSERT OR IGNORE INTO approved_devices (
      id, token_id, user_id, device_fingerprint, device_fingerprint_hash, device_name, device_info_json, ip_address, approved_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tokenId, userId, deviceFingerprintRaw, fingerprintHash, deviceName, JSON.stringify(deviceInfo), ipAddress, now, now);

  if (result.changes === 0) {
    // Already exists for this (token, device) pair — return that row's id.
    // Scope by token_id so we don't silently return a row belonging to a
    // different token (prevents master→guest approval leakage).
    const existing = db.prepare(
      'SELECT id FROM approved_devices WHERE user_id = ? AND device_fingerprint_hash = ? AND token_id = ?'
    ).get(userId, fingerprintHash, tokenId);
    return existing?.id || id;
  }
  return id;
}

function getApprovedDevices(userId, tokenId = null) {
  let query = 'SELECT * FROM approved_devices WHERE user_id = ? AND revoked_at IS NULL';
  const params = [userId];
  
  if (tokenId) {
    query += ' AND token_id = ?';
    params.push(tokenId);
  }
  
  query += ' ORDER BY last_used_at DESC NULLS LAST';
  return db.prepare(query).all(...params);
}

function getApprovedDeviceByHash(userId, fingerprintHash) {
  return db.prepare(`
    SELECT * FROM approved_devices
    WHERE user_id = ? AND device_fingerprint_hash = ? AND revoked_at IS NULL
  `).get(userId, fingerprintHash);
}

// Token-scoped lookup: an approval for one token must NOT authorize a different
// token on the same device. Use this when enforcing requires_approval on
// guest tokens so master-token approvals can't leak across.
function getApprovedDeviceByHashAndToken(userId, fingerprintHash, tokenId) {
  return db.prepare(`
    SELECT * FROM approved_devices
    WHERE user_id = ? AND device_fingerprint_hash = ? AND token_id = ? AND revoked_at IS NULL
  `).get(userId, fingerprintHash, tokenId);
}

function updateDeviceLastUsed(deviceId) {
  const now = new Date().toISOString();
  return db.prepare(`
    UPDATE approved_devices 
    SET last_used_at = ? 
    WHERE id = ?
  `).run(now, deviceId);
}

function revokeDevice(deviceId) {
  const now = new Date().toISOString();
  return db.prepare(`
    UPDATE approved_devices 
    SET revoked_at = ? 
    WHERE id = ?
  `).run(now, deviceId);
}

function renameDevice(deviceId, newName) {
  return db.prepare(`
    UPDATE approved_devices 
    SET device_name = ? 
    WHERE id = ?
  `).run(newName, deviceId);
}

function createPendingApproval(tokenId, userId, fingerprintHash, deviceInfo, ipAddress) {
  const id = 'approval_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h expiry
  
  // Create a serialized version of the fingerprint data as the raw fingerprint
  const deviceFingerprintRaw = JSON.stringify({
    hash: fingerprintHash,
    deviceInfo: deviceInfo,
    ipAddress: ipAddress,
    timestamp: now
  });
  
  const stmt = db.prepare(`
    INSERT INTO device_approvals_pending (
      id, device_fingerprint, device_fingerprint_hash, token_id, user_id, device_info_json, ip_address, status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, deviceFingerprintRaw, fingerprintHash, tokenId, userId, JSON.stringify(deviceInfo), ipAddress, 'pending', now, expiresAt);
  return id;
}

function getPendingApprovals(userId, tokenId = null, limit = null) {
  let query = `
    SELECT * FROM device_approvals_pending 
    WHERE user_id = ? AND status = 'pending' AND expires_at > ?
  `;
  const params = [userId, new Date().toISOString()];
  
  if (tokenId) {
    query += ' AND token_id = ?';
    params.push(tokenId);
  }
  
  query += ' ORDER BY created_at DESC';
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }
  return db.prepare(query).all(...params);
}

function getPendingApprovalById(approvalId) {
  return db.prepare(`
    SELECT * FROM device_approvals_pending WHERE id = ?
  `).get(approvalId);
}

function approvePendingDevice(approvalId, deviceName) {
  const approval = getPendingApprovalById(approvalId);
  if (!approval) return null;

  const now = new Date().toISOString();
  const resolvedName = deviceName || 'Approved Device';

  // Check for an existing device row for THIS token (including revoked ones).
  // Must be token-scoped so re-approval updates the right row and doesn't
  // accidentally reuse a row belonging to a different token.
  const anyExisting = db.prepare(
    'SELECT id, revoked_at FROM approved_devices WHERE user_id = ? AND device_fingerprint_hash = ? AND token_id = ?'
  ).get(approval.user_id, approval.device_fingerprint_hash, approval.token_id);

  let deviceInfo;
  try { deviceInfo = JSON.parse(approval.device_info_json || '{}'); } catch { deviceInfo = {}; }
  const isASC = deviceInfo.type === 'asc';

  let deviceId;
  if (anyExisting) {
    // Re-approve: clear revoked_at and update name/approved_at
    db.prepare(`
      UPDATE approved_devices SET revoked_at = NULL, device_name = ?, approved_at = ? WHERE id = ?
    `).run(resolvedName, now, anyExisting.id);
    deviceId = anyExisting.id;
  } else if (isASC) {
    deviceId = createApprovedDeviceASC(
      approval.token_id,
      approval.user_id,
      approval.device_fingerprint_hash,
      deviceInfo.public_key || '',
      resolvedName,
      deviceInfo,
      approval.ip_address
    );
  } else {
    deviceId = createApprovedDevice(
      approval.token_id,
      approval.user_id,
      approval.device_fingerprint_hash,
      resolvedName,
      deviceInfo,
      approval.ip_address
    );
  }

  // Mark approval as approved
  db.prepare(`
    UPDATE device_approvals_pending
    SET status = 'approved', approved_at = ?
    WHERE id = ?
  `).run(now, approvalId);

  return deviceId;
}

function denyPendingApproval(approvalId, reason = null) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE device_approvals_pending
    SET status = 'denied', denied_at = ?, denial_reason = ?
    WHERE id = ?
  `).run(now, reason, approvalId);
  return result.changes > 0;
}

// ─── OAuth Device Flow (RFC 8628) ────────────────────────────────────────────

function createDeviceCode({ id, deviceCode, userCode, clientId, scope, expiresAt }) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO oauth_device_codes (id, device_code, user_code, client_id, scope, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, deviceCode, userCode, clientId, scope || null, expiresAt, now);
  return id;
}

function getDeviceCodeByDeviceCode(deviceCode) {
  return db.prepare('SELECT * FROM oauth_device_codes WHERE device_code = ?').get(deviceCode);
}

function getDeviceCodeByUserCode(userCode) {
  return db.prepare('SELECT * FROM oauth_device_codes WHERE UPPER(user_code) = UPPER(?)').get(userCode);
}

function getPendingDeviceCodes(userId) {
  return db.prepare(
    "SELECT * FROM oauth_device_codes WHERE user_id = ? AND status = 'pending' AND expires_at > ? ORDER BY created_at DESC"
  ).all(String(userId), new Date().toISOString());
}

function approveDeviceCode(id, userId, accessTokenId) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE oauth_device_codes SET status = 'approved', user_id = ?, access_token_id = ?, approved_at = ?
    WHERE id = ? AND status = 'pending' AND expires_at > ?
  `).run(userId, accessTokenId, now, id, now);
  return result.changes > 0;
}

function denyDeviceCode(id) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE oauth_device_codes SET status = 'denied', denied_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(now, id);
  return result.changes > 0;
}

function expireOldDeviceCodes() {
  const now = new Date().toISOString();
  db.prepare("UPDATE oauth_device_codes SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?").run(now);
}

// ─── ASC: approved device with public key ────────────────────────────────────

function createApprovedDeviceASC(tokenId, userId, keyFingerprint, publicKey, deviceName, summary, ipAddress) {
  const id = `device_${crypto.randomBytes(16).toString('hex')}`;
  const now = new Date().toISOString();
  // Use key_fingerprint as the device_fingerprint_hash so existing lookup paths work
  db.prepare(`
    INSERT INTO approved_devices
      (id, token_id, user_id, device_fingerprint, device_fingerprint_hash, device_name,
       device_info_json, ip_address, approved_at, created_at, connection_type, public_key, key_fingerprint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'asc', ?, ?)
  `).run(
    id, tokenId, userId,
    keyFingerprint, keyFingerprint,
    deviceName || 'ASC Agent',
    JSON.stringify(summary || {}),
    ipAddress || 'unknown',
    now, now,
    publicKey, keyFingerprint
  );
  return id;
}

function getApprovedDeviceByKeyFingerprint(userId, keyFingerprint) {
  return db.prepare(
    'SELECT * FROM approved_devices WHERE user_id = ? AND key_fingerprint = ?'
  ).get(userId, keyFingerprint);
}

function cleanupExpiredApprovals() {
  // Delete approvals that expired more than 7 days ago
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(`
    DELETE FROM device_approvals_pending 
    WHERE expires_at < ? AND status IN ('denied', 'approved')
  `).run(cutoffDate);
}

function getDeviceApprovalHistory(userId, tokenId = null, limit = 100) {
  let query = `
    SELECT 
      'approved' as type,
      approved_at as event_date,
      device_name,
      ip_address,
      'approval' as action,
      device_fingerprint_hash,
      id
    FROM approved_devices
    WHERE user_id = ?
  `;
  const params = [userId];
  
  if (tokenId) {
    query += ' AND token_id = ?';
    params.push(tokenId);
  }
  
  query += `
    UNION ALL
    SELECT 
      'revoked' as type,
      revoked_at as event_date,
      device_name,
      ip_address,
      'revocation' as action,
      device_fingerprint_hash,
      id
    FROM approved_devices
    WHERE user_id = ? AND revoked_at IS NOT NULL
  `;
  params.push(userId);
  
  if (tokenId) {
    query += ' AND token_id = ?';
    params.push(tokenId);
  }
  
  query += `
    UNION ALL
    SELECT
      status as type,
      created_at as event_date,
      'Device Request' as device_name,
      ip_address,
      status as action,
      device_fingerprint_hash,
      id
    FROM device_approvals_pending
    WHERE user_id = ? AND status IN ('approved', 'denied')
  `;
  params.push(userId);
  
  if (tokenId) {
    query += ' AND token_id = ?';
    params.push(tokenId);
  }
  
  query += ' ORDER BY event_date DESC LIMIT ?';
  params.push(limit);
  
  return db.prepare(query).all(...params);
}

// --- SERVICE PREFERENCES (Phase 3) ---

function createServicePreference(userId, serviceName, preferences) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const preferencesJson = typeof preferences === 'string' ? preferences : JSON.stringify(preferences);
  
  try {
    db.prepare(`
      INSERT INTO service_preferences (id, user_id, service_name, preferences_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, serviceName, preferencesJson, now, now);
    
    return {
      id,
      user_id: userId,
      service_name: serviceName,
      preferences: JSON.parse(preferencesJson),
      created_at: now,
      updated_at: now
    };
  } catch (err) {
    // If record already exists, update it instead
    if (err.message.includes('UNIQUE constraint failed')) {
      return updateServicePreference(userId, serviceName, preferences);
    }
    throw err;
  }
}

function getServicePreference(userId, serviceName) {
  const row = db.prepare(`
    SELECT * FROM service_preferences
    WHERE user_id = ? AND service_name = ?
  `).get(userId, serviceName);
  
  if (!row) return null;
  
  return {
    id: row.id,
    user_id: row.user_id,
    service_name: row.service_name,
    preferences: JSON.parse(row.preferences_json),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function getServicePreferences(userId) {
  const rows = db.prepare(`
    SELECT * FROM service_preferences
    WHERE user_id = ?
    ORDER BY service_name ASC
  `).all(userId);
  
  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    service_name: row.service_name,
    preferences: JSON.parse(row.preferences_json),
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

function updateServicePreference(userId, serviceName, preferences) {
  const now = new Date().toISOString();
  const preferencesJson = typeof preferences === 'string' ? preferences : JSON.stringify(preferences);
  
  const stmt = db.prepare(`
    UPDATE service_preferences
    SET preferences_json = ?, updated_at = ?
    WHERE user_id = ? AND service_name = ?
  `);
  
  const result = stmt.run(preferencesJson, now, userId, serviceName);
  
  if (result.changes === 0) {
    // Record doesn't exist, create it
    return createServicePreference(userId, serviceName, preferences);
  }
  
  return getServicePreference(userId, serviceName);
}

function deleteServicePreference(userId, serviceName) {
  const stmt = db.prepare(`
    DELETE FROM service_preferences
    WHERE user_id = ? AND service_name = ?
  `);
  
  return stmt.run(userId, serviceName).changes > 0;
}

// Notification functions
// Phase 3.5: Notifications System - Workspace-scoped notifications
function createNotification(workspaceId, userId, type, title, message, data = null) {
  const id = 'notif_' + crypto.randomBytes(16).toString('hex');
  const now = Math.floor(Date.now() / 1000); // Unix timestamp
  const expiresAt = now + (60 * 24 * 60 * 60); // 60 days
  
  const stmt = db.prepare(`
    INSERT INTO notifications (id, workspace_id, user_id, type, title, message, data, is_read, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `);
  
  stmt.run(
    id,
    workspaceId,
    userId,
    type,
    title,
    message,
    data ? JSON.stringify(data) : null,
    now,
    expiresAt
  );
  
  return id;
}

function getNotifications(workspaceId, userId, filters = {}) {
  let query = `
    SELECT id, workspace_id, user_id, type, title, message, data, is_read, created_at, expires_at
    FROM notifications
    WHERE workspace_id = ? AND user_id = ?
  `;
  const params = [workspaceId, userId];
  
  // Filter by read status
  if (filters.read !== undefined) {
    query += ` AND is_read = ?`;
    params.push(filters.read ? 1 : 0);
  }
  
  // Filter by type
  if (filters.type) {
    query += ` AND type = ?`;
    params.push(filters.type);
  }
  
  // Date range filters
  if (filters.dateFrom) {
    query += ` AND created_at >= ?`;
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    query += ` AND created_at <= ?`;
    params.push(filters.dateTo);
  }
  
  // Order and pagination
  query += ` ORDER BY created_at DESC`;
  
  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);
  }
  
  if (filters.offset) {
    query += ` OFFSET ?`;
    params.push(filters.offset);
  }
  
  return db.prepare(query).all(...params);
}

function markNotificationAsRead(notificationId, workspaceId, userId) {
  const stmt = db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE id = ? AND user_id = ?
  `);

  return stmt.run(notificationId, userId).changes > 0;
}

function deleteNotification(notificationId, workspaceId, userId) {
  // Delete child rows in notification_queue first to avoid FK constraint failure
  db.prepare(`DELETE FROM notification_queue WHERE notification_id = ?`).run(notificationId);
  // Match only on id + user_id; workspace_id is omitted because notifications may be
  // created under a different workspace than what the request resolves to, causing
  // false 404s. user_id is the authoritative ownership check.
  return db.prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`)
    .run(notificationId, userId).changes > 0;
}

function getUnreadNotificationCount(workspaceId, userId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE workspace_id = ? AND user_id = ? AND is_read = 0
  `).get(workspaceId, userId);
  
  return result?.count || 0;
}

function getOrCreateNotificationSettings(workspaceId, userId) {
  // Get or ensure the user has a valid workspace
  let actualWorkspaceId = workspaceId;
  
  // Verify the workspace actually exists; if not, get/create user's workspace
  if (actualWorkspaceId) {
    const wsExists = db.prepare('SELECT id FROM workspaces WHERE id = ?').get(actualWorkspaceId);
    if (!wsExists) {
      actualWorkspaceId = null;
    }
  }
  
  if (!actualWorkspaceId) {
    actualWorkspaceId = getOrEnsureUserWorkspace(userId);
  }
  
  if (!actualWorkspaceId) {
    // Fallback to default if workspace creation failed
    console.warn('[DB] Could not get or create workspace for user:', userId);
    return { inApp: null, email: null };
  }
  
  // Get or create user's preferences for in-app and email channels
  let inAppPrefs = db.prepare(`
    SELECT * FROM notification_preferences
    WHERE workspace_id = ? AND user_id = ? AND channel = 'in-app'
  `).get(actualWorkspaceId, userId);
  
  if (!inAppPrefs) {
    const id = 'notif_pref_' + crypto.randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    try {
      db.prepare(`
        INSERT INTO notification_preferences (id, workspace_id, user_id, channel, enabled, frequency, created_at, updated_at)
        VALUES (?, ?, ?, 'in-app', 1, 'immediate', ?, ?)
      `).run(id, actualWorkspaceId, userId, now, now);
      inAppPrefs = db.prepare(`
        SELECT * FROM notification_preferences
        WHERE workspace_id = ? AND user_id = ? AND channel = 'in-app'
      `).get(actualWorkspaceId, userId);
    } catch (err) {
      console.error('[DB] Failed to create in-app notification preference:', err.message);
    }
  }
  
  let emailPrefs = db.prepare(`
    SELECT * FROM notification_preferences
    WHERE workspace_id = ? AND user_id = ? AND channel = 'email'
  `).get(actualWorkspaceId, userId);
  
  if (!emailPrefs) {
    const id = 'notif_pref_' + crypto.randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    try {
      db.prepare(`
        INSERT INTO notification_preferences (id, workspace_id, user_id, channel, enabled, frequency, created_at, updated_at)
        VALUES (?, ?, ?, 'email', 0, 'immediate', ?, ?)
      `).run(id, actualWorkspaceId, userId, now, now);
      emailPrefs = db.prepare(`
        SELECT * FROM notification_preferences
        WHERE workspace_id = ? AND user_id = ? AND channel = 'email'
      `).get(actualWorkspaceId, userId);
    } catch (err) {
      console.error('[DB] Failed to create email notification preference:', err.message);
    }
  }
  
  return { inApp: inAppPrefs, email: emailPrefs };
}

function updateNotificationPreferences(workspaceId, userId, channel, updates) {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    UPDATE notification_preferences
    SET enabled = ?, frequency = ?, updated_at = ?
    WHERE workspace_id = ? AND user_id = ? AND channel = ?
  `);
  
  stmt.run(
    updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : 1,
    updates.frequency || 'immediate',
    now,
    workspaceId,
    userId,
    channel
  );
  
  return db.prepare(`
    SELECT * FROM notification_preferences
    WHERE workspace_id = ? AND user_id = ? AND channel = ?
  `).get(workspaceId, userId, channel);
}

function deleteAllNotifications(workspaceId, userId) {
  // Remove queue entries first (FK constraint)
  const notifIds = db.prepare(`SELECT id FROM notifications WHERE workspace_id = ? AND user_id = ?`).all(workspaceId, userId).map(r => r.id);
  for (const nid of notifIds) {
    db.prepare(`DELETE FROM notification_queue WHERE notification_id = ?`).run(nid);
  }
  return db.prepare(`DELETE FROM notifications WHERE workspace_id = ? AND user_id = ?`).run(workspaceId, userId).changes;
}

function updateNotificationTypeSettings(workspaceId, userId, channel, typeKey, enabled) {
  const row = db.prepare(`SELECT type_settings FROM notification_preferences WHERE workspace_id = ? AND user_id = ? AND channel = ?`).get(workspaceId, userId, channel);
  if (!row) return;
  let ts = {};
  try { ts = JSON.parse(row.type_settings || '{}'); } catch (_) {}
  ts[typeKey] = enabled ? 1 : 0;
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE notification_preferences SET type_settings = ?, updated_at = ? WHERE workspace_id = ? AND user_id = ? AND channel = ?`).run(JSON.stringify(ts), now, workspaceId, userId, channel);
}

function queueNotificationForDelivery(notificationId, channels = ['in-app']) {
  const deliveryChannels = Array.isArray(channels) ? channels : [channels];
  const queued = [];
  
  for (const channel of deliveryChannels) {
    const id = 'queue_' + crypto.randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = db.prepare(`
      INSERT INTO notification_queue (id, notification_id, channel, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `);
    
    stmt.run(id, notificationId, channel, now);
    queued.push(id);
  }
  
  return queued;
}

function createActivityLog(userId, actionType, resourceType, options = {}) {
  const stmt = db.prepare(`
    INSERT INTO activity_log (user_id, action_type, resource_type, resource_id, resource_name, actor_type, actor_id, actor_name, details, result, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    userId,
    actionType,
    resourceType,
    options.resourceId || null,
    options.resourceName || null,
    options.actorType || 'user',
    options.actorId || null,
    options.actorName || null,
    options.details ? JSON.stringify(options.details) : null,
    options.result || 'success',
    options.ipAddress || null,
    options.userAgent || null,
    new Date().toISOString()
  );
}

function getActivityLog(userId, filters = {}) {
  let query = `
    SELECT * FROM activity_log
    WHERE user_id = ?
  `;
  const params = [userId];
  
  if (filters.actionType) {
    query += ` AND action_type = ?`;
    params.push(filters.actionType);
  }
  if (filters.resourceType) {
    query += ` AND resource_type = ?`;
    params.push(filters.resourceType);
  }
  if (filters.result) {
    query += ` AND result = ?`;
    params.push(filters.result);
  }
  if (filters.afterDate) {
    query += ` AND created_at > ?`;
    params.push(filters.afterDate);
  }
  if (filters.beforeDate) {
    query += ` AND created_at < ?`;
    params.push(filters.beforeDate);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(filters.limit || 50);
  params.push(filters.offset || 0);
  
  return db.prepare(query).all(...params);
}

function queueEmail(userId, emailAddress, subject, body, options = {}) {
  const id = 'email_' + crypto.randomBytes(16).toString('hex');
  const stmt = db.prepare(`
    INSERT INTO email_queue (id, user_id, email_address, notification_id, subject, body, html_body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    userId,
    emailAddress,
    options.notificationId || null,
    subject,
    body,
    options.htmlBody || null,
    new Date().toISOString()
  );
  
  return id;
}

function getPendingEmails(limit = 100) {
  return db.prepare(`
    SELECT * FROM email_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit);
}

function markEmailAsSent(emailId) {
  return db.prepare(`
    UPDATE email_queue
    SET status = 'sent', sent_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), emailId).changes > 0;
}

function markEmailAsFailed(emailId, reason) {
  return db.prepare(`
    UPDATE email_queue
    SET status = 'failed', failed_reason = ?
    WHERE id = ?
  `).run(reason, emailId).changes > 0;
}

function getEmailQueueStats() {
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM email_queue
    GROUP BY status
  `).all();

  const stats = { pending: 0, sent: 0, failed: 0, total: 0 };
  for (const row of rows) {
    const status = String(row.status || '').toLowerCase();
    const count = Number(row.count || 0);
    if (Object.prototype.hasOwnProperty.call(stats, status)) {
      stats[status] = count;
    }
    stats.total += count;
  }

  const lastFailure = db.prepare(`
    SELECT id, email_address as emailAddress, subject, failed_reason as failedReason, created_at as createdAt
    FROM email_queue
    WHERE status = 'failed'
    ORDER BY created_at DESC
    LIMIT 1
  `).get();

  return { ...stats, lastFailure: lastFailure || null };
}

function getRecentEmailJobs(limit = 20, status = null) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  if (status && ['pending', 'sent', 'failed'].includes(String(status).toLowerCase())) {
    return db.prepare(`
      SELECT id, user_id as userId, email_address as emailAddress, subject, status, sent_at as sentAt,
             failed_reason as failedReason, created_at as createdAt
      FROM email_queue
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(String(status).toLowerCase(), safeLimit);
  }

  return db.prepare(`
    SELECT id, user_id as userId, email_address as emailAddress, subject, status, sent_at as sentAt,
           failed_reason as failedReason, created_at as createdAt
    FROM email_queue
    ORDER BY created_at DESC
    LIMIT ?
  `).all(safeLimit);
}

// ========== PHASE 1: WORKSPACES & TEAMS ==========

function createWorkspace(name, ownerId, slug = null) {
  const id = 'ws_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  
  const stmt = db.prepare(`
    INSERT INTO workspaces (id, name, owner_id, slug, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, name, ownerId, finalSlug, now, now);
  
  // Add owner as member with owner role
  addWorkspaceMember(id, ownerId, 'owner');
  
  return {
    id,
    name,
    ownerId,
    slug: finalSlug,
    createdAt: now,
    updatedAt: now
  };
}

function getWorkspaces(userId = null, workspaceId = null) {
  if (workspaceId) {
    const stmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
    const workspace = stmt.get(workspaceId);
    return workspace ? {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
      slug: workspace.slug,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at
    } : null;
  }
  
  if (userId) {
    const stmt = db.prepare(`
      SELECT DISTINCT w.*
      FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE w.owner_id = ? OR wm.user_id = ?
      ORDER BY w.created_at DESC
    `);
    return stmt.all(userId, userId).map(w => ({
      id: w.id,
      name: w.name,
      ownerId: w.owner_id,
      slug: w.slug,
      createdAt: w.created_at,
      updatedAt: w.updated_at
    }));
  }
  
  const stmt = db.prepare('SELECT * FROM workspaces ORDER BY created_at DESC');
  return stmt.all().map(w => ({
    id: w.id,
    name: w.name,
    ownerId: w.owner_id,
    slug: w.slug,
    createdAt: w.created_at,
    updatedAt: w.updated_at
  }));
}

function updateWorkspace(workspaceId, updates) {
  const now = new Date().toISOString();
  const allowed = ['name', 'slug'];
  const setClauses = [];
  const params = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      setClauses.push(`${key} = ?`);
      params.push(value);
    }
  }
  
  if (setClauses.length === 0) return false;
  
  params.push(now);
  params.push(workspaceId);
  
  const stmt = db.prepare(`
    UPDATE workspaces
    SET ${setClauses.join(', ')}, updated_at = ?
    WHERE id = ?
  `);
  
  return stmt.run(...params).changes > 0;
}

function deleteWorkspace(workspaceId) {
  const stmt = db.prepare('DELETE FROM workspaces WHERE id = ?');
  return stmt.run(workspaceId).changes > 0;
}

// Ensure a default workspace exists (for systems without multi-workspace support)
function ensureDefaultWorkspaceExists() {
  const existing = db.prepare('SELECT id FROM workspaces WHERE id = ?').get('default');
  if (existing) {
    return 'default';
  }
  
  // Try to create a default workspace with a system user
  // First, try to find or create a system user
  let systemUser = db.prepare('SELECT id FROM users WHERE id = ?').get('system');
  if (!systemUser) {
    // If no system user exists, use the first user in the database
    systemUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
    if (!systemUser) {
      // No users exist, we can't create a workspace
      return null;
    }
  }
  
  // Create a default workspace
  const now = new Date().toISOString();
  try {
    const stmt = db.prepare(`
      INSERT INTO workspaces (id, name, owner_id, slug, created_at, updated_at)
      VALUES ('default', 'Default Workspace', ?, 'default', ?, ?)
    `);
    
    stmt.run(systemUser.id || systemUser, now, now);
    return 'default';
  } catch (err) {
    console.warn('[DB] Failed to create default workspace:', err.message);
    return null;
  }
}

// Get or ensure a workspace for a user (creates one if needed)
function getOrEnsureUserWorkspace(userId) {
  // Check if user has any workspace
  try {
    const existing = db.prepare(`
      SELECT DISTINCT w.id FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE w.owner_id = ? OR wm.user_id = ?
      LIMIT 1
    `).get(userId, userId);
    
    if (existing) {
      return existing.id;
    }
  } catch (err) {
    console.error('[DB] Error checking for existing workspace:', err.message);
  }
  
  // Create a default workspace for the user
  try {
    const id = 'ws_' + crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO workspaces (id, name, owner_id, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, 'My Workspace', userId, userId.slice(0, 8), now, now);
    
    // Add user as owner
    const memberId = 'wm_' + crypto.randomBytes(16).toString('hex');
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'owner', ?)
      ON CONFLICT DO NOTHING
    `).run(memberId, id, userId, now);
    
    return id;
  } catch (err) {
    console.warn('[DB] Failed to create user workspace:', err.message);
    return null;
  }
}

function addWorkspaceMember(workspaceId, userId, role = 'member') {
  const id = 'wm_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);
  
  stmt.run(id, workspaceId, userId, role, now);
  return id;
}

function getWorkspaceMembers(workspaceId) {
  const stmt = db.prepare(`
    SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, wm.joined_at, u.username, u.email, u.display_name
    FROM workspace_members wm
    LEFT JOIN users u ON wm.user_id = u.id
    WHERE wm.workspace_id = ?
    ORDER BY wm.joined_at ASC
  `);
  
  return stmt.all(workspaceId).map(m => ({
    id: m.id,
    workspaceId: m.workspace_id,
    userId: m.user_id,
    role: m.role,
    joinedAt: m.joined_at,
    username: m.username,
    email: m.email,
    displayName: m.display_name
  }));
}

function updateWorkspaceMemberRole(workspaceMemberId, newRole) {
  const stmt = db.prepare('UPDATE workspace_members SET role = ? WHERE id = ?');
  return stmt.run(newRole, workspaceMemberId).changes > 0;
}

function removeWorkspaceMember(workspaceMemberId) {
  const stmt = db.prepare('DELETE FROM workspace_members WHERE id = ?');
  return stmt.run(workspaceMemberId).changes > 0;
}

function removeWorkspaceMemberByUserId(workspaceId, userId) {
  // Delete from workspace_members
  const stmt = db.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?');
  const result = stmt.run(workspaceId, userId).changes > 0;
  
  // Also clean up the invitation record (mark as declined) to avoid UNIQUE constraint issues
  // when re-inviting someone who was revoked
  if (result) {
    try {
      const user = getUserById(userId);
      if (user && user.email) {
        const invStmt = db.prepare('DELETE FROM workspace_invitations WHERE workspace_id = ? AND email = ?');
        invStmt.run(workspaceId, user.email);
      }
    } catch (err) {
      // Silent fail - not critical if invitation cleanup fails
      console.error('Failed to cleanup invitation on member removal:', err.message);
    }
  }
  
  return result;
}

function getWorkspaceMember(workspaceId, userId) {
  const stmt = db.prepare(`
    SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, wm.joined_at
    FROM workspace_members wm
    WHERE wm.workspace_id = ? AND wm.user_id = ?
  `);
  
  const member = stmt.get(workspaceId, userId);
  return member ? {
    id: member.id,
    workspaceId: member.workspace_id,
    userId: member.user_id,
    role: member.role,
    joinedAt: member.joined_at
  } : null;
}

function createWorkspaceInvitation(workspaceId, email, createdByUserId, role = 'member') {
  const id = 'inv_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  
  const stmt = db.prepare(`
    INSERT INTO workspace_invitations (id, workspace_id, email, role, created_by_user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, workspaceId, email, role, createdByUserId, now, expiresAt);
  return {
    id,
    workspaceId,
    email,
    role,
    createdByUserId,
    createdAt: now,
    expiresAt
  };
}

function getWorkspaceInvitations(workspaceId = null) {
  if (workspaceId) {
    const stmt = db.prepare(`
      SELECT * FROM workspace_invitations
      WHERE workspace_id = ? AND (accepted_at IS NULL OR accepted_at = '')
      ORDER BY created_at DESC
    `);
    return stmt.all(workspaceId).map(inv => ({
      id: inv.id,
      workspaceId: inv.workspace_id,
      email: inv.email,
      role: inv.role,
      createdByUserId: inv.created_by_user_id,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
      acceptedAt: inv.accepted_at,
      acceptedByUserId: inv.accepted_by_user_id
    }));
  }
  
  const stmt = db.prepare(`
    SELECT * FROM workspace_invitations
    WHERE accepted_at IS NULL OR accepted_at = ''
    ORDER BY created_at DESC
  `);
  
  return stmt.all().map(inv => ({
    id: inv.id,
    workspaceId: inv.workspace_id,
    email: inv.email,
    role: inv.role,
    createdByUserId: inv.created_by_user_id,
    createdAt: inv.created_at,
    expiresAt: inv.expires_at,
    acceptedAt: inv.accepted_at,
    acceptedByUserId: inv.accepted_by_user_id
  }));
}

function getInvitationById(invitationId) {
  const stmt = db.prepare('SELECT * FROM workspace_invitations WHERE id = ?');
  const inv = stmt.get(invitationId);
  return inv ? {
    id: inv.id,
    workspaceId: inv.workspace_id,
    email: inv.email,
    role: inv.role,
    createdByUserId: inv.created_by_user_id,
    createdAt: inv.created_at,
    expiresAt: inv.expires_at,
    acceptedAt: inv.accepted_at,
    acceptedByUserId: inv.accepted_by_user_id
  } : null;
}

function deleteInvitationByEmailAndWorkspace(workspaceId, email) {
  const stmt = db.prepare('DELETE FROM workspace_invitations WHERE workspace_id = ? AND email = ?');
  return stmt.run(workspaceId, email).changes > 0;
}

function getInvitationByEmailAndWorkspace(workspaceId, email) {
  const stmt = db.prepare('SELECT * FROM workspace_invitations WHERE workspace_id = ? AND email = ? LIMIT 1');
  const inv = stmt.get(workspaceId, email);
  return inv ? {
    id: inv.id,
    workspaceId: inv.workspace_id,
    email: inv.email,
    role: inv.role,
    createdByUserId: inv.created_by_user_id,
    createdAt: inv.created_at,
    expiresAt: inv.expires_at,
    acceptedAt: inv.accepted_at,
    acceptedByUserId: inv.accepted_by_user_id
  } : null;
}

function acceptWorkspaceInvitation(invitationId, userId) {
  const invitation = getInvitationById(invitationId);
  if (!invitation) return false;
  
  const now = new Date().toISOString();
  
  // Add user as member with the invitation's role
  addWorkspaceMember(invitation.workspaceId, userId, invitation.role);
  
  // Mark invitation as accepted
  const stmt = db.prepare(`
    UPDATE workspace_invitations
    SET accepted_at = ?, accepted_by_user_id = ?
    WHERE id = ?
  `);
  
  return stmt.run(now, userId, invitationId).changes > 0;
}

function declineWorkspaceInvitation(invitationId) {
  const stmt = db.prepare('DELETE FROM workspace_invitations WHERE id = ?');
  return stmt.run(invitationId).changes > 0;
}

function getUserWorkspaceInvitations(email) {
  const stmt = db.prepare(`
    SELECT wi.*, w.name as workspace_name, w.owner_id
    FROM workspace_invitations wi
    LEFT JOIN workspaces w ON wi.workspace_id = w.id
    WHERE wi.email = ? AND (wi.accepted_at IS NULL OR wi.accepted_at = '')
    ORDER BY wi.created_at DESC
  `);
  
  return stmt.all(email).map(inv => ({
    id: inv.id,
    workspaceId: inv.workspace_id,
    workspaceName: inv.workspace_name,
    email: inv.email,
    role: inv.role,
    createdByUserId: inv.created_by_user_id,
    createdAt: inv.created_at,
    expiresAt: inv.expires_at,
    acceptedAt: inv.accepted_at,
    acceptedByUserId: inv.accepted_by_user_id
  }));
}

function cleanupExpiredInvitations() {
  const stmt = db.prepare(`
    DELETE FROM workspace_invitations
    WHERE expires_at < ? AND (accepted_at IS NULL OR accepted_at = '')
  `);
  return stmt.run(new Date().toISOString()).changes;
}

function getBillingCustomerByWorkspace(workspaceId) {
  return db.prepare('SELECT * FROM billing_customers WHERE workspace_id = ?').get(workspaceId) || null;
}

function upsertBillingCustomer(workspaceId, stripeCustomerId, email = null) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO billing_customers (workspace_id, stripe_customer_id, email, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      email = COALESCE(excluded.email, billing_customers.email)
  `).run(workspaceId, stripeCustomerId, email, now);
  return getBillingCustomerByWorkspace(workspaceId);
}

function getBillingSubscriptionByWorkspace(workspaceId) {
  return db.prepare('SELECT * FROM billing_subscriptions WHERE workspace_id = ?').get(workspaceId) || null;
}

function upsertBillingSubscription(workspaceId, payload = {}) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO billing_subscriptions (
      workspace_id, stripe_subscription_id, plan_id, status,
      period_start, period_end, cancel_at_period_end, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan_id = excluded.plan_id,
      status = excluded.status,
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = excluded.updated_at
  `).run(
    workspaceId,
    payload.stripe_subscription_id,
    payload.plan_id || 'free',
    payload.status || 'inactive',
    payload.period_start || null,
    payload.period_end || null,
    payload.cancel_at_period_end ? 1 : 0,
    now,
    now
  );
  return getBillingSubscriptionByWorkspace(workspaceId);
}

function listInvoicesByWorkspace(workspaceId, limit = 50) {
  return db.prepare(`
    SELECT * FROM invoices
    WHERE workspace_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(workspaceId, Math.max(1, Number(limit) || 50));
}

function upsertInvoice(workspaceId, payload = {}) {
  const now = payload.created_at || new Date().toISOString();
  db.prepare(`
    INSERT INTO invoices (workspace_id, stripe_invoice_id, amount_cents, currency, status, invoice_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(stripe_invoice_id) DO UPDATE SET
      amount_cents = excluded.amount_cents,
      currency = excluded.currency,
      status = excluded.status,
      invoice_url = excluded.invoice_url
  `).run(
    workspaceId,
    payload.stripe_invoice_id,
    Number(payload.amount_cents || 0),
    String(payload.currency || 'usd').toLowerCase(),
    payload.status || 'open',
    payload.invoice_url || null,
    now
  );
}

function incrementUsageDaily(workspaceId, date, delta = {}) {
  const now = new Date().toISOString();
  const safeDate = String(date || now.slice(0, 10));
  db.prepare(`
    INSERT INTO usage_daily (workspace_id, date, api_calls, installs, ratings, active_services, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, date) DO UPDATE SET
      api_calls = usage_daily.api_calls + excluded.api_calls,
      installs = usage_daily.installs + excluded.installs,
      ratings = usage_daily.ratings + excluded.ratings,
      active_services = CASE
        WHEN excluded.active_services > 0 THEN excluded.active_services
        ELSE usage_daily.active_services
      END,
      updated_at = excluded.updated_at
  `).run(
    workspaceId,
    safeDate,
    Number(delta.api_calls || 0),
    Number(delta.installs || 0),
    Number(delta.ratings || 0),
    Number(delta.active_services || 0),
    now,
    now
  );
}

function getUsageDaily(workspaceId, fromDate, toDate) {
  return db.prepare(`
    SELECT workspace_id, date, api_calls, installs, ratings, active_services
    FROM usage_daily
    WHERE workspace_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(workspaceId, fromDate, toDate);
}

function seedDefaultPricingPlans() {
  try {
    // Check if plans already exist
    const now = new Date().toISOString();
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price_cents: 0,
        description: 'Perfect for individuals getting started',
        features: [
          '2 AI Personas',
          '3 Service Connections',
          '10 MB Knowledge Base',
          '5 Token Vault entries',
          'Attach up to 4 Skills per Persona',
          '1,000 API calls/month',
          'Up to 2 team members'
        ],
        monthly_api_call_limit: 1000,
        max_services: 3,
        max_team_members: 2,
        max_skills_per_persona: 4,
        stripe_product_id: null,
        active: 1,
        display_order: 0,
      },
      {
        id: 'pro',
        name: 'Pro',
        price_cents: 2900,
        description: 'For creators and small teams',
        features: [
          '5 AI Personas',
          'Unlimited Service Connections',
          '50 MB Knowledge Base',
          'Unlimited Token Vault entries',
          'Attach unlimited Skills per Persona',
          '100,000 API calls/month',
          'Up to 10 team members',
          'Priority support'
        ],
        monthly_api_call_limit: 100000,
        max_services: -1, // unlimited
        max_team_members: 10,
        max_skills_per_persona: -1, // unlimited
        stripe_product_id: 'prod_pro_myapi',
        active: 1,
        display_order: 1,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price_cents: 9900,
        description: 'Scale with higher limits and custom support',
        features: [
          '20 AI Personas',
          'Unlimited Service Connections',
          '200 MB Knowledge Base',
          'Unlimited Token Vault entries',
          'Attach unlimited Skills per Persona',
          'Unlimited API calls/month',
          'Unlimited team members',
          'Priority 24/7 support',
          'Custom SLA & onboarding',
          'Dedicated infrastructure option'
        ],
        monthly_api_call_limit: -1, // unlimited
        max_services: -1, // unlimited
        max_team_members: -1, // unlimited
        max_skills_per_persona: -1, // unlimited
        stripe_product_id: 'prod_enterprise_myapi',
        active: 1,
        display_order: 2,
      }
    ];

    const existingPlans = db.prepare('SELECT id FROM pricing_plans').all().map((row) => row.id);

    const insertStmt = db.prepare(`
      INSERT INTO pricing_plans (
        id, name, price_cents, description, features,
        monthly_api_call_limit, max_services, max_team_members, max_skills_per_persona,
        stripe_product_id, active, display_order, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE pricing_plans
      SET name = ?,
          price_cents = ?,
          description = ?,
          features = ?,
          monthly_api_call_limit = ?,
          max_services = ?,
          max_team_members = ?,
          max_skills_per_persona = ?,
          stripe_product_id = ?,
          active = ?,
          display_order = ?,
          updated_at = ?
      WHERE id = ?
    `);

    for (const plan of plans) {
      const serializedFeatures = JSON.stringify(plan.features);
      if (existingPlans.includes(plan.id)) {
        updateStmt.run(
          plan.name,
          plan.price_cents,
          plan.description,
          serializedFeatures,
          plan.monthly_api_call_limit,
          plan.max_services,
          plan.max_team_members,
          plan.max_skills_per_persona,
          plan.stripe_product_id,
          plan.active,
          plan.display_order,
          now,
          plan.id
        );
      } else {
        insertStmt.run(
          plan.id,
          plan.name,
          plan.price_cents,
          plan.description,
          serializedFeatures,
          plan.monthly_api_call_limit,
          plan.max_services,
          plan.max_team_members,
          plan.max_skills_per_persona,
          plan.stripe_product_id,
          plan.active,
          plan.display_order,
          now,
          now
        );
      }
    }

    console.log('[Pricing] Synced default pricing plans (Free, Pro, Enterprise)');
  } catch (err) {
    if (!err.message?.includes('already exists')) {
      console.warn('[Pricing] Error seeding default plans:', err.message);
    }
  }
}

/**
 * Run pending database migrations with retry for transient connection failures
 * (e.g. Docker DNS not ready at startup)
 */
async function runMigrations(retries = 20, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const migrationRunner = new MigrationRunner(db);
      await migrationRunner.initMigrationTable();
      const result = await migrationRunner.runPendingMigrations();
      console.log('[Migrations]', result.message);
      if (result.failed && result.failed.length > 0) {
        console.warn('[Migrations] Failed migrations:', result.failed);
      }
      return result;
    } catch (error) {
      const isTransient = ['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', '57P01', 'EPIPE'].includes(error.code)
        || /connection terminated|connection reset|connection refused|econnreset|epipe/i.test(error.message);
      console.error(`[Migrations] Error (attempt ${attempt}/${retries}):`, error.message);
      if (isTransient && attempt < retries) {
        console.log(`[Migrations] Retrying in ${delayMs / 1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw error;
      }
    }
  }
}

// ============================================================================
// SSO & RBAC Database Functions
// ============================================================================

/**
 * Create a new role in a workspace
 */
function createRole(workspaceId, name, description, createdByUserId) {
  const id = 'role_' + crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO roles (id, workspace_id, name, description, created_at, updated_at, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, workspaceId, name, description, now, now, createdByUserId);
    return { id, workspaceId, name, description, created_at: now, updated_at: now };
  } catch (error) {
    console.error('[SSO/RBAC] Error creating role:', error.message);
    throw error;
  }
}

/**
 * Get all roles for a workspace
 */
function getRolesByWorkspace(workspaceId) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM roles WHERE workspace_id = ? ORDER BY name
    `);
    return stmt.all(workspaceId);
  } catch (error) {
    console.error('[SSO/RBAC] Error getting workspace roles:', error.message);
    return [];
  }
}

/**
 * Get a role by ID
 */
function getRoleById(roleId) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM roles WHERE id = ?
    `);
    return stmt.get(roleId);
  } catch (error) {
    console.error('[SSO/RBAC] Error getting role:', error.message);
    return null;
  }
}

/**
 * Update a role
 */
function updateRole(roleId, updates) {
  try {
    const now = new Date().toISOString();
    const allowedFields = ['name', 'description'];
    const fields = [];
    const values = [];
    
    for (const field of allowedFields) {
      if (field in updates) {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    
    if (fields.length === 0) return getRoleById(roleId);
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(roleId);
    
    const stmt = db.prepare(`
      UPDATE roles SET ${fields.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
    return getRoleById(roleId);
  } catch (error) {
    console.error('[SSO/RBAC] Error updating role:', error.message);
    throw error;
  }
}

/**
 * Delete a role
 */
function deleteRole(roleId) {
  try {
    const stmt = db.prepare(`
      DELETE FROM roles WHERE id = ?
    `);
    stmt.run(roleId);
    return true;
  } catch (error) {
    console.error('[SSO/RBAC] Error deleting role:', error.message);
    throw error;
  }
}

/**
 * Create a permission
 */
function createPermission(resource, action, description) {
  const id = 'perm_' + crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO permissions (id, resource, action, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, resource, action, description, now);
    return { id, resource, action, description, created_at: now };
  } catch (error) {
    console.error('[SSO/RBAC] Error creating permission:', error.message);
    throw error;
  }
}

/**
 * Get all permissions
 */
function getAllPermissions() {
  try {
    const stmt = db.prepare(`
      SELECT * FROM permissions ORDER BY resource, action
    `);
    return stmt.all();
  } catch (error) {
    console.error('[SSO/RBAC] Error getting permissions:', error.message);
    return [];
  }
}

/**
 * Get permissions for a role
 */
function getRolePermissions(roleId) {
  try {
    const stmt = db.prepare(`
      SELECT p.* FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.resource, p.action
    `);
    return stmt.all(roleId);
  } catch (error) {
    console.error('[SSO/RBAC] Error getting role permissions:', error.message);
    return [];
  }
}

/**
 * Assign permission to role
 */
function assignPermissionToRole(roleId, permissionId) {
  const id = 'rp_' + crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO role_permissions (id, role_id, permission_id, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, roleId, permissionId, now);
    return { id, roleId, permissionId, created_at: now };
  } catch (error) {
    console.error('[SSO/RBAC] Error assigning permission to role:', error.message);
    throw error;
  }
}

/**
 * Remove permission from role
 */
function removePermissionFromRole(roleId, permissionId) {
  try {
    const stmt = db.prepare(`
      DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?
    `);
    stmt.run(roleId, permissionId);
    return true;
  } catch (error) {
    console.error('[SSO/RBAC] Error removing permission from role:', error.message);
    throw error;
  }
}

/**
 * Assign role to user in workspace
 */
function assignRoleToUser(userId, roleId, workspaceId, assignedByUserId) {
  const id = 'ur_' + crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO user_roles (id, user_id, role_id, workspace_id, created_at, assigned_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, userId, roleId, workspaceId, now, assignedByUserId);
    return { id, userId, roleId, workspaceId, created_at: now };
  } catch (error) {
    console.error('[SSO/RBAC] Error assigning role to user:', error.message);
    throw error;
  }
}

/**
 * Get roles for a user in a workspace
 */
function getUserWorkspaceRoles(userId, workspaceId) {
  try {
    const stmt = db.prepare(`
      SELECT r.* FROM roles r
      INNER JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.workspace_id = ?
      ORDER BY r.name
    `);
    return stmt.all(userId, workspaceId);
  } catch (error) {
    console.error('[SSO/RBAC] Error getting user workspace roles:', error.message);
    return [];
  }
}

/**
 * Remove role from user
 */
function removeRoleFromUser(userId, roleId, workspaceId) {
  try {
    const stmt = db.prepare(`
      DELETE FROM user_roles 
      WHERE user_id = ? AND role_id = ? AND workspace_id = ?
    `);
    stmt.run(userId, roleId, workspaceId);
    return true;
  } catch (error) {
    console.error('[SSO/RBAC] Error removing role from user:', error.message);
    throw error;
  }
}

// ========================= PHASE 5: ENCRYPTION & COMPLIANCE =========================

function recordSchemaMigration(name, checksum = null) {
  try {
    const stmt = db.prepare(`INSERT INTO schema_migrations (id, name, applied_at, checksum) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`);
    const id = 'mig_' + crypto.randomBytes(10).toString('hex');
    stmt.run(id, name, Math.floor(Date.now() / 1000), checksum);
    return true;
  } catch (error) {
    console.error('[Migration] recordSchemaMigration failed');
    return false;
  }
}

function getSchemaMigrations(limit = 100) {
  try {
    const stmt = db.prepare(`SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT ?`);
    return stmt.all(limit);
  } catch (error) {
    return [];
  }
}

/**
 * Create encryption key
 */
function createEncryptionKey(workspaceId, algorithm, keyHash, keySalt, createdByUserId, masterKeyId = null) {
  const id = 'enckey_' + crypto.randomBytes(12).toString('hex');
  const keyId = 'kid_' + crypto.randomBytes(10).toString('hex');
  const now = Math.floor(Date.now() / 1000);

  try {
    const stmt = db.prepare(`
      INSERT INTO encryption_keys (id, workspace_id, key_id, algorithm, key_hash, key_salt, master_key_id, created_at, status, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, workspaceId, keyId, algorithm, keyHash, keySalt, masterKeyId, now, 'active', createdByUserId);
    return { id, keyId, workspaceId, algorithm, keyHash, created_at: now, status: 'active' };
  } catch (error) {
    console.error('[Encryption] Create key error');
    throw error;
  }
}

/**
 * Get encryption keys for workspace
 */
function getEncryptionKeys(workspaceId, status = 'active') {
  try {
    const stmt = db.prepare(`
      SELECT * FROM encryption_keys 
      WHERE workspace_id = ? AND status = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(workspaceId, status) || [];
  } catch (error) {
    console.error('[Encryption] Get keys error:', error.message);
    return [];
  }
}

/**
 * Get encryption key by hash
 */
function getEncryptionKeyByHash(workspaceId, keyHash) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM encryption_keys 
      WHERE workspace_id = ? AND key_hash = ?
    `);
    return stmt.get(workspaceId, keyHash) || null;
  } catch (error) {
    console.error('[Encryption] Get key by hash error:', error.message);
    return null;
  }
}

/**
 * Get active encryption key (most recent)
 */
function getActiveEncryptionKey(workspaceId) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM encryption_keys 
      WHERE workspace_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(workspaceId) || null;
  } catch (error) {
    console.error('[Encryption] Get active key error:', error.message);
    return null;
  }
}

/**
 * Rotate encryption key
 */
function rotateWorkspaceEncryptionKey(workspaceId, oldKeyId, newKeyId) {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    // Mark old key as rotated
    const oldStmt = db.prepare(`
      UPDATE encryption_keys SET status = 'rotated', rotated_at = ?
      WHERE id = ? AND workspace_id = ?
    `);
    oldStmt.run(now, oldKeyId, workspaceId);
    
    // Make new key active
    const newStmt = db.prepare(`
      UPDATE encryption_keys SET status = 'active'
      WHERE id = ? AND workspace_id = ?
    `);
    newStmt.run(newKeyId, workspaceId);
    
    return { status: 'success', oldKeyId, newKeyId, rotatedAt: now };
  } catch (error) {
    console.error('[Encryption] Rotate key error:', error.message);
    throw error;
  }
}

/**
 * Create data retention policy
 */
function createRetentionPolicy(workspaceId, entityType, retentionDays, createdByUserId, autoDelete = true) {
  const id = 'rpolicy_' + crypto.randomBytes(12).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  
  try {
    const stmt = db.prepare(`
      INSERT INTO data_retention_policies (id, workspace_id, entity_type, retention_days, auto_delete, created_at, updated_at, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, workspaceId, entityType, retentionDays, autoDelete ? 1 : 0, now, now, createdByUserId);
    return { id, workspaceId, entityType, retentionDays, auto_delete: autoDelete ? 1 : 0, created_at: now };
  } catch (error) {
    console.error('[Retention] Create policy error:', error.message);
    throw error;
  }
}

/**
 * Get retention policies for workspace
 */
function getRetentionPolicies(workspaceId) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM data_retention_policies 
      WHERE workspace_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(workspaceId) || [];
  } catch (error) {
    console.error('[Retention] Get policies error:', error.message);
    return [];
  }
}

/**
 * Update retention policy
 */
function updateRetentionPolicy(policyId, updates) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const fields = [];
    const values = [];
    
    if ('retentionDays' in updates) {
      fields.push('retention_days = ?');
      values.push(updates.retentionDays);
    }
    
    if ('autoDelete' in updates) {
      fields.push('auto_delete = ?');
      values.push(updates.autoDelete ? 1 : 0);
    }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(policyId);
    
    if (fields.length <= 1) return null;
    
    const stmt = db.prepare(`
      UPDATE data_retention_policies SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);
    
    const getStmt = db.prepare('SELECT * FROM data_retention_policies WHERE id = ?');
    return getStmt.get(policyId);
  } catch (error) {
    console.error('[Retention] Update policy error:', error.message);
    throw error;
  }
}

/**
 * Create compliance audit log (immutable)
 */
function createComplianceAuditLog(workspaceId, userId, action, entityType, entityId, dataAccessed = null, ipAddress = null, userAgent = null, requestId = null) {
  // Compliance audit logs are workspace-scoped SOC2 records. Skip system-level
  // events (workspaceId === 'system' or missing) — they would fail the FK
  // constraint and belong in the regular audit_log instead.
  if (!workspaceId || workspaceId === 'system') return null;

  const id = 'audit_' + crypto.randomBytes(12).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);

  const hasRequestId = (() => {
    try {
      const cols = db.prepare('PRAGMA table_info(compliance_audit_logs)').all();
      return cols.some(c => c.name === 'request_id');
    } catch { return false; }
  })();

  try {
    const sql = hasRequestId
      ? `INSERT INTO compliance_audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, data_accessed, ip_address, user_agent, status, timestamp, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO compliance_audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, data_accessed, ip_address, user_agent, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [id, workspaceId, userId, action, entityType, entityId, dataAccessed, ipAddress, userAgent, 'success', timestamp];
    if (hasRequestId) params.push(requestId || getCurrentRequestId() || null);

    db.prepare(sql).run(...params);
    return { id, workspaceId, userId, action, timestamp };
  } catch (error) {
    // Swallow — compliance log must never crash the caller
    console.error('[Compliance] Audit log error:', error.message);
  }
}

/**
 * Get compliance audit logs
 */
function getComplianceAuditLogs(workspaceId, limit = 100) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM compliance_audit_logs 
      WHERE workspace_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(workspaceId, limit) || [];
  } catch (error) {
    console.error('[Compliance] Get logs error:', error.message);
    return [];
  }
}

/**
 * Execute retention cleanup for a workspace (best-effort, per policy)
 */
function executeRetentionCleanup(workspaceId, options = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const dryRun = !!options.dryRun;
  const policies = (getRetentionPolicies(workspaceId) || []).filter((p) => p && p.auto_delete === 1);
  const summary = {
    workspaceId,
    dryRun,
    runAt: nowSec,
    scannedPolicies: policies.length,
    totalDeleted: 0,
    results: [],
  };

  for (const policy of policies) {
    const entityType = String(policy.entity_type || '');
    const retentionDays = Number(policy.retention_days || 0);
    const cutoffSec = nowSec - Math.max(1, retentionDays) * 86400;

    try {
      if (entityType === 'notifications') {
        const countStmt = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE workspace_id = ? AND created_at < ?`);
        const row = countStmt.get(workspaceId, cutoffSec) || { c: 0 };
        const count = Number(row.c || 0);

        if (!dryRun && count > 0) {
          db.prepare(`DELETE FROM notification_queue WHERE notification_id IN (SELECT id FROM notifications WHERE workspace_id = ? AND created_at < ?)`)
            .run(workspaceId, cutoffSec);
          db.prepare(`DELETE FROM notifications WHERE workspace_id = ? AND created_at < ?`).run(workspaceId, cutoffSec);
        }

        summary.totalDeleted += count;
        summary.results.push({ entityType, retentionDays, deleted: count, status: 'ok' });
        continue;
      }

      if (entityType === 'activity_logs' || entityType === 'audit_log') {
        // audit_log is now append-only (SOC2 CC7) — deletion is prohibited.
        summary.results.push({ entityType, retentionDays, deleted: 0, status: 'skipped', reason: 'immutable_append_only' });
        continue;
      }

      if (entityType === 'compliance_audit_logs') {
        summary.results.push({ entityType, retentionDays, deleted: 0, status: 'skipped', reason: 'immutable_append_only' });
        continue;
      }

      summary.results.push({ entityType, retentionDays, deleted: 0, status: 'skipped', reason: 'unsupported_entity_type' });
    } catch (error) {
      summary.results.push({ entityType, retentionDays, deleted: 0, status: 'error', error: error.message });
    }
  }

  return summary;
}

/**
 * Create SSO configuration
 */
function createSSOConfiguration(workspaceId, provider, config, createdByUserId) {
  const id = 'sso_' + crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO sso_configurations (id, workspace_id, provider, config, active, created_at, updated_at, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, workspaceId, provider, JSON.stringify(config), 0, now, now, createdByUserId);
    return { id, workspaceId, provider, config, active: false, created_at: now };
  } catch (error) {
    console.error('[SSO/RBAC] Error creating SSO configuration:', error.message);
    throw error;
  }
}

/**
 * Get SSO configurations for a workspace
 */
function getSSOConfigurationsByWorkspace(workspaceId) {
  try {
    const stmt = db.prepare(`
      SELECT id, workspace_id, provider, active, created_at, updated_at 
      FROM sso_configurations 
      WHERE workspace_id = ?
    `);
    return stmt.all(workspaceId);
  } catch (error) {
    console.error('[SSO/RBAC] Error getting SSO configurations:', error.message);
    return [];
  }
}

/**
 * Get SSO configuration by provider
 */
function getSSOConfigurationByProvider(workspaceId, provider) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM sso_configurations 
      WHERE workspace_id = ? AND provider = ?
    `);
    const config = stmt.get(workspaceId, provider);
    if (config && config.config) {
      config.config = JSON.parse(config.config);
    }
    return config;
  } catch (error) {
    console.error('[SSO/RBAC] Error getting SSO configuration:', error.message);
    return null;
  }
}

/**
 * Update SSO configuration
 */
function updateSSOConfiguration(id, updates) {
  try {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];
    
    if ('config' in updates) {
      fields.push('config = ?');
      values.push(JSON.stringify(updates.config));
    }
    
    if ('active' in updates) {
      fields.push('active = ?');
      values.push(updates.active ? 1 : 0);
    }
    
    if (fields.length === 0) return null;
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    const stmt = db.prepare(`
      UPDATE sso_configurations SET ${fields.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
    
    const getStmt = db.prepare('SELECT * FROM sso_configurations WHERE id = ?');
    const result = getStmt.get(id);
    if (result && result.config) {
      result.config = JSON.parse(result.config);
    }
    return result;
  } catch (error) {
    console.error('[SSO/RBAC] Error updating SSO configuration:', error.message);
    throw error;
  }
}

// ============================================================================
// OAuth Server CRUD (MyApi as authorization server)
// ============================================================================

function upsertOAuthServerClient({ clientId, clientSecretHash, clientName, redirectUris, ownerId }) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO oauth_server_clients (client_id, client_secret_hash, client_name, redirect_uris, owner_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET
      client_secret_hash = excluded.client_secret_hash,
      client_name = excluded.client_name,
      redirect_uris = excluded.redirect_uris
  `).run(clientId, clientSecretHash, clientName, JSON.stringify(redirectUris), ownerId || null, now);
}

function getOAuthServerClient(clientId) {
  const row = db.prepare('SELECT * FROM oauth_server_clients WHERE client_id = ?').get(clientId);
  if (!row) return null;
  return { ...row, redirectUris: JSON.parse(row.redirect_uris || '[]') };
}

function createOAuthServerAuthCode({ code, clientId, userId, redirectUri, scope, codeChallenge }) {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  // Add code_challenge column for PKCE if not present
  try { db.exec('ALTER TABLE oauth_server_auth_codes ADD COLUMN code_challenge TEXT'); } catch (_) {}
  db.prepare(`
    INSERT INTO oauth_server_auth_codes (code, client_id, user_id, redirect_uri, scope, expires_at, used, code_challenge)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(code, clientId, userId, redirectUri, scope || 'full', expiresAt, codeChallenge || null);
}

function consumeOAuthServerAuthCode(code) {
  const row = db.prepare('SELECT * FROM oauth_server_auth_codes WHERE code = ? AND used = 0').get(code);
  if (!row) return null;
  if (row.expires_at < Date.now()) return null;
  db.prepare('UPDATE oauth_server_auth_codes SET used = 1 WHERE code = ?').run(code);
  return row;
}

function peekOAuthServerAuthCode(code) {
  const row = db.prepare('SELECT * FROM oauth_server_auth_codes WHERE code = ? AND used = 0').get(code);
  if (!row || row.expires_at < Date.now()) return null;
  return row;
}

// ── AFP (API File Protocol) helpers ───────────────────────────────────────────

function createAfpDevice(userId, deviceName, hostname, platform, arch, capabilities, tokenHash, afpRoot) {
  const id = 'afp_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO afp_devices
      (id, user_id, device_name, hostname, platform, arch, capabilities_json, device_token_hash, afp_root, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?)
  `).run(id, userId, deviceName, hostname || null, platform || null, arch || null,
         JSON.stringify(capabilities || []), tokenHash, afpRoot || null, now);
  return id;
}

function getAfpDevices(userId) {
  return db.prepare(
    `SELECT * FROM afp_devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`
  ).all(userId);
}

function getAfpDeviceById(deviceId) {
  return db.prepare(`SELECT * FROM afp_devices WHERE id = ?`).get(deviceId);
}

// Returns the first non-revoked device matching this user + hostname + platform.
// Used by the register endpoint to avoid creating duplicate rows for the same machine.
function findAfpDeviceByHostname(userId, hostname, platform) {
  return db.prepare(
    `SELECT * FROM afp_devices WHERE user_id = ? AND hostname = ? AND platform = ? AND revoked_at IS NULL LIMIT 1`
  ).get(userId, hostname || null, platform || null);
}

function rotateAfpDeviceToken(deviceId, deviceName, arch, capabilities, tokenHash, afpRoot) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE afp_devices
      SET device_token_hash = ?, device_name = ?, arch = ?,
          capabilities_json = ?, afp_root = ?, status = 'offline', last_seen_at = ?
      WHERE id = ?
  `).run(tokenHash, deviceName, arch || null, JSON.stringify(capabilities || []), afpRoot || null, now, deviceId);
}

function revokeAfpDevice(deviceId) {
  db.prepare(`UPDATE afp_devices SET revoked_at = ?, status = 'offline' WHERE id = ?`)
    .run(new Date().toISOString(), deviceId);
}

function updateAfpDeviceStatus(deviceId, status) {
  db.prepare(`UPDATE afp_devices SET status = ?, last_seen_at = ? WHERE id = ?`)
    .run(status, new Date().toISOString(), deviceId);
}

function logAfpCommand(deviceId, userId, requesterTokenId, op, path, cmd, status, durationMs) {
  db.prepare(`
    INSERT INTO afp_command_log
      (device_id, user_id, requester_token_id, op, path, cmd, status, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(deviceId, userId, requesterTokenId || null, op,
         path || null, cmd || null, status, durationMs || null,
         new Date().toISOString());
}

// ─────────────────────────────────────────────────────────────────────────────

function setUserNeedsOnboarding(userId, value) {
  try {
    db.prepare('UPDATE users SET needs_onboarding = ? WHERE id = ?').run(value ? 1 : 0, userId);
  } catch (_) {}
}

function clearUserOnboarding(userId) {
  setUserNeedsOnboarding(userId, false);
}

module.exports = {
  db,
  initDatabase,
  checkDatabaseHealth,
  createVaultToken,
  getVaultTokens,
  deleteVaultToken,
  decryptVaultToken,
  createAccessToken,
  getAccessTokens,
  getExistingMasterToken,
  encryptRawToken,
  decryptRawToken,
  revokeAccessToken,
  // Scopes
  seedDefaultScopes,
  validateScope,
  getAllScopes,
  grantScopes,
  getTokenScopes,
  revokeScopes,
  hasPermission,
  expandScopeTemplate,
  createConnector,
  getConnectors,
  createAuditLog,
  getAuditLogs,
  createUser,
  getUsers,
  countTotalUsers,
  addToWaitlist,
  listWaitlist,
  markWaitlistInvited,
  markWaitlistNotified,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  updateUserPlan,
  updateUserOAuthProfile,
  setUserNeedsOnboarding,
  clearUserOnboarding,
  upsertUserPiiSecure,
  getUserPiiSecure,
  updateUserSubscriptionStatus,
  getUserTotpSecret,
  setUserTotpSecret,
  enableUserTwoFactor,
  disableUserTwoFactor,
  createHandshake,
  getHandshakes,
  approveHandshake,
  denyHandshake,
  revokeHandshake,
  createPersona,
  getPersonas,
  getPersonaById,
  getActivePersona,
  updatePersona,
  setActivePersona,
  deletePersona,
  storeOAuthToken,
  getOAuthToken,
  countConnectedOAuthServices,
  isTokenExpired,
  refreshOAuthToken,
  revokeOAuthToken,
  updateOAuthStatus,
  getOAuthStatus,
  createStateToken,
  validateStateToken,
  cleanupExpiredStateTokens, // BUG-11: Cleanup expired OAuth state tokens
  // Phase 5: Key rotation and rate limiting
  createKeyVersion,
  getKeyVersions,
  getCurrentKeyVersion,
  rotateEncryptionKey,
  checkRateLimit,
  incrementRateLimit,
  cleanupOldRateLimits, // BUG-10: Cleanup old rate limit records
  // Brain
  createConversation,
  getConversations,
  getConversation,
  storeMessage,
  getConversationHistory,
  cacheContext,
  getCachedContext,
  purgeExpiredCache,
  addKBDocument,
  getKBDocuments,
  getKBDocumentById,
  deleteKBDocument,
  updateKBDocument,
  getKBDocumentByTitle,
  // Memory
  createMemory,
  getMemories,
  getMemoryById,
  updateMemory,
  deleteMemory,
  clearMemories,
  // Skills
  createSkill,
  getSkills,
  getSkillById,
  getSkillBySlug,
  getSkillsByIds,
  getSkillsBySlugList,
  suggestSkills,
  updateSkill,
  deleteSkill,
  setActiveSkill,
  getSkillDocuments,
  attachDocumentToSkill,
  detachDocumentFromSkill,
  // Skill Origin & Attribution (Phase 1)
  updateSkillOrigin,
  // Skill Versioning & Immutability (Phase 2)
  createSkillVersion,
  getSkillVersions,
  getSkillVersion,
  // Skill Fork & Derivative Tracking (Phase 3)
  createSkillFork,
  getSkillForks,
  getSkillForkInfo,
  // Skill Licenses (Phase 4)
  getLicenses,
  getLicense,
  validateLicenseOperation,
  // Skill Ownership Verification (Phase 4)
  createOwnershipClaim,
  getOwnershipClaim,
  verifyOwnershipClaim,
  getSkillOwnershipClaims,
  // Marketplace
  createMarketplaceListing,
  getPersonaDocuments,
  getPersonaDocumentContents,
  attachDocumentToPersona,
  detachDocumentFromPersona,
  getPersonaSkills,
  attachSkillToPersona,
  detachSkillFromPersona,
  getPersonaSkillPackages,
  getMarketplaceListings,
  getMarketplaceListing,
  updateMarketplaceListing,
  removeMarketplaceListing,
  rateMarketplaceListing,
  incrementInstallCount,
  getMyMarketplaceListings,
  // Services
  seedServiceCategories,
  seedServices,
  seedExamplePersonas,
  getServiceCategories,
  getServices,
  getServicesByCategory,
  getServiceByName,
  getServiceMethods,
  addServiceMethod,
  // Device Approval System
  createApprovedDevice,
  getApprovedDevices,
  getApprovedDeviceByHash,
  getApprovedDeviceByHashAndToken,
  updateDeviceLastUsed,
  revokeDevice,
  renameDevice,
  createPendingApproval,
  getPendingApprovals,
  getPendingApprovalById,
  approvePendingDevice,
  denyPendingApproval,
  cleanupExpiredApprovals,
  getDeviceApprovalHistory,
  // OAuth Device Flow (RFC 8628)
  createDeviceCode,
  getDeviceCodeByDeviceCode,
  getDeviceCodeByUserCode,
  getPendingDeviceCodes,
  approveDeviceCode,
  denyDeviceCode,
  expireOldDeviceCodes,
  // ASC (Agentic Secure Connection)
  createApprovedDeviceASC,
  getApprovedDeviceByKeyFingerprint,
  // Service Preferences (Phase 3)
  createServicePreference,
  getServicePreference,
  getServicePreferences,
  updateServicePreference,
  deleteServicePreference,
  // Notifications & Activity Log
  createNotification,
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  getOrCreateNotificationSettings,
  updateNotificationPreferences,
  queueNotificationForDelivery,
  createActivityLog,
  getActivityLog,
  queueEmail,
  getPendingEmails,
  markEmailAsSent,
  markEmailAsFailed,
  getEmailQueueStats,
  getRecentEmailJobs,
  // Phase 1: Workspaces & Teams
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  ensureDefaultWorkspaceExists,
  getOrEnsureUserWorkspace,
  addWorkspaceMember,
  getWorkspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  removeWorkspaceMemberByUserId,
  getWorkspaceMember,
  createWorkspaceInvitation,
  getWorkspaceInvitations,
  getInvitationById,
  getInvitationByEmailAndWorkspace,
  deleteInvitationByEmailAndWorkspace,
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  getUserWorkspaceInvitations,
  cleanupExpiredInvitations,
  // Phase 2: Billing & Usage
  getBillingCustomerByWorkspace,
  upsertBillingCustomer,
  getBillingSubscriptionByWorkspace,
  upsertBillingSubscription,
  listInvoicesByWorkspace,
  upsertInvoice,
  incrementUsageDaily,
  getUsageDaily,
  // Pricing Plans
  seedDefaultPricingPlans,
  // Phase 4: SSO & RBAC
  runMigrations,
  // Roles
  createRole,
  getRolesByWorkspace,
  getRoleById,
  updateRole,
  deleteRole,
  // Permissions
  createPermission,
  getAllPermissions,
  getRolePermissions,
  assignPermissionToRole,
  removePermissionFromRole,
  // User Roles
  assignRoleToUser,
  getUserWorkspaceRoles,
  removeRoleFromUser,
  // SSO Configuration
  createSSOConfiguration,
  getSSOConfigurationsByWorkspace,
  getSSOConfigurationByProvider,
  updateSSOConfiguration,
  // Phase 5: Encryption & Compliance
  recordSchemaMigration,
  getSchemaMigrations,
  createEncryptionKey,
  getEncryptionKeys,
  getEncryptionKeyByHash,
  rotateWorkspaceEncryptionKey,
  getActiveEncryptionKey,
  createRetentionPolicy,
  getRetentionPolicies,
  updateRetentionPolicy,
  createComplianceAuditLog,
  getComplianceAuditLogs,
  executeRetentionCleanup,
  deleteAllNotifications,
  updateNotificationTypeSettings,
  // OAuth Server (MyApi as authorization server)
  upsertOAuthServerClient,
  getOAuthServerClient,
  createOAuthServerAuthCode,
  consumeOAuthServerAuthCode,
  peekOAuthServerAuthCode,
  // AFP (API File Protocol)
  createAfpDevice,
  getAfpDevices,
  getAfpDeviceById,
  findAfpDeviceByHostname,
  rotateAfpDeviceToken,
  revokeAfpDevice,
  updateAfpDeviceStatus,
  logAfpCommand,
};