/**
 * Email Management Routes
 * Outbound-only operations (no inbox read/search)
 */

const express = require('express');
const {
  getEmailQueueStats,
  getRecentEmailJobs,
} = require('../database');
const emailService = require('../services/emailService');

const router = express.Router();

function isAdmin(req) {
  const scope = req.tokenMeta?.scope;
  return scope === 'full' || String(scope || '').includes('admin');
}

function ensureAdmin(req, res) {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * POST /api/v1/email/process
 * Process pending emails in the queue
 * Protected: Requires admin token or internal call
 */
router.post('/process', async (req, res) => {
  try {
    // Validate request is from internal process or admin
    const internalKey = req.headers['x-internal-key'];
    if (internalKey !== process.env.INTERNAL_PROCESS_KEY && !isAdmin(req)) {
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
 * Test outbound email service configuration
 * Protected: Requires admin token
 */
router.get('/test', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const result = await emailService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing email service:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/email/status
 * Provider/config health + queue counters
 * Protected: Requires admin token
 */
router.get('/status', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const connection = await emailService.testConnection();
    const queue = getEmailQueueStats();

    res.json({
      success: true,
      outboundOnly: true,
      provider: emailService.getConfigStatus(),
      connection,
      queue,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting email status:', error);
    res.status(500).json({ success: false, error: 'Failed to get email status' });
  }
});

/**
 * POST /api/v1/email/send-test
 * Send a test email to destination address
 * Protected: Requires admin token
 */
router.post('/send-test', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const to = String(req.body?.to || '').trim();
    if (!to || !to.includes('@')) {
      return res.status(400).json({ error: 'Valid "to" email address is required' });
    }

    const connection = await emailService.testConnection();
    if (!connection.success) {
      return res.status(400).json({
        success: false,
        error: 'Email provider is not ready. Fix configuration before sending test email.',
        details: connection,
      });
    }

    const result = await emailService.sendTestEmail(to);
    res.json(result);
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/email/jobs
 * Lightweight queue observability for dashboard
 * Protected: Requires admin token
 */
router.get('/jobs', (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const limit = Number(req.query?.limit || 20);
    const status = req.query?.status ? String(req.query.status).toLowerCase() : null;
    const jobs = getRecentEmailJobs(limit, status);

    res.json({
      success: true,
      outboundOnly: true,
      jobs,
      queue: getEmailQueueStats(),
    });
  } catch (error) {
    console.error('Error getting email jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch email jobs' });
  }
});

module.exports = router;
