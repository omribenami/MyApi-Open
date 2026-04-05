const https = require('https');
const querystring = require('querystring');

const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_REVOKE_URL = 'https://discord.com/api/oauth2/token/revoke';

class DiscordAdapter {
  constructor(config) {
    this.clientId = config.clientId || process.env.DISCORD_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.DISCORD_CLIENT_SECRET;
    this.redirectUri = config.redirectUri || process.env.DISCORD_REDIRECT_URI || 'http://localhost:4500/api/v1/oauth/callback/discord';
  }

  getAuthorizationUrl(state) {
    const params = {
      client_id: this.clientId,
      permissions: '2048',
      response_type: 'code',
      redirect_uri: this.redirectUri,
      integration_type: '0',
      scope: 'identify email guilds guilds.join bot applications.commands.permissions.update',
      state: state
    };
    return `${DISCORD_AUTH_URL}?${querystring.stringify(params)}`;
  }

  async exchangeCodeForToken(code) {
    return new Promise((resolve, reject) => {
      const postData = querystring.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri
      });

      const options = {
        hostname: 'discord.com',
        path: '/api/oauth2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              reject(new Error(`Discord OAuth error: ${result.error_description || result.error}`));
            } else {
              resolve({
                accessToken: result.access_token,
                refreshToken: result.refresh_token || null,
                expiresIn: result.expires_in,
                tokenType: result.token_type,
                scope: result.scope || 'identify email guilds guilds.join bot applications.commands.permissions.update'
              });
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async revokeToken(token) {
    return new Promise((resolve, reject) => {
      const postData = querystring.stringify({
        token: token,
        token_type_hint: 'access_token'
      });

      const options = {
        hostname: 'discord.com',
        path: '/api/oauth2/token/revoke',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length,
          'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
        }
      };

      const req = https.request(options, (res) => {
        resolve({ ok: res.statusCode === 200 });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async verifyToken(token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'discord.com',
        path: '/api/users/@me',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({
              valid: res.statusCode === 200 && !result.message,
              error: result.message || null,
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
}

module.exports = DiscordAdapter;
