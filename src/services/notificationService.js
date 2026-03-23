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
    const baseStyles = `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
      padding: 20px;
      color: #374151;
    `;
    
    const templates = {
      device_approval_requested: `
        <div style="${baseStyles}">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="color: #dc2626; margin: 0 0 20px 0;">🔐 ${title}</h2>
            <p>${message}</p>
            <p style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626;">
              <strong>Device Info:</strong><br>
              ${options.data?.deviceInfo || 'Unknown Device'}<br>
              IP: ${options.data?.ipAddress || 'Unknown'}
            </p>
            <p>
              <a href="${options.actionUrl || 'https://www.myapiai.com/dashboard/devices'}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Review & Approve
              </a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #9ca3af;">
              This is an automated notification from MyApi. <a href="https://www.myapiai.com/settings#notifications" style="color: #2563eb;">Manage your notification preferences</a>
            </p>
          </div>
        </div>
      `,
      
      skill_liked: `
        <div style="${baseStyles}">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="color: #dc2626; margin: 0 0 20px 0;">❤️ ${title}</h2>
            <p>${message}</p>
            <p>
              <a href="${options.actionUrl || 'https://www.myapiai.com/dashboard/skills'}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                View Skill
              </a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #9ca3af;">
              This is an automated notification from MyApi. <a href="https://www.myapiai.com/settings#notifications" style="color: #2563eb;">Manage your notification preferences</a>
            </p>
          </div>
        </div>
      `,
      
      // Default template for other types
      default: `
        <div style="${baseStyles}">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">${title}</h2>
            <p>${message}</p>
            <p>
              <a href="https://www.myapiai.com/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                View Details
              </a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #9ca3af;">
              This is an automated notification from MyApi. <a href="https://www.myapiai.com/settings#notifications" style="color: #2563eb;">Manage your notification preferences</a>
            </p>
          </div>
        </div>
      `,
    };
    
    return templates[type] || templates.default;
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
