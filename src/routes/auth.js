const logger = require('../utils/logger');
/**
 * Authentication Routes
 * Handles user login/registration and persistent user management
 */

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getAccessTokens, getExistingMasterToken, createAccessToken, db } = require('../database');
const emailService = require('../services/emailService');

const { generateCSRFToken, validateCSRFToken } = require('../lib/csrf-protection');
const { requireBetaSlot } = require('../middleware/betaCap');
const { invalidateBetaFullCache } = require('../lib/betaMode');

const router = express.Router();

/**
 * GET /api/v1/auth/csrf-token
 * Returns a CSRF token for the current session.
 * Frontend must call this before submitting any state-changing form with a session cookie.
 */
router.get('/csrf-token', (req, res) => {
  if (!req.session) return res.status(400).json({ error: 'Session not available' });
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  res.json({ csrfToken: req.session.csrfToken });
});

/**
 * Middleware: validate CSRF token for cookie-session-based POST requests.
 * Bearer-token authenticated requests skip CSRF (inherently CSRF-safe).
 */
function requireCsrfForSession(req, res, next) {
  // Skip CSRF check if using Bearer token auth (not cookie-based)
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  // Skip if no session is established yet (GET csrf-token first)
  if (!req.session?.csrfToken) return next();

  const provided = req.body?._csrf || req.headers['x-csrf-token'];
  if (!provided) {
    return res.status(403).json({ error: 'CSRF token required', code: 'CSRF_MISSING' });
  }
  try {
    if (!validateCSRFToken(provided, req.session.csrfToken)) {
      return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
    }
  } catch {
    return res.status(403).json({ error: 'CSRF validation error', code: 'CSRF_ERROR' });
  }
  // Rotate token after successful validation (defense in depth)
  req.session.csrfToken = generateCSRFToken();
  next();
}

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
router.post('/token-login', requireCsrfForSession, async (req, res) => {
  try {
    const token = req.body?.token;
    if (!token || typeof token !== 'string' || token.length < 16) {
      return res.status(400).json({ error: 'Valid token required' });
    }

    // Validate token exists and is active in the database
    const { getAccessTokens } = require('../database');
    const bcryptLib = require('bcrypt');
    const tokens = getAccessTokens() || [];
    let validToken = null;
    for (const tokenRecord of tokens) {
      if (tokenRecord.revokedAt) continue;
      if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) <= new Date()) continue;
      if (tokenRecord.hash && await bcryptLib.compare(token, tokenRecord.hash).catch(() => false)) {
        validToken = tokenRecord;
        break;
      }
    }

    if (!validToken) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.session.masterToken = token;
    req.session.authMethod = 'token';
    req.session.user = { id: validToken.ownerId };
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.json({ success: true, message: 'Logged in with token' });
    });
  } catch (error) {
    logger.error('Token login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/v1/auth/login
 * Login with email and password, returns master token
 */
router.post('/login', requireCsrfForSession, async (req, res) => {
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
      logger.error('Error fetching user:', e);
      return res.status(500).json({ error: 'Internal server error', message: 'Service temporarily unavailable' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash || '').catch(() => false);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Retrieve existing master token — login must NEVER create or revoke master tokens.
    // The master token is an API key given to AI agents; changing it on login would
    // break all integrations.  Only the explicit /tokens/master/regenerate endpoint
    // may replace it.  If none exists yet the frontend will bootstrap one via
    // POST /tokens/master/bootstrap on first dashboard load.
    let masterTokenRaw = null;
    let masterTokenId = null;
    const existing = getExistingMasterToken(user.id);
    if (existing) {
      masterTokenRaw = existing.rawToken;
      masterTokenId = existing.tokenId;
    }

    await regenerateSession(req);
    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
    };
    req.session.masterTokenRaw = masterTokenRaw;
    req.session.masterTokenId = masterTokenId;
    
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.json({
        success: true,
        userId: user.id,
        masterToken: masterTokenRaw,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
        }
      });
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/v1/auth/register
 * Create a new user account
 * 
 * Body: { username, password, email, timezone, display_name }
 * Response: { success: true, data: { token, user: {...}, needsOnboarding: true } }
 */
router.post('/register', requireCsrfForSession, requireBetaSlot, async (req, res) => {
  const { username, password, display_name, email, timezone } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const { isStrongPassword } = require('../utils/passwordUtils');
  if (!isStrongPassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters and contain 3 of: uppercase, lowercase, number, symbol' });
  if (username.length < 3 || username.length > 50) return res.status(400).json({ error: 'username must be between 3 and 50 characters' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return res.status(400).json({ error: 'username can only contain letters, numbers, underscores, hyphens, and dots' });
  if (password.length > 128) return res.status(400).json({ error: 'password must not exceed 128 characters' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid email format' });
  if (display_name && display_name.length > 100) return res.status(400).json({ error: 'display name must not exceed 100 characters' });
  if (timezone && timezone.length > 50) return res.status(400).json({ error: 'invalid timezone' });

  try {
    const { db } = require('../database');
    
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const id = 'usr_' + crypto.randomBytes(16).toString('hex');
    const hash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    db.prepare(`INSERT INTO users (id, username, password_hash, display_name, email, timezone, created_at, status, roles)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'user')`).run(
      id, username, hash, display_name || username, email || '', timezone || 'UTC', now
    );
    invalidateBetaFullCache();

    // Fire-and-forget welcome email (does not block the 201 response)
    if (email) {
      emailService.sendWelcomeEmail(email, display_name || username).catch(() => {});
    }

    // Auto-login after registration
    req.session.user = { id, username, display_name: display_name || username, roles: 'user', needsOnboarding: true };

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    if (!global.sessions) global.sessions = {};
    global.sessions[sessionToken] = { userId: id, username, createdAt: Date.now() };

    // FIX BUG-3: Return 201 for successful creation
    return res.status(201).json({ data: { token: sessionToken, user: { id, username, displayName: display_name || username, email: email || '', timezone: timezone || 'UTC' }, needsOnboarding: true } });
  } catch (err) {
    logger.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout and destroy all authentication state
 * - Clears Express session
 * - Removes token from global store
 * - Clears session cookies
 * - Returns no-cache headers to prevent auto-login on refresh
 */
router.post('/logout', requireCsrfForSession, (req, res) => {
  try {
    const userId = req.session?.user?.id;

    // **STEP 1: Session-only logout — never touch master tokens or service OAuth tokens**
    // - Master tokens are permanent API keys; revoking them on logout breaks all integrations.
    //   They are only replaced via POST /api/v1/tokens/master/regenerate.
    // - oauth_tokens (Google, GitHub, Slack…) are persistent service connections,
    //   not session credentials — deleting them on logout would disconnect all services.
    // - Guest tokens belong to external callers; they must not be revoked silently.
    // Nothing to revoke here — the session destruction below is the entire logout action.
    if (userId) {
      try {
        logger.info(`[Logout] User ${userId}: session destroyed (master token and service connections preserved)`);
      } catch (err) {
        logger.error('[Logout] Error during logout:', err);
      }
    }

    // **STEP 2: Remove user from global sessions store**
    if (global.sessions) {
      Object.keys(global.sessions).forEach((token) => {
        if (global.sessions[token]?.userId === userId) delete global.sessions[token];
      });
    }

    // **STEP 3: Prevent browser caching**
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // **STEP 4: Clear all auth-related cookies**
    clearAuthCookies(req, res);
    
    // **STEP 5: Clear cookies with EXACT same options as when they were set**
    const cookieClearOpts = { path: '/', httpOnly: false, sameSite: 'lax' };
    const cookieClearOptsHttpOnly = { path: '/', httpOnly: true, sameSite: 'lax' };
    
    res.clearCookie('myapi_master_token', cookieClearOpts);
    res.clearCookie('myapi_master_token', cookieClearOptsHttpOnly);
    res.clearCookie('myapi_user', cookieClearOpts);
    res.clearCookie('masterToken', cookieClearOpts);
    res.clearCookie('masterToken', cookieClearOptsHttpOnly);
    res.clearCookie('myapi_master_token', { path: '/', httpOnly: false });
    res.clearCookie('myapi_master_token', { path: '/', httpOnly: true });
    res.clearCookie('myapi_user', { path: '/' });

    if (!req.session) {
      return res.json({ success: true, message: 'No active session', cleared: true });
    }

    // **STEP 6: Invalidate session BEFORE destroying it**
    // Mark session as invalid so if it's recreated from cookie, it won't have user data
    const sid = req.sessionID;
    
    // First, immediately clear user from session (synchronously)
    if (req.session) {
      delete req.session.user;
      delete req.session.masterToken;
      delete req.session.masterTokenRaw;
      delete req.session.masterTokenId;
      delete req.session.pending_2fa_user;
      delete req.session.currentWorkspace;
      
      // Save the cleared session first
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error('Error saving cleared session:', saveErr);
        }
        
        // THEN destroy the session entirely
        req.session.destroy((err) => {
          if (typeof req.sessionStore?.destroy === 'function' && sid) {
            try { req.sessionStore.destroy(sid, () => {}); } catch (_) {}
          }

          if (err) {
            logger.error('Session destruction error:', err);
            return res.status(500).json({ success: false, error: 'Failed to logout' });
          }

          logger.info(`[Auth] User ${userId} logged out successfully (all tokens revoked/deleted)`);
          return res.json({ success: true, message: 'Successfully logged out', cleared: true });
        });
      });
    } else {
      logger.info(`[Auth] No session to destroy`);
      return res.json({ success: true, message: 'Successfully logged out', cleared: true });
    }
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user info
 * IMPORTANT: This endpoint is NOT wrapped in authenticate() middleware,
 * so it must check req.session.user directly (for OAuth session auth)
 * and validate Bearer tokens manually.
 */
router.get('/me', async (req, res) => {
  try {
    const { getAccessTokens } = require('../database');
    const bcrypt = require('bcrypt');
    
    // Check session auth FIRST (OAuth login via browser)
    // Track auth method so we know whether bootstrap is safe to return.
    let userId = null;
    let authViaSession = false;
    if (req.session && req.session.user && req.session.user.id) {
      userId = String(req.session.user.id);
      authViaSession = true;
      logger.info(`[Auth/Me] Authenticated via session: ${userId}`);
    }

    // Fallback to tokenMeta (set by authenticate middleware if this route is wrapped)
    if (!userId && req.tokenMeta?.ownerId) {
      userId = String(req.tokenMeta.ownerId);
      logger.info(`[Auth/Me] Authenticated via req.tokenMeta: ${userId}`);
    }

    // Fallback to req.user (in case this route is later wrapped in authenticate())
    if (!userId && req.user?.id) {
      userId = String(req.user.id);
      logger.info(`[Auth/Me] Authenticated via req.user: ${userId}`);
    }

    // Fallback: directly validate Bearer token from Authorization header.
    // This route is excluded from the global authenticate() middleware so we must
    // validate Bearer tokens here to support master-token re-authentication.
    if (!userId) {
      const authHeader = req.headers.authorization || '';
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const rawToken = parts[1];
        const tokens = getAccessTokens() || [];
        let matchedToken = null;
        for (const tokenRecord of tokens) {
          if (
            !tokenRecord.revokedAt &&
            tokenRecord.hash &&
            await bcrypt.compare(rawToken, tokenRecord.hash).catch(() => false)
          ) {
            if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) <= new Date()) {
              continue; // skip expired tokens
            }
            userId = String(tokenRecord.ownerId);
            matchedToken = tokenRecord;
            break;
          }
        }
        // Bearer tokens reaching /auth/me MUST honor requires_approval and per-token
        // device approval. Do NOT trust caller-controlled Referer/Origin — those are spoofable.
        // Session-authed dashboard hits the session branch above; this path only runs for
        // external Bearer callers (agents, AI), which must be gated.
        if (matchedToken) {
          try {
            const { db: dbInstance, getPendingApprovals, createPendingApproval } = require('../database');
            const DeviceFingerprint = require('../utils/deviceFingerprint');
            const tokenRow = dbInstance.prepare(
              'SELECT label, requires_approval, token_type, scope FROM access_tokens WHERE id = ?'
            ).get(matchedToken.tokenId);
            const isMasterToken = tokenRow?.token_type === 'master' || tokenRow?.scope === 'full';
            const isOAuthToken = tokenRow?.label && tokenRow.label.endsWith('(OAuth)');
            // Gate if: master token, OAuth-labeled token, OR guest token with requires_approval=1.
            // Guest token without approval requirement still passes (existing policy).
            const gateEnabled = isMasterToken || isOAuthToken || !!tokenRow?.requires_approval;

            if (gateEnabled) {
              const fingerprint = DeviceFingerprint.fromRequest(req);
              // Per-token lookup: master approval must NOT auto-authorize guest tokens.
              const approvedForToken = dbInstance.prepare(
                'SELECT id FROM approved_devices WHERE token_id = ? AND user_id = ? AND device_fingerprint_hash = ? AND revoked_at IS NULL LIMIT 1'
              ).get(matchedToken.tokenId, userId, fingerprint.fingerprintHash);

              if (!approvedForToken) {
                const pendingApprovals = getPendingApprovals(userId, matchedToken.tokenId);
                const existingPending = pendingApprovals.find(p => p.device_fingerprint_hash === fingerprint.fingerprintHash);
                if (!existingPending) {
                  createPendingApproval(matchedToken.tokenId, userId, fingerprint.fingerprintHash, fingerprint.summary, fingerprint.fingerprint.ipAddress);
                }
                return res.status(403).json({
                  error: 'device_not_approved',
                  code: 'DEVICE_APPROVAL_REQUIRED',
                  message: 'Access denied — waiting for the user to approve you in the dashboard.',
                });
              }
            }
          } catch (err) {
            logger.error('[Auth/Me] Device approval check failed, failing closed', { err: err.message });
            return res.status(403).json({
              error: 'device_approval_error',
              code: 'DEVICE_APPROVAL_FAILED',
              message: 'Access denied — device check temporarily unavailable.',
            });
          }
        }
      }
    }

    if (!userId) {
      logger.info(`[Auth/Me] No authentication found (no session, no valid Bearer token)`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { getUserById } = require('../database');
    let user = getUserById(userId);

    // In MongoDB mode, getUserById uses a SQLite stub and returns null.
    // Fall back to the session user object populated during OAuth login.
    if (!user && req.session?.user) {
      const s = req.session.user;
      user = {
        id: userId,
        email: s.email || null,
        username: s.username || s.displayName || null,
        displayName: s.displayName || s.display_name || null,
        avatarUrl: s.avatarUrl || s.avatar_url || null,
        timezone: s.timezone || null,
        plan: s.plan || 'free',
      };
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this is the user's first login based on session state
    const isFirstLogin = req.session?.isFirstLogin || false;

    // Look up the persistent master token from DB so every device gets the same one.
    // Prefer a token already cached in the session; fall back to the DB lookup.
    let masterTokenRaw = req.session?.masterTokenRaw || null;
    let masterTokenId  = req.session?.masterTokenId  || null;

    // Verify the session's cached token is still active in the DB (not revoked).
    // If it was revoked (e.g. by a regenerate call), clear it from the session
    // so we don't hand out a dead token as the bootstrap value.
    if (masterTokenId && !process.env.DATABASE_URL) {
      const { db } = require('../database');
      const tokenRow = db.prepare('SELECT revoked_at FROM access_tokens WHERE id = ?').get(masterTokenId);
      if (!tokenRow || tokenRow.revoked_at) {
        masterTokenRaw = null;
        masterTokenId  = null;
        if (req.session) {
          delete req.session.masterTokenRaw;
          delete req.session.masterTokenId;
          req.session.save?.((err) => { if (err) logger.error('[Auth/Me] Session clear error:', err); });
        }
      }
    }

    if (!masterTokenRaw) {
      const existing = getExistingMasterToken(userId);
      if (existing) {
        masterTokenRaw = existing.rawToken;
        masterTokenId  = existing.tokenId;
      } else {
        // No master token exists yet — create the canonical one for this user.
        // Platform-generated, not linked to any OAuth service. Persists until
        // the user explicitly rotates it via /tokens/master/regenerate.
        try {
          const rawToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
          const hash = await bcrypt.hash(rawToken, 10);
          const tokenId = createAccessToken(hash, userId, 'full', 'Master Token', null, null, null, rawToken, 'master');
          masterTokenRaw = rawToken;
          masterTokenId  = tokenId;
          logger.info('[Auth/Me] Created initial master token', { userId, tokenId });
        } catch (mintErr) {
          logger.error('[Auth/Me] Failed to create master token', { error: mintErr.message });
        }
      }

      if (masterTokenRaw && req.session) {
        req.session.masterTokenRaw = masterTokenRaw;
        req.session.masterTokenId  = masterTokenId;
        req.session.save?.((err) => { if (err) logger.error('[Auth/Me] Session save error:', err); });
      }
    }

    const _pwrEmail = String(process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || '').trim().toLowerCase();
    const userPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      plan: user.plan,
      isPowerUser: !!(_pwrEmail && String(user.email || '').toLowerCase() === _pwrEmail),
      needsOnboarding: Boolean(user?.needsOnboarding),
    };

    // SECURITY: only return the master token bootstrap to session-authenticated
    // requests (browser dashboard). Bearer-token callers (including scoped guest
    // tokens) must NOT receive the master token — doing so would allow any guest
    // token holder to escalate to full account control.
    const bootstrapPayload = (authViaSession && masterTokenRaw)
      ? { masterToken: masterTokenRaw, tokenId: masterTokenId }
      : null;

    res.json({
      success: true,
      user: userPayload,
      isFirstLogin,
      bootstrap: bootstrapPayload,
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
