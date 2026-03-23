/**
 * Notification Dispatcher
 * Wires system events to notification creation
 * Used internally by event handlers throughout the app
 */

const { createNotification, queueNotificationForDelivery, getOrCreateNotificationSettings } = require('../database');

class NotificationDispatcher {
  /**
   * Check if in-app notifications are enabled for a user
   */
  static isInAppEnabled(workspaceId, userId) {
    try {
      const settings = getOrCreateNotificationSettings(workspaceId, userId);
      return settings.inApp?.enabled === 1;
    } catch (err) {
      // Default to enabled if we can't check preferences
      return true;
    }
  }

  /**
   * OAuth service connected event
   */
  static async onServiceConnected(workspaceId, userId, serviceName) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} Connected`;
      const message = `Your ${serviceName} account has been successfully linked to MyApi`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'oauth_connected',
        title,
        message,
        { serviceName, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Service connected: ${serviceName} for user ${userId}`);
    } catch (err) {
      console.error('Error creating service_connected notification:', err);
    }
  }

  /**
   * OAuth service disconnected event
   */
  static async onServiceDisconnected(workspaceId, userId, serviceName) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} Disconnected`;
      const message = `Your ${serviceName} account has been removed from MyApi`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'oauth_disconnected',
        title,
        message,
        { serviceName, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Service disconnected: ${serviceName} for user ${userId}`);
    } catch (err) {
      console.error('Error creating service_disconnected notification:', err);
    }
  }

  /**
   * Skill installed event
   */
  static async onSkillInstalled(workspaceId, userId, skillName, skillId) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Skill Installed: ${skillName}`;
      const message = `You've successfully installed the "${skillName}" skill`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'skill_installed',
        title,
        message,
        { skillId, skillName, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Skill installed: ${skillName} for user ${userId}`);
    } catch (err) {
      console.error('Error creating skill_installed notification:', err);
    }
  }

  /**
   * Skill removed event
   */
  static async onSkillRemoved(workspaceId, userId, skillName, skillId) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Skill Removed: ${skillName}`;
      const message = `The "${skillName}" skill has been removed from your workspace`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'skill_removed',
        title,
        message,
        { skillId, skillName, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Skill removed: ${skillName} for user ${userId}`);
    } catch (err) {
      console.error('Error creating skill_removed notification:', err);
    }
  }

  /**
   * Team member invited event
   */
  static async onTeamMemberInvited(workspaceId, userId, invitedEmail, role) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Team Member Invited`;
      const message = `You've invited ${invitedEmail} to join as ${role}`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'team_invite_sent',
        title,
        message,
        { email: invitedEmail, role, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Team member invited: ${invitedEmail}`);
    } catch (err) {
      console.error('Error creating team_invite_sent notification:', err);
    }
  }

  /**
   * Team invitation accepted event
   */
  static async onTeamInvitationAccepted(workspaceId, userId, memberName) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Team Invitation Accepted`;
      const message = `${memberName} has accepted your team invitation`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'team_invite_accepted',
        title,
        message,
        { memberName, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Team invitation accepted by: ${memberName}`);
    } catch (err) {
      console.error('Error creating team_invite_accepted notification:', err);
    }
  }

  /**
   * Login from new device event
   */
  static async onNewDeviceLogin(workspaceId, userId, deviceName, ip) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `New Login from ${deviceName}`;
      const message = `Your account was accessed from a new device at ${ip}`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'security_new_device',
        title,
        message,
        { deviceName, ip, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] New device login: ${deviceName} from ${ip}`);
    } catch (err) {
      console.error('Error creating security_new_device notification:', err);
    }
  }

  /**
   * 2FA disabled event
   */
  static async on2FADisabled(workspaceId, userId) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Two-Factor Authentication Disabled`;
      const message = `Your account's 2FA has been disabled. Your account is less secure.`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'security_2fa_disabled',
        title,
        message,
        { timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] 2FA disabled for user ${userId}`);
    } catch (err) {
      console.error('Error creating security_2fa_disabled notification:', err);
    }
  }

  /**
   * 2FA enabled event
   */
  static async on2FAEnabled(workspaceId, userId) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Two-Factor Authentication Enabled`;
      const message = `Your account is now protected with 2FA`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'security_2fa_enabled',
        title,
        message,
        { timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] 2FA enabled for user ${userId}`);
    } catch (err) {
      console.error('Error creating security_2fa_enabled notification:', err);
    }
  }

  /**
   * API quota warning event
   */
  static async onQuotaWarning(workspaceId, userId, percentageUsed) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `API Quota Warning`;
      const message = `You've used ${percentageUsed}% of your monthly API quota`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'billing_quota_warning',
        title,
        message,
        { percentageUsed, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Quota warning: ${percentageUsed}% used`);
    } catch (err) {
      console.error('Error creating billing_quota_warning notification:', err);
    }
  }

  /**
   * Subscription upgraded event
   */
  static async onSubscriptionUpgraded(workspaceId, userId, planName) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Subscription Upgraded`;
      const message = `You've successfully upgraded to the ${planName} plan`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'billing_subscription_upgraded',
        title,
        message,
        { planName, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Subscription upgraded to: ${planName}`);
    } catch (err) {
      console.error('Error creating billing_subscription_upgraded notification:', err);
    }
  }

  /**
   * Billing failure event
   */
  static async onBillingFailure(workspaceId, userId, reason) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Billing Failed`;
      const message = `There was an issue processing your payment: ${reason}`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'billing_failure',
        title,
        message,
        { reason, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Billing failure: ${reason}`);
    } catch (err) {
      console.error('Error creating billing_failure notification:', err);
    }
  }

  /**
   * Device approved event
   */
  static async onDeviceApproved(workspaceId, userId, deviceName) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Device Approved`;
      const message = `Your device "${deviceName}" has been approved and can now access your account`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'security_device_approved',
        title,
        message,
        { deviceName, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Device approved: ${deviceName}`);
    } catch (err) {
      console.error('Error creating security_device_approved notification:', err);
    }
  }

  /**
   * Device revoked event
   */
  static async onDeviceRevoked(workspaceId, userId, deviceName) {
    try {
      if (!this.isInAppEnabled(workspaceId, userId)) return;
      const title = `Device Revoked`;
      const message = `Your device "${deviceName}" has been removed and can no longer access your account`;
      const notificationId = createNotification(
        workspaceId,
        userId,
        'security_device_revoked',
        title,
        message,
        { deviceName, timestamp: Date.now() }
      );
      queueNotificationForDelivery(notificationId, ['in-app']);
      console.log(`[Notification] Device revoked: ${deviceName}`);
    } catch (err) {
      console.error('Error creating security_device_revoked notification:', err);
    }
  }
}

module.exports = NotificationDispatcher;
