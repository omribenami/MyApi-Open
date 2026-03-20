/**
 * Authentication Routes
 * Handles user login/registration and persistent user management
 */

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const router = express.Router();

function buildCookieDomainCandidates(req) {
  const candidates = new Set();
  const configuredDomain = String(process.env.SESSION_COOKIE_DOMAIN || '').trim();
  const hostname = String(req?.hostname || '').trim();

  const add = (value) => {
    const v = String(value || '').trim();
    if (!v) return;
    candidates.add(v);
    if (!v.startsWith('.')) candidates.add(`.${v}`);
  };

  if (configuredDomain) add(configuredDomain);
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  if (hostname && hostname !== 'localhost' && !isIp) {
    add(hostname);
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length >= 2) add(parts.slice(-2).join('.'));
  }

  return [undefined, ...Array.from(candidates)];
}

function clearAuthCookies(req, res) {
  const cookieNames = ['connect.sid', 'myapi.sid', 'myapi_master_token', 'myapi_user', 'session', 'auth', 'token'];
  const sameSiteVariants = [undefined, 'lax', 'none', 'strict'];
  const secureVariants = [true, false];
  const domains = buildCookieDomainCandidates(req);

  for (const name of cookieNames) {
    for (const domain of domains) {
      for (const sameSite of sameSiteVariants) {
        for (const secure of secureVariants) {
          const opts = { path: '/', secure };
          if (domain) opts.domain = domain;
          if (sameSite) opts.sameSite = sameSite;
          res.clearCookie(name, opts);
        }
      }
    }
  }
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.regenerate !== 'function') return resolve();
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * POST /api/v1/auth/token-login
 * Login with master token (for cross-device access)
 */
router.post('/token-login', (req, res) => {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    req.session.masterToken = token;
    req.session.authMethod = 'token';
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.json({ success: true, message: 'Logged in with token' });
    });
  } catch (error) {
    console.error('Token login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/v1/auth/login
 * Login with email and password, returns master token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const { getUserByEmail } = require('../database');
    let user = null;
    try {
      user = getUserByEmail(email);
    } catch (e) {
      console.error('Error fetching user:', e);
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash || '');
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const rawToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
    await regenerateSession(req);
    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
    };
    req.session.masterToken = rawToken;
    
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.json({
        success: true,
        userId: user.id,
        masterToken: rawToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/v1/auth/register
 * Create a new user account
 * 
 * Body: { email, password, username, displayName }
 * Response: { success: true, userId, masterToken, user: {...} }
 */
router.post('/register', (_req, res) => {
  return res.status(410).json({
    error: 'Direct signup is disabled',
    message: 'Use OAuth signup from the dashboard login page.',
    code: 'OAUTH_SIGNUP_REQUIRED',
  });
});

/**
 * POST /api/v1/auth/logout
 * Logout and destroy all authentication state
 * - Clears Express session
 * - Removes token from global store
 * - Clears session cookies
 * - Returns no-cache headers to prevent auto-login on refresh
 */
router.post('/logout', (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (global.sessions) {
      Object.keys(global.sessions).forEach((token) => {
        if (global.sessions[token]?.userId === userId) delete global.sessions[token];
      });
    }

    clearAuthCookies(req, res);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!req.session) {
      return res.json({ success: true, message: 'No active session' });
    }

    const sid = req.sessionID;
    delete req.session.user;
    delete req.session.masterToken;
    delete req.session.masterTokenRaw;
    delete req.session.masterTokenId;
    delete req.session.pending_2fa_user;

    req.session.destroy((err) => {
      if (typeof req.sessionStore?.destroy === 'function' && sid) {
        try { req.sessionStore.destroy(sid, () => {}); } catch (_) {}
      }

      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ success: false, error: 'Failed to logout' });
      }

      return res.json({ success: true, message: 'Successfully logged out' });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed', details: error.message });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user info
 * IMPORTANT: This endpoint is NOT wrapped in authenticate() middleware,
 * so it must check req.session.user directly (for OAuth session auth).
 */
router.get('/me', (req, res) => {
  try {
    // Check session auth FIRST (OAuth login via browser)
    let userId = null;
    if (req.session && req.session.user && req.session.user.id) {
      userId = String(req.session.user.id);
    }
    
    // Fallback to Bearer token if no session
    if (!userId && req.tokenMeta?.ownerId) {
      userId = String(req.tokenMeta.ownerId);
    }
    
    // Fallback to req.user (in case this route is later wrapped in authenticate())
    if (!userId && req.user?.id) {
      userId = String(req.user.id);
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { getUserById } = require('../database');
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this is the user's first login based on session state
    const isFirstLogin = req.session?.isFirstLogin || false;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        timezone: user.timezone,
        plan: user.plan,
      },
      isFirstLogin
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
