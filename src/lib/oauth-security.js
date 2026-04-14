
// ============================================================================
// SECURITY FIX: OAuth Security Hardening
// CVSS: 5.3-8.2 (High)
// ============================================================================

const crypto = require('crypto');

/**
 * Secure OAuth state parameter handling
 * CVSS 5.3: State parameter validation bypass
 */
class OAuthStateManager {
  constructor() {
    this.states = new Map();
  }
  
  generateState() {
    const state = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    this.states.set(state, timestamp);
    
    // Auto-expire states after 10 minutes
    setTimeout(() => this.states.delete(state), 10 * 60 * 1000);
    
    return state;
  }
  
  validateState(state) {
    if (!state || typeof state !== 'string') {
      return false;
    }
    
    if (!this.states.has(state)) {
      return false; // State not found or expired
    }
    
    const timestamp = this.states.get(state);
    const age = Date.now() - timestamp;
    
    // Reject if older than 10 minutes
    if (age > 10 * 60 * 1000) {
      this.states.delete(state);
      return false;
    }
    
    // Only allow one-time use
    this.states.delete(state);
    return true;
  }
}

/**
 * Secure token storage - Never store tokens in localStorage
 * CVSS 6.2: Plaintext OAuth token storage
 */
class SecureTokenStorage {
  // Store tokens in httpOnly cookies only, never in localStorage
  static storeAccessToken(token, req, res) {
    res.cookie('oauth_access_token', token, {
      httpOnly: true,    // Prevents JavaScript access
      secure: true,      // HTTPS only
      sameSite: 'strict',
      maxAge: 3600000    // 1 hour
    });
  }
  
  static getAccessToken(req) {
    // Only retrieve from httpOnly cookie, never from localStorage
    return req.cookies?.oauth_access_token;
  }
  
  static clearAccessToken(req, res) {
    res.clearCookie('oauth_access_token');
  }
}

/**
 * Token refresh with validation
 * CVSS 5.9: Weak token refresh and validation
 */
class TokenRefreshHandler {
  static async refreshToken(refreshToken, clientId, clientSecret) {
    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error('Missing required parameters');
    }
    
    // Validate token format before use
    if (!/^[a-zA-Z0-9._-]+$/.test(refreshToken)) {
      throw new Error('Invalid refresh token format');
    }
    
    // Make HTTPS request only
    const response = await fetch('https://oauth-provider.example.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret // Should be in Authorization header in production
      })
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate response contains expected fields
    if (!data.access_token || !data.token_type) {
      throw new Error('Invalid token response');
    }
    
    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in
    };
  }
}

module.exports = {
  OAuthStateManager,
  SecureTokenStorage,
  TokenRefreshHandler
};
