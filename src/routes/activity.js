const logger = require('../utils/logger');
const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/v1/activity
 * Get activity log for authenticated user
 * Query params: limit, offset, actionType, resourceType, result, afterDate, beforeDate
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user?.id || req.tokenMeta?.ownerId;
    
    const filters = {
      limit: Math.min(parseInt(req.query.limit) || 50, 100),
      offset: parseInt(req.query.offset) || 0,
      actionType: req.query.actionType,
      resourceType: req.query.resourceType,
      result: req.query.result,
      afterDate: req.query.afterDate,
      beforeDate: req.query.beforeDate,
    };
    
    const activity = db.getActivityLog(userId, filters);
    const isAdmin = req.tokenMeta?.scope === 'full' || req.tokenMeta?.tokenType === 'master' ||
                    req.session?.user?.roles?.includes('admin');

    // Parse JSON fields; restrict sensitive metadata to admin users only
    const parsed = activity.map(a => {
      const base = {
        id: a.id,
        action_type: a.action_type,
        resource_type: a.resource_type,
        resource_id: a.resource_id,
        result: a.result,
        created_at: a.created_at,
      };
      if (isAdmin) {
        base.details = a.details ? JSON.parse(a.details) : null;
        base.ip_address = a.ip_address;
        base.user_agent = a.user_agent;
      }
      return base;
    });
    
    res.json({
      success: true,
      activity: parsed,
      total: parsed.length,
    });
  } catch (error) {
    logger.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

/**
 * GET /api/v1/activity/summary
 * Get summary stats of recent activity
 */
router.get('/summary', (req, res) => {
  try {
    const userId = req.user?.id || req.tokenMeta?.ownerId;
    
    // Get activity from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activity = db.getActivityLog(userId, {
      limit: 1000,
      afterDate: oneDayAgo,
    });
    
    // Count by type
    const byType = {};
    const byResult = {};
    
    activity.forEach(a => {
      byType[a.action_type] = (byType[a.action_type] || 0) + 1;
      byResult[a.result] = (byResult[a.result] || 0) + 1;
    });
    
    res.json({
      success: true,
      summary: {
        totalEvents: activity.length,
        byType,
        byResult,
        timeRange: '24h',
      },
    });
  } catch (error) {
    logger.error('Error fetching activity summary:', error);
    res.status(500).json({ error: 'Failed to fetch activity summary' });
  }
});

module.exports = router;
