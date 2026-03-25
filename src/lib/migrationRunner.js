const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Migration Runner for MyApi Database
 * Tracks and applies database migrations in order
 * Supports rollback, checksums, and batch operations
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
          executed_at TEXT NOT NULL,
          checksum TEXT,
          batch INTEGER DEFAULT 1,
          rolled_back_at TEXT
        );
      `);
    } catch (error) {
      console.error('[Migration] Error initializing migration table:', error.message);
      throw error;
    }
  }

  /**
   * Get list of applied migrations (not rolled back)
   */
  getAppliedMigrations() {
    try {
      const stmt = this.db.prepare(`
        SELECT filename FROM migrations
        WHERE rolled_back_at IS NULL
        ORDER BY id ASC
      `);
      return stmt.all().map(row => row.filename);
    } catch (error) {
      console.error('[Migration] Error reading applied migrations:', error.message);
      return [];
    }
  }

  /**
   * Get detailed migration records
   */
  getAppliedMigrationDetails() {
    try {
      const stmt = this.db.prepare(`
        SELECT id, filename, executed_at, checksum, batch, rolled_back_at
        FROM migrations
        ORDER BY id ASC
      `);
      return stmt.all();
    } catch (error) {
      console.error('[Migration] Error reading migration details:', error.message);
      return [];
    }
  }

  /**
   * Get list of pending migrations
   */
  getPendingMigrations() {
    try {
      if (!fs.existsSync(this.migrationsPath)) {
        return [];
      }

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
   * Calculate checksum for a migration file
   */
  _checksum(content) {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Get the current batch number
   */
  _getCurrentBatch() {
    try {
      const stmt = this.db.prepare(`
        SELECT MAX(batch) as maxBatch FROM migrations WHERE rolled_back_at IS NULL
      `);
      const row = stmt.get();
      return (row && row.maxBatch) || 0;
    } catch {
      return 0;
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

    const batch = this._getCurrentBatch() + 1;
    const applied = [];
    const failed = [];

    for (const filename of pending) {
      try {
        const filePath = path.join(this.migrationsPath, filename);
        const sql = fs.readFileSync(filePath, 'utf8');
        const checksum = this._checksum(sql);

        // Execute migration in a transaction
        const runInTransaction = this.db.transaction(() => {
          this.db.exec(sql);

          const stmt = this.db.prepare(`
            INSERT INTO migrations (filename, executed_at, checksum, batch)
            VALUES (?, ?, ?, ?)
          `);
          stmt.run(filename, new Date().toISOString(), checksum, batch);
        });

        runInTransaction();
        applied.push(filename);
        console.log(`[Migration] Applied: ${filename} (batch ${batch})`);
      } catch (error) {
        console.error(`[Migration] Failed to apply ${filename}:`, error.message);
        failed.push({
          filename,
          error: error.message
        });
        // Stop on first failure to maintain consistency
        break;
      }
    }

    return {
      success: failed.length === 0,
      applied,
      failed,
      batch,
      message: `Applied ${applied.length} migration(s) in batch ${batch}${failed.length > 0 ? `, ${failed.length} failed` : ''}`
    };
  }

  /**
   * Run a single migration by filename
   */
  runMigration(filename) {
    const filePath = path.join(this.migrationsPath, filename);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Migration file not found: ${filename}` };
    }

    if (this.isMigrationApplied(filename)) {
      return { success: false, error: `Migration already applied: ${filename}` };
    }

    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = this._checksum(sql);
      const batch = this._getCurrentBatch() + 1;

      const runInTransaction = this.db.transaction(() => {
        this.db.exec(sql);

        const stmt = this.db.prepare(`
          INSERT INTO migrations (filename, executed_at, checksum, batch)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(filename, new Date().toISOString(), checksum, batch);
      });

      runInTransaction();
      console.log(`[Migration] Applied: ${filename} (batch ${batch})`);

      return { success: true, filename, batch };
    } catch (error) {
      console.error(`[Migration] Failed to apply ${filename}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rollback the last batch of migrations
   * Looks for corresponding .down.sql files
   */
  rollbackLastBatch() {
    const batch = this._getCurrentBatch();
    if (batch === 0) {
      return { success: true, rolledBack: [], message: 'No migrations to rollback' };
    }

    return this.rollbackBatch(batch);
  }

  /**
   * Rollback a specific batch
   */
  rollbackBatch(batch) {
    try {
      const stmt = this.db.prepare(`
        SELECT filename FROM migrations
        WHERE batch = ? AND rolled_back_at IS NULL
        ORDER BY id DESC
      `);
      const migrations = stmt.all();

      if (migrations.length === 0) {
        return { success: true, rolledBack: [], message: `No migrations in batch ${batch}` };
      }

      const rolledBack = [];
      const failed = [];

      for (const { filename } of migrations) {
        // Look for down migration file
        const downFile = filename.replace('.sql', '.down.sql');
        const downPath = path.join(this.migrationsPath, downFile);

        try {
          if (fs.existsSync(downPath)) {
            const downSql = fs.readFileSync(downPath, 'utf8');

            const runRollback = this.db.transaction(() => {
              this.db.exec(downSql);

              const updateStmt = this.db.prepare(`
                UPDATE migrations SET rolled_back_at = ? WHERE filename = ?
              `);
              updateStmt.run(new Date().toISOString(), filename);
            });

            runRollback();
            console.log(`[Migration] Rolled back: ${filename}`);
          } else {
            // No down file — just mark as rolled back
            const updateStmt = this.db.prepare(`
              UPDATE migrations SET rolled_back_at = ? WHERE filename = ?
            `);
            updateStmt.run(new Date().toISOString(), filename);
            console.warn(`[Migration] No rollback file for ${filename}, marked as rolled back`);
          }

          rolledBack.push(filename);
        } catch (error) {
          console.error(`[Migration] Failed to rollback ${filename}:`, error.message);
          failed.push({ filename, error: error.message });
          break;
        }
      }

      return {
        success: failed.length === 0,
        rolledBack,
        failed,
        batch,
        message: `Rolled back ${rolledBack.length} migration(s) from batch ${batch}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify migration checksums match the files on disk
   */
  verifyChecksums() {
    const details = this.getAppliedMigrationDetails();
    const results = [];

    for (const migration of details) {
      if (migration.rolled_back_at) continue;

      const filePath = path.join(this.migrationsPath, migration.filename);
      if (!fs.existsSync(filePath)) {
        results.push({
          filename: migration.filename,
          status: 'missing',
          message: 'Migration file not found on disk'
        });
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = this._checksum(content);

      if (migration.checksum && migration.checksum !== currentChecksum) {
        results.push({
          filename: migration.filename,
          status: 'modified',
          expected: migration.checksum,
          actual: currentChecksum
        });
      } else {
        results.push({
          filename: migration.filename,
          status: 'ok'
        });
      }
    }

    return results;
  }

  /**
   * Get migration status
   */
  getStatus() {
    return {
      applied: this.getAppliedMigrations(),
      pending: this.getPendingMigrations(),
      details: this.getAppliedMigrationDetails(),
      currentBatch: this._getCurrentBatch()
    };
  }

  /**
   * Check if specific migration is applied
   */
  isMigrationApplied(filename) {
    return this.getAppliedMigrations().includes(filename);
  }

  /**
   * Create a new migration file with timestamp prefix
   */
  static createMigrationFile(migrationsPath, name) {
    if (!fs.existsSync(migrationsPath)) {
      fs.mkdirSync(migrationsPath, { recursive: true });
    }

    const timestamp = new Date().toISOString()
      .replace(/[-:T]/g, '')
      .replace(/\..+/, '')
      .substring(0, 14);

    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const upFile = `${timestamp}_${safeName}.sql`;
    const downFile = `${timestamp}_${safeName}.down.sql`;

    const upPath = path.join(migrationsPath, upFile);
    const downPath = path.join(migrationsPath, downFile);

    fs.writeFileSync(upPath, `-- Migration: ${name}\n-- Created: ${new Date().toISOString()}\n\n-- Add your SQL here\n`);
    fs.writeFileSync(downPath, `-- Rollback: ${name}\n-- Created: ${new Date().toISOString()}\n\n-- Add your rollback SQL here\n`);

    return { upFile, downFile, upPath, downPath };
  }
}

module.exports = MigrationRunner;
