const https = require('https');

/**
 * GitHub Repository Metadata Service
 * Handles fetching repo metadata, detecting forks, and verifying repository ownership
 */
class GitHubRepoMetadata {
  constructor(githubToken = null) {
    this.token = githubToken || process.env.GITHUB_PERSONAL_TOKEN;
  }

  /**
   * Make a request to GitHub API
   */
  async _request(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'MyApi-SkillOrigin',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      // Add authorization header if token is available
      if (this.token) {
        options.headers['Authorization'] = `token ${this.token}`;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: JSON.parse(data || '{}')
            };
            resolve(result);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Fetch repository metadata
   * @param {string} owner - GitHub username or org
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository metadata
   */
  async getRepoMetadata(owner, repo) {
    try {
      const response = await this._request(`/repos/${owner}/${repo}`);

      if (response.statusCode !== 200) {
        return {
          error: response.body.message || 'Repository not found',
          statusCode: response.statusCode
        };
      }

      const repoData = response.body;
      
      return {
        id: repoData.id,
        name: repoData.name,
        owner: repoData.owner.login,
        ownerType: repoData.owner.type, // 'User' or 'Organization'
        isFork: repoData.fork,
        parentOwner: repoData.fork && repoData.parent ? repoData.parent.owner.login : null,
        parentName: repoData.fork && repoData.parent ? repoData.parent.name : null,
        description: repoData.description,
        url: repoData.html_url,
        defaultBranch: repoData.default_branch,
        language: repoData.language,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        license: repoData.license ? repoData.license.spdx_id : null,
        topics: repoData.topics || [],
        isPublic: !repoData.private,
        updatedAt: repoData.updated_at,
        createdAt: repoData.created_at
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Verify that a user owns a repository
   * @param {string} owner - Repository owner username
   * @param {string} repo - Repository name
   * @param {string} userToken - GitHub token of user to verify
   * @returns {Promise<boolean>} Whether the user owns the repo
   */
  async verifyRepoOwnership(owner, repo, userToken) {
    try {
      const response = await this._requestWithToken(`/repos/${owner}/${repo}`, userToken);

      if (response.statusCode === 404) {
        return false;
      }

      if (response.statusCode !== 200) {
        throw new Error(`GitHub API error: ${response.statusCode}`);
      }

      const repoData = response.body;
      // User has access to the repo; check if they're an owner
      // This is simplified - a more robust check would verify push access
      return repoData.permissions && (repoData.permissions.admin || repoData.permissions.push);
    } catch (error) {
      console.error('Error verifying repo ownership:', error.message);
      return false;
    }
  }

  /**
   * Make a request to GitHub API with a specific user token
   */
  async _requestWithToken(path, token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path,
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'MyApi-SkillOrigin',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: JSON.parse(data || '{}')
            };
            resolve(result);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Extract owner and repo name from a GitHub URL
   * @param {string} url - GitHub URL (e.g., https://github.com/owner/repo)
   * @returns {Object|null} { owner, repo } or null if invalid
   */
  static parseGitHubUrl(url) {
    if (!url) return null;

    // Match various GitHub URL formats
    const patterns = [
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/,
      /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
      /^github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, '')
        };
      }
    }

    return null;
  }

  /**
   * Get fork information for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object|null>} Fork information or null if not a fork
   */
  async getForkInfo(owner, repo) {
    try {
      const response = await this._request(`/repos/${owner}/${repo}`);

      if (response.statusCode !== 200) {
        return null;
      }

      const repoData = response.body;

      if (!repoData.fork || !repoData.parent) {
        return null;
      }

      return {
        isFork: true,
        parentOwner: repoData.parent.owner.login,
        parentName: repoData.parent.name,
        parentUrl: repoData.parent.html_url,
        forks: repoData.forks_count,
        watchers: repoData.stargazers_count
      };
    } catch (error) {
      console.error('Error fetching fork info:', error.message);
      return null;
    }
  }

  /**
   * Get user information
   * @param {string} username - GitHub username
   * @returns {Promise<Object|null>} User information or null if not found
   */
  async getUserInfo(username) {
    try {
      const response = await this._request(`/users/${username}`);

      if (response.statusCode !== 200) {
        return null;
      }

      const userData = response.body;
      return {
        username: userData.login,
        name: userData.name,
        avatar: userData.avatar_url,
        type: userData.type, // 'User' or 'Organization'
        publicRepos: userData.public_repos,
        followers: userData.followers,
        following: userData.following,
        createdAt: userData.created_at
      };
    } catch (error) {
      console.error('Error fetching user info:', error.message);
      return null;
    }
  }
}

module.exports = GitHubRepoMetadata;
