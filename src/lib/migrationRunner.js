const fs = require('fs');
const path = require('path');

/**
 * Migration Runner for MyApi Database
 * Tracks and applies database migrations in order
 */
class MigrationRunner {
  constructor(db) {
    this.db = db;
    this.migrationsPath = path.join(__dirname, '../migrations');
  }

  /**
   * Initialize migration tracking table
   */
  initMigrationTable() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL UNIQUE,
          executed_at TEXT NOT NULL
        );
      `);
    } catch (error) {
      console.error('[Migration] Error initializing migration table:', error.message);
      throw error;
    }
  }

  /**
   * Get list of applied migrations
   */
  getAppliedMigrations() {
    try {
      const stmt = this.db.prepare(`
        SELECT filename FROM migrations ORDER BY id ASC
      `);
      return stmt.all().map(row => row.filename);
    } catch (error) {
      console.error('[Migration] Error reading applied migrations:', error.message);
      return [];
    }
  }

  /**
   * Get list of pending migrations
   */
  getPendingMigrations() {
    try {
      const migrationFiles = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      const applied = this.getAppliedMigrations();
      return migrationFiles.filter(file => !applied.includes(file));
    } catch (error) {
      console.error('[Migration] Error reading migration files:', error.message);
      return [];
    }
  }

  /**
   * Run all pending migrations
   */
  runPendingMigrations() {
    const pending = this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('[Migration] No pending migrations');
      return {
        success: true,
        applied: [],
        message: 'No pending migrations'
      };
    }

    const applied = [];
    const failed = [];

    for (const filename of pending) {
      try {
        const filePath = path.join(this.migrationsPath, filename);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Execute migration
        this.db.exec(sql);

        // Track migration
        const stmt = this.db.prepare(`
          INSERT INTO migrations (filename, executed_at)
          VALUES (?, ?)
        `);
        stmt.run(filename, new Date().toISOString());

        applied.push(filename);
        console.log(`[Migration] Applied: ${filename}`);
      } catch (error) {
        console.error(`[Migration] Failed to apply ${filename}:`, error.message);
        failed.push({
          filename,
          error: error.message
        });
      }
    }

    return {
      success: failed.length === 0,
      applied,
      failed,
      message: `Applied ${applied.length} migration(s)${failed.length > 0 ? `, ${failed.length} failed` : ''}`
    };
  }

  /**
   * Get migration status
   */
  getStatus() {
    return {
      applied: this.getAppliedMigrations(),
      pending: this.getPendingMigrations()
    };
  }

  /**
   * Check if specific migration is applied
   */
  isMigrationApplied(filename) {
    return this.getAppliedMigrations().includes(filename);
  }
}

module.exports = MigrationRunner;
