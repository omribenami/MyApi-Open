#!/usr/bin/env node

/**
 * Test script: Logout Persistence Fix
 * 
 * Tests the complete logout flow:
 * 1. Login → Session created
 * 2. GET /auth/me → User confirmed logged in
 * 3. Logout → Session destroyed
 * 4. GET /auth/me → User confirmed logged out
 * 5. Refresh/Retry → No auto-login
 * 
 * Run: node test_logout_persistence.js
 */

const http = require('http');
const https = require('https');
const assert = require('assert');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4500';
const isHttps = BASE_URL.startsWith('https');
const httpClient = isHttps ? https : http;

// Test user credentials
const testUser = {
  email: `test-logout-${Date.now()}@example.com`,
  password: 'TestPassword123',
  username: `testuser${Date.now()}`,
  displayName: 'Test User Logout'
};

let sessionCookies = [];
let testResults = [];

function log(msg, type = 'info') {
  const icon = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'step' ? '👉' : 'ℹ️';
  console.log(`${icon} ${msg}`);
}

function logResult(title, passed, details = '') {
  testResults.push({ title, passed, details });
  if (passed) {
    log(`PASS: ${title}`, 'pass');
    if (details) log(`  └─ ${details}`, 'info');
  } else {
    log(`FAIL: ${title}`, 'fail');
    if (details) log(`  └─ ${details}`, 'info');
  }
}

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // Add session cookies to every request
    if (sessionCookies.length > 0) {
      options.headers.Cookie = sessionCookies.join('; ');
    }

    const req = httpClient.request(url, options, (res) => {
      let data = '';
      
      // Capture Set-Cookie headers
      const setCookieHeaders = res.headers['set-cookie'] || [];
      setCookieHeaders.forEach(cookie => {
        const cookieName = cookie.split('=')[0];
        // Remove old cookie with same name
        sessionCookies = sessionCookies.filter(c => !c.startsWith(cookieName));
        // Add new cookie
        sessionCookies.push(cookie.split(';')[0]);
      });

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
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

async function runTests() {
  log('\n🚀 Starting Logout Persistence Tests\n', 'step');

  try {
    // ===== STEP 1: Register a test user =====
    log('Step 1: Register test user', 'step');
    const registerResp = await makeRequest('POST', '/api/v1/auth/register', testUser);
    
    const registerPassed = registerResp.status === 200 && registerResp.body.success;
    logResult(
      'User registration successful',
      registerPassed,
      `Status: ${registerResp.status}, Response: ${JSON.stringify(registerResp.body).substring(0, 80)}`
    );
    
    if (!registerPassed) {
      throw new Error('Registration failed');
    }

    const userId = registerResp.body.userId;
    log(`  └─ Registered user ID: ${userId}`, 'info');
    log(`  └─ Session cookies captured: ${sessionCookies.length}`, 'info');

    // ===== STEP 2: Verify login by checking /auth/me =====
    log('\nStep 2: Verify user is logged in after registration', 'step');
    const meResp1 = await makeRequest('GET', '/api/v1/auth/me');
    
    const loginPassed = meResp1.status === 200 && meResp1.body.success;
    logResult(
      'GET /auth/me returns logged-in user',
      loginPassed,
      `Status: ${meResp1.status}, User: ${meResp1.body.user?.email}`
    );
    
    if (!loginPassed) {
      log('  └─ Error: User is not logged in after registration!', 'info');
    } else {
      log(`  └─ Confirmed logged in as: ${meResp1.body.user.email}`, 'info');
    }

    // ===== STEP 3: Logout =====
    log('\nStep 3: Logout user', 'step');
    const logoutResp = await makeRequest('POST', '/api/v1/auth/logout');
    
    const logoutPassed = logoutResp.status === 200 && (logoutResp.body.ok || logoutResp.body.success);
    logResult(
      'POST /auth/logout succeeds',
      logoutPassed,
      `Status: ${logoutResp.status}, Response: ${JSON.stringify(logoutResp.body)}`
    );

    if (!logoutPassed) {
      throw new Error('Logout failed');
    }
    
    log('  └─ Session cookies after logout: ' + sessionCookies.join('; '), 'info');

    // ===== STEP 4: Verify logout by checking /auth/me =====
    log('\nStep 4: Verify user is logged out', 'step');
    const meResp2 = await makeRequest('GET', '/api/v1/auth/me');
    
    const logoutVerifyPassed = meResp2.status === 401 || (meResp2.status === 200 && !meResp2.body.success);
    logResult(
      'GET /auth/me after logout returns 401 Unauthorized',
      logoutVerifyPassed,
      `Status: ${meResp2.status}, Response: ${JSON.stringify(meResp2.body).substring(0, 80)}`
    );

    if (!logoutVerifyPassed) {
      log('  ⚠️  WARNING: User is still logged in after logout! (Persistence bug)', 'info');
      log(`      Response: ${JSON.stringify(meResp2.body)}`, 'info');
    }

    // ===== STEP 5: Refresh (simulate browser refresh) =====
    log('\nStep 5: Simulate browser refresh - check for auto-login', 'step');
    const refreshResp = await makeRequest('GET', '/api/v1/auth/me');
    
    const noAutoLoginPassed = refreshResp.status === 401 || (refreshResp.status === 200 && !refreshResp.body.success);
    logResult(
      'No auto-login on refresh (session stays destroyed)',
      noAutoLoginPassed,
      `Status: ${refreshResp.status}, Response: ${JSON.stringify(refreshResp.body).substring(0, 80)}`
    );

    if (!noAutoLoginPassed) {
      log('  ⚠️  CRITICAL: Auto-login detected on refresh!', 'info');
      log(`      This is the persistence bug: ${JSON.stringify(refreshResp.body)}`, 'info');
    }

    // ===== STEP 6: Verify logout with new auth route =====
    log('\nStep 6: Test logout via /api/v1/auth/logout endpoint', 'step');
    
    // Re-login first
    const reloginResp = await makeRequest('POST', '/api/v1/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    
    if (reloginResp.status !== 200) {
      log('  └─ Could not re-login for v1 endpoint test', 'info');
    } else {
      log(`  └─ Re-logged in, testing /api/v1/auth/logout`, 'info');
      
      const logoutV1Resp = await makeRequest('POST', '/api/v1/auth/logout');
      const logoutV1Passed = logoutV1Resp.status === 200;
      logResult(
        'POST /api/v1/auth/logout succeeds',
        logoutV1Passed,
        `Status: ${logoutV1Resp.status}`
      );

      // Verify logged out
      const meRespV1 = await makeRequest('GET', '/api/v1/auth/me');
      const logoutV1VerifyPassed = meRespV1.status === 401 || (meRespV1.status === 200 && !meRespV1.body.success);
      logResult(
        'User logged out after /api/v1/auth/logout',
        logoutV1VerifyPassed,
        `Status: ${meRespV1.status}`
      );
    }

  } catch (error) {
    log(`\n❌ Test error: ${error.message}`, 'fail');
    logResult('Test execution', false, error.message);
  }

  // ===== Print Summary =====
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  testResults.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.title}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    result.passed ? passed++ : failed++;
  });

  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${testResults.length}`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
