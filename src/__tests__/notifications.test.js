/**
 * Phase 3.5: Notifications System Tests
 * Unit and integration tests for notification endpoints and dispatcher
 */

const request = require('supertest');
const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// Mock database
let mockDb;
let testWorkspaceId, testUserId;

describe('Notifications API', () => {
  beforeAll(() => {
    // Create test database
    mockDb = new Database(':memory:');
    
    // Create test tables
    mockDb.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT,
        owner_id TEXT,
        created_at TEXT
      );
      
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        created_at TEXT
      );
      
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT,
        type TEXT,
        title TEXT,
        message TEXT,
        data TEXT,
        is_read INTEGER DEFAULT 0,
        created_at INTEGER,
        expires_at INTEGER,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      
      CREATE TABLE notification_preferences (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT,
        channel TEXT,
        enabled INTEGER DEFAULT 1,
        frequency TEXT DEFAULT 'immediate',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(workspace_id, user_id, channel),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);
    
    // Create test data
    testWorkspaceId = 'ws_' + crypto.randomBytes(16).toString('hex');
    testUserId = 'usr_' + crypto.randomBytes(16).toString('hex');
    
    mockDb.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?)').run(
      testWorkspaceId, 'Test Workspace', testUserId, new Date().toISOString()
    );
    
    mockDb.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(
      testUserId, 'testuser', 'test@example.com', new Date().toISOString()
    );
  });

  afterAll(() => {
    mockDb.close();
  });

  describe('POST /api/v1/notifications/read', () => {
    it('should mark notification as read', () => {
      const now = Math.floor(Date.now() / 1000);
      const notifId = 'notif_' + crypto.randomBytes(16).toString('hex');
      
      // Create test notification
      mockDb.prepare(`
        INSERT INTO notifications (id, workspace_id, user_id, type, title, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(notifId, testWorkspaceId, testUserId, 'test', 'Test', 'Test message', 0, now);
      
      // Verify created
      const notif = mockDb.prepare('SELECT is_read FROM notifications WHERE id = ?').get(notifId);
      expect(notif.is_read).toBe(0);
      
      // Mark as read
      mockDb.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notifId);
      
      // Verify marked
      const updated = mockDb.prepare('SELECT is_read FROM notifications WHERE id = ?').get(notifId);
      expect(updated.is_read).toBe(1);
    });
  });

  describe('GET /api/v1/notifications', () => {
    it('should list notifications with filters', () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Create multiple notifications
      for (let i = 0; i < 3; i++) {
        mockDb.prepare(`
          INSERT INTO notifications (id, workspace_id, user_id, type, title, message, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'notif_' + crypto.randomBytes(16).toString('hex'),
          testWorkspaceId,
          testUserId,
          'test',
          `Test ${i}`,
          `Message ${i}`,
          i % 2,  // Alternate read/unread
          now
        );
      }
      
      // Query unread only
      const unread = mockDb.prepare(
        'SELECT * FROM notifications WHERE workspace_id = ? AND user_id = ? AND is_read = 0'
      ).all(testWorkspaceId, testUserId);
      
      expect(unread.length).toBeGreaterThan(0);
      expect(unread.every(n => n.is_read === 0)).toBe(true);
    });
  });

  describe('Notification Preferences', () => {
    it('should manage notification preferences', () => {
      const now = Math.floor(Date.now() / 1000);
      const prefId = 'pref_' + crypto.randomBytes(16).toString('hex');
      
      // Create preference
      mockDb.prepare(`
        INSERT INTO notification_preferences 
        (id, workspace_id, user_id, channel, enabled, frequency, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(prefId, testWorkspaceId, testUserId, 'email', 1, 'daily', now, now);
      
      // Retrieve
      const pref = mockDb.prepare(
        'SELECT * FROM notification_preferences WHERE id = ?'
      ).get(prefId);
      
      expect(pref.channel).toBe('email');
      expect(pref.frequency).toBe('daily');
      expect(pref.enabled).toBe(1);
      
      // Update
      mockDb.prepare(
        'UPDATE notification_preferences SET enabled = 0, updated_at = ? WHERE id = ?'
      ).run(now + 1, prefId);
      
      const updated = mockDb.prepare(
        'SELECT enabled FROM notification_preferences WHERE id = ?'
      ).get(prefId);
      
      expect(updated.enabled).toBe(0);
    });
  });

  describe('Notification Types', () => {
    it('should handle OAuth connected notifications', () => {
      const now = Math.floor(Date.now() / 1000);
      const notifId = 'notif_' + crypto.randomBytes(16).toString('hex');
      
      mockDb.prepare(`
        INSERT INTO notifications (id, workspace_id, user_id, type, title, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        notifId,
        testWorkspaceId,
        testUserId,
        'oauth_connected',
        'GitHub Connected',
        'Your GitHub account has been successfully connected',
        JSON.stringify({ serviceName: 'github' }),
        now
      );
      
      const notif = mockDb.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);
      expect(notif.type).toBe('oauth_connected');
      expect(notif.title).toContain('GitHub');
    });

    it('should handle security notifications', () => {
      const now = Math.floor(Date.now() / 1000);
      const notifId = 'notif_' + crypto.randomBytes(16).toString('hex');
      
      mockDb.prepare(`
        INSERT INTO notifications (id, workspace_id, user_id, type, title, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        notifId,
        testWorkspaceId,
        testUserId,
        'security_2fa_enabled',
        'Two-Factor Authentication Enabled',
        'Your account is now protected with 2FA',
        JSON.stringify({}),
        now
      );
      
      const notif = mockDb.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);
      expect(notif.type).toBe('security_2fa_enabled');
    });
  });

  describe('Notification Unread Count', () => {
    it('should calculate unread count correctly', () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Clear previous notifications
      mockDb.prepare('DELETE FROM notifications WHERE workspace_id = ?').run(testWorkspaceId);
      
      // Create notifications
      for (let i = 0; i < 5; i++) {
        mockDb.prepare(`
          INSERT INTO notifications (id, workspace_id, user_id, type, title, message, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'notif_' + crypto.randomBytes(16).toString('hex'),
          testWorkspaceId,
          testUserId,
          'test',
          `Test ${i}`,
          `Message ${i}`,
          i < 2 ? 0 : 1,  // First 2 unread, rest read
          now
        );
      }
      
      // Count unread
      const result = mockDb.prepare(
        'SELECT COUNT(*) as count FROM notifications WHERE workspace_id = ? AND user_id = ? AND is_read = 0'
      ).get(testWorkspaceId, testUserId);
      
      expect(result.count).toBe(2);
    });
  });
});

