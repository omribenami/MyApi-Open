const express = require('express');
const crypto = require('crypto');
const { 
  createNotification, 
  getNotifications, 
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  getOrCreateNotificationSettings,
  updateNotificationPreferences,
  queueNotificationForDelivery
} = require('../database');

function createNotificationsRouter() {
  const router = express.Router();

  // GET /api/v1/notifications - List user notifications with filtering
  router.get('/notifications', (req, res) => {
    try {
      const workspaceId = req.workspaceId || 'default';
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Parse filters
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const read = req.query.read !== undefined ? req.query.read === 'true' : undefined;
      const type = req.query.type || undefined;
      const dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom) : undefined;
      const dateTo = req.query.dateTo ? parseInt(req.query.dateTo) : undefined;

      const filters = {
        read,
        type,
        dateFrom,
        dateTo,
        limit,
        offset
      };

      const notifications = getNotifications(workspaceId, userId, filters);

      res.json({
        ok: true,
        data: notifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data ? JSON.parse(n.data) : null,
          isRead: n.is_read === 1,
          createdAt: n.created_at,
          expiresAt: n.expires_at
        })),
        pagination: {
          limit,
          offset,
          total: getUnreadNotificationCount(workspaceId, userId) // approximate
        }
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
    }
  });

  // GET /api/v1/notifications/unread-count - Get unread count
  router.get('/notifications/unread-count', (req, res) => {
    try {
      const workspaceId = req.workspaceId || 'default';
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const count = getUnreadNotificationCount(workspaceId, userId);

      res.json({
        ok: true,
        data: { unreadCount: count }
      });
    } catch (err) {
      console.error('Error fetching unread count:', err);
      res.status(500).json({ error: 'Failed to fetch unread count', details: err.message });
    }
  });

  // POST /api/v1/notifications/:id/read - Mark notification as read
  router.post('/notifications/:id/read', (req, res) => {
    try {
      const workspaceId = req.workspaceId || 'default';
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      const notificationId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const success = markNotificationAsRead(notificationId, workspaceId, userId);

      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({
        ok: true,
        data: { marked: true }
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      res.status(500).json({ error: 'Failed to mark notification as read', details: err.message });
    }
  });

  // POST /api/v1/notifications/read-all - Mark all as read
  router.post('/notifications/read-all', (req, res) => {
    try {
      const workspaceId = req.workspaceId || 'default';
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get all unread notifications and mark them
      const notifications = getNotifications(workspaceId, userId, { read: false });
      let marked = 0;
      
      for (const notif of notifications) {
        if (markNotificationAsRead(notif.id, workspaceId, userId)) {
          marked++;
        }
      }

      res.json({
        ok: true,
        data: { markedCount: marked }
      });
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      res.status(500).json({ error: 'Failed to mark all notifications as read', details: err.message });
    }
  });

  // DELETE /api/v1/notifications/:id - Delete notification
  router.delete('/notifications/:id', (req, res) => {
    try {
      const workspaceId = req.workspaceId || 'default';
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      const notificationId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const success = deleteNotification(notificationId, workspaceId, userId);

      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({
        ok: true,
        data: { deleted: true }
      });
    } catch (err) {
      console.error('Error deleting notification:', err);
      res.status(500).json({ error: 'Failed to delete notification', details: err.message });
    }
  });

  // GET /api/v1/notifications/preferences - Get notification preferences
  router.get('/notifications/preferences', (req, res) => {
    try {
      const workspaceId = req.workspaceId || 'default';
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const settings = getOrCreateNotificationSettings(workspaceId, userId);

      res.json({
        ok: true,
        data: {
          inApp: {
            enabled: settings.inApp?.enabled === 1,
            frequency: settings.inApp?.frequency || 'immediate'
          },
          email: {
            enabled: settings.email?.enabled === 1,
            frequency: settings.email?.frequency || 'immediate'
          }
        }
      });
    } catch (err) {
      console.error('Error fetching notification preferences:', err);
      res.status(500).json({ error: 'Failed to fetch preferences', details: err.message });
    }
  });

  // POST /api/v1/notifications/preferences - Update notification preferences
  router.post('/notifications/preferences', (req, res) => {
    try {
      const workspaceId = req.workspaceId || 'default';
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      const { channel, enabled, frequency } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate channel
      if (!['in-app', 'email', 'whatsapp', 'slack'].includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel', validChannels: ['in-app', 'email', 'whatsapp', 'slack'] });
      }

      // Validate frequency
      if (!['immediate', 'daily', 'weekly', 'none'].includes(frequency)) {
        return res.status(400).json({ error: 'Invalid frequency', validFrequencies: ['immediate', 'daily', 'weekly', 'none'] });
      }

      const updated = updateNotificationPreferences(workspaceId, userId, channel, {
        enabled: enabled !== false,
        frequency: frequency || 'immediate'
      });

      res.json({
        ok: true,
        data: {
          channel,
          enabled: updated.enabled === 1,
          frequency: updated.frequency
        }
      });
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      res.status(500).json({ error: 'Failed to update preferences', details: err.message });
    }
  });

  return router;
}

// Notification dispatcher for internal use (called when events trigger)
function dispatchNotification(workspaceId, userId, type, title, message, data = null, channels = ['in-app', 'email']) {
  try {
    const notificationId = createNotification(workspaceId, userId, type, title, message, data);
    
    // Queue for delivery to configured channels
    const queued = queueNotificationForDelivery(notificationId, channels);
    
    return {
      notificationId,
      queued,
      success: true
    };
  } catch (err) {
    console.error('Error dispatching notification:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  createNotificationsRouter,
  dispatchNotification
};
