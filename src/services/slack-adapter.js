const https = require('https');
const querystring = require('querystring');

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_REVOKE_URL = 'https://slack.com/api/auth.revoke';

class SlackAdapter {
  constructor(config) {
    this.clientId = config.clientId || process.env.SLACK_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.SLACK_CLIENT_SECRET;
    this.redirectUri = config.redirectUri || process.env.SLACK_REDIRECT_URI || 'http://localhost:4500/api/v1/oauth/callback/slack';
  }

  getAuthorizationUrl(state) {
    const params = {
      client_id: this.clientId,
      // Request user token only (no bot install), to avoid "doesn't have a bot user" failures
      user_scope: 'chat:write,users:read,users.profile:read',
      redirect_uri: this.redirectUri,
      state: state
    };
    return `${SLACK_AUTH_URL}?${querystring.stringify(params)}`;
  }

  async exchangeCodeForToken(code) {
    return new Promise((resolve, reject) => {
      const postData = querystring.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri
      });

      const options = {
        hostname: 'slack.com',
        path: '/api/oauth.v2.access',
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
            if (!result.ok) {
              reject(new Error(`Slack OAuth error: ${result.error}`));
            } else {
              const resolvedAccessToken = result.access_token || result.authed_user?.access_token || null;
              if (!resolvedAccessToken) {
                return reject(new Error('Slack OAuth error: no access token returned'));
              }
              resolve({
                accessToken: resolvedAccessToken,
                refreshToken: null,
                tokenType: 'bearer',
                scope: result.scope || result.authed_user?.scope || 'chat:write users:read users.profile:read',
                teamId: result.team?.id,
                userId: result.authed_user?.id
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
        token: token
      });

      const options = {
        hostname: 'slack.com',
        path: '/api/auth.revoke',
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
            resolve({ ok: result.ok });
          } catch (e) {
            resolve({ ok: true });
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async verifyToken(token) {
    return new Promise((resolve, reject) => {
      const postData = querystring.stringify({
        token: token
      });

      const options = {
        hostname: 'slack.com',
        path: '/api/auth.test',
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
            resolve({
              valid: result.ok,
              error: result.ok ? null : result.error,
              data: result
            });
          } catch (e) {
            resolve({ valid: false, error: e.message });
          }
        });
      });

      req.on('error', (e) => resolve({ valid: false, error: e.message }));
      req.write(postData);
      req.end();
    });
  }
}

module.exports = SlackAdapter;
