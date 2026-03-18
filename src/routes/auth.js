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
    
    const { getUsers } = require('../database');
    let user = null;
    try {
      const users = getUsers() || [];
      user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    } catch (e) {
      console.error('Error fetching users:', e);
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
    
    // Create new user
    const userId = 'user_' + crypto.randomBytes(12).toString('hex');
    const passwordHash = bcrypt.hashSync(password, 10);
    
    try {
      createUser(username, displayName || username, email, 'UTC', password, 'free', null);
      
      // Generate master token
      const rawToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
      
      res.json({
        success: true,
        userId,
        masterToken: rawToken,
        user: {
          id: userId,
          email,
          username,
          displayName: displayName || username,
        }
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
 * GET /api/v1/auth/me
 * Get current authenticated user info
 */
router.get('/me', (req, res) => {
  try {
    const userId = req.user?.id || req.tokenMeta?.ownerId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { getUserById } = require('../database');
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
