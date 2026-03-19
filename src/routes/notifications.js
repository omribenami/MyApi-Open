const express = require('express');
const db = require('../database');

const router = express.Router();

function resolveUserId(req) {
  const resolved = (
    req?.session?.user_id ||
    req?.session?.user?.id ||
    req?.user?.id ||
    req?.tokenMeta?.ownerId ||
    null
  );

  if (resolved === null || resolved === undefined || resolved === '') return null;
  return String(resolved);
}

// Specific routes first (before generic :id routes)

/**
 * GET /api/v1/notifications/unread
 * Get unread notification count
 */
router.get('/unread', (req, res) => {
  try {
    const userId = resolveUserId(req);
    
    if (!userId) {
      console.error('userId extraction failed:', { user: req.user, tokenMeta: req.tokenMeta });
      return res.status(401).json({ error: 'Unauthorized - no user ID' });
    }
    
    const count = db.getUnreadNotificationCount(userId);
    
    res.json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * GET /api/v1/notifications/settings
 * Get notification settings for user
 */
router.get('/settings', (req, res) => {
  try {
    const userId = resolveUserId(req);
    
    if (!userId) {
      console.error('userId extraction failed:', { user: req.user, tokenMeta: req.tokenMeta });
      return res.status(401).json({ error: 'Unauthorized - no user ID' });
    }
    
    const settings = db.getOrCreateNotificationSettings(userId);
    
    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

/**
 * PUT /api/v1/notifications/settings
 * Update notification settings for user
 */
router.put('/settings', (req, res) => {
  try {
    const userId = resolveUserId(req);
    
    if (!userId) {
      console.error('userId extraction failed:', { user: req.user, tokenMeta: req.tokenMeta });
      return res.status(401).json({ error: 'Unauthorized - no user ID' });
    }
    
    const settings = db.updateNotificationSettings(userId, req.body);
    
    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// Generic :id routes

/**
 * POST /api/v1/notifications/:id/read
 * Mark notification as read
 */
router.post('/:id/read', (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - no user ID' });
    }

    const notification = db.db
      .prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?')
      .get(req.params.id, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const success = db.markNotificationAsRead(req.params.id);
    if (!success) {
      console.error('Failed to mark notification as read after ownership check', { notificationId: req.params.id, userId });
      return res.status(500).json({ error: 'Failed to mark notification as read' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification
 */
router.delete('/:id', (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - no user ID' });
    }

    const notification = db.db
      .prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?')
      .get(req.params.id, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const success = db.deleteNotification(req.params.id);

    if (!success) {
      console.error('Failed to delete notification after ownership check', { notificationId: req.params.id, userId });
      return res.status(500).json({ error: 'Failed to delete notification' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * GET /api/v1/notifications
 * Get all notifications for authenticated user
 * Query params: limit, offset
 */
router.get('/', (req, res) => {
  try {
    const userId = resolveUserId(req);
    
    if (!userId) {
      console.error('userId extraction failed:', { user: req.user, tokenMeta: req.tokenMeta });
      return res.status(401).json({ error: 'Unauthorized - no user ID' });
    }
    
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    
    const notifications = db.getNotifications(userId, limit, offset);
    const unreadCount = db.getUnreadNotificationCount(userId);
    
    // Parse JSON fields safely so malformed legacy rows do not break the whole feed
    const parsed = notifications.map((n) => {
      let parsedData = null;
      if (n.data) {
        try {
          parsedData = JSON.parse(n.data);
        } catch (error) {
          console.error('Malformed notification data JSON', { notificationId: n.id, userId, error: error.message });
        }
      }

      return {
        ...n,
        data: parsedData,
      };
    });
    
    res.json({
      success: true,
      notifications: parsed,
      unreadCount,
      total: parsed.length,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
