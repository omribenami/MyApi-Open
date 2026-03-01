const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new Database(dbPath);

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
      status TEXT
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
  `);

  // Seed default scopes if not already present
  seedDefaultScopes();

  // Add service column to vault_tokens if not already present (migration)
  try {
    db.exec('ALTER TABLE vault_tokens ADD COLUMN service TEXT');
  } catch (e) {
    // Column already exists — ignore
  }

  // Add allowed_personas column to access_tokens if not already present (migration)
  try {
    db.exec('ALTER TABLE access_tokens ADD COLUMN allowed_personas TEXT');
  } catch (e) {
    // Column already exists — ignore
  }

  console.log('Database initialized at:', dbPath);
}

// Vault Tokens
function createVaultToken(label, description, token, service) {
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

  const stmt = db.prepare(`
    INSERT INTO vault_tokens (id, label, description, encrypted_token, token_preview, created_at, updated_at, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, label, description || null, encrypted, tokenPreview, now, now, service || null);

  return {
    id,
    name: label,
    label,
    description,
    service: service || null,
    tokenPreview,
    createdAt: now,
  };
}

function getVaultTokens() {
  const stmt = db.prepare(`
    SELECT id, label, description, token_preview, service, created_at, updated_at
    FROM vault_tokens
    ORDER BY created_at DESC
  `);
  return stmt.all().map(row => ({
    id: row.id,
    name: row.label,
    label: row.label,
    description: row.description,
    service: row.service,
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
    { name: 'admin:*', category: 'admin', description: 'Full admin access (grants all scopes)' },
  ];

  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM scope_definitions');
  const result = checkStmt.get();
  
  if (result.count === 0) {
    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO scope_definitions (scope_name, description, category, permissions, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const scope of scopes) {
      insertStmt.run(scope.name, scope.description, scope.category, null, now);
    }
    console.log('Seeded default scopes');
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
    'read': ['identity:read', 'vault:read', 'services:read', 'brain:read', 'audit:read'],
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
function createUser(username, displayName, email, timezone, password) {
  const id = 'usr_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(`INSERT INTO users (id, username, display_name, email, timezone, password_hash, created_at, status) VALUES (?,?,?,?,?,?,?,?)`);
  stmt.run(id, username, displayName || null, email || null, timezone || null, hash, now, 'active');
  return { id, username, displayName, email, timezone, createdAt: now };
}

function getUsers() {
  const stmt = db.prepare('SELECT id, username, display_name as displayName, email, timezone, created_at as createdAt, status FROM users ORDER BY created_at DESC');
  return stmt.all();
}

function getUserByUsername(username) {
  const stmt = db.prepare('SELECT id, username, display_name as displayName, email, timezone, password_hash, created_at as createdAt, status FROM users WHERE username = ?');
  return stmt.get(username);
}

function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, display_name as displayName, email, timezone, created_at as createdAt, status FROM users WHERE id = ?');
  return stmt.get(id);
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
function createPersona(name, soulContent, description) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO personas (name, soul_content, description, active, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `);
  const result = stmt.run(name, soulContent, description || null, now, now);
  return {
    id: result.lastInsertRowid,
    name,
    soul_content: soulContent,
    description,
    active: false,
    created_at: now,
    updated_at: now
  };
}

function getPersonas() {
  const stmt = db.prepare(`
    SELECT id, name, soul_content, description, active, created_at, updated_at
    FROM personas
    ORDER BY created_at DESC
  `);
  return stmt.all().map(row => ({
    id: row.id,
    name: row.name,
    soul_content: row.soul_content,
    description: row.description,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

function getPersonaById(id) {
  const stmt = db.prepare(`
    SELECT id, name, soul_content, description, active, created_at, updated_at
    FROM personas
    WHERE id = ?
  `);
  const row = stmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    soul_content: row.soul_content,
    description: row.description,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function getActivePersona() {
  const stmt = db.prepare(`
    SELECT id, name, soul_content, description, active, created_at, updated_at
    FROM personas
    WHERE active = 1
    LIMIT 1
  `);
  const row = stmt.get();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    soul_content: row.soul_content,
    description: row.description,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function updatePersona(id, updates) {
  const persona = getPersonaById(id);
  if (!persona) return null;
  
  const now = new Date().toISOString();
  const name = updates.name !== undefined ? updates.name : persona.name;
  const soulContent = updates.soul_content !== undefined ? updates.soul_content : persona.soul_content;
  const description = updates.description !== undefined ? updates.description : persona.description;
  
  const stmt = db.prepare(`
    UPDATE personas
    SET name = ?, soul_content = ?, description = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(name, soulContent, description, now, id);
  
  return {
    id,
    name,
    soul_content: soulContent,
    description,
    active: persona.active,
    created_at: persona.created_at,
    updated_at: now
  };
}

function setActivePersona(id) {
  const persona = getPersonaById(id);
  if (!persona) return null;
  
  // Deactivate all other personas
  const deactivate = db.prepare('UPDATE personas SET active = 0 WHERE id != ?');
  deactivate.run(id);
  
  // Activate the selected persona
  const now = new Date().toISOString();
  const activate = db.prepare('UPDATE personas SET active = 1, updated_at = ? WHERE id = ?');
  activate.run(now, id);
  
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

function deletePersona(id) {
  // Check if this is the only persona
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM personas');
  const { count } = countStmt.get();
  if (count <= 1) return null; // Cannot delete the only persona
  
  const stmt = db.prepare('DELETE FROM personas WHERE id = ?');
  const result = stmt.run(id);
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
function addKBDocument(source, title, content, embeddingVector = null, metadata = null) {
  const id = 'kbdoc_' + crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO kb_documents (id, source, title, content, embedding_vector, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, source, title, content, embeddingVector, metadata ? JSON.stringify(metadata) : null, now);
  
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

function getKBDocuments() {
  const stmt = db.prepare(`
    SELECT id, source, title, metadata, created_at
    FROM kb_documents
    ORDER BY created_at DESC
  `);
  
  return stmt.all().map(row => ({
    id: row.id,
    source: row.source,
    title: row.title,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at
  }));
}

function getKBDocumentById(id) {
  const stmt = db.prepare(`
    SELECT * FROM kb_documents WHERE id = ?
  `);
  
  const row = stmt.get(id);
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

function deleteKBDocument(id) {
  const stmt = db.prepare('DELETE FROM kb_documents WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
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
  // Marketplace
  createMarketplaceListing,
  getMarketplaceListings,
  getMarketplaceListing,
  updateMarketplaceListing,
  removeMarketplaceListing,
  rateMarketplaceListing,
  incrementInstallCount,
  getMyMarketplaceListings,
};