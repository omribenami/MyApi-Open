/**
 * Email Management Routes
 * Handle email processing and testing
 */

const express = require('express');
const emailService = require('../services/emailService');

const router = express.Router();

/**
 * POST /api/v1/email/process
 * Process pending emails in the queue
 * Protected: Requires admin token or internal call
 */
router.post('/process', async (req, res) => {
  try {
    // Validate request is from internal process or admin
    const internalKey = req.headers['x-internal-key'];
    if (internalKey !== process.env.INTERNAL_PROCESS_KEY && !req.tokenMeta?.scope?.includes('admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { limit } = req.body;
    const result = await emailService.processPendingEmails(limit || 50);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error processing emails:', error);
    res.status(500).json({ error: 'Failed to process emails' });
  }
});

/**
 * GET /api/v1/email/test
 * Test email service configuration
 * Protected: Requires admin token
 */
router.get('/test', async (req, res) => {
  try {
    if (!req.tokenMeta?.scope?.includes('admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await emailService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing email service:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
