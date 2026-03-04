const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new Database(dbPath);

function normalizeOwnerId(ownerId) {
  const v = String(ownerId || '').trim();
  return v || 'owner';
}

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize database schema
function initDatabase() {
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
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      scope TEXT,
      ip TEXT,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      email TEXT,
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
      updated_at TEXT NOT NULL
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
  `);

  // Seed default scopes if not already present
  seedDefaultScopes();

  // Seed example personas
  seedExamplePersonas();

  // Seed service categories and services
  seedServiceCategories();
  seedServices();

  // Vault token schema migrations
  const vaultTokenMigrations = [
    'ALTER TABLE vault_tokens ADD COLUMN service TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN website_url TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN discovered_api_url TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN discovered_auth_scheme TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN discovered_metadata TEXT',
    'ALTER TABLE vault_tokens ADD COLUMN last_discovered_at TEXT'
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

  console.log('Database initialized at:', dbPath);
}

// Vault Tokens
function createVaultToken(label, description, token, service, websiteUrl = null, discovery = null) {
  const id = 'vt_' + crypto.randomBytes(16).toString('hex');
  const encryptionKey = process.env.VAULT_KEY || 'default-vault-key-change-me';

  // Simple encryption using crypto (AES-256-CBC)
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Store IV with encrypted data
  encrypted = iv.toString('hex') + ':' + encrypted;

  const tokenPreview = token.length > 8 ? token.slice(0, 4) + '***' + token.slice(-4) : '***';
  const now = new Date().toISOString();

  const discoveredApiUrl = discovery?.apiBaseUrl || null;
  const discoveredAuthScheme = discovery?.authScheme || null;
  const discoveredMetadata = discovery?.raw ? JSON.stringify(discovery.raw) : null;

  const stmt = db.prepare(`
    INSERT INTO vault_tokens (
      id, label, description, encrypted_token, token_preview,
      service, website_url, discovered_api_url, discovered_auth_scheme, discovered_metadata, last_discovered_at,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    now
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

function getVaultTokens() {
  const stmt = db.prepare(`
    SELECT id, label, description, token_preview, service, website_url, discovered_api_url, discovered_auth_scheme, created_at, updated_at
    FROM vault_tokens
    ORDER BY created_at DESC
  `);
  return stmt.all().map(row => ({
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
  }));
}

function decryptVaultToken(id) {
  const encryptionKey = process.env.VAULT_KEY || 'default-vault-key-change-me';
  const row = db.prepare('SELECT * FROM vault_tokens WHERE id = ?').get(id);
  if (!row) return null;
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    const [ivHex, encryptedData] = row.encrypted_token.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
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

function deleteVaultToken(id) {
  const stmt = db.prepare('DELETE FROM vault_tokens WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Access Tokens
function createAccessToken(hash, ownerId, scope, label, expiresAt = null, allowedPersonas = null) {
  const id = 'tok_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const allowedPersonasJson = allowedPersonas && allowedPersonas.length > 0
    ? JSON.stringify(allowedPersonas)
    : null;

  const stmt = db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, revoked_at, expires_at, allowed_personas)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `);

  stmt.run(id, hash, ownerId, scope, label, now, expiresAt, allowedPersonasJson);
  return id;
}

function getAccessTokens(ownerId = null) {
  let query = 'SELECT * FROM access_tokens';
  if (ownerId) {
    query += ' WHERE owner_id = ?';
  }
  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  const rows = ownerId ? stmt.all(ownerId) : stmt.all();
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
    allowedPersonas: row.allowed_personas ? JSON.parse(row.allowed_personas) : null
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
    { name: 'identity:read', category: 'identity', description: 'Read user identity information' },
    { name: 'identity:write', category: 'identity', description: 'Write user identity information' },
    { name: 'vault:read', category: 'vault', description: 'Read vault tokens' },
    { name: 'vault:write', category: 'vault', description: 'Create and manage vault tokens' },
    { name: 'services:read', category: 'services', description: 'Read service connectors' },
    { name: 'services:write', category: 'services', description: 'Create and manage service connectors' },
    { name: 'brain:chat', category: 'brain', description: 'Chat with brain AI' },
    { name: 'brain:read', category: 'brain', description: 'Read brain conversations and context' },
    { name: 'audit:read', category: 'audit', description: 'Read audit logs' },
    { name: 'personas:read', category: 'personas', description: 'Read persona definitions' },
    { name: 'personas:write', category: 'personas', description: 'Create and manage personas' },
    { name: 'skills:read', category: 'skills', description: 'Read skills and skill metadata' },
    { name: 'skills:write', category: 'skills', description: 'Create and manage skills' },
    { name: 'admin:*', category: 'admin', description: 'Full admin access (grants all scopes)' },
  ];

  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO scope_definitions (scope_name, description, category, permissions, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE scope_definitions
    SET description = ?, category = ?
    WHERE scope_name = ?
  `);

  for (const scope of scopes) {
    insertStmt.run(scope.name, scope.description, scope.category, null, now);
    updateStmt.run(scope.description, scope.category, scope.name);
  }
}

function validateScope(scopeName) {
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
    'read': ['identity:read', 'vault:read', 'services:read', 'brain:read', 'audit:read', 'skills:read'],
    'professional': ['identity:read'],
    'availability': ['identity:read'],
    'guest': ['identity:read'],
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
  const stmt = db.prepare(`
    INSERT INTO audit_log (timestamp, requester_id, action, resource, scope, ip, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    entry.timestamp || new Date().toISOString(),
    entry.requesterId || null,
    entry.action,
    entry.resource,
    entry.scope || null,
    entry.ip || null,
    entry.details ? JSON.stringify(entry.details) : null
  );
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
    action: row.action,
    resource: row.resource,
    scope: row.scope,
    ip: row.ip,
    details: row.details ? JSON.parse(row.details) : null
  }));

  return { logs, total };
}

// Handshake support (new)
function createUser(username, displayName, email, timezone, password, plan = 'free') {
  const id = 'usr_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(`INSERT INTO users (id, username, display_name, email, timezone, password_hash, created_at, status, plan) VALUES (?,?,?,?,?,?,?,?,?)`);
  stmt.run(id, username, displayName || null, email || null, timezone || null, hash, now, 'active', plan || 'free');
  return { id, username, displayName, email, timezone, createdAt: now, status: 'active', plan: plan || 'free' };
}

function getUsers() {
  const stmt = db.prepare("SELECT id, username, display_name as displayName, email, timezone, created_at as createdAt, status, COALESCE(plan, 'free') as plan FROM users ORDER BY created_at DESC");
  return stmt.all();
}

function getUserByUsername(username) {
  const stmt = db.prepare("SELECT id, username, display_name as displayName, email, timezone, password_hash, created_at as createdAt, status, COALESCE(plan, 'free') as plan FROM users WHERE username = ?");
  return stmt.get(username);
}

function getUserById(id) {
  const stmt = db.prepare("SELECT id, username, display_name as displayName, email, timezone, created_at as createdAt, status, COALESCE(plan, 'free') as plan FROM users WHERE id = ?");
  return stmt.get(id);
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
  const rawToken = crypto.randomBytes(32).toString('hex');
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
function createPersona(name, soulContent, description, templateData = null, ownerId = 'owner') {
  const now = new Date().toISOString();
  const owner = normalizeOwnerId(ownerId);
  const stmt = db.prepare(`
    INSERT INTO personas (name, soul_content, description, active, created_at, updated_at, template_data, owner_id)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?)
  `);
  const result = stmt.run(name, soulContent, description || null, now, now, templateData ? JSON.stringify(templateData) : null, owner);
  return {
    id: result.lastInsertRowid,
    name,
    soul_content: soulContent,
    description,
    active: false,
    created_at: now,
    updated_at: now,
    template_data: templateData
  };
}

function getPersonas(ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const stmt = db.prepare(`
    SELECT id, name, soul_content, description, active, created_at, updated_at, template_data
    FROM personas
    WHERE owner_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(owner).map(row => ({
    id: row.id,
    name: row.name,
    soul_content: row.soul_content,
    description: row.description,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    template_data: row.template_data ? JSON.parse(row.template_data) : null
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
function storeOAuthToken(serviceName, userId, accessToken, refreshToken, expiresAt, scope) {
  const id = 'oauth_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  
  // Encrypt tokens using AES-256-GCM
  const encryptionKey = process.env.VAULT_KEY || 'default-vault-key-change-me';
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encryptedAccess = cipher.update(accessToken, 'utf8', 'hex');
  encryptedAccess += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Store encrypted access token with IV and authTag
  const accessTokenEncrypted = JSON.stringify({
    encrypted: encryptedAccess,
    iv: iv.toString('hex'),
    authTag: authTag
  });
  
  // Encrypt refresh token if present
  let refreshTokenEncrypted = null;
  if (refreshToken) {
    const cipher2 = crypto.createCipheriv(algorithm, key, crypto.randomBytes(16));
    let encryptedRefresh = cipher2.update(refreshToken, 'utf8', 'hex');
    encryptedRefresh += cipher2.final('hex');
    const authTag2 = cipher2.getAuthTag().toString('hex');
    const iv2 = crypto.randomBytes(16).toString('hex');
    refreshTokenEncrypted = JSON.stringify({
      encrypted: encryptedRefresh,
      iv: iv2,
      authTag: authTag2
    });
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

function getOAuthToken(serviceName, userId) {
  const stmt = db.prepare(`
    SELECT * FROM oauth_tokens
    WHERE service_name = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  
  const row = stmt.get(serviceName, userId);
  if (!row) return null;
  
  // Decrypt tokens
  const encryptionKey = process.env.VAULT_KEY || 'default-vault-key-change-me';
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  
  try {
    const accessData = JSON.parse(row.access_token);
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(accessData.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(accessData.authTag, 'hex'));
    let decrypted = decipher.update(accessData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    let refreshToken = null;
    if (row.refresh_token) {
      const refreshData = JSON.parse(row.refresh_token);
      const decipher2 = crypto.createDecipheriv(algorithm, key, Buffer.from(refreshData.iv, 'hex'));
      decipher2.setAuthTag(Buffer.from(refreshData.authTag, 'hex'));
      let decryptedRefresh = decipher2.update(refreshData.encrypted, 'hex', 'utf8');
      decryptedRefresh += decipher2.final('utf8');
      refreshToken = decryptedRefresh;
    }
    
    return {
      id: row.id,
      serviceName: row.service_name,
      userId: row.user_id,
      accessToken: decrypted,
      refreshToken,
      expiresAt: row.expires_at,
      scope: row.scope,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (e) {
    console.error('Error decrypting OAuth token:', e);
    return null;
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

function deleteKBDocument(id, ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  const tx = db.transaction((docId, docOwner) => {
    db.prepare('DELETE FROM persona_documents WHERE document_id = ? AND persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(docId, docOwner);
    db.prepare('DELETE FROM skill_documents WHERE document_id = ? AND skill_id IN (SELECT id FROM skills WHERE owner_id = ?)').run(docId, docOwner);
    const result = db.prepare('DELETE FROM kb_documents WHERE id = ? AND owner_id = ?').run(docId, docOwner);
    return result.changes > 0;
  });
  return tx(id, owner);
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
  const stmt = db.prepare(`
    INSERT INTO skills (name, description, version, author, category, script_content, config_json, repo_url, active, created_at, updated_at, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `);
  const configValue = typeof configJson === 'object' ? JSON.stringify(configJson) : (configJson || null);
  const result = stmt.run(name, description || null, version || '1.0.0', author || null, category || 'custom', scriptContent || null, configValue, repoUrl || null, now, now, owner);
  return getSkillById(result.lastInsertRowid, owner);
}

function getSkills(ownerId = 'owner') {
  const owner = normalizeOwnerId(ownerId);
  return db.prepare('SELECT * FROM skills WHERE owner_id = ? ORDER BY created_at DESC').all(owner).map(row => ({
    ...row, active: Boolean(row.active),
    config_json: row.config_json ? (() => { try { return JSON.parse(row.config_json); } catch { return row.config_json; } })() : null,
  }));
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
  const stmt = db.prepare(`
    INSERT INTO marketplace_listings (owner_id, type, title, description, content, tags, price, status, avg_rating, rating_count, install_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, 0, ?, ?)
  `);
  const result = stmt.run(ownerId, type, title, description || null, contentStr, tags || '', price || 'free', now, now);
  return getMarketplaceListing(result.lastInsertRowid);
}

function getMarketplaceListings({ type, sort, search, tags, status = 'active' } = {}) {
  let query = `
    SELECT ml.*, u.username as owner_name, u.display_name as owner_display_name
    FROM marketplace_listings ml
    LEFT JOIN users u ON ml.owner_id = u.id
    WHERE ml.status = ?
  `;
  const params = [status];

  if (type && type !== 'all') {
    query += ' AND ml.type = ?';
    params.push(type);
  }
  if (search) {
    query += ' AND (ml.title LIKE ? OR ml.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (tags) {
    query += ' AND ml.tags LIKE ?';
    params.push(`%${tags}%`);
  }

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
    // Social Media - with official logos
    { name: 'twitter', label: 'X (Twitter)', category: 'social', icon: 'https://cdn.simpleicons.org/x/000000', auth: 'oauth2', endpoint: 'https://api.twitter.com/2', docs: 'https://developer.twitter.com' },
    { name: 'facebook', label: 'Facebook', category: 'social', icon: 'https://cdn.simpleicons.org/facebook/1877F2', auth: 'oauth2', endpoint: 'https://graph.facebook.com', docs: 'https://developers.facebook.com/docs/graph-api' },
    { name: 'linkedin', label: 'LinkedIn', category: 'social', icon: 'https://cdn.simpleicons.org/linkedin/0A66C2', auth: 'oauth2', endpoint: 'https://api.linkedin.com/v2', docs: 'https://docs.microsoft.com/en-us/linkedin' },
    { name: 'instagram', label: 'Instagram', category: 'social', icon: 'https://cdn.simpleicons.org/instagram/E4405F', auth: 'oauth2', endpoint: 'https://graph.instagram.com', docs: 'https://developers.facebook.com/docs/instagram' },
    { name: 'tiktok', label: 'TikTok', category: 'social', icon: 'https://cdn.simpleicons.org/tiktok/000000', auth: 'oauth2', endpoint: 'https://open.tiktok.com/v1', docs: 'https://developers.tiktok.com' },
    { name: 'reddit', label: 'Reddit', category: 'social', icon: 'https://cdn.simpleicons.org/reddit/FF4500', auth: 'oauth2', endpoint: 'https://oauth.reddit.com', docs: 'https://www.reddit.com/dev/api' },
    { name: 'youtube', label: 'YouTube', category: 'social', icon: 'https://cdn.simpleicons.org/youtube/FF0000', auth: 'oauth2', endpoint: 'https://www.googleapis.com/youtube/v3', docs: 'https://developers.google.com/youtube' },
    { name: 'twitch', label: 'Twitch', category: 'social', icon: 'https://cdn.simpleicons.org/twitch/9146FF', auth: 'oauth2', endpoint: 'https://api.twitch.tv/helix', docs: 'https://dev.twitch.tv/docs/api' },
    { name: 'bluesky', label: 'Bluesky', category: 'social', icon: 'https://cdn.simpleicons.org/bluesky/1185FE', auth: 'jwt', endpoint: 'https://bsky.social/xrpc', docs: 'https://docs.bsky.app' },
    { name: 'mastodon', label: 'Mastodon', category: 'social', icon: 'https://cdn.simpleicons.org/mastodon/6364FF', auth: 'oauth2', endpoint: 'https://mastodon.social/api/v1', docs: 'https://docs.joinmastodon.org' },
    
    // Development - with official logos
    { name: 'gitlab', label: 'GitLab', category: 'dev', icon: 'https://cdn.simpleicons.org/gitlab/FC6D26', auth: 'oauth2', endpoint: 'https://gitlab.com/api/v4', docs: 'https://docs.gitlab.com/ee/api' },
    { name: 'bitbucket', label: 'Bitbucket', category: 'dev', icon: 'https://cdn.simpleicons.org/bitbucket/0052CC', auth: 'oauth2', endpoint: 'https://api.bitbucket.org/2.0', docs: 'https://developer.atlassian.com/cloud/bitbucket' },
    { name: 'azuredevops', label: 'Azure DevOps', category: 'dev', icon: 'https://cdn.simpleicons.org/azuredevops/0078D4', auth: 'oauth2', endpoint: 'https://dev.azure.com', docs: 'https://docs.microsoft.com/en-us/rest/api/azure/devops' },
    { name: 'travisci', label: 'Travis CI', category: 'dev', icon: 'https://cdn.simpleicons.org/travisci/3EAAAF', auth: 'token', endpoint: 'https://api.travis-ci.com', docs: 'https://docs.travis-ci.com/api' },
    { name: 'circleci', label: 'CircleCI', category: 'dev', icon: 'https://cdn.simpleicons.org/circleci/343434', auth: 'token', endpoint: 'https://circleci.com/api/v2', docs: 'https://circleci.com/docs/api/v2' },
    { name: 'gitea', label: 'Gitea', category: 'dev', icon: 'https://cdn.simpleicons.org/gitea/609926', auth: 'oauth2', endpoint: 'https://api.gitea.io', docs: 'https://docs.gitea.io/en-us/api-usage' },
    
    // Productivity - with official logos
    { name: 'notion', label: 'Notion', category: 'productivity', icon: 'https://cdn.simpleicons.org/notion/000000', auth: 'oauth2', endpoint: 'https://api.notion.com/v1', docs: 'https://developers.notion.com' },
    { name: 'airtable', label: 'Airtable', category: 'productivity', icon: 'https://cdn.simpleicons.org/airtable/13B5EA', auth: 'token', endpoint: 'https://api.airtable.com/v0', docs: 'https://airtable.com/developers/web/api' },
    { name: 'asana', label: 'Asana', category: 'productivity', icon: 'https://cdn.simpleicons.org/asana/F06A6A', auth: 'oauth2', endpoint: 'https://app.asana.com/api/1.0', docs: 'https://developers.asana.com' },
    { name: 'monday', label: 'Monday.com', category: 'productivity', icon: 'https://cdn.simpleicons.org/monday/0055CC', auth: 'token', endpoint: 'https://api.monday.com/graphql', docs: 'https://monday.com/developers' },
    { name: 'trello', label: 'Trello', category: 'productivity', icon: 'https://cdn.simpleicons.org/trello/0052CC', auth: 'oauth2', endpoint: 'https://api.trello.com/1', docs: 'https://developer.atlassian.com/cloud/trello' },
    { name: 'jira', label: 'Jira', category: 'productivity', icon: 'https://cdn.simpleicons.org/jira/0052CC', auth: 'oauth2', endpoint: 'https://your-domain.atlassian.net/rest/api/2', docs: 'https://developer.atlassian.com/cloud/jira' },
    { name: 'clickup', label: 'ClickUp', category: 'productivity', icon: 'https://cdn.simpleicons.org/clickup/7B68EE', auth: 'token', endpoint: 'https://api.clickup.com/api/v2', docs: 'https://clickup.com/api' },
    { name: 'linear', label: 'Linear', category: 'productivity', icon: 'https://cdn.simpleicons.org/linear/5E6AD2', auth: 'token', endpoint: 'https://api.linear.app/graphql', docs: 'https://developers.linear.app' },
    
    // Payment - with official logos
    { name: 'stripe', label: 'Stripe', category: 'payment', icon: 'https://cdn.simpleicons.org/stripe/008CDD', auth: 'key', endpoint: 'https://api.stripe.com/v1', docs: 'https://stripe.com/docs/api' },
    { name: 'paypal', label: 'PayPal', category: 'payment', icon: 'https://cdn.simpleicons.org/paypal/003087', auth: 'oauth2', endpoint: 'https://api-m.paypal.com', docs: 'https://developer.paypal.com' },
    { name: 'shopify', label: 'Shopify', category: 'payment', icon: 'https://cdn.simpleicons.org/shopify/96C63E', auth: 'oauth2', endpoint: 'https://your-store.myshopify.com/admin/api/2024-01', docs: 'https://shopify.dev/api/admin-rest' },
    { name: 'square', label: 'Square', category: 'payment', icon: 'https://cdn.simpleicons.org/square/3693F3', auth: 'oauth2', endpoint: 'https://api.square.com/v2', docs: 'https://developer.squareup.com' },
    
    // Communication - with official logos
    { name: 'email', label: 'Email/SMTP', category: 'communication', icon: 'https://cdn.simpleicons.org/gmail/EA4335', auth: 'oauth2', endpoint: 'smtp.gmail.com', docs: 'https://support.google.com/mail' },
    { name: 'telegram', label: 'Telegram', category: 'communication', icon: 'https://cdn.simpleicons.org/telegram/0088cc', auth: 'token', endpoint: 'https://api.telegram.org/bot', docs: 'https://core.telegram.org/bots/api' },
    { name: 'signal', label: 'Signal', category: 'communication', icon: 'https://cdn.simpleicons.org/signal/3A76F0', auth: 'webhook', endpoint: 'https://signal.org', docs: 'https://signal.org/docs' },
    { name: 'matrix', label: 'Matrix', category: 'communication', icon: 'https://cdn.simpleicons.org/matrix/000000', auth: 'token', endpoint: 'https://matrix.org/_matrix', docs: 'https://spec.matrix.org/latest' },
    { name: 'mattermost', label: 'Mattermost', category: 'communication', icon: 'https://cdn.simpleicons.org/mattermost/0058CC', auth: 'oauth2', endpoint: 'https://mattermost.example.com/api/v4', docs: 'https://developers.mattermost.com' },
    
    // Cloud - with official logos
    { name: 'aws', label: 'Amazon AWS', category: 'cloud', icon: 'https://cdn.simpleicons.org/amazonaws/FF9900', auth: 'key', endpoint: 'https://aws.amazon.com', docs: 'https://docs.aws.amazon.com' },
    { name: 'azure', label: 'Microsoft Azure', category: 'cloud', icon: 'https://cdn.simpleicons.org/microsoftazure/0078D4', auth: 'oauth2', endpoint: 'https://management.azure.com', docs: 'https://docs.microsoft.com/en-us/azure' },
    { name: 'gcp', label: 'Google Cloud', category: 'cloud', icon: 'https://cdn.simpleicons.org/googlecloud/4285F4', auth: 'key', endpoint: 'https://www.googleapis.com', docs: 'https://cloud.google.com/docs' },
    { name: 'digitalocean', label: 'DigitalOcean', category: 'cloud', icon: 'https://cdn.simpleicons.org/digitalocean/0080FF', auth: 'token', endpoint: 'https://api.digitalocean.com/v2', docs: 'https://docs.digitalocean.com/reference/api' },
    
    // Analytics - with official logos
    { name: 'mixpanel', label: 'Mixpanel', category: 'analytics', icon: 'https://cdn.simpleicons.org/mixpanel/25C881', auth: 'token', endpoint: 'https://api.mixpanel.com', docs: 'https://developer.mixpanel.com' },
    { name: 'segment', label: 'Segment', category: 'analytics', icon: 'https://cdn.simpleicons.org/segment/221F1F', auth: 'token', endpoint: 'https://api.segment.com', docs: 'https://segment.com/docs/api' },
    { name: 'googleanalytics', label: 'Google Analytics', category: 'analytics', icon: 'https://cdn.simpleicons.org/googleanalytics/E37400', auth: 'oauth2', endpoint: 'https://www.googleapis.com/analytics/v3', docs: 'https://developers.google.com/analytics' },
  ];

  const getCategoryId = db.prepare('SELECT id FROM service_categories WHERE name = ?');
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO services (name, label, category_id, icon, auth_type, api_endpoint, documentation_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const srv of services) {
    const cat = getCategoryId.get(srv.category);
    if (!cat) continue;
    insertStmt.run(srv.name, srv.label, cat.id, srv.icon, srv.auth, srv.endpoint, srv.docs, now);
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

module.exports = {
  db,
  initDatabase,
  createVaultToken,
  getVaultTokens,
  deleteVaultToken,
  decryptVaultToken,
  createAccessToken,
  getAccessTokens,
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
  getUserByUsername,
  getUserById,
  updateUserPlan,
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
  revokeOAuthToken,
  updateOAuthStatus,
  getOAuthStatus,
  createStateToken,
  validateStateToken,
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
  // Skills
  createSkill,
  getSkills,
  getSkillById,
  updateSkill,
  deleteSkill,
  setActiveSkill,
  getSkillDocuments,
  attachDocumentToSkill,
  detachDocumentFromSkill,
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
};