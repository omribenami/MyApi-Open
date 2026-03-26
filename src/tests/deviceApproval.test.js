const assert = require('assert');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const db = require('../database');

describe('Device Approval System', () => {
  // Test data
  let testUserId;
  const testTokenId = 'test-token-' + Date.now();
  const testIp = '192.168.1.100';

  // Create test user and token before tests
  beforeAll(() => {
    db.initDatabase();
    // Ensure test user exists
    try {
      const user = db.createUser('testuser' + Date.now(), 'Test User', 'device@example.com', 'UTC', 'password123');
      testUserId = user.id;
    } catch (e) {
      // User might already exist
    }

    // Ensure test token exists
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
      // Token might already exist
    }
  });

  describe('Device Fingerprinting', () => {
    it('should generate consistent fingerprints for same device', () => {
      const data1 = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        acceptLanguage: 'en-US,en;q=0.9',
        ipAddress: testIp,
        platform: 'Windows',
        hostname: 'test-device',
        macAddress: '00:11:22:33:44:55',
      };

      const fp1 = DeviceFingerprint.generateFingerprint(data1);
      const fp2 = DeviceFingerprint.generateFingerprint(data1);

      assert.strictEqual(fp1.fingerprintHash, fp2.fingerprintHash, 'Same data should produce same hash');
    });

    it('should generate different fingerprints for different devices', () => {
      const data1 = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        acceptLanguage: 'en-US,en;q=0.9',
        ipAddress: '192.168.1.100',
        platform: 'Windows',
        hostname: 'device1',
        macAddress: '00:11:22:33:44:55',
      };

      const data2 = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        acceptLanguage: 'en-US,en;q=0.9',
        ipAddress: '192.168.1.101',
        platform: 'macOS',
        hostname: 'device2',
        macAddress: '00:11:22:33:44:66',
      };

      const fp1 = DeviceFingerprint.generateFingerprint(data1);
      const fp2 = DeviceFingerprint.generateFingerprint(data2);

      assert.notStrictEqual(fp1.fingerprintHash, fp2.fingerprintHash, 'Different data should produce different hash');
    });

    it('should extract OS correctly', () => {
      const windowsUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const fp = DeviceFingerprint.generateFingerprint({
        userAgent: windowsUA,
        platform: '',
      });
      assert.strictEqual(fp.summary.os, 'Windows', 'Should identify Windows OS');
    });

    it('should extract browser correctly', () => {
      const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      const fp = DeviceFingerprint.generateFingerprint({
        userAgent: chromeUA,
      });
      assert.strictEqual(fp.summary.browser, 'Chrome', 'Should identify Chrome browser');
    });

    it('should handle missing data gracefully', () => {
      const fp = DeviceFingerprint.generateFingerprint({});
      assert.ok(fp.fingerprintHash, 'Should generate hash even with no data');
      assert.ok(fp.summary, 'Should generate summary even with no data');
    });
  });

  describe('Device Approval Database', () => {
    it('should create approved device', () => {
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        'test-hash-' + Date.now(),
        'Test Device',
        { os: 'Windows', browser: 'Chrome' },
        testIp
      );

      assert.ok(deviceId, 'Should return device ID');
      assert(deviceId.startsWith('device_'), 'Device ID should have correct prefix');
    });

    it('should retrieve approved devices', () => {
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        'retrieval-test-' + Date.now(),
        'Retrieval Test Device',
        { os: 'Windows' },
        testIp
      );

      const devices = db.getApprovedDevices(testUserId);
      const found = devices.find(d => d.id === deviceId);

      assert.ok(found, 'Should find created device');
      assert.strictEqual(found.device_name, 'Retrieval Test Device', 'Device name should match');
    });

    it('should get approved device by fingerprint hash', () => {
      const hash = 'specific-hash-' + Date.now();
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash,
        'Hash Lookup Device',
        { os: 'macOS' },
        testIp
      );

      const device = db.getApprovedDeviceByHash(testUserId, hash);

      assert.ok(device, 'Should find device by hash');
      assert.strictEqual(device.id, deviceId, 'Device ID should match');
    });

    it('should revoke device', () => {
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        'revoke-test-' + Date.now(),
        'Revoke Test',
        {},
        testIp
      );

      db.revokeDevice(deviceId);

      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      assert.ok(device.revoked_at, 'Device should have revocation timestamp');
    });

    it('should rename device', () => {
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        'rename-test-' + Date.now(),
        'Old Name',
        {},
        testIp
      );

      db.renameDevice(deviceId, 'New Name');

      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      assert.strictEqual(device.device_name, 'New Name', 'Device name should be updated');
    });

    it('should update last used timestamp', () => {
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        'lastused-test-' + Date.now(),
        'Last Used Test',
        {},
        testIp
      );

      db.updateDeviceLastUsed(deviceId);

      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      assert.ok(device.last_used_at, 'Should have last_used_at timestamp');
    });
  });

  describe('Pending Device Approvals', () => {
    it('should create pending approval', () => {
      const hash = 'pending-test-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'Linux', browser: 'Firefox' },
        '10.0.0.1'
      );

      assert.ok(approvalId, 'Should return approval ID');
      assert(approvalId.startsWith('approval_'), 'Should have correct ID prefix');
    });

    it('should retrieve pending approvals', () => {
      const hash = 'retrieve-pending-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'Android' },
        '172.16.0.1'
      );

      const approvals = db.getPendingApprovals(testUserId);
      const found = approvals.find(a => a.id === approvalId);

      assert.ok(found, 'Should find pending approval');
      assert.strictEqual(found.status, 'pending', 'Status should be pending');
    });

    it('should approve pending device', () => {
      const hash = 'approve-test-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        { os: 'iOS' },
        '203.0.113.1'
      );

      const deviceId = db.approvePendingDevice(approvalId, 'iPhone');

      assert.ok(deviceId, 'Should return device ID');

      const approval = db.getPendingApprovalById(approvalId);
      assert.strictEqual(approval.status, 'approved', 'Approval status should be updated');

      const device = db.db.prepare('SELECT * FROM approved_devices WHERE id = ?').get(deviceId);
      assert.ok(device, 'Should create approved device');
      assert.strictEqual(device.device_name, 'iPhone', 'Device name should match');
    });

    it('should deny pending approval', () => {
      const hash = 'deny-test-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        {},
        '198.51.100.1'
      );

      db.denyPendingApproval(approvalId, 'User denied this device');

      const approval = db.getPendingApprovalById(approvalId);
      assert.strictEqual(approval.status, 'denied', 'Status should be denied');
      assert.strictEqual(approval.denial_reason, 'User denied this device', 'Denial reason should be recorded');
    });

    it('should set expiration on pending approval', () => {
      const hash = 'expiry-test-' + Date.now();
      const approvalId = db.createPendingApproval(
        testTokenId,
        testUserId,
        hash,
        {},
        '192.0.2.1'
      );

      const approval = db.getPendingApprovalById(approvalId);
      const expiryDate = new Date(approval.expires_at);
      const now = new Date();
      const hoursUntilExpiry = (expiryDate - now) / (1000 * 60 * 60);

      assert.ok(hoursUntilExpiry > 23 && hoursUntilExpiry <= 24, 'Approval should expire in ~24 hours');
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect OS changes', () => {
      const current = {
        summary: { os: 'Windows' },
        fingerprint: { ipAddress: '192.168.1.100' },
      };

      const previous = [{
        summary: { os: 'macOS' },
        fingerprint: { ipAddress: '192.168.1.100' },
      }];

      const analysis = DeviceFingerprint.analyzeSuspiciousActivity(current, previous);

      assert(analysis.warnings.length > 0, 'Should detect OS change');
    });

    it('should detect browser changes', () => {
      const current = {
        summary: { browser: 'Firefox' },
        fingerprint: { ipAddress: '192.168.1.100' },
      };

      const previous = [{
        summary: { browser: 'Chrome' },
        fingerprint: { ipAddress: '192.168.1.100' },
      }];

      const analysis = DeviceFingerprint.analyzeSuspiciousActivity(current, previous);

      assert(analysis.warnings.length > 0, 'Should detect browser change');
    });

    it('should detect multiple IPs', () => {
      const current = {
        summary: { os: 'Windows', browser: 'Chrome' },
        fingerprint: { ipAddress: '192.168.1.103' },
      };

      const previous = [
        { summary: { os: 'Windows', browser: 'Chrome' }, fingerprint: { ipAddress: '192.168.1.100' } },
        { summary: { os: 'Windows', browser: 'Chrome' }, fingerprint: { ipAddress: '192.168.1.101' } },
        { summary: { os: 'Windows', browser: 'Chrome' }, fingerprint: { ipAddress: '192.168.1.102' } },
      ];

      const analysis = DeviceFingerprint.analyzeSuspiciousActivity(current, previous);

      assert(analysis.warnings.length > 0, 'Should detect multiple IP addresses');
    });

    it('should return new device risk level for no history', () => {
      const current = {
        summary: {},
        fingerprint: { ipAddress: '192.168.1.100' },
      };

      const analysis = DeviceFingerprint.analyzeSuspiciousActivity(current, []);

      assert.strictEqual(analysis.riskLevel, 'new', 'Should identify as new device');
    });
  });

  describe('Activity Log', () => {
    it('should record device approval history', () => {
      const hash = 'history-test-' + Date.now();
      const deviceId = db.createApprovedDevice(
        testTokenId,
        testUserId,
        hash,
        'History Test Device',
        { os: 'Windows' },
        testIp
      );

      const history = db.getDeviceApprovalHistory(testUserId);

      assert(history.length > 0, 'Should have activity history');
      assert(history.some(h => h.id === deviceId), 'Should include created device');
    });

    it('should retrieve activity log with limit', () => {
      const limit = 5;
      const history = db.getDeviceApprovalHistory(testUserId, null, limit);

      assert(history.length <= limit, 'Should respect limit parameter');
    });
  });

  describe('Fingerprint Verification', () => {
    it('should verify matching fingerprints', () => {
      const hash1 = 'verify-test-' + Date.now();
      const hash2 = hash1; // Same value

      const match = DeviceFingerprint.verifyFingerprint(hash1, hash2);
      assert.strictEqual(match, true, 'Should verify matching fingerprints');
    });

    it('should reject non-matching fingerprints', () => {
      const hash1 = 'hash-1-' + Date.now();
      const hash2 = 'hash-2-' + Date.now();

      const match = DeviceFingerprint.verifyFingerprint(hash1, hash2);
      assert.strictEqual(match, false, 'Should reject non-matching fingerprints');
    });

    it('should reject null or empty fingerprints', () => {
      const match1 = DeviceFingerprint.verifyFingerprint(null, 'hash');
      const match2 = DeviceFingerprint.verifyFingerprint('hash', null);
      const match3 = DeviceFingerprint.verifyFingerprint('', '');

      assert.strictEqual(match1, false, 'Should reject null first argument');
      assert.strictEqual(match2, false, 'Should reject null second argument');
      assert.strictEqual(match3, false, 'Should reject empty strings');
    });
  });
});
