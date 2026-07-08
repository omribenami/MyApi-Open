/**
 * Notification Dispatcher
 * Wires system events to notification creation
 * Respects user notification preferences
 * Used internally by event handlers throughout the app
 */

// NOTE: Database is handled by database.js which detects MongoDB or SQLite
// No need to create a separate instance here
const { db, createNotification, queueNotificationForDelivery, queueEmail } = require('../database');

class NotificationDispatcher {
  /**
   * Notification type definitions with default channels
   */
  static notificationTypes = {
    'oauth_connected': { channels: ['in-app', 'email'], category: 'services', severity: 'info' },
    'oauth_disconnected': { channels: ['in-app', 'email'], category: 'services', severity: 'warning' },
    'skill_installed': { channels: ['in-app'], category: 'skills', severity: 'info' },
    'skill_removed': { channels: ['in-app'], category: 'skills', severity: 'info' },
    'team_invite_sent': { channels: ['in-app'], category: 'team', severity: 'info' },
    'team_invite_accepted': { channels: ['in-app'], category: 'team', severity: 'info' },
    'team_invitation': { channels: ['in-app', 'email'], category: 'team', severity: 'info' },
    'security_new_device': { channels: ['in-app', 'email'], category: 'security', severity: 'warning' },
    'security_2fa_enabled': { channels: ['in-app'], category: 'security', severity: 'info' },
    'security_2fa_disabled': { channels: ['in-app', 'email'], category: 'security', severity: 'warning' },
    'security_device_approved': { channels: ['in-app'], category: 'security', severity: 'info' },
    'security_device_revoked': { channels: ['in-app', 'email'], category: 'security', severity: 'warning' },
    'billing_quota_warning': { channels: ['in-app', 'email'], category: 'billing', severity: 'warning' },
    'billing_quota_exceeded': { channels: ['in-app', 'email'], category: 'billing', severity: 'critical' },
    'billing_subscription_upgraded': { channels: ['in-app'], category: 'billing', severity: 'info' },
    'billing_failure': { channels: ['in-app', 'email'], category: 'billing', severity: 'critical' },
    'agent_approval_request': { channels: ['in-app', 'email'], category: 'agents', severity: 'info' },
    'oauth_reconnect_required': { channels: ['in-app', 'email'], category: 'services', severity: 'warning' },
    'token_created': { channels: ['in-app', 'email'], category: 'security', severity: 'info' }
  };

  /**
   * Get user's notification preferences for specific channels. Uses the same
   * settings model as NotificationService (getOrCreateNotificationSettings +
   * per-type type_settings) so both emit paths obey the Settings UI. Previously
   * this read channel rows directly, defaulted email to ON (the service defaults
   * it to OFF), and ignored per-type toggles entirely.
   */
  static getUserChannelPreferences(workspaceId, userId, channels, notificationType) {
    const NotificationService = require('../services/notificationService');
    const result = {};
    try {
      const { getOrCreateNotificationSettings } = require('../database');
      const settings = getOrCreateNotificationSettings(workspaceId, userId);
      const prefsByChannel = { 'in-app': settings.inApp, 'email': settings.email };
      const alwaysOn = NotificationService.ALWAYS_IN_APP.has(notificationType);
      (channels || []).forEach(channel => {
        result[channel] = NotificationService.isTypeEnabled(prefsByChannel[channel], notificationType, {
          alwaysOn: channel === 'in-app' && alwaysOn,
        });
      });
      return result;
    } catch (err) {
      console.error('[NotificationDispatcher] Error fetching preferences:', err);
      // Fail safe: deliver in-app only (never email someone who may have opted out)
      (channels || []).forEach(ch => result[ch] = ch === 'in-app');
      return result;
    }
  }

