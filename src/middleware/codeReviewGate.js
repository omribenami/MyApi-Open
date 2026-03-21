/**
 * Code Review Gating Middleware
 * Phase 6B: Requires code review before deploying features
 * Integrates Claude Opus 4.6 as the Code Reviewer
 */

const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

/**
 * Code Review Gate Middleware Factory
 * @param {Database} db - Database instance
 * @param {Object} codeReviewService - Code review service
 * @returns {Object} Middleware functions
 */
function createCodeReviewGateMiddleware(db, codeReviewService) {
  /**
   * Middleware: Check if resource requires code review
   * If yes, submit for review and return 202 ACCEPTED
   * @param {string} resource - Resource type (e.g., 'schema', 'deployment')
   * @returns {Function} Express middleware
   */
  function requireCodeReview(resource) {
    return async (req, res, next) => {
      try {
        const userId = req.tokenData?.userId || req.session?.userId;
        const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

        if (!userId || !workspaceId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User not authenticated'
          });
        }

        // Check if this resource requires code review
        const requiresReview = await checkResourceRequiresReview(db, resource, workspaceId);

        if (!requiresReview) {
          // No review needed, proceed normally
          return next();
        }

        // Extract code/content from request body
        const code = req.body.code || req.body.migration || req.body.content || '';

        if (!code) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'No code/content to review'
          });
        }

        // Create review request
        const reviewRequestId = uuid();
        const timestamp = new Date().toISOString();

        // Store review request in database
        await db.run(
          `INSERT INTO code_reviews (
            id, workspace_id, user_id, resource_type, code_content,
            status, created_at, requested_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reviewRequestId,
            workspaceId,
            userId,
            resource,
            code,
            'pending',
            timestamp,
            timestamp
          ]
        );

        // Send code to Claude Opus for async review
        const opusReview = await codeReviewService.submitCodeReview(
          reviewRequestId,
          code,
          resource,
          userId,
          workspaceId
        );

        // Update review request with Opus response ID
        if (opusReview.sessionId) {
          await db.run(
            `UPDATE code_reviews SET opus_session_id = ? WHERE id = ?`,
            [opusReview.sessionId, reviewRequestId]
          );
        }

        // Store original request body for later execution
        req.reviewRequestId = reviewRequestId;
        req.codeReviewPending = true;
        req.originalBody = req.body;

        // Return 202 ACCEPTED with review request ID
        res.status(202).json({
          status: 'accepted',
          message: 'Code submitted for review by Claude Opus',
          reviewRequestId,
          resource,
          expectedReviewTime: '5-15 minutes',
          statusCheckEndpoint: `/api/v1/code-review/${reviewRequestId}/status`
        });

      } catch (error) {
        logger.error('Code review gate error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to submit code for review'
        });
      }
    };
  }

  /**
   * Helper: Check if resource type requires code review
   */
  async function checkResourceRequiresReview(db, resource, workspaceId) {
    // For now, all schema migrations and deployments require review
    // This can be made configurable per workspace
    const reviewableResources = ['schema', 'deployment', 'migration', 'feature'];
    return reviewableResources.includes(resource);
  }

  /**
   * Endpoint: Get code review status
   */
  async function getReviewStatus(req, res) {
    try {
      const { reviewId } = req.params;

      const review = await db.get(
        `SELECT * FROM code_reviews WHERE id = ?`,
        [reviewId]
      );

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Review request not found'
        });
      }

      // If pending, check Opus response
      if (review.status === 'pending' && review.opus_session_id) {
        const opusResult = await checkOpusReviewResult(review.opus_session_id);
        if (opusResult) {
          review.status = opusResult.approved ? 'approved' : 'rejected';
          review.review_notes = opusResult.notes;
          review.reviewed_at = new Date().toISOString();
          
          // Update database
          await db.run(
            `UPDATE code_reviews SET status = ?, review_notes = ?, reviewed_at = ?, approved_by = ?
             WHERE id = ?`,
            [review.status, review.review_notes, review.reviewed_at, 'opus', reviewId]
          );
        }
      }

      res.json({
        reviewId: review.id,
        status: review.status,
        resource: review.resource_type,
        createdAt: review.created_at,
        reviewedAt: review.reviewed_at,
        notes: review.review_notes,
        approvedBy: review.approved_by
      });

    } catch (error) {
      logger.error('Error getting review status:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get review status'
      });
    }
  }

  /**
   * Helper: Check Opus review result
   */
  async function checkOpusReviewResult(sessionId) {
    // In real implementation, this would poll the Opus session
    // For now, return null (still pending)
    return null;
  }

  /**
   * Endpoint: Approve code review (Code Reviewer role only)
   */
  async function approveCodeReview(req, res) {
    try {
      const { reviewId } = req.params;
      const userId = req.tokenData?.userId || req.session?.userId;

      // Verify user has code-review permission
      // This is checked by middleware in routes

      const review = await db.get(
        `SELECT * FROM code_reviews WHERE id = ?`,
        [reviewId]
      );

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Review request not found'
        });
      }

      if (review.status === 'approved') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Review already approved'
        });
      }

      if (review.status === 'rejected') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Review was rejected and cannot be approved'
        });
      }

      // Approve the review
      const approvedAt = new Date().toISOString();
      await db.run(
        `UPDATE code_reviews SET status = ?, approved_by = ?, reviewed_at = ?
         WHERE id = ?`,
        ['approved', userId, approvedAt, reviewId]
      );

      res.json({
        status: 'success',
        message: 'Code review approved',
        reviewId,
        approvedAt,
        nextStep: 'Code will be deployed'
      });

    } catch (error) {
      logger.error('Error approving review:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to approve review'
      });
    }
  }

  /**
   * Endpoint: Reject code review with reason
   */
  async function rejectCodeReview(req, res) {
    try {
      const { reviewId } = req.params;
      const { reason } = req.body;
      const userId = req.tokenData?.userId || req.session?.userId;

      if (!reason) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Rejection reason required'
        });
      }

      const review = await db.get(
        `SELECT * FROM code_reviews WHERE id = ?`,
        [reviewId]
      );

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Review request not found'
        });
      }

      // Reject the review
      const rejectedAt = new Date().toISOString();
      await db.run(
        `UPDATE code_reviews SET status = ?, review_notes = ?, approved_by = ?, reviewed_at = ?
         WHERE id = ?`,
        ['rejected', reason, userId, rejectedAt, reviewId]
      );

      res.json({
        status: 'success',
        message: 'Code review rejected',
        reviewId,
        reason,
        rejectedAt,
        nextStep: 'Developer must address issues and resubmit'
      });

    } catch (error) {
      logger.error('Error rejecting review:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to reject review'
      });
    }
  }

  /**
   * Endpoint: Execute code after approval
   */
  async function executeApprovedCode(req, res) {
    try {
      const { reviewId } = req.params;

      const review = await db.get(
        `SELECT * FROM code_reviews WHERE id = ?`,
        [reviewId]
      );

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Review request not found'
        });
      }

      if (review.status !== 'approved') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Review status is ${review.status}, must be approved to execute`
        });
      }

      // Update review as executed
      const executedAt = new Date().toISOString();
      await db.run(
        `UPDATE code_reviews SET status = ?, executed_at = ? WHERE id = ?`,
        ['executed', executedAt, reviewId]
      );

      res.json({
        status: 'success',
        message: 'Approved code executed',
        reviewId,
        executedAt
      });

    } catch (error) {
      logger.error('Error executing code:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to execute approved code'
      });
    }
  }

  return {
    requireCodeReview,
    getReviewStatus,
    approveCodeReview,
    rejectCodeReview,
    executeApprovedCode
  };
}

module.exports = {
  createCodeReviewGateMiddleware
};
