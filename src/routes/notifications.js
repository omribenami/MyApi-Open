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

const router = express.Router();

  // GET /api/v1/notifications - List user notifications with filtering
  router.get('/', (req, res) => {
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
  const unreadCountHandler = (req, res) => {
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
  };

  router.get('/unread-count', unreadCountHandler);
  // Backward compatibility for older frontend store
  router.get('/unread', unreadCountHandler);

  // POST /api/v1/notifications/:id/read - Mark notification as read
  router.post('/:id/read', (req, res) => {
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
  router.post('/read-all', (req, res) => {
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
  router.delete('/:id', (req, res) => {
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

  const LEGACY_NOTIFICATION_TYPES = [
    'device_approval_requested',
    'device_approved',
    'device_revoked',
    'skill_liked',
    'skill_used',
    'persona_invoked',
    'guest_token_used',
    'token_revoked',
    'service_connected'
  ];

  function toLegacySettings(settings) {
    const inAppEnabled = settings.inApp?.enabled === 1;
    const emailEnabled = settings.email?.enabled === 1;
    const emailFreq = settings.email?.frequency || 'immediate';
    const emailDigestType = emailFreq === 'none' ? 'disabled' : emailFreq;

    const flat = {
      email_digest_type: emailDigestType
    };

    for (const type of LEGACY_NOTIFICATION_TYPES) {
      flat[`${type}_web`] = inAppEnabled ? 1 : 0;
      flat[`${type}_email`] = emailEnabled ? 1 : 0;
    }

    return flat;
  }

  // Backward-compatible settings endpoint used by dashboard UI
  // GET /api/v1/notifications/settings
  router.get('/settings', (req, res) => {
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
          settings: toLegacySettings(settings)
        }
      });
    } catch (err) {
      console.error('Error fetching notification settings:', err);
      res.status(500).json({ error: 'Failed to fetch settings', details: err.message });
    }
  });

  // Backward-compatible settings update endpoint used by dashboard UI
  // PUT /api/v1/notifications/settings
  router.put('/settings', (req, res) => {
    try {
      const workspaceId = req.workspaceId || 'default';
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      const payload = req.body || {};

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Map legacy digest value to frequency
      if (payload.email_digest_type !== undefined) {
        const digest = String(payload.email_digest_type || 'immediate').toLowerCase();
        const frequency = digest === 'disabled' ? 'none' : digest;
        updateNotificationPreferences(workspaceId, userId, 'email', {
          enabled: digest !== 'disabled',
          frequency: ['immediate', 'daily', 'weekly', 'none'].includes(frequency) ? frequency : 'immediate'
        });
      }

      // Map legacy *_web and *_email toggles to channel-level enabled flags
      const webKeys = Object.keys(payload).filter((k) => k.endsWith('_web'));
      if (webKeys.length > 0) {
        const inAppEnabled = webKeys.some((k) => Number(payload[k]) !== 0);
        const current = getOrCreateNotificationSettings(workspaceId, userId);
        updateNotificationPreferences(workspaceId, userId, 'in-app', {
          enabled: inAppEnabled,
          frequency: current.inApp?.frequency || 'immediate'
        });
      }

      const emailKeys = Object.keys(payload).filter((k) => k.endsWith('_email'));
      if (emailKeys.length > 0) {
        const emailEnabled = emailKeys.some((k) => Number(payload[k]) !== 0);
        const current = getOrCreateNotificationSettings(workspaceId, userId);
        updateNotificationPreferences(workspaceId, userId, 'email', {
          enabled: emailEnabled,
          frequency: current.email?.frequency || 'immediate'
        });
      }

      const settings = getOrCreateNotificationSettings(workspaceId, userId);
      res.json({
        ok: true,
        data: {
          settings: toLegacySettings(settings)
        }
      });
    } catch (err) {
      console.error('Error updating notification settings:', err);
      res.status(500).json({ error: 'Failed to update settings', details: err.message });
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

// Notification dispatcher for internal use (called when events trigger)
router.dispatchNotification = function(workspaceId, userId, type, title, message, data = null, channels = ['in-app', 'email']) {
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
};

module.exports = router;
