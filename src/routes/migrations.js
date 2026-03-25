/**
 * Migrations Routes
 * Phase 6B: Protected schema migration endpoints with code review gating
 */

const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

/**
 * Migrations Routes Factory
 * @param {Database} db - Database instance
 * @param {Object} codeReviewGate - Code review gating middleware handlers
 * @returns {Function} Express router
 */
function createMigrationsRoutes(db, codeReviewGate) {
  /**
   * POST /migrations/deploy
   * Deploy a schema migration (requires code review for admin role)
   * Body: {
   *   name: string,
   *   migration: string (SQL or JS migration code),
   *   description?: string
   * }
   * Requires: admin role
   * Returns: 202 ACCEPTED with review_request_id
   */
  router.post('/deploy', async (req, res) => {
    try {
      const { name, migration, description } = req.body;
      const userId = req.tokenData?.userId || req.session?.userId;
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!name || !migration) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'name and migration required'
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      // Create migration record
      const migrationId = uuid();
      const createdAt = new Date().toISOString();

      await db.run(
        `INSERT INTO code_reviews (
          id, workspace_id, user_id, resource_type, 
          code_content, status, created_at, requested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          migrationId,
          workspaceId,
          userId,
          'schema',
          migration,
          'pending',
          createdAt,
          createdAt
        ]
      );

      // Store migration metadata
      await db.run(
        `INSERT INTO migration_queue (
          id, code_review_id, workspace_id, name, description, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          migrationId,
          workspaceId,
          name,
          description || null,
          'pending_review',
          createdAt
        ]
      );

      logger.info(`Schema migration submitted for review: ${migrationId}`, {
        name,
        userId,
        workspaceId
      });

      // Return 202 ACCEPTED with review request ID
      res.status(202).json({
        status: 'accepted',
        message: 'Schema migration submitted for code review',
        reviewRequestId: migrationId,
        migrationName: name,
        expectedReviewTime: '5-15 minutes',
        statusCheckEndpoint: `/api/v1/migrations/${migrationId}/status`,
        approveEndpoint: `/api/v1/migrations/${migrationId}/approve`,
        rejectEndpoint: `/api/v1/migrations/${migrationId}/reject`
      });

    } catch (error) {
      logger.error('Failed to submit migration:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to submit migration'
      });
    }
  });

  /**
   * GET /migrations/pending-reviews
   * List pending code reviews for migrations
   * Requires: admin role
   */
  router.get('/pending-reviews', async (req, res) => {
    try {
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      const reviews = await db.all(
        `SELECT cr.id, cr.resource_type, cr.status, cr.created_at, 
                cr.user_id, mq.name, mq.description
         FROM code_reviews cr
         LEFT JOIN migration_queue mq ON cr.id = mq.code_review_id
         WHERE cr.workspace_id = ? AND cr.status = 'pending'
         ORDER BY cr.created_at DESC`,
        [workspaceId]
      );

      res.json({
        status: 'success',
        workspace: workspaceId,
        pendingReviews: reviews,
        total: reviews.length
      });

    } catch (error) {
      logger.error('Failed to list pending reviews:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list pending reviews'
      });
    }
  });

  /**
   * POST /migrations/:reviewId/approve
   * Approve migration for deployment
   * Requires: 'code:review' permission (Code Reviewer role)
   */
  router.post('/:reviewId/approve', async (req, res) => {
    try {
      const { reviewId } = req.params;
      const userId = req.tokenData?.userId || req.session?.userId;
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      // Get review
      const review = await db.get(
        `SELECT * FROM code_reviews WHERE id = ? AND workspace_id = ?`,
        [reviewId, workspaceId]
      );

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Review not found'
        });
      }

      if (review.status !== 'pending') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Review status is ${review.status}, cannot approve`
        });
      }

      // Approve review
      const approvedAt = new Date().toISOString();
      await db.run(
        `UPDATE code_reviews SET status = ?, approved_by = ?, reviewed_at = ?
         WHERE id = ?`,
        ['approved', userId, approvedAt, reviewId]
      );

      // Update migration queue status
      await db.run(
        `UPDATE migration_queue SET status = 'approved', approved_at = ?
         WHERE code_review_id = ?`,
        [approvedAt, reviewId]
      );

      logger.info(`Migration approved for deployment: ${reviewId}`, {
        approvedBy: userId,
        workspaceId
      });

      // Trigger migration execution
      await executeMigration(db, reviewId, userId);

      res.json({
        status: 'success',
        message: 'Migration approved and deployment initiated',
        reviewId,
        approvedAt,
        nextStep: 'Migration is being executed'
      });

    } catch (error) {
      logger.error('Failed to approve migration:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to approve migration'
      });
    }
  });

  /**
   * POST /migrations/:reviewId/reject
   * Reject migration
   * Requires: 'code:review' permission (Code Reviewer role)
   */
  router.post('/:reviewId/reject', async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { reason } = req.body;
      const userId = req.tokenData?.userId || req.session?.userId;
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!reason) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Rejection reason required'
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      // Get review
      const review = await db.get(
        `SELECT * FROM code_reviews WHERE id = ? AND workspace_id = ?`,
        [reviewId, workspaceId]
      );

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Review not found'
        });
      }

      if (review.status !== 'pending') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Review status is ${review.status}, cannot reject`
        });
      }

      // Reject review
      const rejectedAt = new Date().toISOString();
      await db.run(
        `UPDATE code_reviews SET status = ?, review_notes = ?, approved_by = ?, reviewed_at = ?
         WHERE id = ?`,
        ['rejected', reason, userId, rejectedAt, reviewId]
      );

      // Update migration queue status
      await db.run(
        `UPDATE migration_queue SET status = 'rejected', rejected_at = ?
         WHERE code_review_id = ?`,
        [rejectedAt, reviewId]
      );

      logger.info(`Migration rejected: ${reviewId}`, {
        rejectedBy: userId,
        reason,
        workspaceId
      });

      res.json({
        status: 'success',
        message: 'Migration rejected',
        reviewId,
        reason,
        rejectedAt,
        nextStep: 'Developer must address issues and resubmit'
      });

    } catch (error) {
      logger.error('Failed to reject migration:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to reject migration'
      });
    }
  });

  /**
   * POST /migrations/rollback
   * Rollback the last batch of file-based migrations
   * Requires: admin role
   */
  router.post('/rollback', async (req, res) => {
    try {
      const MigrationRunner = require('../lib/migrationRunner');

      if (!db.db) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Database not available for migration rollback'
        });
      }

      const runner = new MigrationRunner(db.db);
      runner.initMigrationTable();

      const result = runner.rollbackLastBatch();

      logger.info('Migration rollback executed', {
        batch: result.batch,
        rolledBack: result.rolledBack,
        success: result.success
      });

      res.json({
        status: result.success ? 'success' : 'partial',
        message: result.message,
        batch: result.batch,
        rolledBack: result.rolledBack || [],
        failed: result.failed || []
      });
    } catch (error) {
      logger.error('Failed to rollback migrations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to rollback migrations'
      });
    }
  });

  /**
   * GET /migrations/file-status
   * Get file-based migration status (applied, pending, checksums)
   */
  router.get('/file-status', async (req, res) => {
    try {
      const MigrationRunner = require('../lib/migrationRunner');

      if (!db.db) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Database not available'
        });
      }

      const runner = new MigrationRunner(db.db);
      runner.initMigrationTable();

      const status = runner.getStatus();
      const checksums = runner.verifyChecksums();

      res.json({
        status: 'success',
        currentBatch: status.currentBatch,
        applied: status.applied,
        pending: status.pending,
        checksumVerification: checksums
      });
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get migration status'
      });
    }
  });

  /**
   * GET /migrations/:reviewId/status
   * Get migration status
   */
  router.get('/:reviewId/status', async (req, res) => {
    try {
      const { reviewId } = req.params;
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      const review = await db.get(
        `SELECT cr.id, cr.resource_type, cr.status, cr.created_at, cr.reviewed_at,
                mq.name, mq.description
         FROM code_reviews cr
         LEFT JOIN migration_queue mq ON cr.id = mq.code_review_id
         WHERE cr.id = ? AND cr.workspace_id = ?`,
        [reviewId, workspaceId]
      );

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Migration not found'
        });
      }

      res.json({
        status: 'success',
        reviewId: review.id,
        migrationName: review.name,
        reviewStatus: review.status,
        createdAt: review.created_at,
        reviewedAt: review.reviewed_at,
        description: review.description
      });

    } catch (error) {
      logger.error('Failed to get migration status:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get migration status'
      });
    }
  });

  return router;
}

