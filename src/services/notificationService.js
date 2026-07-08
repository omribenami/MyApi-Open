/**
 * Notification Service
 * Handles creating notifications, checking user settings, and queueing emails
 */

const db = require('../database');
const crypto = require('crypto');

class NotificationService {
  // Security-critical types are always delivered in-app regardless of per-type
  // preferences — a user must not be able to silence their own compromise alerts.
  static ALWAYS_IN_APP = new Set(['security_alert']);

  /**
   * Resolve whether a channel should deliver this notification type, combining the
   * channel-level enabled flag with the per-type toggles the Settings UI saves into
   * notification_preferences.type_settings. Types default to enabled when unset.
   */
  static isTypeEnabled(channelPrefs, type, { alwaysOn = false } = {}) {
    if (alwaysOn) return true;
    if (channelPrefs?.enabled !== 1) return false;
    let typeSettings = {};
    try { typeSettings = JSON.parse(channelPrefs.type_settings || '{}'); } catch (_) {}
    return typeSettings[type] !== 0;
  }

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

      // Channel-level preference combined with the per-type toggle. These per-type
      // settings were previously saved by the Settings UI but never read — toggling
      // a type off had no effect.
      const webEnabled = this.isTypeEnabled(settings.inApp, type, { alwaysOn: this.ALWAYS_IN_APP.has(type) });
      const emailEnabled = this.isTypeEnabled(settings.email, type);
      
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
      
      // Queue email if enabled (callers may pass skipEmail:true when a dedicated
      // transactional email already handles this notification type)
      if (emailEnabled && !options.skipEmail) {
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
      device_approval_requested:     '[Action Required]',
      device_approved:               '[MyApi]',
      device_revoked:                '[MyApi]',
      skill_liked:                   '[MyApi]',
      skill_used:                    '[MyApi]',
      skill_installed:               '[MyApi]',
      skill_removed:                 '[MyApi]',
      persona_invoked:               '[MyApi]',
      guest_token_used:              '[MyApi]',
      token_created:                 '[MyApi]',
      token_revoked:                 '[MyApi]',
      security_alert:                '[Security Alert]',
      oauth_reconnect_required:      '[Action Required]',
      service_connected:             '[MyApi]',
      oauth_connected:               '[MyApi]',
      oauth_disconnected:            '[MyApi]',
      security_new_device:           '[Action Required]',
      security_2fa_enabled:          '[MyApi]',
      security_2fa_disabled:         '[Security Alert]',
      security_device_approved:      '[MyApi]',
      security_device_revoked:       '[MyApi]',
      billing_quota_warning:         '[MyApi]',
      billing_quota_exceeded:        '[Action Required]',
      billing_failure:               '[Action Required]',
      billing_subscription_upgraded: '[MyApi]',
      team_invitation:               '[Action Required]',
      team_invite_accepted:          '[MyApi]',
      team_invite_sent:              '[MyApi]',
      agent_approval_request:        '[Action Required]',
    };

