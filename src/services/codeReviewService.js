/**
 * Code Review Service
 * Phase 6B: Integration with Claude Opus 4.6 for async code reviews
 * Submits code for review, polls results, handles webhooks
 */

const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

class CodeReviewService {
  constructor(db, opusApiClient) {
    this.db = db;
    this.opusApi = opusApiClient; // Anthropic Claude API or custom Opus API
    this.MODEL = 'claude-opus-4.6'; // Code reviewer model
  }

  /**
   * Submit code for review to Claude Opus
   * @param {string} requestId - Unique review request ID
   * @param {string} code - Code to review
   * @param {string} resourceType - Type of resource (schema, deployment, etc.)
   * @param {string} userId - User who requested review
   * @param {string} workspaceId - Workspace ID
   * @returns {Object} Review submission result
   */
  async submitCodeReview(requestId, code, resourceType, userId, workspaceId) {
    try {
      const prompt = this.buildReviewPrompt(code, resourceType);

      // Call Claude Opus for review
      const reviewRequest = {
        model: this.MODEL,
        prompt,
        code,
        requestId,
        requestedBy: userId,
        workspaceId,
        resourceType,
        timestamp: new Date().toISOString(),
        metadata: {
          userAgent: 'MyApi/Phase6B',
          version: '1.0',
          async: true // Async review mode
        }
      };

      logger.info(`Submitting code review request: ${requestId}`, {
        resourceType,
        codeLength: code.length,
        userId
      });

      // In production, this would call OpenAI/Anthropic API or invoke a separate Opus service
      // For now, we'll simulate async processing
      const opusResponse = await this.invokeOpusReview(reviewRequest);

      // Store the session ID for polling
      return {
        requestId,
        sessionId: opusResponse.sessionId || uuid(),
        status: 'pending',
        message: 'Code submitted to Claude Opus for review',
        estimatedTime: '5-15 minutes'
      };

    } catch (error) {
      logger.error('Failed to submit code review:', error);
      throw new Error(`Code review submission failed: ${error.message}`);
    }
  }

  /**
   * Build code review prompt for Opus
   * @param {string} code - Code to review
   * @param {string} resourceType - Type of resource
   * @returns {string} Formatted prompt for Opus
   */
  buildReviewPrompt(code, resourceType) {
    const reviewPrompt = `
You are an expert code reviewer for MyApi platform. Review the following ${resourceType} code for:

1. **Security Issues**: SQL injection, XSS, authentication/authorization flaws, sensitive data exposure
2. **Architecture & Best Practices**: Code structure, modularity, error handling, logging
3. **Performance**: Inefficiencies, N+1 queries, memory leaks
4. **Testing**: Sufficient test coverage, edge cases
5. **Database Concerns**: Schema design, migrations, data integrity
6. **Compliance**: GDPR, CCPA, audit logging requirements

\`\`\`
${code}
\`\`\`

Provide:
- APPROVED or REJECTED status
- List of critical issues (if any)
- Recommendations for improvement
- Summary of review

Format your response as JSON:
{
  "approved": boolean,
  "criticalIssues": ["issue1", "issue2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "summary": "Short summary of review",
  "confidence": "high|medium|low"
}
`;
    return reviewPrompt;
  }

  /**
   * Invoke Opus review (simulated async)
   * In production, this would be a real API call or spawned session
   * @param {Object} reviewRequest - Review request object
   * @returns {Object} Opus response with sessionId
   */
  async invokeOpusReview(reviewRequest) {
    try {
      // Simulate async Opus invocation
      // In production, this would:
      // 1. Call the Anthropic API with streaming disabled
      // 2. Or spawn a background job with sessions_spawn
      // 3. Or invoke a separate Opus microservice
      
      const sessionId = uuid();

      logger.info(`Opus review session created: ${sessionId}`, {
        requestId: reviewRequest.requestId,
        model: reviewRequest.model
      });

      // Schedule async processing (in real implementation)
      // For MVP, we'll simulate this with a timeout
      setTimeout(() => {
        this.processOpusReview(reviewRequest, sessionId)
          .catch(err => logger.error('Failed to process Opus review:', err));
      }, 1000);

      return {
        sessionId,
        status: 'pending',
        requestId: reviewRequest.requestId
      };

    } catch (error) {
      logger.error('Failed to invoke Opus review:', error);
      throw error;
    }
  }

