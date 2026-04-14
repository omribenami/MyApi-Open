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
      // Legacy types
      device_approval_requested: '🔐 New Device Approval Request',
      device_approved:           '✅ Device Approved',
      device_revoked:            '⛔ Device Access Revoked',
      skill_liked:               '❤️ Your Skill Was Liked',
      skill_used:                '▶️ Your Skill Was Used',
      persona_invoked:           '🤖 Your Persona Was Used',
      guest_token_used:          '👤 Guest Token Used',
      token_revoked:             '⛔ Token Revoked',
      service_connected:         '🔗 Service Connected',
      // Modern dispatcher types
      oauth_connected:               '🔌 Service Connected',
      oauth_disconnected:            '🔌 Service Disconnected',
      security_new_device:           '🛡️ New Device Login Detected',
      security_2fa_disabled:         '🔓 Two-Factor Authentication Disabled',
      security_device_revoked:       '⛔ Device Access Revoked',
      billing_quota_warning:         '⚠️ API Quota Warning',
      billing_quota_exceeded:        '🚨 API Quota Exceeded',
      billing_failure:               '💳 Payment Failed',
      billing_subscription_upgraded: '🎉 Plan Upgraded',
      team_invitation:               '👥 Team Invitation',
      team_invite_accepted:          '✅ Team Invitation Accepted',
      team_invite_sent:              '📨 Invitation Sent',
      agent_approval_request:        '🤖 Agent Access Request',
      skill_installed:               '⚙️ Skill Installed',
      skill_removed:                 '⚙️ Skill Removed',
    };

    return `${prefixes[type] || 'MyApi'}: ${title}`;
  }

  /**
   * Generate HTML email template for notification
   * Dark theme to match the welcome/goodbye email design
   */
  static generateEmailTemplate(type, title, message, options = {}) {
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || process.env.APP_BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const settingsUrl = `${base}/dashboard/settings`;

    const typeConfig = {
      // Legacy types
      device_approval_requested: { icon: '🔐', gradient: 'linear-gradient(135deg,#7f1d1d,#dc2626)', ctaLabel: 'Review & Approve', ctaUrl: `${base}/dashboard/devices` },
      device_approved:           { icon: '✅', gradient: 'linear-gradient(135deg,#14532d,#16a34a)', ctaLabel: 'View Devices',     ctaUrl: `${base}/dashboard/devices` },
      device_revoked:            { icon: '⛔', gradient: 'linear-gradient(135deg,#7f1d1d,#dc2626)', ctaLabel: 'Manage Devices',   ctaUrl: `${base}/dashboard/devices` },
      skill_liked:               { icon: '❤️', gradient: 'linear-gradient(135deg,#831843,#db2777)', ctaLabel: 'View Skill',       ctaUrl: `${base}/dashboard/skills` },
      skill_used:                { icon: '▶️', gradient: 'linear-gradient(135deg,#4c1d95,#7c3aed)', ctaLabel: 'View Skill',       ctaUrl: `${base}/dashboard/skills` },
      persona_invoked:           { icon: '🤖', gradient: 'linear-gradient(135deg,#164e63,#0891b2)', ctaLabel: 'View Personas',    ctaUrl: `${base}/dashboard/personas` },
      guest_token_used:          { icon: '👤', gradient: 'linear-gradient(135deg,#1e3a8a,#0369a1)', ctaLabel: 'Manage Tokens',    ctaUrl: `${base}/dashboard/access-tokens` },
      token_revoked:             { icon: '⛔', gradient: 'linear-gradient(135deg,#7f1d1d,#dc2626)', ctaLabel: 'Manage Tokens',    ctaUrl: `${base}/dashboard/access-tokens` },
      service_connected:         { icon: '🔗', gradient: 'linear-gradient(135deg,#1e3a8a,#2563eb)', ctaLabel: 'View Services',    ctaUrl: `${base}/dashboard/services` },
      // Modern dispatcher types
      oauth_connected:               { icon: '🔌', gradient: 'linear-gradient(135deg,#1e3a8a,#2563eb)', ctaLabel: 'View Services',    ctaUrl: `${base}/dashboard/services` },
      oauth_disconnected:            { icon: '🔌', gradient: 'linear-gradient(135deg,#78350f,#d97706)', ctaLabel: 'Manage Services',  ctaUrl: `${base}/dashboard/services` },
      security_new_device:           { icon: '🛡️', gradient: 'linear-gradient(135deg,#7f1d1d,#dc2626)', ctaLabel: 'Review Devices',   ctaUrl: `${base}/dashboard/devices` },
      security_2fa_disabled:         { icon: '🔓', gradient: 'linear-gradient(135deg,#78350f,#d97706)', ctaLabel: 'Re-enable 2FA',    ctaUrl: `${base}/dashboard/settings` },
      security_device_revoked:       { icon: '⛔', gradient: 'linear-gradient(135deg,#7f1d1d,#dc2626)', ctaLabel: 'Manage Devices',   ctaUrl: `${base}/dashboard/devices` },
      billing_quota_warning:         { icon: '⚠️', gradient: 'linear-gradient(135deg,#78350f,#d97706)', ctaLabel: 'View Usage',       ctaUrl: `${base}/dashboard/billing` },
      billing_quota_exceeded:        { icon: '🚨', gradient: 'linear-gradient(135deg,#7f1d1d,#dc2626)', ctaLabel: 'Upgrade Plan',     ctaUrl: `${base}/dashboard/billing` },
      billing_failure:               { icon: '💳', gradient: 'linear-gradient(135deg,#7f1d1d,#dc2626)', ctaLabel: 'Update Payment',   ctaUrl: `${base}/dashboard/billing` },
      billing_subscription_upgraded: { icon: '🎉', gradient: 'linear-gradient(135deg,#14532d,#16a34a)', ctaLabel: 'View Plan',        ctaUrl: `${base}/dashboard/billing` },
      team_invitation:               { icon: '👥', gradient: 'linear-gradient(135deg,#1e3a8a,#7c3aed)', ctaLabel: 'Accept Invitation', ctaUrl: `${base}/dashboard/workspaces` },
      team_invite_accepted:          { icon: '✅', gradient: 'linear-gradient(135deg,#14532d,#16a34a)', ctaLabel: 'View Workspace',   ctaUrl: `${base}/dashboard/workspaces` },
      team_invite_sent:              { icon: '📨', gradient: 'linear-gradient(135deg,#1e3a8a,#2563eb)', ctaLabel: 'View Invitations', ctaUrl: `${base}/dashboard/workspaces` },
      agent_approval_request:        { icon: '🤖', gradient: 'linear-gradient(135deg,#4c1d95,#7c3aed)', ctaLabel: 'Review Request',   ctaUrl: `${base}/dashboard/approvals` },
      skill_installed:               { icon: '⚙️', gradient: 'linear-gradient(135deg,#4c1d95,#7c3aed)', ctaLabel: 'View Skills',      ctaUrl: `${base}/dashboard/skills` },
      skill_removed:                 { icon: '⚙️', gradient: 'linear-gradient(135deg,#374151,#6b7280)', ctaLabel: 'View Skills',      ctaUrl: `${base}/dashboard/skills` },
    };

    const cfg = typeConfig[type] || { icon: '📢', gradient: 'linear-gradient(135deg,#1e3a8a,#7c3aed)', ctaLabel: 'Open MyApi', ctaUrl: `${base}/dashboard` };
    const ctaUrl = options.actionUrl || cfg.ctaUrl;

    // Build type-specific info block
    let infoBlock = '';

    if ((type === 'device_approval_requested' || type === 'security_new_device' || type === 'security_device_revoked') &&
        (options.data?.deviceInfo || options.data?.deviceName || options.data?.ipAddress || options.ip)) {
      const deviceLabel = options.data?.deviceInfo || options.data?.deviceName || 'Unknown device';
      const ipLabel = options.data?.ipAddress || options.ip || 'Unknown';
      infoBlock = `
            <tr><td style="padding:0 36px 20px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:10px;">
                <tr><td style="padding:16px 18px;font-size:14px;color:#fca5a5;line-height:1.8;">
                  <strong style="color:#fecaca;">Device:</strong> ${deviceLabel}<br>
                  <strong style="color:#fecaca;">IP address:</strong> ${ipLabel}
                </td></tr>
              </table>
            </td></tr>`;
    } else if ((type === 'billing_quota_warning' || type === 'billing_quota_exceeded') && options.percentageUsed != null) {
      const pct = options.percentageUsed || options.data?.percentageUsed || 0;
      const barColor = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#2563eb';
      infoBlock = `
            <tr><td style="padding:0 36px 20px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1a1500;border:1px solid #78350f;border-radius:10px;">
                <tr><td style="padding:16px 18px;">
                  <p style="margin:0 0 10px 0;font-size:14px;color:#fde68a;"><strong>${pct}%</strong> of monthly API quota used</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#292524;border-radius:6px;overflow:hidden;height:8px;">
                    <tr><td width="${Math.min(pct, 100)}%" style="background:${barColor};height:8px;border-radius:6px;"></td><td></td></tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>`;
    } else if (type === 'team_invitation' && (options.data?.workspaceName || options.data?.inviterName)) {
      const wsName = options.data?.workspaceName || 'a workspace';
      const inviter = options.data?.inviterName || 'Someone';
      const role = options.data?.role || 'member';
      infoBlock = `
            <tr><td style="padding:0 36px 20px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d1526;border:1px solid #1e3a8a;border-radius:10px;">
                <tr><td style="padding:16px 18px;font-size:14px;color:#93c5fd;line-height:1.8;">
                  <strong style="color:#bfdbfe;">Workspace:</strong> ${wsName}<br>
                  <strong style="color:#bfdbfe;">Invited by:</strong> ${inviter}<br>
                  <strong style="color:#bfdbfe;">Role:</strong> ${role}
                </td></tr>
              </table>
            </td></tr>`;
    } else if (type === 'agent_approval_request' && options.data?.agentName) {
      const agentName = options.data.agentName;
      const fingerprint = options.data.agentFingerprint || '';
      infoBlock = `
            <tr><td style="padding:0 36px 20px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#120d24;border:1px solid #4c1d95;border-radius:10px;">
                <tr><td style="padding:16px 18px;font-size:14px;color:#c4b5fd;line-height:1.8;">
                  <strong style="color:#ddd6fe;">Agent:</strong> ${agentName}${fingerprint ? `<br><strong style="color:#ddd6fe;">Fingerprint:</strong> <span style="font-family:monospace;font-size:12px;">${fingerprint}</span>` : ''}
                </td></tr>
              </table>
            </td></tr>`;
    }

    return `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;">

      <!-- Header -->
      <tr><td style="background:${cfg.gradient};border-radius:16px 16px 0 0;padding:28px 36px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td>
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td style="width:34px;height:34px;background:rgba(255,255,255,0.2);border-radius:50%;text-align:center;vertical-align:middle;">
                <span style="font-size:16px;line-height:34px;font-weight:900;color:#fff;">M</span>
              </td>
              <td style="padding-left:10px;font-size:18px;font-weight:700;color:#fff;letter-spacing:0.3px;">MyApi</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding-top:22px;">
            <p style="margin:0 0 6px 0;font-size:26px;">${cfg.icon}</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.3;">${title}</h1>
          </td></tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:28px 36px 20px 36px;">
        <p style="margin:0;font-size:15px;line-height:1.7;color:#cbd5e1;">${message}</p>
      </td></tr>

      ${infoBlock ? `<!-- Info block -->\n      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">\n        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${infoBlock}</table>\n      </td></tr>` : ''}

      <!-- CTA -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:8px 36px 28px 36px;">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr><td>
            <a href="${ctaUrl}" style="display:inline-block;background:${cfg.gradient};color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 28px;border-radius:10px;letter-spacing:0.2px;">${cfg.ctaLabel} →</a>
          </td></tr>
        </table>
      </td></tr>

      <!-- Quick links -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;border-top:1px solid #1e293b;padding:16px 36px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding:0 8px;">
              <a href="${base}/dashboard" style="font-size:12px;font-weight:600;color:#60a5fa;text-decoration:none;">Dashboard</a>
            </td>
            <td align="center" style="padding:0 8px;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
              <a href="${settingsUrl}" style="font-size:12px;font-weight:600;color:#60a5fa;text-decoration:none;">Settings</a>
            </td>
            <td align="center" style="padding:0 8px;">
              <a href="https://docs.myapiai.com" style="font-size:12px;font-weight:600;color:#60a5fa;text-decoration:none;">Docs</a>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#0a1120;border:1px solid #1e293b;border-top:none;border-radius:0 0 16px 16px;padding:18px 36px;">
        <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;text-align:center;">
          Sent from MyApi &nbsp;·&nbsp;
          <a href="${settingsUrl}" style="color:#3b82f6;text-decoration:none;">Manage notification preferences</a> &nbsp;·&nbsp;
          <a href="https://www.myapiai.com" style="color:#3b82f6;text-decoration:none;">myapiai.com</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
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
