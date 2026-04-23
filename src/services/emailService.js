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
  async sendWelcomeEmail(toEmail, displayName, masterToken = null) {
    if (!toEmail || !this.fromAddress) return;
    const name = displayName || 'there';
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<meta name="supported-color-schemes" content="dark light"/>
<title>Welcome to MyApi</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14.5px;line-height:1.6;margin:0 0 12px;}
  .btn{display:inline-block;background:#1f6feb;color:#fff !important;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:500;border:1px solid rgba(240,246,252,0.1);}
  .hairline{border-top:1px solid #2a313c;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .step{padding:12px 0;border-top:1px solid #1f252d;display:table;width:100%;}
  .step-num{display:table-cell;width:26px;vertical-align:top;padding-top:2px;}
  .step-num span{display:inline-block;width:22px;height:22px;border-radius:999px;background:rgba(56,139,253,0.15);color:#4493f8;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;text-align:center;line-height:22px;}
  .step-body{display:table-cell;vertical-align:top;}
  .step-title{color:#f0f6fc;font-size:14px;font-weight:600;margin:0 0 2px;}
  .step-desc{color:#9198a1;font-size:13px;line-height:1.5;margin:0;}
  .foot{text-align:center;padding:24px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .step{border-top-color:#eaeef2;} .step-title{color:#1f2328;}
    .hairline{border-top-color:#d1d9e0;} .foot{color:#afb8c1;} .foot a{color:#818b98;}
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
              <td style="vertical-align:middle;padding-right:10px;">
                <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/>
                  </linearGradient></defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/>
                  <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:rgba(63,185,80,0.15);color:#3fb950;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid rgba(63,185,80,0.3);letter-spacing:0.8px;">● OPEN BETA</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <div class="micro" style="margin-bottom:14px;">WELCOME ABOARD</div>
      <h1>Your gateway is live, ${name}.</h1>
      <p>Your account is ready. MyApi now sits between your data and every AI agent you give access to — one vault, scoped tokens, full audit.</p>
      <div style="margin:22px 0;">
        <a href="${base}/dashboard" class="btn">Open your dashboard →</a>
      </div>
      <div class="micro" style="margin-bottom:8px;">3 STEPS TO YOUR FIRST AGENT</div>
      <div class="step">
        <div class="step-num"><span>1</span></div>
        <div class="step-body">
          <p class="step-title">Connect a service</p>
          <p class="step-desc">OAuth into GitHub, Google, Slack, or any of 45+ providers. Raw tokens live in the vault — agents never see them.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num"><span>2</span></div>
        <div class="step-body">
          <p class="step-title">Shape a persona</p>
          <p class="step-desc">Define voice, system prompt, and refusal rules. Every agent using this persona speaks with one consistent voice.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num"><span>3</span></div>
        <div class="step-body">
          <p class="step-title">Issue a scoped token</p>
          <p class="step-desc">Give Claude, a CLI, or your own agent a token limited to exactly what it needs. Revoke in one click without rotating anything else.</p>
        </div>
      </div>
      <div class="hairline" style="margin:24px 0 18px;"></div>
      <p style="font-size:13px;">Questions? Reply to this email — it reaches a real person. Or drop into <a href="https://discord.gg/WPp4sCN4xB">our Discord</a>.</p>
      <p style="font-size:13px;color:#6e7681;margin-bottom:0;">— The MyApi team</p>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="https://docs.myapiai.com" style="color:#6e7681;margin-left:12px;">Docs</a>
            <a href="https://github.com/omribenami/MyApi-Open" style="color:#6e7681;margin-left:12px;">GitHub</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    MyApi · The privacy-first personal API platform<br/>
    <a href="${base}/dashboard/settings">Manage preferences</a>
  </div>
</div>
</body>
</html>`;

    const data = {
      email_address: toEmail.trim(),
      subject: `Welcome to MyApi, ${name}`,
      body: `Hi ${name}, your MyApi account is ready. Open your dashboard at ${base}/dashboard — auth · vault · audit.`,
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
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<title>Goodbye from MyApi</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14.5px;line-height:1.6;margin:0 0 12px;}
  .btn{display:inline-block;background:#1f6feb;color:#fff !important;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:500;border:1px solid rgba(240,246,252,0.1);}
  .hairline{border-top:1px solid #2a313c;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .foot{text-align:center;padding:24px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .hairline{border-top-color:#d1d9e0;} .foot{color:#afb8c1;} .foot a{color:#818b98;}
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
              <td style="vertical-align:middle;padding-right:10px;">
                <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/>
                  </linearGradient></defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/>
                  <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:rgba(110,118,129,0.15);color:#6e7681;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid rgba(110,118,129,0.3);letter-spacing:0.8px;">ACCOUNT CLOSED</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <div class="micro" style="margin-bottom:14px;">ACCOUNT DELETED</div>
      <h1>Until next time, ${name}.</h1>
      <p>As requested, your account and all associated data have been permanently deleted. We hope we were able to help along the way.</p>

      <!-- What was deleted -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(248,81,73,0.06);border:1px solid rgba(248,81,73,0.25);border-radius:6px;margin:16px 0 22px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#f85149;margin-bottom:10px;">WHAT WAS DELETED</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:3px 0;font-size:13px;color:#9198a1;">— Profile and account credentials</td></tr>
            <tr><td style="padding:3px 0;font-size:13px;color:#9198a1;">— Connected service tokens and OAuth connections</td></tr>
            <tr><td style="padding:3px 0;font-size:13px;color:#9198a1;">— Personas, skills, and knowledge base</td></tr>
            <tr><td style="padding:3px 0;font-size:13px;color:#9198a1;">— All access tokens and API keys</td></tr>
          </table>
        </td></tr>
      </table>

      <!-- Come back -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(56,139,253,0.06);border:1px solid rgba(68,147,248,0.25);border-radius:6px;margin:0 0 20px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 10px;font-size:14px;color:#f0f6fc;font-weight:600;">Your door is always open.</p>
          <p style="margin:0 0 14px;font-size:13px;color:#9198a1;line-height:1.5;">Creating a new account takes less than a minute — and we're always adding new service integrations.</p>
          <a href="${base}/auth/register" class="btn" style="font-size:13px;padding:9px 16px;">Create a new account →</a>
        </td></tr>
      </table>

      <div class="hairline" style="margin:20px 0 16px;"></div>

      <!-- Discord row -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:13px;color:#9198a1;">Stay in touch on Discord — no account needed.</p>
          </td>
          <td style="vertical-align:middle;padding-left:16px;white-space:nowrap;">
            <a href="https://discord.gg/WPp4sCN4xB" style="display:inline-block;background:#5865F2;color:#fff !important;text-decoration:none;font-size:13px;font-weight:500;padding:8px 16px;border-radius:6px;">Join Discord</a>
          </td>
        </tr>
      </table>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="https://www.myapiai.com" style="color:#6e7681;">myapiai.com</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    This is a final confirmation of your account deletion.<br/>No further emails will be sent.
  </div>
</div>
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
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<title>You're on the MyApi waitlist</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14.5px;line-height:1.6;margin:0 0 12px;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .hairline{border-top:1px solid #2a313c;}
  .foot{text-align:center;padding:24px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .hairline{border-top-color:#d1d9e0;} .foot{color:#afb8c1;} .foot a{color:#818b98;}
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
              <td style="vertical-align:middle;padding-right:10px;">
                <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/>
                  </linearGradient></defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/>
                  <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:rgba(56,139,253,0.15);color:#4493f8;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid rgba(68,147,248,0.35);letter-spacing:0.8px;">BETA</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <div class="micro" style="margin-bottom:14px;">WAITLIST CONFIRMED</div>
      <h1>You're on the list.</h1>
      <p>Thanks for your interest in MyApi. We're currently at capacity during the closed beta, but we'll email you as soon as a spot opens up.</p>
      <p>In the meantime, early beta testers often hear about access first on Discord — it's worth joining.</p>
      <div style="margin:22px 0;">
        <a href="https://discord.gg/WPp4sCN4xB" style="display:inline-block;background:#5865F2;color:#fff !important;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">Join the Discord →</a>
      </div>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="${base}" style="color:#6e7681;">myapiai.com</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    You'll receive one more email when your spot is ready.<br/>
    MyApi · The privacy-first personal API platform
  </div>
</div>
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
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<title>MyApi is now open</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14.5px;line-height:1.6;margin:0 0 12px;}
  .btn{display:inline-block;background:#1f6feb;color:#fff !important;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:500;border:1px solid rgba(240,246,252,0.1);}
  .hairline{border-top:1px solid #2a313c;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .step{padding:12px 0;border-top:1px solid #1f252d;display:table;width:100%;}
  .step-num{display:table-cell;width:26px;vertical-align:top;padding-top:2px;}
  .step-num span{display:inline-block;width:22px;height:22px;border-radius:999px;background:rgba(56,139,253,0.15);color:#4493f8;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;text-align:center;line-height:22px;}
  .step-body{display:table-cell;vertical-align:top;}
  .step-title{color:#f0f6fc;font-size:14px;font-weight:600;margin:0 0 2px;}
  .step-desc{color:#9198a1;font-size:13px;line-height:1.5;margin:0;}
  .foot{text-align:center;padding:24px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .step{border-top-color:#eaeef2;} .step-title{color:#1f2328;}
    .hairline{border-top-color:#d1d9e0;} .foot{color:#afb8c1;} .foot a{color:#818b98;}
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
              <td style="vertical-align:middle;padding-right:10px;">
                <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/>
                  </linearGradient></defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/>
                  <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:rgba(63,185,80,0.15);color:#3fb950;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid rgba(63,185,80,0.3);letter-spacing:0.8px;">● NOW OPEN</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <div class="micro" style="margin-bottom:14px;">YOUR SPOT IS READY</div>
      <h1>MyApi is open — come on in.</h1>
      <p>Thanks for being patient during our closed beta. The doors are open and your spot is ready — no more waiting.</p>
      <div style="margin:22px 0;">
        <a href="${base}" class="btn">Create your account →</a>
      </div>

      <div class="micro" style="margin-bottom:8px;">WHAT YOU GET</div>
      <div class="step">
        <div class="step-num"><span>1</span></div>
        <div class="step-body">
          <p class="step-title">45+ service connectors</p>
          <p class="step-desc">Connect GitHub, Google, Slack, Discord, Notion, and more. Credentials live in the vault — agents never see them.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num"><span>2</span></div>
        <div class="step-body">
          <p class="step-title">AI personas with scoped access</p>
          <p class="step-desc">Build identities with their own voice, knowledge base, and refusal rules. Each agent stays in its lane.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num"><span>3</span></div>
        <div class="step-body">
          <p class="step-title">Per-agent tokens, revocable instantly</p>
          <p class="step-desc">Issue scoped tokens for any agent or integration. One click to revoke — no secrets to rotate.</p>
        </div>
      </div>

      <div class="hairline" style="margin:24px 0 18px;"></div>
      <p style="font-size:13px;">Questions? <a href="https://discord.gg/WPp4sCN4xB">Join our Discord</a> — or just reply to this email.</p>
      <p style="font-size:13px;color:#6e7681;margin-bottom:0;">— The MyApi team</p>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="https://docs.myapiai.com" style="color:#6e7681;margin-left:12px;">Docs</a>
            <a href="https://github.com/omribenami/MyApi-Open" style="color:#6e7681;margin-left:12px;">GitHub</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    You're receiving this because you joined the MyApi waitlist.<br/>
    MyApi · The privacy-first personal API platform
  </div>
</div>
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

  async sendSecurityAlertEmail(toEmail, displayName, alert) {
    if (!toEmail || !this.fromAddress) return;
    const name = displayName || 'there';
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const approveUrl = alert.approvalId
      ? `${base}/dashboard/devices?approval=${alert.approvalId}`
      : `${base}/dashboard/devices`;
    const revokeUrl = `${base}/dashboard/access-tokens`;
    const detectedAt = alert.detectedAt ? new Date(alert.detectedAt).toUTCString() : new Date().toUTCString();
    const reasonRows = (alert.reasons || []).map(r =>
      `<tr><td style="padding:5px 0 5px 10px;font-size:13px;color:#ffa198;line-height:1.5;">— ${r}</td></tr>`
    ).join('');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<meta name="supported-color-schemes" content="dark light"/>
<title>Security Alert — MyApi</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14.5px;line-height:1.6;margin:0 0 12px;}
  .btn{display:inline-block;background:#1f6feb;color:#fff !important;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:500;border:1px solid rgba(240,246,252,0.1);}
  .hairline{border-top:1px solid #2a313c;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .foot{text-align:center;padding:24px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .hairline{border-top-color:#d1d9e0;} .foot{color:#afb8c1;} .foot a{color:#818b98;}
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
              <td style="vertical-align:middle;padding-right:10px;">
                <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/>
                  </linearGradient></defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/>
                  <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:rgba(248,81,73,0.15);color:#f85149;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid rgba(248,81,73,0.3);letter-spacing:0.8px;">! SECURITY ALERT</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <div class="micro" style="margin-bottom:14px;">ACTION REQUIRED</div>
      <h1>Suspicious activity detected, ${name}.</h1>
      <p>A token on your account was automatically suspended. Review the details below and either approve or revoke it.</p>

      <!-- Token info block -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(248,81,73,0.06);border:1px solid rgba(248,81,73,0.25);border-radius:6px;margin:4px 0 20px;">
        <tr><td style="padding:14px 16px;">
          <div class="micro" style="color:#f85149;margin-bottom:8px;">SUSPENDED TOKEN</div>
          <div style="font-size:14px;font-weight:600;color:#f0f6fc;margin-bottom:10px;">${alert.tokenName || 'Unknown'}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:24px;vertical-align:top;">
                <div class="micro" style="margin-bottom:3px;">TYPE</div>
                <div style="font-size:13px;color:#9198a1;">${(alert.tokenType || 'token').toUpperCase()}</div>
              </td>
              <td style="padding-right:24px;vertical-align:top;">
                <div class="micro" style="margin-bottom:3px;">NETWORK</div>
                <div style="font-size:13px;color:#9198a1;">${alert.asnInfo?.asnOrg || 'Unknown'}</div>
              </td>
              <td style="vertical-align:top;">
                <div class="micro" style="margin-bottom:3px;">DETECTED</div>
                <div style="font-size:13px;color:#9198a1;">${detectedAt}</div>
              </td>
            </tr>
          </table>
          ${reasonRows ? `<div style="margin-top:12px;border-top:1px solid rgba(248,81,73,0.2);padding-top:10px;"><div class="micro" style="color:#f85149;margin-bottom:6px;">REASONS</div><table role="presentation" cellpadding="0" cellspacing="0" border="0">${reasonRows}</table></div>` : ''}
        </td></tr>
      </table>

      <p style="font-size:13px;">If this was you — moved the agent to a new server or changed infrastructure — review and re-approve. If you don't recognise this, revoke the token immediately.</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
        <tr>
          <td style="padding-right:10px;">
            <a href="${approveUrl}" style="display:inline-block;background:rgba(63,185,80,0.15);color:#3fb950 !important;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;border:1px solid rgba(63,185,80,0.3);text-decoration:none;">Review &amp; Approve</a>
          </td>
          <td>
            <a href="${revokeUrl}" style="display:inline-block;background:rgba(248,81,73,0.1);color:#f85149 !important;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;border:1px solid rgba(248,81,73,0.3);text-decoration:none;">Revoke Token</a>
          </td>
        </tr>
      </table>

      <div class="hairline" style="margin:20px 0 16px;"></div>
      <p style="font-size:12px;color:#6e7681;margin:0;">If you did not expect this, revoke the token and check your connected agents. Questions? Reply to this email.</p>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="${base}/dashboard" style="color:#6e7681;">Dashboard</a>
            <a href="${base}/dashboard/access-tokens" style="color:#6e7681;margin-left:12px;">Tokens</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    Sent because suspicious activity was detected on your MyApi account.<br/>
    MyApi · The privacy-first personal API platform
  </div>
</div>
</body>
</html>`;

    await this._dispatchEmail(toEmail.trim(), `[Action Required] Security Alert — Token Suspended`, html);
  }

  async sendNewDeviceApprovalEmail(toEmail, displayName, details) {
    if (!toEmail || !this.fromAddress) return;
    const name = displayName || 'there';
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const approveUrl = details.approvalId
      ? `${base}/dashboard/devices?approval=${details.approvalId}`
      : `${base}/dashboard/devices`;
    const revokeUrl = `${base}/dashboard/access-tokens`;
    const tokenKindLabel = details.tokenKind === 'master' ? 'Master Token' : 'Guest / Scoped Token';
    const suspicious = details.suspiciousActivity?.suspicious;
    const warnings = details.suspiciousActivity?.warnings || [];
    const detectedAt = details.detectedAt ? new Date(details.detectedAt).toUTCString() : new Date().toUTCString();

    const whatHappened = details.originalDevice
      ? `Token <strong style="color:#f0f6fc;">"${details.tokenName || tokenKindLabel}"</strong> was previously approved for a specific device (${details.originalDevice.name || details.originalDevice.ip || 'original device'}). A different device is now trying to use it — blocked by default.`
      : `Token <strong style="color:#f0f6fc;">"${details.tokenName || tokenKindLabel}"</strong> was used for the first time from an unapproved device. MyApi requires explicit approval for every new device.`;

    const whatToDoText = suspicious
      ? `These signals suggest the token may have been obtained without your knowledge. <strong style="color:#ffa198;">If you did not initiate this, revoke the token immediately.</strong>`
      : `If intentional — you moved your agent to a new server, or you're testing from a cloud environment — approve below. Otherwise revoke the token.`;

    const warningsBlock = warnings.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(210,153,34,0.08);border:1px solid rgba(210,153,34,0.3);border-radius:6px;margin:0 0 18px;">
          <tr><td style="padding:12px 14px;">
            <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#d2a022;margin-bottom:8px;">SUSPICIOUS SIGNALS</div>
            ${warnings.map(w => `<div style="font-size:13px;color:#e3b341;margin-bottom:4px;">— ${w}</div>`).join('')}
          </td></tr>
        </table>`
      : '';

    const chipColor = suspicious
      ? 'background:rgba(210,153,34,0.15);color:#d2a022;border:1px solid rgba(210,153,34,0.3);'
      : 'background:rgba(68,147,248,0.15);color:#4493f8;border:1px solid rgba(68,147,248,0.35);';
    const chipLabel = suspicious ? '! SECURITY WARNING' : 'APPROVAL REQUIRED';

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<meta name="supported-color-schemes" content="dark light"/>
<title>${suspicious ? 'Security Warning' : 'New Device'} — MyApi</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14.5px;line-height:1.6;margin:0 0 12px;}
  .hairline{border-top:1px solid #2a313c;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .foot{text-align:center;padding:24px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .hairline{border-top-color:#d1d9e0;} .foot{color:#afb8c1;} .foot a{color:#818b98;}
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
              <td style="vertical-align:middle;padding-right:10px;">
                <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/>
                  </linearGradient></defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/>
                  <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:3px 8px;border-radius:999px;letter-spacing:0.8px;${chipColor}">${chipLabel}</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <div class="micro" style="margin-bottom:14px;">ACTION REQUIRED</div>
      <h1>${suspicious ? 'Suspicious device on your token, ' : 'New device needs approval, '}${name}.</h1>
      <p>${whatHappened}</p>

      <!-- Device details -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(56,139,253,0.06);border:1px solid rgba(68,147,248,0.2);border-radius:6px;margin:4px 0 18px;">
        <tr><td style="padding:14px 16px;">
          <div class="micro" style="margin-bottom:10px;">NEW DEVICE</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:top;padding-right:20px;padding-bottom:10px;">
                <div class="micro" style="margin-bottom:3px;">IP</div>
                <div style="font-size:13px;color:#f0f6fc;font-family:'JetBrains Mono',monospace;">${details.ip || 'Unknown'}</div>
              </td>
              <td style="vertical-align:top;padding-right:20px;padding-bottom:10px;">
                <div class="micro" style="margin-bottom:3px;">OS</div>
                <div style="font-size:13px;color:#f0f6fc;">${details.os || 'Unknown'}</div>
              </td>
              <td style="vertical-align:top;padding-bottom:10px;">
                <div class="micro" style="margin-bottom:3px;">BROWSER / AGENT</div>
                <div style="font-size:13px;color:#f0f6fc;">${details.browser || 'Unknown'}</div>
              </td>
            </tr>
            <tr>
              <td colspan="3" style="border-top:1px solid #1f252d;padding-top:10px;">
                <div class="micro" style="margin-bottom:3px;">TOKEN</div>
                <div style="font-size:13px;color:#f0f6fc;">${details.tokenName || tokenKindLabel} <span style="color:#6e7681;">(${tokenKindLabel})</span></div>
              </td>
            </tr>
            ${details.originalDevice ? `<tr><td colspan="3" style="border-top:1px solid #1f252d;padding-top:10px;"><div class="micro" style="margin-bottom:3px;">PREVIOUSLY APPROVED DEVICE</div><div style="font-size:13px;color:#9198a1;">${details.originalDevice.name || 'Unknown'} · ${details.originalDevice.ip || ''}</div></td></tr>` : ''}
            ${details.endpoint ? `<tr><td colspan="3" style="border-top:1px solid #1f252d;padding-top:10px;"><div class="micro" style="margin-bottom:3px;">ENDPOINT</div><div style="font-size:13px;color:#9198a1;font-family:'JetBrains Mono',monospace;">${details.endpoint}</div></td></tr>` : ''}
            <tr><td colspan="3" style="border-top:1px solid #1f252d;padding-top:10px;"><div class="micro" style="margin-bottom:3px;">DETECTED</div><div style="font-size:12px;color:#6e7681;">${detectedAt}</div></td></tr>
          </table>
        </td></tr>
      </table>

      ${warningsBlock}

      <p style="font-size:13px;">${whatToDoText}</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
        <tr>
          <td style="padding-right:10px;">
            <a href="${approveUrl}" style="display:inline-block;background:rgba(63,185,80,0.15);color:#3fb950 !important;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;border:1px solid rgba(63,185,80,0.3);text-decoration:none;">Approve This Device</a>
          </td>
          <td>
            <a href="${revokeUrl}" style="display:inline-block;background:rgba(248,81,73,0.1);color:#f85149 !important;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;border:1px solid rgba(248,81,73,0.3);text-decoration:none;">Revoke Token</a>
          </td>
        </tr>
      </table>
      <p style="font-size:12px;color:#6e7681;margin:0;">Approving allows this device to continue using the token. Revoking permanently disables it.</p>

      <div class="hairline" style="margin:20px 0 16px;"></div>
      <p style="font-size:12px;color:#6e7681;margin:0;">Questions? Reply to this email.</p>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="${base}/dashboard/devices" style="color:#6e7681;">Devices</a>
            <a href="${base}/dashboard/access-tokens" style="color:#6e7681;margin-left:12px;">Tokens</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    Sent because a new device attempted to use a token on your account.<br/>
    MyApi · The privacy-first personal API platform
  </div>
</div>
</body>
</html>`;

    const subject = suspicious
      ? `[Security Warning] Suspicious device attempting to use token "${details.tokenName || 'your token'}"`
      : `[Action Required] New device wants to use token "${details.tokenName || 'your token'}"`;
    await this._dispatchEmail(toEmail.trim(), subject, html);
  }

  async sendServiceConnectedEmail(toEmail, displayName, serviceName) {
    if (!toEmail || !this.fromAddress) return;
    const name = displayName || 'there';
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const label = serviceName ? serviceName.charAt(0).toUpperCase() + serviceName.slice(1) : 'A service';

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<meta name="supported-color-schemes" content="dark light"/>
<title>${label} connected — MyApi</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14.5px;line-height:1.6;margin:0 0 12px;}
  .btn{display:inline-block;background:#1f6feb;color:#fff !important;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:500;border:1px solid rgba(240,246,252,0.1);}
  .hairline{border-top:1px solid #2a313c;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .foot{text-align:center;padding:24px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .hairline{border-top-color:#d1d9e0;} .foot{color:#afb8c1;} .foot a{color:#818b98;}
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
              <td style="vertical-align:middle;padding-right:10px;">
                <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/>
                  </linearGradient></defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/>
                  <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:rgba(63,185,80,0.15);color:#3fb950;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid rgba(63,185,80,0.3);letter-spacing:0.8px;">● CONNECTED</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <div class="micro" style="margin-bottom:14px;">SERVICE CONNECTED</div>
      <h1>${label} is now in your vault.</h1>
      <p>The OAuth token for ${label} is encrypted and stored in your vault. Your agents can use ${label} through MyApi — they'll never see the raw credential.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(63,185,80,0.06);border:1px solid rgba(63,185,80,0.2);border-radius:6px;margin:4px 0 22px;">
        <tr><td style="padding:14px 16px;">
          <div class="micro" style="color:#3fb950;margin-bottom:8px;">WHAT THIS MEANS</div>
          <div style="font-size:13px;color:#9198a1;line-height:1.6;margin-bottom:6px;">— Token is AES-256-GCM encrypted at rest</div>
          <div style="font-size:13px;color:#9198a1;line-height:1.6;margin-bottom:6px;">— Agents access ${label} via scoped proxy — never the raw token</div>
          <div style="font-size:13px;color:#9198a1;line-height:1.6;">— Revoke access in one click without touching your ${label} account</div>
        </td></tr>
      </table>

      <div style="margin:22px 0;">
        <a href="${base}/dashboard/services" class="btn">Manage connected services →</a>
      </div>

      <div class="hairline" style="margin:20px 0 16px;"></div>
      <p style="font-size:13px;color:#6e7681;margin:0;">Not you? <a href="${base}/dashboard/services">Disconnect ${label}</a> immediately and change your ${label} password.</p>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="${base}/dashboard" style="color:#6e7681;">Dashboard</a>
            <a href="${base}/dashboard/services" style="color:#6e7681;margin-left:12px;">Services</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    Sent because a new service was connected to your MyApi account.<br/>
    MyApi · The privacy-first personal API platform
  </div>
</div>
</body>
</html>`;

    await this._dispatchEmail(toEmail.trim(), `${label} connected to your MyApi vault`, html);
  }

  async sendServiceDisconnectedEmail(toEmail, displayName, serviceName) {
    if (!toEmail || !this.fromAddress) return;
    const name = displayName || 'there';
    const base = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://www.myapiai.com').replace(/\/$/, '');
    const label = serviceName ? serviceName.charAt(0).toUpperCase() + serviceName.slice(1) : 'A service';

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<meta name="supported-color-schemes" content="dark light"/>
<title>${label} disconnected — MyApi</title>
<!--[if mso]><style>body,table,td,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#010409;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:#4493f8;text-decoration:none;}
  .wrap{background:#010409;padding:24px 16px;}
  .card{max-width:560px;margin:0 auto;background:#0d1117;border:1px solid #2a313c;border-radius:12px;overflow:hidden;}
  .pad{padding:28px 32px;}
  .micro{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6e7681;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;letter-spacing:-0.01em;color:#f0f6fc;line-height:1.3;}
  p{color:#9198a1;font-size:14.5px;line-height:1.6;margin:0 0 12px;}
  .btn{display:inline-block;background:#1f6feb;color:#fff !important;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:500;border:1px solid rgba(240,246,252,0.1);}
  .hairline{border-top:1px solid #2a313c;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#9198a1;}
  .foot{text-align:center;padding:24px 16px;color:#484f58;font-size:11.5px;line-height:1.5;}
  .foot a{color:#6e7681;}
  @media (prefers-color-scheme:light){
    body,.wrap{background:#f6f8fa;}
    .card{background:#fff;border-color:#d1d9e0;}
    h1{color:#1f2328;} p{color:#59636e;}
    .micro{color:#818b98;} .mono{color:#59636e;}
    .hairline{border-top-color:#d1d9e0;} .foot{color:#afb8c1;} .foot a{color:#818b98;}
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
              <td style="vertical-align:middle;padding-right:10px;">
                <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4A8CFF"/><stop offset="100%" stop-color="#6058FF"/>
                  </linearGradient></defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lg)"/>
                  <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </td>
              <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#f0f6fc;">MyApi</span></td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:rgba(110,118,129,0.15);color:#6e7681;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid rgba(110,118,129,0.3);letter-spacing:0.8px;">DISCONNECTED</span>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div class="pad" style="padding-top:16px;">
      <div class="micro" style="margin-bottom:14px;">SERVICE DISCONNECTED</div>
      <h1>Sorry to see ${label} go, ${name}.</h1>
      <p>The ${label} OAuth token has been removed from your vault. Agents that relied on it will no longer have access until you reconnect.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(110,118,129,0.06);border:1px solid rgba(110,118,129,0.2);border-radius:6px;margin:4px 0 22px;">
        <tr><td style="padding:14px 16px;">
          <div class="micro" style="margin-bottom:8px;">WHAT WAS REMOVED</div>
          <div style="font-size:13px;color:#9198a1;line-height:1.6;margin-bottom:6px;">— Encrypted ${label} token deleted from vault</div>
          <div style="font-size:13px;color:#9198a1;line-height:1.6;margin-bottom:6px;">— Remote token revocation attempted on ${label}</div>
          <div style="font-size:13px;color:#9198a1;line-height:1.6;">— Agents can no longer proxy ${label} requests</div>
        </td></tr>
      </table>

      <div style="margin:22px 0;">
        <a href="${base}/dashboard/services" class="btn">Reconnect ${label} →</a>
      </div>

      <div class="hairline" style="margin:20px 0 16px;"></div>
      <p style="font-size:13px;color:#6e7681;margin:0;">Didn't do this? <a href="${base}/dashboard/access-tokens">Review your tokens</a> and check for unauthorized activity.</p>
    </div>
    <!-- Footer bar -->
    <div style="background:#010409;border-top:1px solid #2a313c;padding:14px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="mono" style="font-size:10.5px;color:#484f58;">auth · vault · audit</td>
          <td style="text-align:right;" class="mono">
            <a href="${base}/dashboard" style="color:#6e7681;">Dashboard</a>
            <a href="${base}/dashboard/services" style="color:#6e7681;margin-left:12px;">Services</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
  <div class="foot">
    Sent because a service was disconnected from your MyApi account.<br/>
    MyApi · The privacy-first personal API platform
  </div>
</div>
</body>
</html>`;

    await this._dispatchEmail(toEmail.trim(), `${label} disconnected from your MyApi vault`, html);
  }

  async _dispatchEmail(toEmail, subject, html) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (this.provider === 'resend') {
      return this.sendEmailViaResend({ email_address: toEmail, subject, body: text, html_body: html });
    }
    if (this.transporter) {
      return this.transporter.sendMail({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: toEmail,
        subject,
        text,
        html,
      });
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
