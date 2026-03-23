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

        const mailOptions = {
          from: `${this.fromName} <${this.fromAddress}>`,
          to: emailData.email_address,
          subject: emailData.subject,
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
