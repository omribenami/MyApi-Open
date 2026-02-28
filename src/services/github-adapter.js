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

  getAuthorizationUrl(state) {
    const params = {
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'user repo gist',
      state: state
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
      const options = {
        hostname: 'api.github.com',
        path: '/applications/' + this.clientId + '/token',
        method: 'DELETE',
        auth: this.clientId + ':' + this.clientSecret,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'MyApi-OAuth'
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
      req.end();
    });
  }

  async verifyToken(token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: '/user',
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

module.exports = GitHubAdapter;
