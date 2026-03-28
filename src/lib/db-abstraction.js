/**
 * Database Abstraction Layer
 * Provides a unified interface for both SQLite (local) and PostgreSQL (external)
 * Routes database operations to the appropriate adapter based on configuration
 */

const path = require('path');
const fs = require('fs');

// ============================================================================
// Database Adapter Interface
// ============================================================================

class DatabaseAdapter {
  /**
   * Execute a query and return all rows
   * @param {string} sql - SQL query
   * @param {array} params - Query parameters
   * @returns {Promise<array>} - Array of rows
   */
  async all(sql, params = []) {
    throw new Error('all() not implemented');
  }

  /**
   * Execute a query and return first row
   * @param {string} sql - SQL query
   * @param {array} params - Query parameters
   * @returns {Promise<object>} - Single row or null
   */
  async get(sql, params = []) {
    throw new Error('get() not implemented');
  }

  /**
   * Execute a query (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL query
   * @param {array} params - Query parameters
   * @returns {Promise<object>} - Result with lastID and changes
   */
  async run(sql, params = []) {
    throw new Error('run() not implemented');
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Function} fn - Async function that executes queries
   * @returns {Promise<any>} - Result from fn
   */
  async transaction(fn) {
    throw new Error('transaction() not implemented');
  }

  /**
   * Check if database is healthy
   * @returns {Promise<boolean>}
   */
  async ping() {
    throw new Error('ping() not implemented');
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() not implemented');
  }
}

// ============================================================================
// SQLite Adapter (Local Database)
// ============================================================================

class SQLiteAdapter extends DatabaseAdapter {
  constructor(dbPath) {
    super();
    const Database = require('better-sqlite3');
    
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 10000');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('wal_autocheckpoint = 1000');
    
    console.log('[Database] SQLite initialized:', dbPath);
  }

  // ---- Async API (for abstraction layer) ----

  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return Promise.resolve(stmt.all(...params));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return Promise.resolve(stmt.get(...params) || null);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return Promise.resolve({
        lastID: result.lastInsertRowid,
        changes: result.changes
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  transaction(fn) {
    try {
      const result = this.db.transaction(fn)();
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async ping() {
    try {
      await this.get('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  close() {
    this.db.close();
    return Promise.resolve();
  }

  // ---- Synchronous API (for backward compatibility with existing code) ----

  /**
   * Get the underlying better-sqlite3 database instance
   * for backward compatibility with existing code
   */
  getRawDB() {
    return this.db;
  }

  /**
   * Prepare a statement (sync) - for backward compatibility
   */
  prepare(sql) {
    return this.db.prepare(sql);
  }

  /**
   * Execute pragma (sync) - for backward compatibility
   */
  pragma(sql) {
    return this.db.pragma(sql);
  }

  /**
   * Execute multiple statements (sync) - for backward compatibility
   */
  exec(sql) {
    return this.db.exec(sql);
  }
}

// ============================================================================
// PostgreSQL Adapter (External Database via Supabase)
// ============================================================================

class PostgreSQLAdapter extends DatabaseAdapter {
  constructor(connectionString) {
    super();
    const { Pool } = require('pg');
    
    this.pool = new Pool({
      connectionString: connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('[Database] PostgreSQL pool error:', err);
    });

    console.log('[Database] PostgreSQL initialized via Supabase');
  }

  async all(sql, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async get(sql, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async run(sql, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return {
        lastID: null, // PostgreSQL doesn't return lastID the same way
        changes: result.rowCount
      };
    } finally {
      client.release();
    }
  }

  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async ping() {
    try {
      await this.get('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}

// ============================================================================
// Factory Function - Creates appropriate adapter based on configuration
// ============================================================================

function createDatabaseAdapter() {
  const dbType = process.env.DATABASE_TYPE || 'sqlite';
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'myapi.db');
  const dbUrl = process.env.DATABASE_URL;

  console.log(`[Database] Detected database type: ${dbType}`);

  if (dbType === 'postgres' || dbType === 'postgresql') {
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL mode');
    }
    return new PostgreSQLAdapter(dbUrl);
  } else if (dbType === 'sqlite' || !dbType) {
    return new SQLiteAdapter(dbPath);
  } else {
    throw new Error(`Unsupported database type: ${dbType}`);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = createDatabaseAdapter();
  }
  return dbInstance;
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
  DatabaseAdapter,
  SQLiteAdapter,
  PostgreSQLAdapter,
  createDatabaseAdapter,
  getDatabase
};
