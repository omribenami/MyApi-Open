const https = require('https');

class WhatsAppAdapter {
  constructor(config) {
    this.businessAccountId = config.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    this.apiToken = config.apiToken || process.env.WHATSAPP_API_TOKEN;
    this.webhookToken = config.webhookToken || process.env.WHATSAPP_WEBHOOK_TOKEN;
  }

  // WhatsApp uses token-based auth, not OAuth2, so we provide a different flow
  getAuthorizationUrl(state) {
    // For WhatsApp, we return a JSON response instead of redirect
    return {
      type: 'token-validation',
      instructions: 'WhatsApp Business API uses token-based authentication. Please provide your API token and business account ID.',
      requiredFields: ['businessAccountId', 'apiToken'],
      state: state
    };
  }

  async exchangeCodeForToken(credentials) {
    // In this case, credentials would be { businessAccountId, apiToken, webhookToken }
    // We validate the credentials with WhatsApp API
    const token = credentials.apiToken || this.apiToken;
    const businessAccountId = credentials.businessAccountId || this.businessAccountId;
    
    if (!token || !businessAccountId) {
      throw new Error('WhatsApp: Missing apiToken or businessAccountId');
    }

    // Verify the token is valid
    const isValid = await this.verifyToken(token);
    if (!isValid.valid) {
      throw new Error(`WhatsApp token validation failed: ${isValid.error}`);
    }

    return {
      accessToken: token,
      refreshToken: null,
      tokenType: 'bearer',
      scope: 'whatsapp_business_api',
      businessAccountId: businessAccountId,
      webhookToken: credentials.webhookToken || this.webhookToken || null
    };
  }

  async revokeToken(token) {
    // WhatsApp tokens are revoked by manually removing them from the system
    // We cannot revoke tokens via API, so we just log it
    return { ok: true, message: 'Token marked for revocation (manual removal required in WhatsApp console)' };
  }

  async verifyToken(token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'graph.facebook.com',
        path: '/v19.0/me?fields=id,name&access_token=' + token,
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({
              valid: res.statusCode === 200 && result.id && !result.error,
              error: result.error ? (result.error.message || result.error) : null,
              data: result
            });
          } catch (e) {
            resolve({ valid: false, error: e.message });
          }
        });
      });

      req.on('error', (e) => resolve({ valid: false, error: e.message }));
      req.end();
    });
  }

  async sendMessage(token, phoneNumber, message) {
    // Helper method to send WhatsApp messages
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: { body: message }
      });

      const options = {
        hostname: 'graph.facebook.com',
        path: `/v19.0/${this.businessAccountId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({ ok: !result.error, message_id: result.messages?.[0]?.id, error: result.error });
          } catch (e) {
            resolve({ ok: false, error: e.message });
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
}

module.exports = WhatsAppAdapter;
