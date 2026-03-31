/**
 * Notification Service
 * Handles creating notifications, checking user settings, and queueing emails
 */

const db = require('../database');
const crypto = require('crypto');

class NotificationService {
  /**
   * Emit a notification to a user
   * Checks user settings and creates notification + queues email if enabled
   */
  static async emitNotification(userId, type, title, message, options = {}) {
    try {
      // Get user settings (pass null as workspaceId so it resolves the user's workspace)
      const settings = db.getOrCreateNotificationSettings(null, userId);
      
      // Resolve the workspace ID from the returned preferences
      const workspaceId = settings.inApp?.workspace_id || settings.email?.workspace_id || db.getOrEnsureUserWorkspace(userId);
      
      // Check channel-level preferences
      const webEnabled = settings.inApp?.enabled === 1;
      const emailEnabled = settings.email?.enabled === 1;
      
      // Create in-app notification if web/in-app channel is enabled
      let notificationId = null;
      if (webEnabled) {
        notificationId = db.createNotification(workspaceId, userId, type, title, message, {
          relatedEntityType: options.relatedEntityType,
          relatedEntityId: options.relatedEntityId,
          data: options.data,
          actionUrl: options.actionUrl,
        });
      }
      
      // Queue email if enabled
      if (emailEnabled) {
        const user = db.db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
        if (user?.email) {
          this.queueNotificationEmail(userId, user.email, type, title, message, {
            notificationId,
            data: options.data,
          });
        }
      }
      
      return {
        notificationId,
        webEnabled,
        emailEnabled,
      };
    } catch (error) {
      console.error('Error emitting notification:', error);
      throw error;
    }
  }
  
  /**
   * Queue an email for a notification
   */
  static queueNotificationEmail(userId, emailAddress, type, title, message, options = {}) {
    const subject = this.getEmailSubject(type, title);
    const htmlBody = this.generateEmailTemplate(type, title, message, options);
    
    db.queueEmail(userId, emailAddress, subject, message, {
      notificationId: options.notificationId,
      htmlBody,
    });
  }
  
  /**
   * Get email subject for notification type
   */
  static getEmailSubject(type, title) {
    const prefixes = {
      device_approval_requested: '🔐 New Device Approval Request',
      device_approved: '✅ Device Approved',
      device_revoked: '⛔ Device Access Revoked',
      skill_liked: '❤️ Your Skill Was Liked',
      skill_used: '▶️ Your Skill Was Used',
      persona_invoked: '🤖 Your Persona Was Used',
      guest_token_used: '👤 Guest Token Used',
      token_revoked: '⛔ Token Revoked',
      service_connected: '🔗 Service Connected',
    };
    
    return `${prefixes[type] || 'MyApi'}: ${title}`;
  }
  
  /**
   * Generate HTML email template for notification
   */
  static generateEmailTemplate(type, title, message, options = {}) {
    const appUrl = process.env.APP_BASE_URL || 'https://www.myapiai.com';
    const settingsUrl = `${appUrl}/dashboard/settings`;

    const typeConfig = {
      device_approval_requested: { icon: '🔐', accentColor: '#dc2626', ctaLabel: 'Review & Approve', ctaUrl: `${appUrl}/dashboard/devices` },
      device_approved:           { icon: '✅', accentColor: '#16a34a', ctaLabel: 'View Devices',     ctaUrl: `${appUrl}/dashboard/devices` },
      device_revoked:            { icon: '⛔', accentColor: '#dc2626', ctaLabel: 'Manage Devices',   ctaUrl: `${appUrl}/dashboard/devices` },
      skill_liked:               { icon: '❤️', accentColor: '#db2777', ctaLabel: 'View Skill',       ctaUrl: `${appUrl}/dashboard/skills` },
      skill_used:                { icon: '▶️', accentColor: '#7c3aed', ctaLabel: 'View Skill',       ctaUrl: `${appUrl}/dashboard/skills` },
      persona_invoked:           { icon: '🤖', accentColor: '#0891b2', ctaLabel: 'View Personas',    ctaUrl: `${appUrl}/dashboard/personas` },
      guest_token_used:          { icon: '👤', accentColor: '#0369a1', ctaLabel: 'Manage Tokens',    ctaUrl: `${appUrl}/dashboard/access-tokens` },
      token_revoked:             { icon: '⛔', accentColor: '#dc2626', ctaLabel: 'Manage Tokens',    ctaUrl: `${appUrl}/dashboard/access-tokens` },
      service_connected:         { icon: '🔗', accentColor: '#2563eb', ctaLabel: 'View Services',    ctaUrl: `${appUrl}/dashboard/services` },
    };

    const cfg = typeConfig[type] || { icon: '📢', accentColor: '#2563eb', ctaLabel: 'Open MyApi', ctaUrl: `${appUrl}/dashboard` };
    const ctaUrl = options.actionUrl || cfg.ctaUrl;

    let extraBlock = '';
    if (type === 'device_approval_requested' && (options.data?.deviceInfo || options.data?.ipAddress)) {
      extraBlock = `
        <tr>
          <td style="padding:0 28px 16px 28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;font-size:14px;color:#7f1d1d;line-height:1.7;">
                  <strong>Device info:</strong> ${options.data?.deviceInfo || 'Unknown device'}<br>
                  <strong>IP address:</strong> ${options.data?.ipAddress || 'Unknown'}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }

    return `<!doctype html>
<html>
  <body style="margin:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px rgba(2,6,23,0.08);">
            <tr>
              <td style="background:linear-gradient(120deg,#2563eb 0%,#7c3aed 100%);padding:20px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <span style="display:inline-block;vertical-align:middle;color:#fff;font-size:20px;font-weight:700;letter-spacing:0.2px;">MyApi</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 28px 12px 28px;">
                <p style="margin:0 0 4px 0;font-size:22px;">${cfg.icon}</p>
                <h1 style="margin:8px 0 10px 0;font-size:20px;line-height:1.3;color:#0f172a;">${title}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${message}</p>
              </td>
            </tr>

            ${extraBlock}

            <tr>
              <td style="padding:20px 28px 28px 28px;">
                <a href="${ctaUrl}" style="display:inline-block;background:${cfg.accentColor};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;">${cfg.ctaLabel}</a>
                <p style="margin:12px 0 0 0;font-size:12px;color:#64748b;">Or copy this URL: <span style="color:#334155;word-break:break-all;">${ctaUrl}</span></p>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 28px 22px 28px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  This notification was sent from MyApi. <a href="${settingsUrl}" style="color:#2563eb;">Manage notification preferences</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
  
  /**
   * Log an activity to the activity log
   */
  static logActivity(userId, actionType, resourceType, options = {}) {
    try {
      db.createActivityLog(userId, actionType, resourceType, {
        resourceId: options.resourceId,
        resourceName: options.resourceName,
        actorType: options.actorType || 'user',
        actorId: options.actorId,
        actorName: options.actorName,
        details: options.details,
        result: options.result || 'success',
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}

module.exports = NotificationService;
