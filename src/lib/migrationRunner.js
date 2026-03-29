const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Migration Runner for MyApi Database
 * Tracks and applies database migrations in order.
 * Supports SQLite (sync via better-sqlite3) and PostgreSQL (async via pg).
 */
class MigrationRunner {
  constructor(db) {
    this.db = db;
    this.migrationsPath = path.join(__dirname, '../migrations');
    // Detect PostgreSQL by presence of connection pool
    this.isPostgres = !!db.pool;
  }

  /**
   * Convert ? placeholders to $1, $2, ... for PostgreSQL
   */
  _pgParams(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  /**
   * Convert SQLite-specific SQL syntax to PostgreSQL
   */
  _pgSql(sql) {
    return sql
      .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY')
      .replace(/\bAUTOINCREMENT\b/gi, '');
  }

  /**
   * Initialize migration tracking table
   */
  async initMigrationTable() {
    if (this.isPostgres) {
      // Create table if not exists (minimal schema for compatibility)
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id BIGSERIAL PRIMARY KEY,
          filename TEXT NOT NULL UNIQUE,
          executed_at TEXT NOT NULL
        )
      `, []);
      // Add optional columns if they were added later (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
      const optionalCols = [
        `ALTER TABLE migrations ADD COLUMN IF NOT EXISTS checksum TEXT`,
        `ALTER TABLE migrations ADD COLUMN IF NOT EXISTS batch INTEGER DEFAULT 1`,
        `ALTER TABLE migrations ADD COLUMN IF NOT EXISTS rolled_back_at TEXT`,
      ];
      for (const sql of optionalCols) {
        await this.db.run(sql, []);
      }
    } else {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL UNIQUE,
          executed_at TEXT NOT NULL,
          checksum TEXT,
          batch INTEGER DEFAULT 1,
          rolled_back_at TEXT
        )
      `);
    }
  }

  /**
   * Get list of applied migrations (not rolled back)
   */
  async getAppliedMigrations() {
    try {
      if (this.isPostgres) {
        const rows = await this.db.all(
          'SELECT filename FROM migrations WHERE rolled_back_at IS NULL ORDER BY id ASC',
          []
        );
        return rows.map(row => row.filename);
      } else {
        const stmt = this.db.prepare(
          'SELECT filename FROM migrations WHERE rolled_back_at IS NULL ORDER BY id ASC'
        );
        return stmt.all().map(row => row.filename);
      }
    } catch (error) {
      console.error('[Migration] Error reading applied migrations:', error.message);
      return [];
    }
  }

  /**
   * Get detailed migration records
   */
  async getAppliedMigrationDetails() {
    try {
      const sql = 'SELECT id, filename, executed_at, checksum, batch, rolled_back_at FROM migrations ORDER BY id ASC';
      if (this.isPostgres) {
        return await this.db.all(sql, []);
      } else {
        return this.db.prepare(sql).all();
      }
    } catch (error) {
      console.error('[Migration] Error reading migration details:', error.message);
      return [];
    }
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations() {
    try {
      if (!fs.existsSync(this.migrationsPath)) {
        return [];
      }

      const migrationFiles = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql') && !file.endsWith('.down.sql'))
        .sort();

      const applied = await this.getAppliedMigrations();
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
  async _getCurrentBatch() {
    try {
      const sql = 'SELECT MAX(batch) as "maxBatch" FROM migrations WHERE rolled_back_at IS NULL';
      let row;
      if (this.isPostgres) {
        row = await this.db.get(sql, []);
      } else {
        row = this.db.prepare(sql).get();
      }
      return (row && row.maxBatch) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations() {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('[Migration] No pending migrations');
      return { success: true, applied: [], message: 'No pending migrations' };
    }

    const batch = (await this._getCurrentBatch()) + 1;
    const applied = [];
    const failed = [];

    for (const filename of pending) {
      try {
        const filePath = path.join(this.migrationsPath, filename);
        let sql = fs.readFileSync(filePath, 'utf8');
        const checksum = this._checksum(sql);

        if (this.isPostgres) {
          sql = this._pgSql(sql);
          const client = await this.db.pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(sql);
            // Safe insert — check first to avoid duplicate key if filename already recorded
            const check = await client.query('SELECT 1 FROM migrations WHERE filename = $1', [filename]);
            if (check.rows.length === 0) {
              await client.query(
                'INSERT INTO migrations (filename, executed_at, checksum, batch) VALUES ($1, $2, $3, $4)',
                [filename, new Date().toISOString(), checksum, batch]
              );
            }
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            // If migration SQL failed due to objects already existing, mark as applied anyway
            const alreadyExists = err.message && (
              err.message.includes('already exists') ||
              err.message.includes('duplicate key') ||
              err.message.includes('already been done')
            );
            if (alreadyExists) {
              console.warn(`[Migration] ${filename} partially applied, marking as done: ${err.message.split('\n')[0]}`);
              // Use safe INSERT that doesn't require a UNIQUE constraint
              const rows = await this.db.all(
                'SELECT 1 FROM migrations WHERE filename = $1',
                [filename]
              );
              if (rows.length === 0) {
                await this.db.run(
                  'INSERT INTO migrations (filename, executed_at, checksum, batch) VALUES ($1, $2, $3, $4)',
                  [filename, new Date().toISOString(), checksum, batch]
                );
              }
            } else {
              throw err;
            }
          } finally {
            client.release();
          }
        } else {
          // SQLite: synchronous transaction via raw better-sqlite3 API
          const rawDb = this.db.getRawDB ? this.db.getRawDB() : this.db;
          rawDb.transaction(() => {
            rawDb.exec(sql);
            rawDb.prepare(
              'INSERT INTO migrations (filename, executed_at, checksum, batch) VALUES (?, ?, ?, ?)'
            ).run(filename, new Date().toISOString(), checksum, batch);
          })();
        }

        applied.push(filename);
        console.log(`[Migration] Applied: ${filename} (batch ${batch})`);
      } catch (error) {
        console.error(`[Migration] Failed to apply ${filename}:`, error.message);
        failed.push({ filename, error: error.message });
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
  async runMigration(filename) {
    const filePath = path.join(this.migrationsPath, filename);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Migration file not found: ${filename}` };
    }

    if (await this.isMigrationApplied(filename)) {
      return { success: false, error: `Migration already applied: ${filename}` };
    }

    try {
      let sql = fs.readFileSync(filePath, 'utf8');
      const checksum = this._checksum(sql);
      const batch = (await this._getCurrentBatch()) + 1;

      if (this.isPostgres) {
        sql = this._pgSql(sql);
        const client = await this.db.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            'INSERT INTO migrations (filename, executed_at, checksum, batch) VALUES ($1, $2, $3, $4)',
            [filename, new Date().toISOString(), checksum, batch]
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        const runInTransaction = this.db.transaction(() => {
          this.db.exec(sql);
          this.db.prepare(
            'INSERT INTO migrations (filename, executed_at, checksum, batch) VALUES (?, ?, ?, ?)'
          ).run(filename, new Date().toISOString(), checksum, batch);
        });
        runInTransaction();
      }

      console.log(`[Migration] Applied: ${filename} (batch ${batch})`);
      return { success: true, filename, batch };
    } catch (error) {
      console.error(`[Migration] Failed to apply ${filename}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rollback the last batch of migrations
   */
  async rollbackLastBatch() {
    const batch = await this._getCurrentBatch();
    if (batch === 0) {
      return { success: true, rolledBack: [], message: 'No migrations to rollback' };
    }
    return this.rollbackBatch(batch);
  }

  /**
   * Rollback a specific batch
   */
  async rollbackBatch(batch) {
    try {
      const sql = 'SELECT filename FROM migrations WHERE batch = ? AND rolled_back_at IS NULL ORDER BY id DESC';
      let migrations;
      if (this.isPostgres) {
        migrations = await this.db.all(this._pgParams(sql), [batch]);
      } else {
        migrations = this.db.prepare(sql).all(batch);
      }

      if (migrations.length === 0) {
        return { success: true, rolledBack: [], message: `No migrations in batch ${batch}` };
      }

      const rolledBack = [];
      const failed = [];

      for (const { filename } of migrations) {
        const downFile = filename.replace('.sql', '.down.sql');
        const downPath = path.join(this.migrationsPath, downFile);

        try {
          const updateSql = 'UPDATE migrations SET rolled_back_at = ? WHERE filename = ?';

          if (fs.existsSync(downPath)) {
            let downSql = fs.readFileSync(downPath, 'utf8');

            if (this.isPostgres) {
              downSql = this._pgSql(downSql);
              const client = await this.db.pool.connect();
              try {
                await client.query('BEGIN');
                await client.query(downSql);
                await client.query(
                  this._pgParams(updateSql),
                  [new Date().toISOString(), filename]
                );
                await client.query('COMMIT');
              } catch (err) {
                await client.query('ROLLBACK');
                throw err;
              } finally {
                client.release();
              }
            } else {
              const runRollback = this.db.transaction(() => {
                this.db.exec(downSql);
                this.db.prepare(updateSql).run(new Date().toISOString(), filename);
              });
              runRollback();
            }
          } else {
            if (this.isPostgres) {
              await this.db.run(this._pgParams(updateSql), [new Date().toISOString(), filename]);
            } else {
              this.db.prepare(updateSql).run(new Date().toISOString(), filename);
            }
            console.warn(`[Migration] No rollback file for ${filename}, marked as rolled back`);
          }

          console.log(`[Migration] Rolled back: ${filename}`);
          rolledBack.push(filename);
        } catch (error) {
          console.error(`[Migration] Failed to rollback ${filename}:`, error.message);
          failed.push({ filename, error: error.message });
          break;
        }
      }

      return {
        success: failed.length === 0,
        rolledBack, failed, batch,
        message: `Rolled back ${rolledBack.length} migration(s) from batch ${batch}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify migration checksums match the files on disk
   */
  async verifyChecksums() {
    const details = await this.getAppliedMigrationDetails();
    const results = [];

    for (const migration of details) {
      if (migration.rolled_back_at) continue;

      const filePath = path.join(this.migrationsPath, migration.filename);
      if (!fs.existsSync(filePath)) {
        results.push({ filename: migration.filename, status: 'missing', message: 'Migration file not found on disk' });
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = this._checksum(content);

      if (migration.checksum && migration.checksum !== currentChecksum) {
        results.push({ filename: migration.filename, status: 'modified', expected: migration.checksum, actual: currentChecksum });
      } else {
        results.push({ filename: migration.filename, status: 'ok' });
      }
    }

    return results;
  }

  /**
   * Get migration status
   */
  async getStatus() {
    return {
      applied: await this.getAppliedMigrations(),
      pending: await this.getPendingMigrations(),
      details: await this.getAppliedMigrationDetails(),
      currentBatch: await this._getCurrentBatch()
    };
  }

  /**
   * Check if specific migration is applied
   */
  async isMigrationApplied(filename) {
    const applied = await this.getAppliedMigrations();
    return applied.includes(filename);
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
