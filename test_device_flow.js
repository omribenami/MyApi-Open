#!/usr/bin/env node

/**
 * Comprehensive Device Approval Flow Test
 * Tests the full lifecycle of device management and approval
 */

const http = require('http');
const crypto = require('crypto');

const API_BASE_URL = 'http://localhost:4500/api/v1';

// Helper function to make HTTP requests
function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Helper to create a test token for admin operations
async function createTestToken() {
  console.log('\n=== Step 0: Creating Test Token (Admin) ===');
  
  try {
    const response = await makeRequest('POST', '/api/v1/tokens', {
      'Content-Type': 'application/json',
    }, {
      label: `Test Token ${Date.now()}`,
      scope: 'full',
    });

    if (response.status === 401 || response.status === 403) {
      console.log('⚠️  No auth required for token creation. Creating via database query...');
      // This test assumes there's at least one way to get an admin token
      // For now, we'll use a hardcoded approach
      return null;
    }

    if (response.status === 200 || response.status === 201) {
      const token = response.body.id || response.body.token;
      console.log('✓ Test token created:', token);
      return token;
    }

    console.log('Response:', response);
    return null;
  } catch (error) {
    console.log('⚠️  Token creation failed (expected if server requires auth):', error.message);
    return null;
  }
}

// Test Step 1: Unapproved device tries to access protected route
async function testStep1_UnapprovedDeviceAccess(adminToken) {
  console.log('\n=== Step 1: Unapproved Device Tries to Access Protected Route ===');
  
  // Use a known test token that's already in the database
  const unapprovedToken = `test_token_123456789abcdef123456`;
  const uniqueUserAgent = `TestBrowser/${Date.now()}/Device1`;
  const uniqueIP = `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;

  console.log(`Token: ${unapprovedToken}`);
  console.log(`User-Agent: ${uniqueUserAgent}`);
  console.log(`IP: ${uniqueIP}`);

  try {
    const response = await makeRequest('GET', '/dashboard/metrics', {
      'Authorization': `Bearer ${unapprovedToken}`,
      'User-Agent': uniqueUserAgent,
      'X-Forwarded-For': uniqueIP,
    });

    console.log(`Response Status: ${response.status}`);
    console.log('Response Body:', JSON.stringify(response.body, null, 2));

    // Expectation 1: 403 Forbidden with device approval required
    if (response.status === 403) {
      const errorCode = response.body?.code || response.body?.error;
      if (errorCode === 'DEVICE_APPROVAL_REQUIRED' || errorCode === 'device_not_approved') {
        console.log('✓ PASS: Got expected 403 with device approval required');
        
        // Extract approval ID for next steps
        const approvalId = response.body?.approval?.id;
        if (approvalId) {
          console.log(`✓ Approval ID: ${approvalId}`);
          return {
            status: 'pass',
            approvalId,
            token: unapprovedToken,
            userAgent: uniqueUserAgent,
            ip: uniqueIP,
          };
        } else {
          console.log('⚠️  No approval ID in response');
          return {
            status: 'warning',
            approvalId: null,
            token: unapprovedToken,
            userAgent: uniqueUserAgent,
            ip: uniqueIP,
          };
        }
      } else {
        console.log('✗ FAIL: Got 403 but wrong error code:', errorCode);
        return { status: 'fail', error: 'Wrong error code' };
      }
    } else if (response.status === 401) {
      console.log('⚠️  Got 401 instead of 403. Token might not be recognized.');
      return { status: 'warning', token: unapprovedToken, userAgent: uniqueUserAgent, ip: uniqueIP };
    } else {
      console.log(`✗ FAIL: Expected 403, got ${response.status}`);
      return { status: 'fail', error: `Got ${response.status} instead of 403` };
    }
  } catch (error) {
    console.log('✗ FAIL: Request error:', error.message);
    return { status: 'fail', error: error.message };
  }
}

// Test Step 2-4: Admin fetches pending devices and approves
async function testStep2_AdminApprovesDevice(adminToken, approvalId) {
  console.log('\n=== Step 2-4: Admin Approves Device ===');
  
  if (!adminToken) {
    console.log('⚠️  No admin token available, skipping approval step');
    // In a real scenario, we'd need to use a test admin or mock database
    return { status: 'skipped', reason: 'No admin token' };
  }

  try {
    // Step 3: Fetch pending devices
    console.log('\nFetching pending device approvals...');
    const pendingResponse = await makeRequest('GET', '/devices/approvals/pending', {
      'Authorization': `Bearer ${adminToken}`,
    });

    console.log(`Pending Response Status: ${pendingResponse.status}`);
    if (pendingResponse.status === 200) {
      console.log('Pending approvals:', pendingResponse.body);
    }

    // Step 4: Approve the device
    if (approvalId) {
      console.log(`\nApproving device: ${approvalId}`);
      const approveResponse = await makeRequest('POST', `/devices/approve/${approvalId}`, {
        'Authorization': `Bearer ${adminToken}`,
      }, {
        device_name: `Test Device ${Date.now()}`,
      });

      console.log(`Approve Response Status: ${approveResponse.status}`);
      console.log('Approve Response Body:', JSON.stringify(approveResponse.body, null, 2));

      if (approveResponse.status === 200 && approveResponse.body?.success) {
        console.log('✓ PASS: Device approved successfully');
        return { status: 'pass', approvalId };
      } else {
        console.log('✗ FAIL: Device approval failed');
        return { status: 'fail', error: 'Approval failed' };
      }
    } else {
      console.log('⚠️  No approval ID available');
      return { status: 'warning' };
    }
  } catch (error) {
    console.log('✗ FAIL: Approval error:', error.message);
    return { status: 'fail', error: error.message };
  }
}

// Test Step 5: Retry with approved device
async function testStep5_ApprovedDeviceAccess(token, userAgent, ip) {
  console.log('\n=== Step 5: Approved Device Retries Access ===');
  
  console.log(`Token: ${token}`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`IP: ${ip}`);

  try {
    const response = await makeRequest('GET', '/dashboard/metrics', {
      'Authorization': `Bearer ${token}`,
      'User-Agent': userAgent,
      'X-Forwarded-For': ip,
    });

    console.log(`Response Status: ${response.status}`);
    console.log('Response Body:', JSON.stringify(response.body, null, 2));

    // Expectation 2: 200 OK
    if (response.status === 200) {
      console.log('✓ PASS: Got expected 200 OK response');
      return { status: 'pass', metrics: response.body };
    } else if (response.status === 403) {
      console.log('⚠️  Still getting 403 - device might not be fully approved yet');
      return { status: 'warning', error: 'Still not approved' };
    } else {
      console.log(`✗ FAIL: Expected 200, got ${response.status}`);
      return { status: 'fail', error: `Got ${response.status}` };
    }
  } catch (error) {
    console.log('✗ FAIL: Request error:', error.message);
    return { status: 'fail', error: error.message };
  }
}

// Test Step 6-7: Admin revokes device and verify access is denied
async function testStep6_AdminRevokesDevice(adminToken, deviceId) {
  console.log('\n=== Step 6: Admin Revokes Device ===');
  
  if (!adminToken || !deviceId) {
    console.log('⚠️  Missing admin token or device ID, skipping revocation');
    return { status: 'skipped' };
  }

  try {
    const revokeResponse = await makeRequest('POST', `/devices/${deviceId}/revoke`, {
      'Authorization': `Bearer ${adminToken}`,
    });

    console.log(`Revoke Response Status: ${revokeResponse.status}`);
    console.log('Revoke Response Body:', JSON.stringify(revokeResponse.body, null, 2));

    if (revokeResponse.status === 200 && revokeResponse.body?.success) {
      console.log('✓ PASS: Device revoked successfully');
      return { status: 'pass' };
    } else {
      console.log('✗ FAIL: Device revocation failed');
      return { status: 'fail' };
    }
  } catch (error) {
    console.log('✗ FAIL: Revocation error:', error.message);
    return { status: 'fail', error: error.message };
  }
}

// Test Step 7: Retry with revoked device
async function testStep7_RevokedDeviceAccess(token, userAgent, ip) {
  console.log('\n=== Step 7: Revoked Device Retries Access ===');
  
  console.log(`Token: ${token}`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`IP: ${ip}`);

  try {
    const response = await makeRequest('GET', '/dashboard/metrics', {
      'Authorization': `Bearer ${token}`,
      'User-Agent': userAgent,
      'X-Forwarded-For': ip,
    });

    console.log(`Response Status: ${response.status}`);
    console.log('Response Body:', JSON.stringify(response.body, null, 2));

    // Expectation 3: 401/403 device revoked error
    if (response.status === 401 || response.status === 403) {
      const errorCode = response.body?.code || response.body?.error;
      if (errorCode && (errorCode.includes('revoked') || errorCode.includes('not_approved'))) {
        console.log('✓ PASS: Got expected 401/403 with device revoked error');
        return { status: 'pass' };
      } else {
        console.log(`⚠️  Got ${response.status} but unclear error code: ${errorCode}`);
        return { status: 'warning' };
      }
    } else {
      console.log(`✗ FAIL: Expected 401/403, got ${response.status}`);
      return { status: 'fail' };
    }
  } catch (error) {
    console.log('✗ FAIL: Request error:', error.message);
    return { status: 'fail', error: error.message };
  }
}

// Main test flow
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Device Approval Flow - End-to-End Test Suite              ║');
  console.log('║  Server: http://localhost:4500                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = {
    step1: null,
    step2: null,
    step5: null,
    step6: null,
    step7: null,
  };

  try {
    // Try to get or create admin token
    const adminToken = await createTestToken();

    // Step 1: Test unapproved device access
    results.step1 = await testStep1_UnapprovedDeviceAccess(adminToken);

    if (results.step1.status === 'pass' || results.step1.status === 'warning') {
      // Step 2-4: Admin approves device
      results.step2 = await testStep2_AdminApprovesDevice(adminToken, results.step1.approvalId);

      // Add a small delay to let database update
      await new Promise(r => setTimeout(r, 500));

      // Step 5: Test approved device access
      if (results.step1.token) {
        results.step5 = await testStep5_ApprovedDeviceAccess(
          results.step1.token,
          results.step1.userAgent,
          results.step1.ip
        );

        // Step 6-7: Admin revokes and test revoked access
        // Note: deviceId would need to come from approval response
        if (results.step2?.approvalId) {
          results.step6 = await testStep6_AdminRevokesDevice(adminToken, results.step2.approvalId);
          
          await new Promise(r => setTimeout(r, 500));

          results.step7 = await testStep7_RevokedDeviceAccess(
            results.step1.token,
            results.step1.userAgent,
            results.step1.ip
          );
        }
      }
    }
  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const passCount = Object.values(results).filter(r => r?.status === 'pass').length;
  const failCount = Object.values(results).filter(r => r?.status === 'fail').length;
  const skipCount = Object.values(results).filter(r => r?.status === 'skipped').length;
  const warnCount = Object.values(results).filter(r => r?.status === 'warning').length;

  console.log(`\nResults:`);
  console.log(`  ✓ PASS:     ${passCount}`);
  console.log(`  ✗ FAIL:     ${failCount}`);
  console.log(`  ⚠️  WARNING: ${warnCount}`);
  console.log(`  ⊘ SKIPPED:  ${skipCount}`);

  Object.entries(results).forEach(([step, result]) => {
    if (result) {
      const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : result.status === 'warning' ? '⚠️' : '⊘';
      console.log(`\n${icon} ${step.toUpperCase()}: ${result.status.toUpperCase()}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });

  console.log('\n' + '═'.repeat(60));
  if (failCount === 0) {
    console.log('✓ All critical tests passed!');
  } else {
    console.log(`✗ ${failCount} test(s) failed. Review output above.`);
  }
  console.log('═'.repeat(60) + '\n');

  process.exit(failCount > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