  /**
   * Send notification respecting user preferences
   */
  static async dispatch(workspaceId, userId, notificationType, title, message, data = {}) {
    try {
      const notifConfig = this.notificationTypes[notificationType];
      if (!notifConfig) {
        console.warn(`[NotificationDispatcher] Unknown notification type: ${notificationType}`);
        return;
      }

      // Get user preferences for default channels
      const enabledChannels = this.getUserChannelPreferences(workspaceId, userId, notifConfig.channels, notificationType);
      const channelsToUse = Object.keys(enabledChannels).filter(ch => enabledChannels[ch]);

      if (channelsToUse.length === 0) {
        console.log(`[NotificationDispatcher] Notification suppressed for ${notificationType}: all channels disabled`);
        return;
      }

      // Create notification
      const notificationId = createNotification(
        workspaceId,
        userId,
        notificationType,
        title,
        message,
        { ...data, timestamp: Date.now() }
      );

      // Queue for delivery on enabled channels
      queueNotificationForDelivery(notificationId, channelsToUse);

      // Queue actual email when email channel is enabled.
      // These types are skipped here — they have dedicated transactional email sends
      // (new design) fired directly in the route handlers.
      const DEDICATED_EMAIL_TYPES = new Set(['oauth_connected', 'oauth_disconnected', 'team_invitation', 'security_device_revoked', 'security_alert', 'device_approval_requested']);
      if (channelsToUse.includes('email') && !DEDICATED_EMAIL_TYPES.has(notificationType)) {
        try {
          const user = db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(userId);
          if (user?.email) {
            const NotificationService = require('../services/notificationService');
            const subject = NotificationService.getEmailSubject(notificationType, title);
            const htmlBody = NotificationService.generateEmailTemplate(notificationType, title, message, data);
            queueEmail(userId, user.email, subject, message, { notificationId, htmlBody });
          }
        } catch (emailErr) {
          console.error('[NotificationDispatcher] Failed to queue email:', emailErr);
        }
      }

      console.log(`[NotificationDispatcher] ${notificationType} → user ${userId} on [${channelsToUse.join(', ')}]`);
      return notificationId;
    } catch (err) {
      console.error(`[NotificationDispatcher] Error dispatching ${notificationType}:`, err);
    }
  }

  // ========== SERVICE EVENTS ==========

  static async onServiceConnected(workspaceId, userId, serviceName) {
    const title = `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} Connected`;
    const message = `Your ${serviceName} account has been successfully linked to MyApi`;
    return this.dispatch(workspaceId, userId, 'oauth_connected', title, message, { serviceName });
  }

  static async onServiceDisconnected(workspaceId, userId, serviceName) {
    const title = `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} Disconnected`;
    const message = `Your ${serviceName} account has been removed from MyApi`;
    return this.dispatch(workspaceId, userId, 'oauth_disconnected', title, message, { serviceName });
  }

  // ========== SKILL EVENTS ==========

  static async onSkillInstalled(workspaceId, userId, skillName, skillId) {
    const title = `Skill Installed: ${skillName}`;
    const message = `You've successfully installed the "${skillName}" skill`;
    return this.dispatch(workspaceId, userId, 'skill_installed', title, message, { skillId, skillName });
  }

  static async onSkillRemoved(workspaceId, userId, skillName, skillId) {
    const title = `Skill Removed: ${skillName}`;
    const message = `The "${skillName}" skill has been removed from your workspace`;
    return this.dispatch(workspaceId, userId, 'skill_removed', title, message, { skillId, skillName });
  }

  // ========== TEAM EVENTS ==========

  static async onTeamMemberInvited(workspaceId, userId, invitedEmail, role) {
    const title = `Team Member Invited`;
    const message = `You've invited ${invitedEmail} to join as ${role}`;
    return this.dispatch(workspaceId, userId, 'team_invite_sent', title, message, { email: invitedEmail, role });
  }

  static async onTeamInvitationAccepted(workspaceId, userId, memberName) {
    const title = `Team Invitation Accepted`;
    const message = `${memberName} has accepted your team invitation`;
    return this.dispatch(workspaceId, userId, 'team_invite_accepted', title, message, { memberName });
  }

