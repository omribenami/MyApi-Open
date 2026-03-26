/**
 * Backup & Restore Routes
 * Provides API endpoints for database backup management
 * Requires admin authentication
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const BackupManager = require('../lib/backup-manager');

/**
 * Backup Routes Factory
 * @param {Object} db - Database instance
 * @returns {Router} Express router
 */
function createBackupRoutes(db) {
  // Initialize backup manager with the database instance
  const manager = new BackupManager({
    db: db.db || db,
    dbPath: process.env.DB_PATH || path.join(__dirname, '../data/myapi.db')
  });

  // Security: All backup operations require admin authentication
  router.use((req, res, next) => {
    const scope = String(req.tokenMeta?.scope || req.tokenData?.scope || '');
    const isSession = req.session?.user?.id;
    if (!isSession && !scope) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (scope && scope !== 'full' && !scope.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required for backup operations' });
    }
    next();
  });

  /**
   * GET /backups/status
   * Get backup system status
   */
  router.get('/status', (req, res) => {
    try {
      const status = manager.getStatus();
      res.json({ status: 'success', ...status });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get backup status'
      });
    }
  });

  /**
   * POST /backups/create
   * Create a new backup
   * Body: { type?: string, label?: string }
   */
  router.post('/create', (req, res) => {
    try {
      const { type = 'manual', label = '' } = req.body || {};

      const allowedTypes = ['daily', 'manual', 'pre-deploy'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid backup type. Allowed: ${allowedTypes.join(', ')}`
        });
      }

      const result = manager.createBackup({ type, label });

      if (result.success) {
        res.status(201).json({
          status: 'success',
          message: 'Backup created successfully',
          backup: {
            filename: result.filename,
            type: result.type,
            sizeBytes: result.sizeBytes,
            checksum: result.checksum,
            createdAt: result.createdAt
          }
        });
      } else {
        res.status(500).json({
          error: 'Backup failed',
          message: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create backup'
      });
    }
  });

  /**
   * GET /backups/list
   * List all backups
   * Query: ?type=daily|manual|pre-deploy&limit=50
   */
  router.get('/list', (req, res) => {
    try {
      const type = req.query.type || undefined;
      const limit = parseInt(req.query.limit || '50', 10);

      if (type && !['daily', 'manual', 'pre-deploy'].includes(type)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid type filter'
        });
      }

      const backups = manager.listBackups({ type, limit });

      res.json({
        status: 'success',
        total: backups.length,
        backups
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list backups'
      });
    }
  });

  /**
   * POST /backups/restore
   * Restore from a backup
   * Body: { filename: string }
   */
  router.post('/restore', (req, res) => {
    try {
      const { filename } = req.body || {};

      if (!filename) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Backup filename is required'
        });
      }

      // Validate filename to prevent path traversal
      const safeName = path.basename(filename);
      if (safeName !== filename || filename.includes('..')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid filename'
        });
      }

      // Find backup file
      const backups = manager.listBackups({ limit: 1000 });
      const backup = backups.find(b => b.filename === safeName);

      if (!backup) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Backup file not found'
        });
      }

      const result = manager.restoreBackup(backup.path, {
        createPreRestoreBackup: true,
        verify: true
      });

      if (result.success) {
        res.json({
          status: 'success',
          message: 'Database restored. Server restart required.',
          restoredFrom: result.restoredFrom,
          restoredAt: result.restoredAt,
          requiresRestart: true
        });
      } else {
        res.status(500).json({
          error: 'Restore failed',
          message: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to restore backup'
      });
    }
  });

  /**
   * POST /backups/cleanup
   * Apply retention policy
   */
  router.post('/cleanup', (req, res) => {
    try {
      const result = manager.applyRetention();

      res.json({
        status: 'success',
        message: `Removed ${result.removed} old backup(s)`,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to cleanup backups'
      });
    }
  });

  /**
   * DELETE /backups/:filename
   * Delete a specific backup
   */
  router.delete('/:filename', (req, res) => {
    try {
      const { filename } = req.params;

      // Validate filename to prevent path traversal
      const safeName = path.basename(filename);
      if (safeName !== filename || filename.includes('..')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid filename'
        });
      }

      // Find backup file
      const backups = manager.listBackups({ limit: 1000 });
      const backup = backups.find(b => b.filename === safeName);

      if (!backup) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Backup file not found'
        });
      }

      const result = manager.deleteBackup(backup.path);

      if (result.success) {
        res.json({
          status: 'success',
          message: 'Backup deleted'
        });
      } else {
        res.status(500).json({
          error: 'Delete failed',
          message: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete backup'
      });
    }
  });

  return router;
}

module.exports = createBackupRoutes;
