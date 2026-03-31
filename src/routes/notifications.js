const express = require('express');
const crypto = require('crypto');
const {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadNotificationCount,
  getOrCreateNotificationSettings,
  updateNotificationPreferences,
  updateNotificationTypeSettings,
  getOrEnsureUserWorkspace,
  queueNotificationForDelivery
} = require('../database');

const router = express.Router();

  // GET /api/v1/notifications - List user notifications with filtering
  router.get('/', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

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

      const allNotifications = getNotifications(workspaceId, userId, filters);
      // Deduplicate: legacy types (service_connected, device_approved) were superseded by
      // oauth_connected and security_device_approved. Filter out legacy if a modern
      // equivalent exists within 10 seconds of the same timestamp.
      const LEGACY_TO_MODERN = { service_connected: 'oauth_connected', device_approved: 'security_device_approved' };
      const modernTimestamps = new Set(
        allNotifications
          .filter(n => Object.values(LEGACY_TO_MODERN).includes(n.type))
          .map(n => `${n.type}:${n.created_at}`)
      );
      const notifications = allNotifications.filter(n => {
        const modernType = LEGACY_TO_MODERN[n.type];
        if (!modernType) return true;
        // Drop legacy if a modern equivalent exists within 10 seconds
        for (const key of modernTimestamps) {
          const [mType, mTs] = key.split(':');
          if (mType === modernType && Math.abs(n.created_at - Number(mTs)) <= 10) return false;
        }
        return true;
      });
      const normalized = notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data ? JSON.parse(n.data) : null,
        isRead: n.is_read === 1,
        read_at: n.is_read === 1 ? (n.read_at || n.updated_at || n.created_at) : null,
        createdAt: n.created_at,
        created_at: n.created_at,
        expiresAt: n.expires_at,
      }));
      const unreadCount = getUnreadNotificationCount(workspaceId, userId);

      res.json({
        ok: true,
        data: normalized,
        notifications: normalized,
        unreadCount,
        pagination: {
          limit,
          offset,
          total: unreadCount // approximate
        }
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // GET /api/v1/notifications/unread-count - Get unread count
  const unreadCountHandler = (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

      const count = getUnreadNotificationCount(workspaceId, userId);

      res.json({
        ok: true,
        data: { unreadCount: count },
        unreadCount: count,
      });
    } catch (err) {
      console.error('Error fetching unread count:', err);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  };

  router.get('/unread-count', unreadCountHandler);
  // Backward compatibility for older frontend store
  router.get('/unread', unreadCountHandler);

  // POST /api/v1/notifications/:id/read - Mark notification as read
  router.post('/:id/read', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      const notificationId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

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
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // POST /api/v1/notifications/read-all - Mark all as read
  router.post('/read-all', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

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
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // DELETE /api/v1/notifications/:id - Delete notification
  router.delete('/:id', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      const notificationId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

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
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  // DELETE /api/v1/notifications - Clear all notifications
  router.delete('/', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);
      const deleted = deleteAllNotifications(workspaceId, userId);
      res.json({ ok: true, data: { deleted } });
    } catch (err) {
      console.error('Error clearing all notifications:', err);
      res.status(500).json({ error: 'Failed to clear notifications' });
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

    let inAppTypeSettings = {};
    let emailTypeSettings = {};
    try { inAppTypeSettings = JSON.parse(settings.inApp?.type_settings || '{}'); } catch (_) {}
    try { emailTypeSettings = JSON.parse(settings.email?.type_settings || '{}'); } catch (_) {}

    const flat = { email_digest_type: emailDigestType };

    for (const type of LEGACY_NOTIFICATION_TYPES) {
      flat[`${type}_web`] = inAppEnabled
        ? (inAppTypeSettings[type] !== undefined ? inAppTypeSettings[type] : 1)
        : 0;
      flat[`${type}_email`] = emailEnabled
        ? (emailTypeSettings[type] !== undefined ? emailTypeSettings[type] : 1)
        : 0;
    }

    return flat;
  }

  // Backward-compatible settings endpoint used by dashboard UI
  // GET /api/v1/notifications/settings
  router.get('/settings', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

      const settings = getOrCreateNotificationSettings(workspaceId, userId);
      res.json({
        ok: true,
        data: {
          settings: toLegacySettings(settings)
        }
      });
    } catch (err) {
      console.error('Error fetching notification settings:', err);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  // Backward-compatible settings update endpoint used by dashboard UI
  // PUT /api/v1/notifications/settings
  router.put('/settings', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      const payload = req.body || {};

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

      // Map legacy digest value to frequency
      if (payload.email_digest_type !== undefined) {
        const digest = String(payload.email_digest_type || 'immediate').toLowerCase();
        const frequency = digest === 'disabled' ? 'none' : digest;
        updateNotificationPreferences(workspaceId, userId, 'email', {
          enabled: digest !== 'disabled',
          frequency: ['immediate', 'daily', 'weekly', 'none'].includes(frequency) ? frequency : 'immediate'
        });
      }

      // Map legacy *_web keys to per-type settings on the in-app channel
      const webKeys = Object.keys(payload).filter((k) => k.endsWith('_web') && LEGACY_NOTIFICATION_TYPES.includes(k.slice(0, -4)));
      if (webKeys.length > 0) {
        for (const key of webKeys) {
          const type = key.slice(0, -4); // strip '_web'
          updateNotificationTypeSettings(workspaceId, userId, 'in-app', type, Number(payload[key]) !== 0);
        }
        // Ensure the channel itself is enabled if it was disabled
        const current = getOrCreateNotificationSettings(workspaceId, userId);
        if (current.inApp?.enabled !== 1) {
          updateNotificationPreferences(workspaceId, userId, 'in-app', {
            enabled: true,
            frequency: current.inApp?.frequency || 'immediate'
          });
        }
      }

      const emailKeys = Object.keys(payload).filter((k) => k.endsWith('_email') && LEGACY_NOTIFICATION_TYPES.includes(k.slice(0, -6)));
      if (emailKeys.length > 0) {
        for (const key of emailKeys) {
          const type = key.slice(0, -6); // strip '_email'
          updateNotificationTypeSettings(workspaceId, userId, 'email', type, Number(payload[key]) !== 0);
        }
        const current = getOrCreateNotificationSettings(workspaceId, userId);
        if (current.email?.enabled !== 1) {
          updateNotificationPreferences(workspaceId, userId, 'email', {
            enabled: true,
            frequency: current.email?.frequency || 'immediate'
          });
        }
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
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // GET /api/v1/notifications/preferences - Get notification preferences
  router.get('/preferences', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

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
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  // POST /api/v1/notifications/preferences - Update notification preferences
  router.post('/preferences', (req, res) => {
    try {
      const userId = req.user?.id || req.tokenMeta?.userId || req.tokenMeta?.ownerId;
      const { channel, enabled, frequency } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const workspaceId = req.workspaceId || req.session?.currentWorkspace || getOrEnsureUserWorkspace(userId);

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
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

// Notification dispatcher for internal use (called when events trigger)
router.dispatchNotification = function(workspaceId, userId, type, title, message, data = null, channels = ['in-app', 'email']) {
  try {
    // Check user preferences before creating notification
    const settings = getOrCreateNotificationSettings(workspaceId, userId);
    const inAppEnabled = settings.inApp?.enabled === 1;
    const emailEnabled = settings.email?.enabled === 1;

    // Filter channels based on preferences
    const allowedChannels = channels.filter(ch => {
      if (ch === 'in-app') return inAppEnabled;
      if (ch === 'email') return emailEnabled;
      return true;
    });

    if (allowedChannels.length === 0) {
      return { notificationId: null, queued: [], success: true, skipped: true };
    }

    const notificationId = createNotification(workspaceId, userId, type, title, message, data);
    
    // Queue for delivery to allowed channels only
    const queued = queueNotificationForDelivery(notificationId, allowedChannels);
    
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