  static async onTeamInvitationReceived(workspaceId, userId, inviterName, workspaceName, role, invitationId) {
    const title = `Team Invitation: ${workspaceName}`;
    const message = `${inviterName} invited you to join "${workspaceName}" as a ${role}`;
    return this.dispatch(workspaceId, userId, 'team_invitation', title, message, { 
      workspaceName, 
      inviterName,
      role, 
      invitationId,
      actionUrl: `/accept-invite/${invitationId}`
    });
  }

  // ========== SECURITY EVENTS ==========

  static async onNewDeviceLogin(workspaceId, userId, deviceName, ip) {
    const title = `New Login from ${deviceName}`;
    const message = `Your account was accessed from a new device at ${ip}`;
    return this.dispatch(workspaceId, userId, 'security_new_device', title, message, { deviceName, ip });
  }

  static async on2FAEnabled(workspaceId, userId) {
    const title = `Two-Factor Authentication Enabled`;
    const message = `Your account is now protected with 2FA`;
    return this.dispatch(workspaceId, userId, 'security_2fa_enabled', title, message, {});
  }

  static async on2FADisabled(workspaceId, userId) {
    const title = `Two-Factor Authentication Disabled`;
    const message = `Your account's 2FA has been disabled. Your account is less secure.`;
    return this.dispatch(workspaceId, userId, 'security_2fa_disabled', title, message, {});
  }

  static async onDeviceApproved(workspaceId, userId, deviceName) {
    const title = `Device Approved`;
    const message = `Your device "${deviceName}" has been approved and can now access your account`;
    return this.dispatch(workspaceId, userId, 'security_device_approved', title, message, { deviceName });
  }

  static async onDeviceRevoked(workspaceId, userId, deviceName) {
    const title = `Device Revoked`;
    const message = `Your device "${deviceName}" has been removed and can no longer access your account`;
    const result = await this.dispatch(workspaceId, userId, 'security_device_revoked', title, message, { deviceName });
    try {
      const user = db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(userId);
      if (user?.email) {
        const EmailService = require('../services/emailService');
        EmailService.sendDeviceRevokedEmail(user.email, user.display_name, deviceName)
          .catch(err => console.error('[NotificationDispatcher] Device revoked email failed:', err.message));
      }
    } catch (err) {
      console.error('[NotificationDispatcher] Device revoked email error:', err.message);
    }
    return result;
  }

  // ========== BILLING EVENTS ==========

  static async onQuotaWarning(workspaceId, userId, percentageUsed) {
    const title = `API Quota Warning`;
    const message = `You've used ${percentageUsed}% of your monthly API quota`;
    return this.dispatch(workspaceId, userId, 'billing_quota_warning', title, message, { percentageUsed });
  }

  static async onQuotaExceeded(workspaceId, userId) {
    const title = `API Quota Exceeded`;
    const message = `You've exceeded your monthly API quota. Requests are being rate-limited.`;
    return this.dispatch(workspaceId, userId, 'billing_quota_exceeded', title, message, {});
  }

  static async onSubscriptionUpgraded(workspaceId, userId, planName) {
    const title = `Subscription Upgraded`;
    const message = `You've successfully upgraded to the ${planName} plan`;
    return this.dispatch(workspaceId, userId, 'billing_subscription_upgraded', title, message, { planName });
  }

  static async onBillingFailure(workspaceId, userId, reason) {
    const title = `Billing Failed`;
    const message = `There was an issue processing your payment: ${reason}`;
    return this.dispatch(workspaceId, userId, 'billing_failure', title, message, { reason });
  }

  // ========== AGENT EVENTS ==========

  static async onAgentApprovalRequested(workspaceId, userId, agentName, agentFingerprint) {
    const title = `Agent Access Request`;
    const message = `${agentName} is requesting access to your MyApi services`;
    return this.dispatch(workspaceId, userId, 'agent_approval_request', title, message, { 
      agentName, 
      agentFingerprint,
      actionUrl: `/dashboard/approvals/${agentFingerprint}`
    });
  }
}

module.exports = NotificationDispatcher;
