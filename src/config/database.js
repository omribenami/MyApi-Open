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
  
  return db;
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

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_token ON audit_log(token_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(type);
    CREATE INDEX IF NOT EXISTS idx_identity_category ON identity_vault(category);
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