    return `${prefixes[type] || '[MyApi]'} ${title}`;
  }

  /**
   * Generate HTML email template for notification — new design (GitHub dark theme)
   */
  static generateEmailTemplate(type, title, message, options = {}) {
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || process.env.APP_BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const settingsUrl = `${base}/dashboard/settings`;

    // Badge: [text, bg rgba, text color, border rgba]
    const typeBadge = {
      device_approval_requested:     ['APPROVAL REQUIRED', 'rgba(68,147,248,0.15)',  '#4493f8', 'rgba(68,147,248,0.35)'],
      device_approved:               ['DEVICE APPROVED',   'rgba(63,185,80,0.15)',   '#3fb950', 'rgba(63,185,80,0.3)'],
      device_revoked:                ['ACCESS REVOKED',    'rgba(248,81,73,0.15)',   '#f85149', 'rgba(248,81,73,0.3)'],
      skill_liked:                   ['LIKED',             'rgba(219,68,171,0.15)',  '#db44ab', 'rgba(219,68,171,0.3)'],
      skill_used:                    ['SKILL USED',        'rgba(124,58,237,0.15)',  '#a371f7', 'rgba(124,58,237,0.3)'],
      skill_installed:               ['INSTALLED',         'rgba(124,58,237,0.15)',  '#a371f7', 'rgba(124,58,237,0.3)'],
      skill_removed:                 ['REMOVED',           'rgba(110,118,129,0.15)', '#6e7681', 'rgba(110,118,129,0.3)'],
      persona_invoked:               ['PERSONA USED',      'rgba(8,145,178,0.15)',   '#22d3ee', 'rgba(8,145,178,0.3)'],
      guest_token_used:              ['TOKEN USED',        'rgba(68,147,248,0.15)',  '#4493f8', 'rgba(68,147,248,0.35)'],
      token_created:                 ['TOKEN CREATED',     'rgba(63,185,80,0.15)',   '#3fb950', 'rgba(63,185,80,0.3)'],
      token_revoked:                 ['TOKEN REVOKED',     'rgba(248,81,73,0.15)',   '#f85149', 'rgba(248,81,73,0.3)'],
      security_alert:                ['SECURITY ALERT',    'rgba(248,81,73,0.15)',   '#f85149', 'rgba(248,81,73,0.3)'],
      oauth_reconnect_required:      ['RECONNECT NEEDED',  'rgba(210,153,34,0.15)',  '#d2a022', 'rgba(210,153,34,0.3)'],
      service_connected:             ['CONNECTED',         'rgba(63,185,80,0.15)',   '#3fb950', 'rgba(63,185,80,0.3)'],
      oauth_connected:               ['CONNECTED',         'rgba(63,185,80,0.15)',   '#3fb950', 'rgba(63,185,80,0.3)'],
      oauth_disconnected:            ['DISCONNECTED',      'rgba(110,118,129,0.15)', '#6e7681', 'rgba(110,118,129,0.3)'],
      security_new_device:           ['APPROVAL REQUIRED', 'rgba(68,147,248,0.15)',  '#4493f8', 'rgba(68,147,248,0.35)'],
      security_2fa_enabled:          ['2FA ENABLED',       'rgba(63,185,80,0.15)',   '#3fb950', 'rgba(63,185,80,0.3)'],
      security_2fa_disabled:         ['2FA DISABLED',      'rgba(210,153,34,0.15)',  '#d2a022', 'rgba(210,153,34,0.3)'],
      security_device_approved:      ['DEVICE APPROVED',   'rgba(63,185,80,0.15)',   '#3fb950', 'rgba(63,185,80,0.3)'],
      security_device_revoked:       ['ACCESS REVOKED',    'rgba(248,81,73,0.15)',   '#f85149', 'rgba(248,81,73,0.3)'],
      billing_quota_warning:         ['QUOTA WARNING',     'rgba(210,153,34,0.15)',  '#d2a022', 'rgba(210,153,34,0.3)'],
      billing_quota_exceeded:        ['QUOTA EXCEEDED',    'rgba(248,81,73,0.15)',   '#f85149', 'rgba(248,81,73,0.3)'],
      billing_failure:               ['PAYMENT FAILED',    'rgba(248,81,73,0.15)',   '#f85149', 'rgba(248,81,73,0.3)'],
      billing_subscription_upgraded: ['PLAN UPGRADED',     'rgba(63,185,80,0.15)',   '#3fb950', 'rgba(63,185,80,0.3)'],
      team_invitation:               ['INVITATION',        'rgba(68,147,248,0.15)',  '#4493f8', 'rgba(68,147,248,0.35)'],
      team_invite_accepted:          ['ACCEPTED',          'rgba(63,185,80,0.15)',   '#3fb950', 'rgba(63,185,80,0.3)'],
      team_invite_sent:              ['INVITE SENT',       'rgba(68,147,248,0.15)',  '#4493f8', 'rgba(68,147,248,0.35)'],
      agent_approval_request:        ['AGENT REQUEST',     'rgba(124,58,237,0.15)',  '#a371f7', 'rgba(124,58,237,0.3)'],
    };

    const typeCtaUrl = {
      device_approval_requested: `${base}/dashboard/devices`,
      device_approved:           `${base}/dashboard/devices`,
      device_revoked:            `${base}/dashboard/devices`,
      skill_liked:               `${base}/dashboard/skills`,
      skill_used:                `${base}/dashboard/skills`,
      skill_installed:           `${base}/dashboard/skills`,
      skill_removed:             `${base}/dashboard/skills`,
      persona_invoked:           `${base}/dashboard/personas`,
      guest_token_used:          `${base}/dashboard/access-tokens`,
      token_created:             `${base}/dashboard/access-tokens`,
      token_revoked:             `${base}/dashboard/access-tokens`,
      security_alert:            `${base}/dashboard/devices`,
      oauth_reconnect_required:  `${base}/dashboard/services`,
      service_connected:         `${base}/dashboard/services`,
      oauth_connected:           `${base}/dashboard/services`,
      oauth_disconnected:        `${base}/dashboard/services`,
      security_new_device:       `${base}/dashboard/devices`,
      security_2fa_enabled:      settingsUrl,
      security_2fa_disabled:     settingsUrl,
      security_device_approved:  `${base}/dashboard/devices`,
      security_device_revoked:   `${base}/dashboard/devices`,
      billing_quota_warning:     `${base}/dashboard/billing`,
      billing_quota_exceeded:    `${base}/dashboard/billing`,
      billing_failure:           `${base}/dashboard/billing`,
      billing_subscription_upgraded: `${base}/dashboard/billing`,
      team_invitation:           `${base}/dashboard/workspaces`,
      team_invite_accepted:      `${base}/dashboard/workspaces`,
      team_invite_sent:          `${base}/dashboard/workspaces`,
      agent_approval_request:    `${base}/dashboard/approvals`,
    };

    const typeCtaLabel = {
      device_approval_requested: 'Review &amp; Approve',
      device_approved:           'View Devices',
      device_revoked:            'Manage Devices',
      skill_liked:               'View Skill',
      skill_used:                'View Skill',
      skill_installed:           'View Skills',
      skill_removed:             'View Skills',
      persona_invoked:           'View Personas',
      guest_token_used:          'Manage Tokens',
      token_created:             'View Tokens',
      token_revoked:             'Manage Tokens',
      security_alert:            'Review & Re-approve',
      oauth_reconnect_required:  'Reconnect Service',
      service_connected:         'View Services',
      oauth_connected:           'View Services',
      oauth_disconnected:        'Manage Services',
      security_new_device:       'Review Devices',
      security_2fa_enabled:      'Security Settings',
      security_2fa_disabled:     'Re-enable 2FA',
      security_device_approved:  'View Devices',
      security_device_revoked:   'Manage Devices',
      billing_quota_warning:     'View Usage',
      billing_quota_exceeded:    'Upgrade Plan',
      billing_failure:           'Update Payment',
      billing_subscription_upgraded: 'View Plan',
      team_invitation:           'Accept Invitation',
      team_invite_accepted:      'View Workspace',
      team_invite_sent:          'View Invitations',
      agent_approval_request:    'Review Request',
    };

    const badge = typeBadge[type] || ['NOTIFICATION', 'rgba(68,147,248,0.15)', '#4493f8', 'rgba(68,147,248,0.35)'];
    const ctaUrl = options.actionUrl || typeCtaUrl[type] || `${base}/dashboard`;
    const ctaLabel = typeCtaLabel[type] || 'Open MyApi';

    // Type-specific info block
    let infoBlock = '';

    if ((type === 'device_approval_requested' || type === 'security_new_device') &&
        (options.data?.deviceInfo || options.data?.deviceName || options.data?.ipAddress)) {
      const deviceLabel = options.data?.deviceInfo || options.data?.deviceName || 'Unknown device';
      const ipLabel = options.data?.ipAddress || 'Unknown';
      infoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(56,139,253,0.06);border:1px solid rgba(68,147,248,0.2);border-radius:6px;margin:16px 0 4px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;margin-bottom:8px;">NEW DEVICE</div>
          <div style="font-size:13px;color:#f0f6fc;margin-bottom:4px;">${deviceLabel}</div>
          <div style="font-size:12px;color:#9198a1;font-family:'JetBrains Mono',monospace;">${ipLabel}</div>
        </td></tr>
      </table>`;
    } else if ((type === 'device_revoked' || type === 'security_device_revoked') &&
               (options.data?.deviceName || options.data?.deviceInfo)) {
      const deviceLabel = options.data?.deviceName || options.data?.deviceInfo || 'Unknown device';
      infoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(248,81,73,0.06);border:1px solid rgba(248,81,73,0.25);border-radius:6px;margin:16px 0 4px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#f85149;margin-bottom:8px;">REVOKED DEVICE</div>
          <div style="font-size:13px;font-weight:600;color:#f0f6fc;">${deviceLabel}</div>
        </td></tr>
      </table>`;
    } else if ((type === 'billing_quota_warning' || type === 'billing_quota_exceeded') &&
               (options.percentageUsed != null || options.data?.percentageUsed != null)) {
      const pct = options.percentageUsed ?? options.data?.percentageUsed ?? 0;
      const barColor = pct >= 100 ? '#f85149' : pct >= 80 ? '#d2a022' : '#4493f8';
      const borderColor = pct >= 100 ? 'rgba(248,81,73,0.25)' : 'rgba(210,153,34,0.3)';
      const bgColor = pct >= 100 ? 'rgba(248,81,73,0.06)' : 'rgba(210,153,34,0.06)';
      const labelColor = pct >= 100 ? '#f85149' : '#d2a022';
      infoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColor};border:1px solid ${borderColor};border-radius:6px;margin:16px 0 4px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:${labelColor};margin-bottom:8px;">QUOTA USAGE</div>
          <div style="font-size:14px;font-weight:600;color:#f0f6fc;margin-bottom:10px;">${pct}% used</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2a313c;border-radius:3px;overflow:hidden;height:6px;">
            <tr><td width="${Math.min(pct, 100)}%" style="background:${barColor};height:6px;border-radius:3px;"></td><td></td></tr>
          </table>
        </td></tr>
      </table>`;
    } else if (type === 'team_invitation' && (options.data?.workspaceName || options.data?.inviterName)) {
      const wsName = options.data?.workspaceName || 'a workspace';
      const inviter = options.data?.inviterName || 'Someone';
      const role = options.data?.role || 'member';
      infoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(56,139,253,0.06);border:1px solid rgba(68,147,248,0.2);border-radius:6px;margin:16px 0 4px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;margin-bottom:8px;">INVITATION DETAILS</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding-right:24px;vertical-align:top;">
              <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;margin-bottom:3px;">WORKSPACE</div>
              <div style="font-size:13px;color:#f0f6fc;">${wsName}</div>
            </td><td style="padding-right:24px;vertical-align:top;">
              <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;margin-bottom:3px;">INVITED BY</div>
              <div style="font-size:13px;color:#f0f6fc;">${inviter}</div>
            </td><td style="vertical-align:top;">
              <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;margin-bottom:3px;">ROLE</div>
              <div style="font-size:13px;color:#f0f6fc;">${role}</div>
            </td></tr>
          </table>
        </td></tr>
      </table>`;
    } else if (type === 'agent_approval_request' && options.data?.agentName) {
      const agentName = options.data.agentName;
      const fingerprint = options.data.agentFingerprint || '';
      infoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.25);border-radius:6px;margin:16px 0 4px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#a371f7;margin-bottom:8px;">AGENT DETAILS</div>
          <div style="font-size:13px;font-weight:600;color:#f0f6fc;margin-bottom:${fingerprint ? '8px' : '0'};">${agentName}</div>
          ${fingerprint ? `<div style="font-size:12px;color:#9198a1;font-family:'JetBrains Mono',monospace;">${fingerprint}</div>` : ''}
        </td></tr>
      </table>`;
    }

    const logoSvg = `<svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/></linearGradient></defs><rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/><path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<meta name="supported-color-schemes" content="dark light"/>
