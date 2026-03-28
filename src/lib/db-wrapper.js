/**
 * Database Wrapper
 * Provides helper functions to work with the abstraction layer
 * Acts as a bridge between old synchronous SQLite code and new async abstraction
 */

const { getDatabase } = require('./db-abstraction');

// ============================================================================
// Synchronous-style Wrapper (for backward compatibility with existing code)
// ============================================================================

class DatabaseWrapper {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Prepare and get all rows (wrapper for sync code)
   * For NEW code, use async methods instead
   * @deprecated - Use db.all() with await instead
   */
  prepareAll(sql, params = []) {
    // This is a placeholder for sync code
    // In real migration, we'll convert to async
    const stmt = { all: () => [], get: () => null };
    return stmt;
  }

  /**
   * Execute all rows - async version
   * @param {string} sql - SQL query
   * @param {array} params - Parameters
   * @returns {Promise<array>}
   */
  async all(sql, params = []) {
    return this.db.all(sql, params);
  }

  /**
   * Execute and get first row - async version
   * @param {string} sql - SQL query
   * @param {array} params - Parameters
   * @returns {Promise<object|null>}
   */
  async get(sql, params = []) {
    return this.db.get(sql, params);
  }

  /**
   * Execute insert/update/delete - async version
   * @param {string} sql - SQL query
   * @param {array} params - Parameters
   * @returns {Promise<object>}
   */
  async run(sql, params = []) {
    return this.db.run(sql, params);
  }

  /**
   * Execute transaction - async version
   * @param {Function} fn - Async function with database operations
   * @returns {Promise}
   */
  async transaction(fn) {
    return this.db.transaction(fn);
  }

  /**
   * Ping database connection
   * @returns {Promise<boolean>}
   */
  async ping() {
    return this.db.ping();
  }

  /**
   * Close database connection
   * @returns {Promise}
   */
  async close() {
    return this.db.close();
  }
}

// ============================================================================
// Exported singleton
// ============================================================================

const dbWrapper = new DatabaseWrapper();

module.exports = dbWrapper;
module.exports.DatabaseWrapper = DatabaseWrapper;
