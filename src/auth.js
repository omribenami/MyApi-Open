const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db } = require('./database');

const router = express.Router();

// Ensure users table has auth columns (.catch handles both SQLite duplicate-column and PostgreSQL IF NOT EXISTS)
try { db.exec(`ALTER TABLE users ADD COLUMN roles TEXT DEFAULT 'user'`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN last_login TEXT`); } catch (_) {}

// Register
router.post('/auth/register', (req, res) => {
  const { username, password, display_name, email, timezone } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const id = 'usr_' + crypto.randomBytes(16).toString('hex');
  const hash = bcrypt.hashSync(password, 12);
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO users (id, username, password_hash, display_name, email, timezone, created_at, status, roles)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'user')`).run(
    id, username, hash, display_name || username, email || '', timezone || 'UTC', now
  );

  // Auto-login after registration
  req.session.user = { id, username, display_name: display_name || username, roles: 'user', needsOnboarding: true };

  // Generate session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  if (!global.sessions) global.sessions = {};
  global.sessions[sessionToken] = { userId: id, username, createdAt: Date.now() };

  res.status(201).json({ data: { token: sessionToken, user: { id, username, displayName: display_name || username, email: email || '', timezone: timezone || 'UTC' }, needsOnboarding: true } });
});

// Login
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Update last login
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), row.id);

  req.session.user = {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    roles: row.roles || 'user'
  };

  // Generate a session token for client-side auth
  const sessionToken = crypto.randomBytes(32).toString('hex');
  if (!global.sessions) global.sessions = {};
  global.sessions[sessionToken] = { userId: row.id, username: row.username, createdAt: Date.now() };

  res.json({ data: { token: sessionToken, user: { id: row.id, username: row.username, displayName: row.display_name, email: row.email, timezone: row.timezone } } });
});

// Logout - Fully destroy session and clean up all authentication state
router.post('/auth/logout', (req, res) => {
  try {
    const userId = req.session?.user?.id;
    
    // 1. Clear the in-memory global sessions store
    if (global.sessions) {
      // Find and remove all sessions for this user
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
          return res.status(500).json({ error: 'Failed to logout' });
        }
        
        // 3. Clear the session cookie explicitly (redundant but safe)
        res.clearCookie('connect.sid'); // default express-session cookie
        res.clearCookie('myapi.sid'); // custom session cookie name used in main app
        
        // 4. Return success with cache-control headers to prevent caching
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json({ ok: true, message: 'Successfully logged out' });
      });
    } else {
      // No session to destroy, but still clear cookies and return success
      res.clearCookie('connect.sid');
      res.clearCookie('myapi.sid');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json({ ok: true, message: 'No active session' });
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Current user
router.get('/auth/me', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

// Check if any users exist (for first-run detection)
router.get('/auth/has-users', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
  res.json({ hasUsers: count.c > 0 });
});

module.exports = router;