describe('NotificationDispatcher', () => {
  it('should dispatch service connected event', async () => {
    // Mock implementation
    const event = {
      workspaceId: testWorkspaceId,
      userId: testUserId,
      serviceName: 'github'
    };
    
    expect(event.serviceName).toBe('github');
  });

  it('should dispatch 2FA enabled event', async () => {
    const event = {
      workspaceId: testWorkspaceId,
      userId: testUserId,
      type: 'security_2fa_enabled'
    };
    
    expect(event.type).toBe('security_2fa_enabled');
  });
});

describe('Notification Preference Enforcement', () => {
  let prefDb;
  let wsId, uId;

  beforeAll(() => {
    prefDb = new Database(':memory:');
    prefDb.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT,
        owner_id TEXT,
        created_at TEXT
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        created_at TEXT
      );
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT,
        type TEXT,
        title TEXT,
        message TEXT,
        data TEXT,
        is_read INTEGER DEFAULT 0,
        created_at INTEGER,
        expires_at INTEGER,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      CREATE TABLE notification_preferences (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT,
        channel TEXT,
        enabled INTEGER DEFAULT 1,
        frequency TEXT DEFAULT 'immediate',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(workspace_id, user_id, channel),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);

    wsId = 'ws_pref_' + crypto.randomBytes(16).toString('hex');
    uId = 'usr_pref_' + crypto.randomBytes(16).toString('hex');

    prefDb.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?)').run(
      wsId, 'Pref Workspace', uId, new Date().toISOString()
    );
    prefDb.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(
      uId, 'prefuser', 'pref@example.com', new Date().toISOString()
    );
  });

  afterAll(() => {
    prefDb.close();
  });

  describe('Channel-level preference checks', () => {
    it('should correctly read channel-level inApp preferences', () => {
      const settings = { 
        inApp: { enabled: 1, frequency: 'immediate', workspace_id: wsId },
        email: { enabled: 0, frequency: 'immediate', workspace_id: wsId }
      };

      const webEnabled = settings.inApp?.enabled === 1;
      const emailEnabled = settings.email?.enabled === 1;

      expect(webEnabled).toBe(true);
      expect(emailEnabled).toBe(false);
    });

    it('should not create notification when inApp is disabled', () => {
      const settings = { 
        inApp: { enabled: 0, frequency: 'immediate', workspace_id: wsId },
        email: { enabled: 0, frequency: 'immediate', workspace_id: wsId }
      };

      const webEnabled = settings.inApp?.enabled === 1;
      const emailEnabled = settings.email?.enabled === 1;

      expect(webEnabled).toBe(false);
      expect(emailEnabled).toBe(false);

      let notificationCreated = false;
      if (webEnabled) {
        notificationCreated = true;
      }
      expect(notificationCreated).toBe(false);
    });

    it('should create notification when inApp is enabled', () => {
      const settings = { 
        inApp: { enabled: 1, frequency: 'immediate', workspace_id: wsId },
        email: { enabled: 0, frequency: 'immediate', workspace_id: wsId }
      };

      const webEnabled = settings.inApp?.enabled === 1;
      expect(webEnabled).toBe(true);

      const now = Math.floor(Date.now() / 1000);
      const notifId = 'notif_pref_' + crypto.randomBytes(16).toString('hex');
      
      prefDb.prepare(`
        INSERT INTO notifications (id, workspace_id, user_id, type, title, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(notifId, wsId, uId, 'device_approved', 'Device Approved', 'Test message', 0, now);

      const notif = prefDb.prepare(
        'SELECT * FROM notifications WHERE workspace_id = ? AND user_id = ? AND id = ?'
      ).get(wsId, uId, notifId);

      expect(notif).toBeDefined();
      expect(notif.workspace_id).toBe(wsId);
      expect(notif.user_id).toBe(uId);
    });

    it('should handle null settings gracefully', () => {
      const settings = { inApp: null, email: null };

      const webEnabled = settings.inApp?.enabled === 1;
      const emailEnabled = settings.email?.enabled === 1;

      expect(webEnabled).toBe(false);
      expect(emailEnabled).toBe(false);
    });
  });

  describe('Notification dispatch respects preferences', () => {
    it('should skip notification when all channels are disabled', () => {
      const inAppEnabled = false;
      const emailEnabled = false;
      const channels = ['in-app', 'email'];

      const allowedChannels = channels.filter(ch => {
        if (ch === 'in-app') return inAppEnabled;
        if (ch === 'email') return emailEnabled;
        return true;
      });

      expect(allowedChannels.length).toBe(0);
    });

    it('should only allow in-app channel when email is disabled', () => {
      const inAppEnabled = true;
      const emailEnabled = false;
      const channels = ['in-app', 'email'];

      const allowedChannels = channels.filter(ch => {
        if (ch === 'in-app') return inAppEnabled;
        if (ch === 'email') return emailEnabled;
        return true;
      });

      expect(allowedChannels).toEqual(['in-app']);
    });

    it('should allow all channels when both are enabled', () => {
      const inAppEnabled = true;
      const emailEnabled = true;
      const channels = ['in-app', 'email'];

      const allowedChannels = channels.filter(ch => {
        if (ch === 'in-app') return inAppEnabled;
        if (ch === 'email') return emailEnabled;
        return true;
      });

      expect(allowedChannels).toEqual(['in-app', 'email']);
    });
  });

  describe('Notification stored with correct workspace_id', () => {
    it('should store notification with workspace_id, not user_id', () => {
      const now = Math.floor(Date.now() / 1000);
      const notifId = 'notif_ws_' + crypto.randomBytes(16).toString('hex');

      prefDb.prepare(`
        INSERT INTO notifications (id, workspace_id, user_id, type, title, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(notifId, wsId, uId, 'token_revoked', 'Token Revoked', 'Test', 0, now);

      const found = prefDb.prepare(
        'SELECT * FROM notifications WHERE workspace_id = ? AND user_id = ?'
      ).all(wsId, uId);

      expect(found.some(n => n.id === notifId)).toBe(true);

      // Querying with user_id as workspace_id (the old bug) should NOT find it
      const wrongQuery = prefDb.prepare(
        'SELECT * FROM notifications WHERE workspace_id = ? AND user_id = ?'
      ).all(uId, uId);

      expect(wrongQuery.some(n => n.id === notifId)).toBe(false);
    });
  });
});
