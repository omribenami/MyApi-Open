/**
 * Email Service
 * Handles sending emails via SMTP, SendGrid, or Resend
 * Configured via environment variables
 */

const nodemailer = require('nodemailer');
const https = require('https');
const db = require('../database');

class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp'; // smtp or sendgrid
    this.transporter = null;
    this.fromAddress = process.env.EMAIL_FROM;
    this.fromName = process.env.EMAIL_FROM_NAME || 'MyApi';
    console.log('[EmailService] Initialized:', {
      provider: this.provider,
      fromAddress: this.fromAddress,
      fromName: this.fromName,
      resendKeySet: !!process.env.RESEND_API_KEY
    });
    this.initTransporter();
  }

  initTransporter() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
    this.fromAddress = process.env.EMAIL_FROM;
    this.fromName = process.env.EMAIL_FROM_NAME || 'MyApi';
    this.resendApiKey = process.env.RESEND_API_KEY;

    if (this.provider === 'resend') {
      // Resend uses API, not traditional SMTP
      this.transporter = null; // Will use sendEmailViaResend()
    } else if (this.provider === 'sendgrid') {
      // SendGrid via nodemailer
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });
    } else {
      // Standard SMTP (default)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
      });
    }
  }

  getConfigStatus() {
    const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
    const fromAddress = process.env.EMAIL_FROM || null;
    const fromName = process.env.EMAIL_FROM_NAME || 'MyApi';
    const missing = [];

    if (!fromAddress) missing.push('EMAIL_FROM');

    if (provider === 'resend') {
      if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
    } else if (provider === 'sendgrid') {
      if (!process.env.SENDGRID_API_KEY) missing.push('SENDGRID_API_KEY');
    } else {
      if (!process.env.SMTP_HOST) missing.push('SMTP_HOST');
      if (!process.env.SMTP_PORT) missing.push('SMTP_PORT');
      if (process.env.SMTP_USER && !process.env.SMTP_PASSWORD) missing.push('SMTP_PASSWORD');
    }

    const authTypeMap = {
      resend: 'api_key',
      sendgrid: 'api_key',
      smtp: 'smtp',
    };

    return {
      provider,
      fromAddress,
      fromName,
      requiredDeploymentFrom: 'noreply@myapiai.com',
      configured: missing.length === 0,
      missing,
      authType: authTypeMap[provider] || 'smtp',
    };
  }

  /**
   * Send email via Resend API
   */
  async sendEmailViaResend(emailData) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: emailData.email_address,
        subject: emailData.subject,
        html: emailData.html_body || emailData.body,
      });

      const options = {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${this.resendApiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, messageId: response.id });
            } else {
              reject(new Error(`Resend API error: ${response.message || res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Resend response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Send a single email from the queue
   */
  async sendEmail(emailId, emailData) {
    try {
      console.log('[sendEmail] Checking fromAddress:', {
        fromAddress: this.fromAddress,
        provider: this.provider,
        to: emailData.email_address
      });
      
      if (!this.fromAddress) {
        throw new Error('EMAIL_FROM is not configured (required deployment value: noreply@myapiai.com)');
      }

      let info;
      if (this.provider === 'resend') {
        if (!this.resendApiKey) {
          throw new Error('RESEND_API_KEY not configured');
        }
        info = await this.sendEmailViaResend(emailData);
      } else {
        if (!this.transporter) {
          throw new Error('Email service not configured');
        }

        // Sanitize email headers to prevent injection via \r\n sequences
        const sanitizeHeader = (v) => typeof v === 'string' ? v.replace(/[\r\n\0]/g, '') : '';
        const safeEmail = sanitizeHeader(emailData.email_address);
        const safeSubject = sanitizeHeader(emailData.subject);
        // Basic email address validation
        if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
          throw new Error(`Invalid email address: ${safeEmail}`);
        }

        const mailOptions = {
          from: `${this.fromName} <${this.fromAddress}>`,
          to: safeEmail,
          subject: safeSubject,
          html: emailData.html_body || emailData.body,
          text: emailData.body,
        };

        info = await this.transporter.sendMail(mailOptions);
      }
      
      // Mark as sent in database
      db.markEmailAsSent(emailId);
      
      console.log(`Email sent: ${emailId} to ${emailData.email_address}`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`Failed to send email ${emailId}:`, error);
      
      // Mark as failed with reason
      db.markEmailAsFailed(emailId, error.message);
      
      throw error;
    }
  }

  // ── Transactional emails ───────────────────────────────────────────────────

  /**
   * Send welcome email immediately after a new user registers.
   * Fire-and-forget: caller should not await, failures are logged only.
   */
  async sendWelcomeEmail(toEmail, displayName) {
    if (!toEmail || !this.fromAddress) return;
    const name = displayName || 'there';
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to MyApi</title></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 45%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:32px 36px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                <td style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="font-size:18px;line-height:36px;font-weight:900;color:#fff;">M</span>
                </td>
                <td style="padding-left:10px;font-size:20px;font-weight:700;color:#fff;letter-spacing:0.3px;">MyApi</td>
              </tr></table>
            </td>
          </tr>
          <tr><td style="padding-top:28px;">
            <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.65);letter-spacing:1px;text-transform:uppercase;">Welcome aboard</p>
            <h1 style="margin:0;font-size:30px;font-weight:800;color:#fff;line-height:1.25;">Hey ${name}, you're in! 🎉</h1>
          </td></tr>
        </table>
      </td></tr>

      <!-- Body card -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:36px 36px 24px 36px;">
        <p style="margin:0 0 20px 0;font-size:16px;line-height:1.7;color:#cbd5e1;">
          Your <strong style="color:#e2e8f0;">MyApi</strong> account is ready. You now have your own privacy-first API platform — connect 45+ services, build AI personas, and share capabilities with any agent or integration, all with fine-grained access control.
        </p>

        <!-- Feature grid -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
          <tr>
            <td width="48%" style="vertical-align:top;padding:0 8px 12px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px;">
                <tr><td>
                  <p style="margin:0 0 8px 0;font-size:22px;">🔌</p>
                  <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#f1f5f9;">Service Connectors</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Connect Gmail, GitHub, Slack, Discord, Notion, and 40+ more services in one place.</p>
                </td></tr>
              </table>
            </td>
            <td width="48%" style="vertical-align:top;padding:0 0 12px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px;">
                <tr><td>
                  <p style="margin:0 0 8px 0;font-size:22px;">🤖</p>
                  <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#f1f5f9;">AI Personas</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Create custom AI identities with their own personality, knowledge base, and access scopes.</p>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td width="48%" style="vertical-align:top;padding:0 8px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px;">
                <tr><td>
                  <p style="margin:0 0 8px 0;font-size:22px;">⚡</p>
                  <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#f1f5f9;">Skills & Automation</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Build and publish reusable scripts that any AI agent can discover and execute on your behalf.</p>
                </td></tr>
              </table>
            </td>
            <td width="48%" style="vertical-align:top;padding:0 0 0 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px;">
                <tr><td>
                  <p style="margin:0 0 8px 0;font-size:22px;">🔑</p>
                  <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#f1f5f9;">Access Tokens</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Issue scoped tokens for agents and integrations with per-resource permission control.</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- CTA -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
          <tr><td align="center">
            <a href="${base}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">Open My Dashboard →</a>
          </td></tr>
        </table>
      </td></tr>

      <!-- Quick links -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;border-top:1px solid #1e293b;padding:20px 36px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding:0 10px;">
              <a href="${base}/dashboard" style="display:inline-block;font-size:13px;font-weight:600;color:#60a5fa;text-decoration:none;">Dashboard</a>
            </td>
            <td align="center" style="padding:0 10px;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
              <a href="https://docs.myapiai.com" style="display:inline-block;font-size:13px;font-weight:600;color:#60a5fa;text-decoration:none;">Documentation</a>
            </td>
            <td align="center" style="padding:0 10px;">
              <a href="https://discord.gg/WPp4sCN4xB" style="display:inline-block;font-size:13px;font-weight:600;color:#60a5fa;text-decoration:none;">Discord Community</a>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#0a1120;border:1px solid #1e293b;border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;">
        <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;text-align:center;">
          You're receiving this because you just created a MyApi account.<br>
          <a href="${base}/dashboard/settings" style="color:#3b82f6;text-decoration:none;">Manage notification preferences</a> &nbsp;·&nbsp;
          <a href="https://www.myapiai.com" style="color:#3b82f6;text-decoration:none;">myapiai.com</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

    const data = {
      email_address: toEmail.trim(),
      subject: `Welcome to MyApi, ${name}! 🚀`,
      body: `Hey ${name}, welcome to MyApi! Your account is ready. Open your dashboard at ${base}/dashboard`,
      html_body: html,
    };

    try {
      if (this.provider === 'resend') {
        await this.sendEmailViaResend(data);
      } else {
        if (!this.transporter) throw new Error('Email service not configured');
        await this.transporter.sendMail({
          from: `${this.fromName} <${this.fromAddress}>`,
          to: data.email_address,
          subject: data.subject,
          text: data.body,
          html: data.html_body,
        });
      }
      console.log(`[Email] Welcome email sent to ${toEmail}`);
    } catch (err) {
      console.error(`[Email] Failed to send welcome email to ${toEmail}:`, err.message);
    }
  }

  /**
   * Send goodbye email when a user deletes their account.
   * Must be called BEFORE the user record is deleted.
   * Fire-and-forget: failures are logged only.
   */
  async sendGoodbyeEmail(toEmail, displayName) {
    if (!toEmail || !this.fromAddress) return;
    const name = displayName || 'there';
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goodbye from MyApi</title></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e3a8a 100%);border-radius:16px 16px 0 0;padding:32px 36px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                <td style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="font-size:18px;line-height:36px;font-weight:900;color:#fff;">M</span>
                </td>
                <td style="padding-left:10px;font-size:20px;font-weight:700;color:#fff;letter-spacing:0.3px;">MyApi</td>
              </tr></table>
            </td>
          </tr>
          <tr><td style="padding-top:28px;">
            <p style="margin:0 0 6px 0;font-size:22px;">👋</p>
            <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;line-height:1.3;">Until next time, ${name}</h1>
            <p style="margin:10px 0 0 0;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.5;">Your account has been deleted. We're sorry to see you go.</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Body card -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:36px 36px 24px 36px;">

        <p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:#cbd5e1;">
          As requested, your MyApi account and all associated data have been permanently deleted. We hope we were able to help you along the way.
        </p>

        <!-- What's gone -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1a1033;border:1px solid #312e81;border-radius:12px;margin:0 0 24px 0;">
          <tr><td style="padding:20px 22px;">
            <p style="margin:0 0 12px 0;font-size:13px;font-weight:700;color:#a5b4fc;letter-spacing:0.8px;text-transform:uppercase;">What was deleted</p>
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr><td style="padding:3px 0;font-size:13px;color:#94a3b8;">✓&nbsp; Your profile and account credentials</td></tr>
              <tr><td style="padding:3px 0;font-size:13px;color:#94a3b8;">✓&nbsp; All connected service tokens and OAuth connections</td></tr>
              <tr><td style="padding:3px 0;font-size:13px;color:#94a3b8;">✓&nbsp; Your personas, skills, and knowledge base</td></tr>
              <tr><td style="padding:3px 0;font-size:13px;color:#94a3b8;">✓&nbsp; All access tokens and API keys</td></tr>
            </table>
          </td></tr>
        </table>

        <!-- Come back section -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d2235;border:1px solid #1e3a5f;border-radius:12px;margin:0 0 28px 0;">
          <tr><td style="padding:22px;">
            <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#93c5fd;">We hope to see you again 💙</p>
            <p style="margin:0 0 16px 0;font-size:14px;color:#94a3b8;line-height:1.6;">
              If you ever decide to come back, your door is always open. Creating a new account takes less than a minute — and we're always adding new service integrations and features.
            </p>
            <a href="${base}/auth/register" style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:8px;">Create a new account</a>
          </td></tr>
        </table>

        <!-- Community -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1e293b;border:1px solid #334155;border-radius:12px;">
          <tr><td style="padding:20px 22px;">
            <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">
                  <p style="margin:0 0 2px 0;font-size:14px;font-weight:700;color:#f1f5f9;">Stay in touch</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;">Follow updates and chat with the community on Discord — no account needed.</p>
                </td>
                <td style="vertical-align:middle;padding-left:16px;white-space:nowrap;">
                  <a href="https://discord.gg/WPp4sCN4xB" style="display:inline-block;background:#5865F2;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 18px;border-radius:8px;">Join Discord</a>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>

      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#0a1120;border:1px solid #1e293b;border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;">
        <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;text-align:center;">
          This is a final confirmation of your account deletion. No further emails will be sent.<br>
          <a href="https://www.myapiai.com" style="color:#3b82f6;text-decoration:none;">myapiai.com</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

    const data = {
      email_address: toEmail.trim(),
      subject: `Goodbye from MyApi — your account has been deleted`,
      body: `Hi ${name}, your MyApi account has been permanently deleted. We hope to see you again someday. — The MyApi Team`,
      html_body: html,
    };

    try {
      if (this.provider === 'resend') {
        await this.sendEmailViaResend(data);
      } else {
        if (!this.transporter) throw new Error('Email service not configured');
        await this.transporter.sendMail({
          from: `${this.fromName} <${this.fromAddress}>`,
          to: data.email_address,
          subject: data.subject,
          text: data.body,
          html: data.html_body,
        });
      }
      console.log(`[Email] Goodbye email sent to ${toEmail}`);
    } catch (err) {
      console.error(`[Email] Failed to send goodbye email to ${toEmail}:`, err.message);
    }
  }

  /**
   * Waitlist confirmation email sent after POST /api/v1/waitlist.
   * Fire-and-forget: caller should not await.
   */
  async sendWaitlistConfirmationEmail(toEmail) {
    if (!toEmail || !this.fromAddress) return;
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're on the MyApi waitlist</title></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
      <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:28px 32px;">
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">MyApi Beta</p>
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.3;">You're on the waitlist</h1>
      </td></tr>
      <tr><td style="background:#0f172a;border:1px solid #1e293b;border-top:none;border-radius:0 0 16px 16px;padding:28px 32px;">
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
          Thanks for your interest in MyApi. We're currently at capacity during the closed beta, but we'll email you as soon as a spot opens up.
        </p>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
          In the meantime, feel free to join the conversation on Discord — early beta testers often hear about access there first.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 8px 0;">
          <tr><td align="center">
            <a href="https://discord.gg/WPp4sCN4xB" style="display:inline-block;background:#5865f2;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;">Join the Discord →</a>
          </td></tr>
        </table>
        <p style="margin:22px 0 0 0;font-size:12px;color:#475569;line-height:1.6;text-align:center;">
          <a href="${base}" style="color:#3b82f6;text-decoration:none;">myapiai.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
    const data = {
      email_address: toEmail.trim(),
      subject: "You're on the MyApi waitlist",
      body: `Thanks for your interest in MyApi. We're currently at capacity during the closed beta; we'll email you when a spot opens up. Join our Discord in the meantime: https://discord.gg/WPp4sCN4xB`,
      html_body: html,
    };
    try {
      if (this.provider === 'resend') {
        await this.sendEmailViaResend(data);
      } else {
        if (!this.transporter) throw new Error('Email service not configured');
        await this.transporter.sendMail({
          from: `${this.fromName} <${this.fromAddress}>`,
          to: data.email_address,
          subject: data.subject,
          text: data.body,
          html: data.html_body,
        });
      }
      console.log(`[Email] Waitlist confirmation sent to ${toEmail}`);
    } catch (err) {
      console.error(`[Email] Failed to send waitlist confirmation to ${toEmail}:`, err.message);
    }
  }

  /**
   * Beta-launch announcement sent to every pending waitlist entry when the
   * operator flips BETA off. Re-uses the welcome-email visual language.
   */
  async sendBetaLaunchEmail(toEmail) {
    if (!toEmail || !this.fromAddress) return;
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MyApi is now open</title></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;">

      <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 45%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:32px 36px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                <td style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="font-size:18px;line-height:36px;font-weight:900;color:#fff;">M</span>
                </td>
                <td style="padding-left:10px;font-size:20px;font-weight:700;color:#fff;letter-spacing:0.3px;">MyApi</td>
              </tr></table>
            </td>
          </tr>
          <tr><td style="padding-top:28px;">
            <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.65);letter-spacing:1px;text-transform:uppercase;">The waitlist is over</p>
            <h1 style="margin:0;font-size:30px;font-weight:800;color:#fff;line-height:1.25;">MyApi is now open — come on in 🎉</h1>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:36px 36px 28px 36px;">
        <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#cbd5e1;">
          Thanks for being patient during our closed beta. We've officially opened the doors and your spot is ready — no more waiting.
        </p>
        <p style="margin:0 0 22px 0;font-size:16px;line-height:1.7;color:#cbd5e1;">
          MyApi gives you a privacy-first personal API platform: connect 45+ services, build AI personas with scoped access, share skills, and issue per-agent tokens you can revoke at any time.
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
          <tr>
            <td width="48%" style="vertical-align:top;padding:0 8px 12px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px;">
                <tr><td>
                  <p style="margin:0 0 8px 0;font-size:22px;">🔐</p>
                  <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#f1f5f9;">Private by default</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Credentials stay encrypted in your vault. Agents only see what you allow.</p>
                </td></tr>
              </table>
            </td>
            <td width="48%" style="vertical-align:top;padding:0 0 12px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px;">
                <tr><td>
                  <p style="margin:0 0 8px 0;font-size:22px;">⚡</p>
                  <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#f1f5f9;">Built for AI agents</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">OAuth-ready, scope-aware, and speaks OpenAPI — plug into any agent stack.</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
          <tr><td align="center">
            <a href="${base}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">Create your account →</a>
          </td></tr>
        </table>

        <p style="margin:18px 0 0 0;font-size:13px;color:#64748b;line-height:1.6;text-align:center;">
          Or head straight to <a href="${base}" style="color:#60a5fa;text-decoration:none;">${base.replace(/^https?:\/\//, '')}</a> and sign in.
        </p>
      </td></tr>

      <tr><td style="background:#0a1120;border:1px solid #1e293b;border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;">
        <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;text-align:center;">
          You're receiving this because you joined the MyApi waitlist.<br>
          <a href="${base}" style="color:#3b82f6;text-decoration:none;">myapiai.com</a>
          &nbsp;·&nbsp;
          <a href="https://discord.gg/WPp4sCN4xB" style="color:#3b82f6;text-decoration:none;">Discord</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
    const data = {
      email_address: toEmail.trim(),
      subject: 'MyApi is now open — your spot is ready',
      body: `MyApi is now open. Create your account at ${base}.`,
      html_body: html,
    };
    try {
      if (this.provider === 'resend') {
        await this.sendEmailViaResend(data);
      } else {
        if (!this.transporter) throw new Error('Email service not configured');
        await this.transporter.sendMail({
          from: `${this.fromName} <${this.fromAddress}>`,
          to: data.email_address,
          subject: data.subject,
          text: data.body,
          html: data.html_body,
        });
      }
      console.log(`[Email] Beta launch email sent to ${toEmail}`);
    } catch (err) {
      console.error(`[Email] Failed to send beta launch email to ${toEmail}:`, err.message);
      throw err;
    }
  }

  async sendTestEmail(toEmail) {
    if (!toEmail || typeof toEmail !== 'string') {
      throw new Error('A valid destination email is required');
    }

    this.fromAddress = process.env.EMAIL_FROM;
    this.fromName = process.env.EMAIL_FROM_NAME || 'MyApi';
    if (!this.fromAddress) {
      throw new Error('EMAIL_FROM is not configured (required deployment value: noreply@myapiai.com)');
    }

    const now = new Date().toISOString();
    const testData = {
      email_address: toEmail.trim(),
      subject: 'MyApi email service test',
      body: `This is a test email from MyApi. Sent at ${now}.`,
      html_body: `<p>This is a test email from <strong>MyApi</strong>.</p><p>Sent at ${now}.</p>`,
    };

    let info;
    if (this.provider === 'resend') {
      if (!this.resendApiKey) {
        throw new Error('RESEND_API_KEY not configured');
      }
      info = await this.sendEmailViaResend(testData);
    } else {
      if (!this.transporter) {
        throw new Error('Email service not configured');
      }
      info = await this.transporter.sendMail({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: testData.email_address,
        subject: testData.subject,
        text: testData.body,
        html: testData.html_body,
      });
    }

    return { success: true, messageId: info.messageId, to: toEmail.trim(), sentAt: now };
  }

  /**
   * Process pending emails from the queue
   * Call this periodically (e.g., every 5 minutes via cron)
   */
  async processPendingEmails(limit = 50) {
    try {
      const pendingEmails = db.getPendingEmails(limit);
      
      if (pendingEmails.length === 0) {
        console.log('No pending emails to send');
        return { sent: 0, failed: 0 };
      }

      console.log(`Processing ${pendingEmails.length} pending emails...`);

      let sent = 0;
      let failed = 0;

      for (const email of pendingEmails) {
        try {
          await this.sendEmail(email.id, email);
          sent++;
        } catch (error) {
          console.error(`Failed to send email ${email.id}:`, error.message);
          failed++;
        }
      }

      console.log(`Email batch complete: ${sent} sent, ${failed} failed`);
      return { sent, failed };
    } catch (error) {
      console.error('Error processing pending emails:', error);
      throw error;
    }
  }

  /**
   * Test the email configuration
   */
  async testConnection() {
    try {
      const config = this.getConfigStatus();
      if (!config.configured) {
        return {
          success: false,
          error: `Email is not fully configured. Missing: ${config.missing.join(', ')}`,
          config,
        };
      }

      if (this.provider === 'resend') {
        // For Resend, just verify the config is set
        console.log('✓ Resend email service configured');
        return { success: true, config, provider: 'resend' };
      }

      if (!this.transporter) {
        throw new Error('Email service not configured');
      }

      await this.transporter.verify();
      console.log('✓ Email service configured and ready');
      return { success: true, config };
    } catch (error) {
      console.error('✗ Email service configuration failed:', error.message);
      return { success: false, error: error.message, config: this.getConfigStatus() };
    }
  }
}

module.exports = new EmailService();
