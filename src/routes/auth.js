/**
 * Authentication Routes
 * Handles user login/registration and persistent user management
 */

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const router = express.Router();

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
router.post('/login', (req, res) => {
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
router.post('/register', (req, res) => {
  try {
    const { email, password, username, displayName } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { createUser } = require('../database');
    
    try {
      // Create new user and get the actual user ID from the database
      const newUser = createUser(username, displayName || username, email, 'UTC', password, 'free', null);
      
      // Generate master token
      const rawToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
      
      // Create session for auto-login after registration (use the actual user ID from database)
      req.session.user = {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        display_name: newUser.displayName,
      };
      req.session.masterToken = rawToken;
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ error: 'Session error' });
        }
        
        res.json({
          success: true,
          userId: newUser.id,
          masterToken: rawToken,
          user: {
            id: newUser.id,
            email: newUser.email,
            username: newUser.username,
            displayName: newUser.displayName,
          }
        });
      });
    } catch (error) {
      if (error.message?.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Email or username already exists' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
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
router.post('/logout', (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const masterToken = req.session?.masterToken;
    
    // 1. Clear any in-memory token stores
    if (global.sessions) {
      Object.keys(global.sessions).forEach(token => {
        if (global.sessions[token]?.userId === userId) {
          delete global.sessions[token];
        }
      });
    }
    
    // 2. Destroy the Express session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
          return res.status(500).json({ success: false, error: 'Failed to logout' });
        }
        
        // 3. Explicitly clear all auth-related cookies
        res.clearCookie('connect.sid');
        res.clearCookie('myapi.sid');
        res.clearCookie('session');
        res.clearCookie('auth');
        res.clearCookie('token');
        
        // 4. Set cache control headers to prevent browser caching
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json({ success: true, message: 'Successfully logged out' });
      });
    } else {
      // No session, but still clear cookies
      res.clearCookie('connect.sid');
      res.clearCookie('myapi.sid');
      res.clearCookie('session');
      res.clearCookie('auth');
      res.clearCookie('token');
      
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json({ success: true, message: 'No active session' });
    }
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
