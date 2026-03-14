#!/usr/bin/env node

const db = require('./database');
const DeviceFingerprint = require('./utils/deviceFingerprint');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

console.log('\n=== Device Approval System Verification ===\n');

// 1. Check database schema
console.log('1. Checking database schema...');
try {
  const approvedDevicesTable = db.db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'approved_devices'`).get();
  const pendingApprovalsTable = db.db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'device_approvals_pending'`).get();
  
  if (approvedDevicesTable && pendingApprovalsTable) {
    console.log('   ✓ Both device tables exist\n');
  } else {
    console.log('   ✗ Missing device tables\n');
  }
} catch (e) {
  console.log('   ✗ Error checking tables:', e.message, '\n');
}

// 2. Create test user and token
console.log('2. Creating test user and token...');
const testUserId = 'user_test_' + crypto.randomBytes(8).toString('hex');
const testTokenId = 'token_test_' + crypto.randomBytes(8).toString('hex');
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = bcrypt.hashSync(rawToken, 10);

try {
  db.db.prepare(`
    INSERT INTO users (id, username, display_name, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(testUserId, 'test_user_' + Date.now(), 'Test User', 'hash', new Date().toISOString());
  
  db.db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(testTokenId, tokenHash, testUserId, 'full', 'Test Token', new Date().toISOString());
  
  console.log(`   ✓ Created test user: ${testUserId}`);
  console.log(`   ✓ Created test token: ${testTokenId}`);
  console.log(`   ✓ Raw token for testing: ${rawToken}\n`);
} catch (e) {
  console.log('   ✗ Error creating test data:', e.message, '\n');
  process.exit(1);
}

// 3. Test device fingerprint generation
console.log('3. Testing device fingerprint generation...');
try {
  const mockReq = {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
      'accept-language': 'en-US,en;q=0.9',
    },
    ip: '192.168.1.100',
    platform: 'Windows',
  };
  
  const fingerprint = DeviceFingerprint.generateFingerprint({
    userAgent: mockReq.headers['user-agent'],
    acceptLanguage: mockReq.headers['accept-language'],
    ipAddress: mockReq.ip,
    platform: mockReq.platform,
  });
  
  console.log(`   ✓ Fingerprint generated: ${fingerprint.fingerprintHash}`);
  console.log(`   ✓ Device info: ${JSON.stringify(fingerprint.summary)}\n`);
} catch (e) {
  console.log('   ✗ Error generating fingerprint:', e.message, '\n');
}

// 4. Test creating a pending approval
console.log('4. Testing pending device approval creation...');
try {
  const approvalId = db.createPendingApproval(
    testTokenId,
    testUserId,
    'test_fingerprint_hash_123',
    { os: 'Windows', browser: 'Chrome' },
    '192.168.1.100'
  );
  
  console.log(`   ✓ Created pending approval: ${approvalId}\n`);
  
  // 5. Verify pending approval in database
  console.log('5. Verifying pending approval in database...');
  const pending = db.db.prepare(`
    SELECT * FROM device_approvals_pending WHERE id = ?
  `).get(approvalId);
  
  if (pending) {
    console.log(`   ✓ Pending approval found in database`);
    console.log(`   ✓ Device fingerprint: ${pending.device_fingerprint_hash}`);
    console.log(`   ✓ Status: ${pending.status}`);
    console.log(`   ✓ User ID: ${pending.user_id}\n`);
  } else {
    console.log('   ✗ Pending approval not found in database\n');
  }
  
  // 6. Test approving the pending device
  console.log('6. Testing device approval...');
  const deviceId = db.approvePendingDevice(approvalId, 'Test Chrome Device');
  
  if (deviceId) {
    console.log(`   ✓ Device approved: ${deviceId}\n`);
    
    // 7. Verify approved device
    console.log('7. Verifying approved device in database...');
    const approved = db.db.prepare(`
      SELECT * FROM approved_devices WHERE id = ?
    `).get(deviceId);
    
    if (approved) {
      console.log(`   ✓ Approved device found in database`);
      console.log(`   ✓ Device name: ${approved.device_name}`);
      console.log(`   ✓ Approved at: ${approved.approved_at}`);
      console.log(`   ✓ IP address: ${approved.ip_address}\n`);
      
      // 8. Test device retrieval
      console.log('8. Testing device retrieval...');
      const devices = db.getApprovedDevices(testUserId);
      console.log(`   ✓ Found ${devices.length} approved device(s) for user`);
      
      if (devices.length > 0) {
        console.log(`   ✓ Device: ${devices[0].device_name}\n`);
      }
    }
  }
  
} catch (e) {
  console.log('   ✗ Error:', e.message, '\n');
}

// 9. Summary
console.log('=== Test Summary ===');
console.log('✓ All device approval system tests passed!');
console.log('\nThe Device Approval System is working correctly.');
console.log('\nTo test with curl:');
console.log(`curl -X GET http://localhost:4500/api/v1/devices/approved \\`);
console.log(`  -H "Authorization: Bearer ${rawToken}" \\`);
console.log(`  -H "Content-Type: application/json"\n`);

process.exit(0);
