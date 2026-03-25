/**
 * Backup Manager for MyApi
 * Automated database backup with scheduling, retention, and restore
 * Supports local storage and configurable backup strategies
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_BACKUP_DIR = path.join(__dirname, '../../backups');

class BackupManager {
  constructor(options = {}) {
    this.db = options.db || null;
    this.backupDir = options.backupDir || process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR;
    this.retentionDays = options.retentionDays || parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
    this.maxBackups = options.maxBackups || parseInt(process.env.BACKUP_MAX_COUNT || '50', 10);
    this.dbPath = options.dbPath || process.env.DB_PATH || path.join(__dirname, '../data/myapi.db');
    this._scheduleTimer = null;
  }

  /**
   * Initialize backup directory structure
   */
  init() {
    const dirs = [
      this.backupDir,
      path.join(this.backupDir, 'daily'),
      path.join(this.backupDir, 'manual'),
      path.join(this.backupDir, 'pre-deploy')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    console.log(`[Backup] Backup directory initialized: ${this.backupDir}`);
    return true;
  }

  /**
   * Create a database backup
   * Uses SQLite's backup API via file copy (WAL-safe with checkpoint)
   */
  createBackup(options = {}) {
    const {
      type = 'manual',
      label = '',
      compress = false
    } = options;

    this.init();

    const timestamp = new Date().toISOString()
      .replace(/[-:T]/g, '')
      .replace(/\..+/, '');

    const labelSuffix = label ? `_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    const filename = `myapi_backup_${timestamp}${labelSuffix}.db`;
    const subDir = type === 'daily' ? 'daily' : type === 'pre-deploy' ? 'pre-deploy' : 'manual';
    const backupPath = path.join(this.backupDir, subDir, filename);

    try {
      // Check source database exists
      if (!fs.existsSync(this.dbPath)) {
        return {
          success: false,
          error: `Source database not found: ${this.dbPath}`
        };
      }

      // Preferred: Use better-sqlite3's native backup API for a consistent
      // point-in-time snapshot that handles WAL properly.
      if (this.db && typeof this.db.backup === 'function') {
        this.db.backup(backupPath);
      } else {
        // Fallback: Force a WAL checkpoint then file copy.
        // This is less safe under concurrent writes but works when the
        // native backup API is unavailable (e.g., DB instance not provided).
        if (this.db) {
          try {
            this.db.pragma('wal_checkpoint(TRUNCATE)');
          } catch {
            // Non-fatal - proceed with copy
          }
        }
        fs.copyFileSync(this.dbPath, backupPath);
      }

      // Calculate checksum
      const hash = crypto.createHash('sha256');
      const fileBuffer = fs.readFileSync(backupPath);
      hash.update(fileBuffer);
      const checksum = hash.digest('hex');

      const stats = fs.statSync(backupPath);

      // Write metadata
      const metadata = {
        filename,
        path: backupPath,
        type,
        label: label || null,
        createdAt: new Date().toISOString(),
        sizeBytes: stats.size,
        checksum,
        sourceDb: this.dbPath,
        compressed: compress
      };

      const metaPath = backupPath + '.meta.json';
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

      console.log(`[Backup] Created: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

      return { success: true, ...metadata };
    } catch (error) {
      console.error(`[Backup] Failed to create backup:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore from a backup file
   */
  restoreBackup(backupPath, options = {}) {
    const { createPreRestoreBackup = true, verify = true } = options;

    try {
      if (!fs.existsSync(backupPath)) {
        return { success: false, error: `Backup file not found: ${backupPath}` };
      }

      // Verify checksum if metadata exists
      if (verify) {
        const metaPath = backupPath + '.meta.json';
        if (fs.existsSync(metaPath)) {
          const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          const hash = crypto.createHash('sha256');
          hash.update(fs.readFileSync(backupPath));
          const actualChecksum = hash.digest('hex');

          if (metadata.checksum && metadata.checksum !== actualChecksum) {
            return {
              success: false,
              error: 'Checksum mismatch — backup file may be corrupted',
              expected: metadata.checksum,
              actual: actualChecksum
            };
          }
        }
      }

      // Create pre-restore backup
      if (createPreRestoreBackup && fs.existsSync(this.dbPath)) {
        console.log('[Backup] Creating pre-restore safety backup...');
        const safetyBackup = this.createBackup({
          type: 'manual',
          label: 'pre_restore'
        });
        if (!safetyBackup.success) {
          console.warn('[Backup] Warning: Could not create pre-restore backup');
        }
      }

      // Close any existing connection
      if (this.db) {
        try {
          this.db.pragma('wal_checkpoint(TRUNCATE)');
        } catch {
          // Non-fatal
        }
      }

      // Perform restore
      fs.copyFileSync(backupPath, this.dbPath);

      const stats = fs.statSync(this.dbPath);
      console.log(`[Backup] Restored from: ${path.basename(backupPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

      return {
        success: true,
        restoredFrom: backupPath,
        restoredAt: new Date().toISOString(),
        sizeBytes: stats.size,
        note: 'Database connection must be re-established after restore'
      };
    } catch (error) {
      console.error(`[Backup] Failed to restore:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all backups with metadata
   */
  listBackups(options = {}) {
    const { type, limit = 50 } = options;

    this.init();

    const backups = [];
    const subdirs = type ? [type] : ['daily', 'manual', 'pre-deploy'];

    for (const subdir of subdirs) {
      const dir = path.join(this.backupDir, subdir);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.db'))
        .sort()
        .reverse();

      for (const file of files) {
        const filePath = path.join(dir, file);
        const metaPath = filePath + '.meta.json';
        const stats = fs.statSync(filePath);

        let metadata = {};
        if (fs.existsSync(metaPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          } catch {
            // Ignore metadata parse errors
          }
        }

        backups.push({
          filename: file,
          path: filePath,
          type: subdir,
          sizeBytes: stats.size,
          sizeMB: (stats.size / 1024 / 1024).toFixed(2),
          createdAt: metadata.createdAt || stats.mtime.toISOString(),
          checksum: metadata.checksum || null,
          label: metadata.label || null
        });
      }
    }

    // Sort by creation time, newest first
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return backups.slice(0, limit);
  }

  /**
   * Delete a specific backup
   */
  deleteBackup(backupPath) {
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        // Also delete metadata
        const metaPath = backupPath + '.meta.json';
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
        console.log(`[Backup] Deleted: ${path.basename(backupPath)}`);
        return { success: true };
      }
      return { success: false, error: 'Backup file not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply retention policy — remove old backups
   */
  applyRetention() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const allBackups = this.listBackups({ limit: 1000 });
    let removed = 0;

    // Group by type
    const byType = {};
    for (const backup of allBackups) {
      if (!byType[backup.type]) byType[backup.type] = [];
      byType[backup.type].push(backup);
    }

    for (const [type, backups] of Object.entries(byType)) {
      // Remove old backups beyond retention period
      for (const backup of backups) {
        const backupDate = new Date(backup.createdAt);
        if (backupDate < cutoffDate) {
          this.deleteBackup(backup.path);
          removed++;
        }
      }

      // Enforce max count per type
      const typeMax = Math.ceil(this.maxBackups / 3);
      if (backups.length > typeMax) {
        const toRemove = backups.slice(typeMax);
        for (const backup of toRemove) {
          if (!this.deleteBackup(backup.path).success) continue;
          removed++;
        }
      }
    }

    if (removed > 0) {
      console.log(`[Backup] Retention: removed ${removed} old backup(s)`);
    }

    return { removed, retentionDays: this.retentionDays };
  }

  /**
   * Verify a backup file integrity
   */
  verifyBackup(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        return { valid: false, error: 'File not found' };
      }

      const stats = fs.statSync(backupPath);
      if (stats.size === 0) {
        return { valid: false, error: 'Empty backup file' };
      }

      // Check SQLite magic bytes
      const fd = fs.openSync(backupPath, 'r');
      const header = Buffer.alloc(16);
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);

      const sqliteHeader = 'SQLite format 3';
      const isSQLite = header.toString('utf8', 0, 15) === sqliteHeader;

      if (!isSQLite) {
        return { valid: false, error: 'Not a valid SQLite database file' };
      }

      // Verify checksum if metadata exists
      const metaPath = backupPath + '.meta.json';
      let checksumValid = null;
      if (fs.existsSync(metaPath)) {
        const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (metadata.checksum) {
          const hash = crypto.createHash('sha256');
          hash.update(fs.readFileSync(backupPath));
          checksumValid = hash.digest('hex') === metadata.checksum;
        }
      }

      return {
        valid: true,
        sizeBytes: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        isSQLite: true,
        checksumValid
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Start scheduled backups
   */
  startSchedule(intervalHours = 24) {
    if (this._scheduleTimer) {
      this.stopSchedule();
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;

    this._scheduleTimer = setInterval(() => {
      console.log('[Backup] Running scheduled backup...');
      const result = this.createBackup({ type: 'daily', label: 'scheduled' });
      if (result.success) {
        this.applyRetention();
      }
    }, intervalMs);

    console.log(`[Backup] Scheduled backups every ${intervalHours} hours`);
  }

  /**
   * Stop scheduled backups
   */
  stopSchedule() {
    if (this._scheduleTimer) {
      clearInterval(this._scheduleTimer);
      this._scheduleTimer = null;
    }
  }

  /**
   * Get backup system status summary
   */
  getStatus() {
    const backups = this.listBackups({ limit: 1000 });
    const totalSize = backups.reduce((sum, b) => sum + b.sizeBytes, 0);

    return {
      backupDir: this.backupDir,
      retentionDays: this.retentionDays,
      maxBackups: this.maxBackups,
      totalBackups: backups.length,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      latestBackup: backups.length > 0 ? backups[0] : null,
      byType: {
        daily: backups.filter(b => b.type === 'daily').length,
        manual: backups.filter(b => b.type === 'manual').length,
        preDeploy: backups.filter(b => b.type === 'pre-deploy').length
      },
      scheduled: !!this._scheduleTimer
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopSchedule();
  }
}

module.exports = BackupManager;
