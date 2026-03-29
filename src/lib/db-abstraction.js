/**
 * Database Abstraction Layer
 * Provides a unified interface for both SQLite (local) and PostgreSQL (external)
 * Routes database operations to the appropriate adapter based on configuration
 */

// Force IPv4 DNS resolution to prevent ECONNREFUSED on IPv6 Supabase endpoints
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

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
      max: 5,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
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

  /**
   * Synchronous prepare() shim for backward compatibility with SQLite-style code.
   * Uses deasync to block until the async pg query resolves.
   * Returns an object with .get(), .all(), .run(), .iterate() methods.
   */
  prepare(sql) {
    const deasync = require('deasync');
    const pool = this.pool;

    // Convert SQLite ? placeholders to PostgreSQL $1, $2, ...
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);

    const syncQuery = deasync(function (querySql, params, cb) {
      pool.query(querySql, params, (err, result) => cb(err, result));
    });

    return {
      get: (...args) => {
        const params = args.flat();
        try {
          const result = syncQuery(pgSql, params);
          return result.rows[0] || null;
        } catch (err) {
          console.error('[DB prepare.get]', err.message);
          return null;
        }
      },
      all: (...args) => {
        const params = args.flat();
        try {
          const result = syncQuery(pgSql, params);
          return result.rows || [];
        } catch (err) {
          console.error('[DB prepare.all]', err.message);
          return [];
        }
      },
      run: (...args) => {
        const params = args.flat();
        try {
          const result = syncQuery(pgSql, params);
          return { changes: result.rowCount, lastID: null };
        } catch (err) {
          console.error('[DB prepare.run]', err.message);
          return { changes: 0, lastID: null };
        }
      },
      iterate: (...args) => {
        const params = args.flat();
        try {
          const result = syncQuery(pgSql, params);
          return (result.rows || [])[Symbol.iterator]();
        } catch {
          return [][Symbol.iterator]();
        }
      }
    };
  }

  /**
   * exec() - runs raw SQL via the pool (returns a Promise for .catch() compatibility)
   * Also works synchronously via the deasync shim when awaited is not possible.
   */
  exec(sql) {
    // Return a real Promise so callers can do .catch() on it
    return this.pool.query(sql).catch(err => {
      console.error('[DB exec]', err.message);
    });
  }

  /**
   * SQLite pragma() shim - no-op for PostgreSQL
   */
  pragma() {
    return null;
  }

  /**
   * SQLite transaction() shim - wraps fn in BEGIN/COMMIT via deasync
   */
  transaction(fn) {
    // Override the async transaction() with a sync version for backward compat
    const deasync = require('deasync');
    const pool = this.pool;
    return function (...args) {
      let result;
      let done = false;
      let error;
      pool.connect().then(client => {
        client.query('BEGIN')
          .then(() => {
            try { result = fn(...args); } catch (e) { error = e; return client.query('ROLLBACK'); }
            return client.query('COMMIT');
          })
          .catch(e => { error = error || e; return client.query('ROLLBACK').catch(() => {}); })
          .finally(() => { client.release(); done = true; });
      }).catch(e => { error = e; done = true; });
      deasync.loopWhile(() => !done);
      if (error) throw error;
      return result;
    };
  }
}

// ============================================================================
// Factory Function - Creates appropriate adapter based on configuration
// ============================================================================

function createDatabaseAdapter() {
  const dbUrl = process.env.DATABASE_URL;
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'myapi.db');
  
  // Auto-detect database type from DATABASE_TYPE or DATABASE_URL
  let dbType = process.env.DATABASE_TYPE;
  if (!dbType && dbUrl) {
    // Auto-detect from DATABASE_URL
    dbType = dbUrl.includes('postgresql') || dbUrl.includes('postgres') ? 'postgresql' : 'sqlite';
  }
  dbType = dbType || 'sqlite'; // Final fallback to SQLite

  console.log(`[Database] Detected database type: ${dbType}`);
  if (dbUrl) {
    console.log(`[Database] Using DATABASE_URL: ${dbUrl.substring(0, 50)}...`);
  }

  if (dbType === 'postgres' || dbType === 'postgresql') {
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL mode');
    }
    return new PostgreSQLAdapter(dbUrl);
  } else if (dbType === 'sqlite') {
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