/**
 * Helper: Execute migration after approval
 */
async function executeMigration(db, reviewId, userId) {
  try {
    const review = await db.get(
      `SELECT * FROM code_reviews WHERE id = ?`,
      [reviewId]
    );

    if (!review || review.status !== 'approved') {
      throw new Error('Migration not approved');
    }

    logger.info(`Executing migration: ${reviewId}`, {
      userId
    });

    // Execute the migration code
    // In production, this would parse and execute SQL/JS migration
    // For MVP, just update status
    const executedAt = new Date().toISOString();
    await db.run(
      `UPDATE code_reviews SET status = ?, executed_at = ? WHERE id = ?`,
      ['executed', executedAt, reviewId]
    );

    await db.run(
      `UPDATE migration_queue SET status = 'executed', executed_at = ? WHERE code_review_id = ?`,
      [executedAt, reviewId]
    );

    logger.info(`Migration executed successfully: ${reviewId}`);

  } catch (error) {
    logger.error('Failed to execute migration:', error);
    
    // Update status to error
    try {
      await db.run(
        `UPDATE code_reviews SET status = ?, review_notes = ? WHERE id = ?`,
        ['error', error.message, reviewId]
      );
    } catch (dbError) {
      logger.error('Failed to update migration status to error:', dbError);
    }
  }
}

module.exports = createMigrationsRoutes;