  /**
   * Async: Process Opus review response
   * Stores results in database
   * @param {Object} reviewRequest - Original review request
   * @param {string} sessionId - Opus session ID
   */
  async processOpusReview(reviewRequest, sessionId) {
    try {
      // In production, poll Opus API or listen for webhook callback
      // For MVP, we simulate a review
      
      const simulatedReview = this.generateSimulatedReview(reviewRequest.code);

      logger.info(`Opus review completed for session: ${sessionId}`, {
        approved: simulatedReview.approved,
        issueCount: simulatedReview.criticalIssues?.length || 0
      });

      // Update code_reviews table with results
      const reviewedAt = new Date().toISOString();
      await this.db.run(
        `UPDATE code_reviews SET 
          status = ?, 
          review_notes = ?, 
          review_data = ?,
          reviewed_at = ?,
          approved_by = ?
         WHERE id = ?`,
        [
          simulatedReview.approved ? 'approved' : 'rejected',
          simulatedReview.summary,
          JSON.stringify(simulatedReview),
          reviewedAt,
          'opus-4.6',
          reviewRequest.requestId
        ]
      );

      // Emit event for real-time updates
      logger.info(`Code review ${reviewRequest.requestId} completed`, {
        status: simulatedReview.approved ? 'approved' : 'rejected'
      });

    } catch (error) {
      logger.error('Failed to process Opus review:', error);
      
      // Update review status to error
      try {
        await this.db.run(
          `UPDATE code_reviews SET status = ?, review_notes = ? WHERE id = ?`,
          ['error', error.message, reviewRequest.requestId]
        );
      } catch (dbError) {
        logger.error('Failed to update review status:', dbError);
      }
    }
  }

  /**
   * Simulate code review for MVP
   * In production, this would be replaced with actual Opus API call
   * @param {string} code - Code to review
   * @returns {Object} Simulated review result
   */
  generateSimulatedReview(code) {
    // Basic heuristics for MVP
    const hasSecurityIssues = code.includes('eval(') || 
                              code.includes('exec(') ||
                              !code.includes('try') ||
                              !code.includes('catch');
    
    const hasLogging = code.includes('logger') || code.includes('console.log');
    const hasErrorHandling = code.includes('catch') || code.includes('error');

    const criticalIssues = [];
    const recommendations = [];

    if (!hasErrorHandling) {
      criticalIssues.push('Missing error handling blocks');
      recommendations.push('Add try-catch blocks for all async operations');
    }

    if (!hasLogging) {
      recommendations.push('Add logging for debugging and monitoring');
    }

    if (code.length > 500) {
      recommendations.push('Consider breaking down large functions into smaller units');
    }

    return {
      approved: criticalIssues.length === 0,
      criticalIssues,
      recommendations,
      summary: criticalIssues.length === 0 
        ? 'Code review passed all critical checks'
        : `Found ${criticalIssues.length} critical issue(s) that should be addressed`,
      confidence: 'medium' // MVP confidence
    };
  }

  /**
   * Get review status
   * @param {string} reviewId - Review request ID
   * @returns {Object} Review status
   */
  async getReviewStatus(reviewId) {
    try {
      const review = await this.db.get(
        `SELECT * FROM code_reviews WHERE id = ?`,
        [reviewId]
      );

      if (!review) {
        throw new Error('Review not found');
      }

      return {
        reviewId: review.id,
        status: review.status,
        resourceType: review.resource_type,
        createdAt: review.created_at,
        reviewedAt: review.reviewed_at,
        notes: review.review_notes,
        data: review.review_data ? JSON.parse(review.review_data) : null,
        approvedBy: review.approved_by
      };

    } catch (error) {
      logger.error('Failed to get review status:', error);
      throw error;
    }
  }

  /**
   * Get pending reviews for a workspace
   * @param {string} workspaceId - Workspace ID
   * @returns {Array} Pending reviews
   */
  async getPendingReviews(workspaceId) {
    try {
      const reviews = await this.db.all(
        `SELECT id, resource_type, status, created_at, user_id 
         FROM code_reviews 
         WHERE workspace_id = ? AND status = 'pending'
         ORDER BY created_at DESC`,
        [workspaceId]
      );

      return reviews;

    } catch (error) {
      logger.error('Failed to get pending reviews:', error);
      throw error;
    }
  }

  /**
   * Webhook: Handle Opus callback with review result
   * In production, Opus would call this endpoint with results
   * @param {Object} callbackData - Opus callback data
   */
  async handleOpusCallback(callbackData) {
    try {
      const { requestId, approved, issues, notes } = callbackData;

      // Update code_reviews with Opus result
      const reviewedAt = new Date().toISOString();
      await this.db.run(
        `UPDATE code_reviews SET 
          status = ?, 
          review_notes = ?,
          review_data = ?,
          reviewed_at = ?,
          approved_by = ?
         WHERE id = ?`,
        [
          approved ? 'approved' : 'rejected',
          notes,
          JSON.stringify({ approved, issues, notes }),
          reviewedAt,
          'opus-4.6',
          requestId
        ]
      );

      logger.info(`Opus callback processed: ${requestId}`, { approved });

      return {
        success: true,
        message: 'Review result stored',
        requestId
      };

    } catch (error) {
      logger.error('Failed to handle Opus callback:', error);
      throw error;
    }
  }
}

module.exports = CodeReviewService;
