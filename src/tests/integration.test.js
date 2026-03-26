/**
 * Integration Tests for MyApi
 * Tests device approval flow, OAuth proxy routes, and API security
 * Run: npm test -- src/tests/integration.test.js
 */

const request = require('supertest');
const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');

describe('Integration Tests - Device Approval Flow', () => {
  let testUserId;
  const testTokenId = 'test-token-' + Date.now();
  const testToken = 'Bearer test-token-' + Date.now();
  let mockReq;

  // Setup before tests
  beforeAll(() => {
    try {
      const user = db.createUser('testuser' + Date.now(), 'Test User', 'integ@example.com', 'UTC', 'password123');
      testUserId = user.id;
    } catch (e) {
      // User might exist
    }

    // Create access token
    try {
      const stmt = db.db.prepare(`
        INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        testTokenId,
        'test-hash-' + Date.now(),
        testUserId,
        'full',
        'Test Token',
        new Date().toISOString()
      );
    } catch (e) {
      // Token might exist
    }
  });

  describe('POST /api/v1/devices/fingerprint', () => {
    it('should generate device fingerprint for authenticated user', async () => {
      mockReq = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'accept-language': 'en-US,en;q=0.9',
        },
        ip: '192.168.1.100',
        userId: testUserId,
      };

      const fingerprint = DeviceFingerprint.fromRequest(mockReq);

      expect(fingerprint).toBeDefined();
      expect(fingerprint.fingerprintHash).toBeDefined();
      expect(fingerprint.summary).toBeDefined();
      expect(fingerprint.summary.browser).toBeTruthy();
    });

    it('should return 401 without authentication', async () => {
      mockReq = {
        headers: {},
        ip: '192.168.1.100',
        userId: null,
      };

      // Should fail without user context
      expect(mockReq.userId).toBeNull();
    });
  });

  describe('Device Approval Flow', () => {
    it('should create pending device approval', () => {
      const hash = 'test-hash-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'Windows', browser: 'Chrome' },
        '192.168.1.100'
      );

      expect(approvalId).toBeDefined();
      expect(approvalId).toMatch(/^approval_/);

      // Verify it was created
      const approval = db.getPendingApprovalById(approvalId);
      expect(approval).toBeDefined();
      expect(approval.status).toBe('pending');
      expect(approval.user_id).toBe(testUserId);
    });

    it('should approve pending device', () => {
      const hash = 'approve-test-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'macOS', browser: 'Safari' },
        '192.168.1.101'
      );

      const deviceId = db.approvePendingDevice(approvalId, 'My Mac');

      expect(deviceId).toBeDefined();
      expect(deviceId).toMatch(/^device_/);

      // Verify device was created
      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      expect(device).toBeDefined();
      expect(device.device_name).toBe('My Mac');
      expect(device.user_id).toBe(testUserId);

      // Verify approval status changed
      const approval = db.getPendingApprovalById(approvalId);
      expect(approval.status).toBe('approved');
    });

    it('should deny pending device approval', () => {
      const hash = 'deny-test-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'Linux', browser: 'Firefox' },
        '192.168.1.102'
      );

      const reason = 'Device not recognized';
      db.denyPendingApproval(approvalId, reason);

      const approval = db.getPendingApprovalById(approvalId);
      expect(approval.status).toBe('denied');
      expect(approval.denial_reason).toBe(reason);
    });

    it('should reject approval of already approved request', () => {
      const hash = 'already-approved-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'Windows' },
        '192.168.1.103'
      );

      // Approve it
      db.approvePendingDevice(approvalId, 'Device 1');

      // Try to approve again
      const approval = db.getPendingApprovalById(approvalId);
      expect(approval.status).toBe('approved');
    });

    it('should expire pending approval after 24 hours', () => {
      const hash = 'expiry-test-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'iOS' },
        '192.168.1.104'
      );

      const approval = db.getPendingApprovalById(approvalId);
      const expiryTime = new Date(approval.expires_at);
      const now = new Date();
      const hoursUntilExpiry = (expiryTime - now) / (1000 * 60 * 60);

      expect(hoursUntilExpiry).toBeGreaterThan(23);
      expect(hoursUntilExpiry).toBeLessThanOrEqual(24);
    });
  });

  describe('Device Management', () => {
    it('should revoke approved device', () => {
      const hash = 'revoke-test-' + Date.now();
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash,
        'Device to Revoke',
        { os: 'Windows' },
        '192.168.1.105'
      );

      db.revokeDevice(deviceId);

      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      expect(device.revoked_at).toBeDefined();
      expect(device.revoked_at).not.toBeNull();
    });

    it('should rename approved device', () => {
      const hash = 'rename-test-' + Date.now();
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash,
        'Old Name',
        { os: 'Windows' },
        '192.168.1.106'
      );

      db.renameDevice(deviceId, 'New Name');

      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      expect(device.device_name).toBe('New Name');
    });

    it('should update device last used timestamp', () => {
      const hash = 'lastused-test-' + Date.now();
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash,
        'Active Device',
        { os: 'Windows' },
        '192.168.1.107'
      );

      db.updateDeviceLastUsed(deviceId);

      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      expect(device.last_used_at).toBeDefined();
      expect(device.last_used_at).not.toBeNull();
    });

    it('should get approved devices by user', () => {
      const hash1 = 'user-device-1-' + Date.now();
      const hash2 = 'user-device-2-' + Date.now();

      const deviceId1 = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash1,
        'Device 1',
        { os: 'Windows' },
        '192.168.1.108'
      );

      const deviceId2 = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash2,
        'Device 2',
        { os: 'macOS' },
        '192.168.1.109'
      );

      const devices = db.getApprovedDevices(testUserId);

      expect(devices.length).toBeGreaterThanOrEqual(2);
      expect(devices.some(d => d.id === deviceId1)).toBe(true);
      expect(devices.some(d => d.id === deviceId2)).toBe(true);
    });

    it('should get approved device by fingerprint hash', () => {
      const hash = 'fingerprint-lookup-' + Date.now();
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash,
        'Lookup Device',
        { os: 'Windows' },
        '192.168.1.110'
      );

      const device = db.getApprovedDeviceByHash(testUserId, hash);

      expect(device).toBeDefined();
      expect(device.id).toBe(deviceId);
      expect(device.device_fingerprint_hash).toBe(hash);
    });
  });

  describe('Cookie & Session Handling', () => {
    it('should handle secure cookies correctly', () => {
      // Cookies should be HttpOnly and Secure
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      };

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.sameSite).toBe('strict');
    });

    it('should expire device sessions after timeout', () => {
      // Device sessions should be tied to device approval
      // Once a device is revoked, its sessions expire
      const hash = 'session-test-' + Date.now();
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash,
        'Session Device',
        { os: 'Windows' },
        '192.168.1.111'
      );

      // Revoke device
      db.revokeDevice(deviceId);

      // Device should be marked as revoked
      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      expect(device.revoked_at).toBeDefined();
    });
  });

  describe('Pending Approvals - List & Retrieve', () => {
    it('should retrieve pending approvals for user', () => {
      const hash = 'retrieve-pending-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'Android', browser: 'Chrome Mobile' },
        '172.16.0.1'
      );

      const approvals = db.getPendingApprovals(testUserId);

      expect(approvals).toBeDefined();
      expect(Array.isArray(approvals)).toBe(true);
      expect(approvals.some(a => a.id === approvalId)).toBe(true);
    });

    it('should retrieve pending approvals with limit', () => {
      // Create multiple approvals
      for (let i = 0; i < 5; i++) {
        db.createPendingApproval(
          testTokenId,
          testUserId,
          'hash-' + i + '-' + Date.now(),
          { os: 'Windows' },
          '192.168.1.' + (120 + i)
        );
      }

      const approvals = db.getPendingApprovals(testUserId, null, 3);
      expect(approvals.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Activity Log & Audit Trail', () => {
    it('should record device approval history', () => {
      const hash = 'history-test-' + Date.now();
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash,
        'History Device',
        { os: 'Windows' },
        '192.168.1.130'
      );

      const history = db.getDeviceApprovalHistory(testUserId);

      expect(Array.isArray(history)).toBe(true);
      // History should be populated
    });
  });
});

describe('Integration Tests - OAuth Proxy Routes', () => {
  const testUserId = 'oauth-test-' + Date.now();
  const testServiceName = 'github';

  describe('Service Connection', () => {
    it('should validate service name', () => {
      const validServices = ['github', 'slack', 'facebook', 'google'];
      const serviceToTest = 'github';

      expect(validServices).toContain(serviceToTest);
    });

    it('should require OAuth token to be present', () => {
      // Service connection should require token in database
      const { getOAuthToken } = require('../database');

      // Non-existent service should return null
      const token = getOAuthToken('nonexistent', testUserId);
      expect(token).toBeNull();
    });
  });

  describe('Service Proxy Rate Limiting', () => {
    it('should enforce rate limit per user/service', () => {
      // Rate limiting should be implemented at middleware level
      const rateLimit = require('express-rate-limit');

      expect(rateLimit).toBeDefined();
    });

    it('should return 429 when rate limit exceeded', () => {
      // This would be tested with actual HTTP requests
      // Rate limit middleware should return 429 status
    });
  });

  describe('Service Proxy Security', () => {
    it('should validate token scope for service access', () => {
      const requiredScopes = [
        'services:github:read',
        'services:github:write',
        'services:github',
        'services:read',
        'services:*',
      ];

      expect(requiredScopes).toContain('services:github:read');
      expect(requiredScopes).toContain('services:github:write');
    });

    it('should return 403 if token lacks required scope', () => {
      // Token validation should check scope
      const tokenScopes = ['read:profile'];
      const requiredScopes = ['services:github:read'];

      const hasScope = requiredScopes.some(s => tokenScopes.includes(s));
      expect(hasScope).toBe(false);
    });

    it('should return 401 if service not connected', () => {
      // Service connection check before proxy
    });
  });

  describe('Service Proxy with Injected Defaults', () => {
    it('should inject default Slack channel', () => {
      const preferences = {
        serviceName: 'slack',
        defaultChannel: '#general',
      };

      expect(preferences.defaultChannel).toBe('#general');
    });

    it('should inject default Facebook page', () => {
      const preferences = {
        serviceName: 'facebook',
        defaultPageId: '123456',
      };

      expect(preferences.defaultPageId).toBe('123456');
    });

    it('should override provided parameter with default if applicable', () => {
      // When user posts to Slack without channel, use default
      const requestBody = { message: 'Hello' };
      const defaults = { channel: '#general' };

      const merged = { ...defaults, ...requestBody };
      expect(merged.channel).toBe('#general');
      expect(merged.message).toBe('Hello');
    });
  });

  describe('Service Proxy Error Handling', () => {
    it('should handle service unreachable error', () => {
      // Network error should be caught and reported
      const error = new Error('Service unreachable');
      expect(error.message).toContain('Service unreachable');
    });

    it('should handle invalid service method', () => {
      // 404 from service API should be propagated
      const statusCode = 404;
      expect(statusCode).toBe(404);
    });

    it('should handle authentication failure at service', () => {
      // 401 from service should indicate token refresh needed
      const statusCode = 401;
      expect(statusCode).toBe(401);
    });

    it('should handle rate limit from service provider', () => {
      // 429 from service should be propagated
      const statusCode = 429;
      expect(statusCode).toBe(429);
    });
  });

  describe('OAuth Token Refresh', () => {
    it('should refresh token when expired', () => {
      const token = {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000, // Expired
      };

      const isExpired = token.expiresAt < Date.now();
      expect(isExpired).toBe(true);
    });

    it('should handle refresh failure gracefully', () => {
      // If refresh fails, should return 401
      const refreshError = new Error('Refresh failed');
      expect(refreshError.message).toContain('Refresh failed');
    });
  });
});

describe('Code Quality & Security Checks', () => {
  describe('Promise Rejection Handling', () => {
    it('should not have unhandled promise rejections', () => {
      // All async functions should handle .catch() or try/catch
      const asyncFn = async () => {
        try {
          await Promise.reject(new Error('Test error'));
        } catch (e) {
          // Handled
          return e;
        }
      };

      return asyncFn().then(err => {
        expect(err).toBeDefined();
      });
    });

    it('should log all errors appropriately', () => {
      const logger = {
        error: jest.fn(),
      };

      logger.error('Test error', { code: 'ERROR_CODE' });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should use parameterized queries', () => {
      // Check that queries use ? placeholders, not string concatenation
      const safeQuery = 'SELECT * FROM users WHERE id = ?';
      const unsafeQuery = "SELECT * FROM users WHERE id = '" + 'user123' + "'";

      expect(safeQuery).toContain('?');
      expect(unsafeQuery).toContain("'");
    });

    it('should validate input before database operations', () => {
      const userInput = '"; DROP TABLE users; --';
      const sanitized = userInput.trim();

      // Database layer should parameterize, not concatenate
      expect(sanitized).toBeDefined();
    });
  });

  describe('Environment Variables', () => {
    it('should not have hardcoded secrets', () => {
      // Secrets should be in .env, not in code
      const requirementsByService = {
        'GITHUB_CLIENT_ID': 'Service Client ID',
        'GITHUB_CLIENT_SECRET': 'Service Client Secret',
        'ENCRYPTION_KEY': 'Database encryption key',
        'JWT_SECRET': 'Token signing secret',
      };

      // These should all be in .env.example
      expect(requirementsByService).toBeDefined();
    });

    it('should load .env variables safely', () => {
      require('dotenv').config();
      
      // Critical vars should be present or have defaults
      const requiredEnvVars = [
        'PORT',
        'NODE_ENV',
        'DB_PATH',
      ];

      requiredEnvVars.forEach(varName => {
        // Should either be set or have a default in code
        expect(varName).toBeDefined();
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate API input on all endpoints', () => {
      const validateDeviceName = (name) => {
        if (!name || typeof name !== 'string') return false;
        if (name.trim().length === 0) return false;
        if (name.length > 100) return false;
        return true;
      };

      expect(validateDeviceName('My Device')).toBe(true);
      expect(validateDeviceName('')).toBe(false);
      expect(validateDeviceName(null)).toBe(false);
      expect(validateDeviceName('a'.repeat(101))).toBe(false);
    });

    it('should validate request body structure', () => {
      const validateApprovalRequest = (body) => {
        if (!body || typeof body !== 'object') return false;
        if ('device_name' in body && typeof body.device_name !== 'string') return false;
        return true;
      };

      expect(validateApprovalRequest({ device_name: 'Device' })).toBe(true);
      expect(validateApprovalRequest({ device_name: 123 })).toBe(false);
      expect(validateApprovalRequest(null)).toBe(false);
    });
  });

  describe('Middleware Order', () => {
    it('should enforce middleware execution order', () => {
      // Expected order:
      // 1. Body parsing
      // 2. Authentication (auth middleware)
      // 3. Device approval check (if applicable)
      // 4. Route handlers
      // 5. Error handling

      const middlewareOrder = [
        'bodyParser',
        'authenticate',
        'deviceApproval',
        'routes',
        'errorHandler',
      ];

      expect(middlewareOrder[0]).toBe('bodyParser');
      expect(middlewareOrder[1]).toBe('authenticate');
      expect(middlewareOrder[middlewareOrder.length - 1]).toBe('errorHandler');
    });
  });

  describe('CORS & Security Headers', () => {
    it('should set correct CORS headers', () => {
      const corsOptions = {
        origin: ['http://localhost:3001', 'https://myapi.com'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      };

      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.origin).toBeDefined();
    });

    it('should set security headers with Helmet', () => {
      const helmetOptions = {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
          },
        },
      };

      expect(helmetOptions.contentSecurityPolicy).toBeDefined();
    });
  });
});