<title>${title} — MyApi</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:20px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14px;line-height:1.6;margin:0 0 12px;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .foot{text-align:center;padding:20px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .foot{color:#afb8c1;} .foot a{color:#818b98;}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <!-- Header -->
    <div class="pad" style="padding-bottom:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle;padding-right:10px;">${logoSvg}</td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:${badge[1]};color:${badge[2]};font-family:'JetBrains Mono',monospace;font-size:10px;padding:3px 8px;border-radius:999px;border:1px solid ${badge[3]};letter-spacing:0.8px;">${badge[0]}</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <h1>${title}</h1>
      <p>${message}</p>
      ${infoBlock}
      <div style="margin:${infoBlock ? '20px' : '8px'} 0 4px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#1f6feb;color:#fff !important;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;border:1px solid rgba(240,246,252,0.1);text-decoration:none;">${ctaLabel} →</a>
      </div>
      <div style="border-top:1px solid #2a313c;margin:20px 0 16px;"></div>
      <p style="font-size:12px;color:#6e7681;margin:0;"><a href="${settingsUrl}" style="color:#6e7681;">Manage notification preferences</a></p>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="${base}/dashboard" style="color:#6e7681;">Dashboard</a>
            <a href="https://docs.myapiai.com" style="color:#6e7681;margin-left:12px;">Docs</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    MyApi · The privacy-first personal API platform<br/>
    <a href="${settingsUrl}">Manage preferences</a>
  </div>
</div>
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
