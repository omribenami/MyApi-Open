/**
 * Email Service
 * Handles sending emails via SMTP or SendGrid
 * Configured via environment variables
 */

const nodemailer = require('nodemailer');
const db = require('../database');

class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp'; // smtp or sendgrid
    this.transporter = null;
    this.fromAddress = process.env.EMAIL_FROM;
    this.fromName = process.env.EMAIL_FROM_NAME || 'MyApi';
    this.initTransporter();
  }

  initTransporter() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
    this.fromAddress = process.env.EMAIL_FROM;
    this.fromName = process.env.EMAIL_FROM_NAME || 'MyApi';

    if (this.provider === 'sendgrid') {
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
      // Standard SMTP
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
    const missing = [];

    if (!fromAddress) missing.push('EMAIL_FROM');

    if (provider === 'sendgrid') {
      if (!process.env.SENDGRID_API_KEY) missing.push('SENDGRID_API_KEY');
    } else {
      if (!process.env.SMTP_HOST) missing.push('SMTP_HOST');
      if (!process.env.SMTP_PORT) missing.push('SMTP_PORT');
      if (process.env.SMTP_USER && !process.env.SMTP_PASSWORD) missing.push('SMTP_PASSWORD');
    }

    return {
      provider,
      fromAddress,
      configured: missing.length === 0,
      missing,
      authType: provider === 'sendgrid' ? 'api_key' : 'smtp',
    };
  }

  /**
   * Send a single email from the queue
   */
  async sendEmail(emailId, emailData) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not configured');
      }

      if (!this.fromAddress) {
        throw new Error('EMAIL_FROM is not configured');
      }

      const mailOptions = {
        from: `${this.fromName} <${this.fromAddress}>`,
        to: emailData.email_address,
        subject: emailData.subject,
        html: emailData.html_body || emailData.body,
        text: emailData.body,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
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
      throw new Error('EMAIL_FROM is not configured');
    }

    const now = new Date().toISOString();

    const info = await this.transporter.sendMail({
      from: `${this.fromName} <${this.fromAddress}>`,
      to: toEmail.trim(),
      subject: 'MyApi email service test',
      text: `This is a test email from MyApi. Sent at ${now}.`,
      html: `<p>This is a test email from <strong>MyApi</strong>.</p><p>Sent at ${now}.</p>`,
    });

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
