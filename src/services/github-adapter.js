const https = require('https');
const querystring = require('querystring');

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

class GitHubAdapter {
  constructor(config) {
    this.clientId = config.clientId || process.env.GITHUB_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.GITHUB_CLIENT_SECRET;
    this.redirectUri = config.redirectUri || process.env.GITHUB_REDIRECT_URI || 'http://localhost:4500/api/v1/oauth/callback/github';
  }

  isConfigured() {
    return !!(
      this.clientId &&
      this.clientSecret
    );
  }

  getAuthorizationUrl(state, runtimeAuthParams = {}) {
    const params = {
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'user repo gist',
      state: state,
      ...(runtimeAuthParams || {}),
    };
    return `${GITHUB_AUTH_URL}?${querystring.stringify(params)}`;
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
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length,
          'Accept': 'application/json',
          'User-Agent': 'MyApi-OAuth'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              reject(new Error(`GitHub OAuth error: ${result.error_description || result.error}`));
            } else {
              resolve({
                accessToken: result.access_token,
                refreshToken: null,
                tokenType: result.token_type || 'bearer',
                scope: 'user repo gist'
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
      const body = JSON.stringify({
        access_token: token
      });

      const options = {
        hostname: 'api.github.com',
        path: '/applications/' + this.clientId + '/grant',
        method: 'DELETE',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64'),
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'MyApi-OAuth',
          'Content-Length': body.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ ok: true });
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async verifyToken(token) {
    const requestJson = (path) => new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path,
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'MyApi-OAuth',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') });
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });

    try {
      const userResp = await requestJson('/user');
      const user = userResp.body || {};
      if (userResp.statusCode !== 200 || user.message) {
        return { valid: false, error: user.message || 'GitHub token invalid', data: user };
      }

      // GitHub may omit email on /user when it's private; fetch primary email explicitly.
      if (!user.email) {
        try {
          const emailResp = await requestJson('/user/emails');
          const emails = Array.isArray(emailResp.body) ? emailResp.body : [];
          const primary = emails.find(e => e && e.primary) || emails.find(e => e && e.verified) || emails[0];
          if (primary?.email) user.email = primary.email;
        } catch (_) {
          // best effort; keep user payload even without email
        }
      }

      return {
        valid: true,
        error: null,
        data: user
      };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }
}

module.exports = GitHubAdapter;
