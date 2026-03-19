#!/usr/bin/env node

/**
 * Test logout using the old auth.js endpoints
 * This tests the legacy auth flow at /api/v1/auth/*
 */

const http = require('http');

const BASE_URL = 'http://localhost:4500';

const testUser = {
  email: `testuser${Date.now()}@example.com`,
  username: `testuser${Date.now()}`,
  password: 'TestPassword123',
  displayName: 'Test User'
};

let sessionCookie = null;
let userInfo = null;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (sessionCookie) {
      options.headers.Cookie = sessionCookie;
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      
      // Capture Set-Cookie header
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        sessionCookie = setCookie[0].split(';')[0];
        console.log(`  📝 Session cookie: ${sessionCookie.substring(0, 40)}...`);
      }

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('🔐 Testing Logout with Old Auth Flow (/api/v1/auth/...)\n');
  
  try {
    // Step 1: Register
    console.log('1️⃣  Registering user...');
    console.log(`   Username: ${testUser.username}`);
    console.log(`   Password: ${testUser.password}`);
    
    const registerResp = await makeRequest('POST', '/api/v1/auth/register', testUser);
    
    if (registerResp.status !== 200) {
      console.log(`❌ Registration failed: ${registerResp.status}`);
      console.log(`   Response: ${JSON.stringify(registerResp.body)}`);
      throw new Error('Registration failed');
    }
    
    console.log('✅ User registered');
    userInfo = registerResp.body.data?.user;
    console.log(`   User ID: ${userInfo?.id}`);
    console.log(`   Username: ${userInfo?.username}`);
    
    // Step 2: Check /auth/me
    console.log('\n2️⃣  Checking /auth/me (should be logged in)...');
    const meResp1 = await makeRequest('GET', '/api/v1/auth/me');
    
    if (meResp1.status === 200) {
      console.log('✅ User is logged in');
      console.log(`   Response: ${JSON.stringify(meResp1.body)}`);
    } else {
      console.log(`⚠️  Status: ${meResp1.status}`);
      console.log(`   Response: ${JSON.stringify(meResp1.body)}`);
    }
    
    // Step 3: Logout
    console.log('\n3️⃣  Calling /auth/logout...');
    const logoutResp = await makeRequest('POST', '/api/v1/auth/logout');
    
    if (logoutResp.status !== 200) {
      console.log(`❌ Logout failed: ${logoutResp.status}`);
      console.log(`   Response: ${JSON.stringify(logoutResp.body)}`);
      throw new Error('Logout failed');
    }
    
    console.log('✅ Logout successful');
    console.log(`   Response: ${JSON.stringify(logoutResp.body)}`);
    
    // Step 4: Check /auth/me after logout
    console.log('\n4️⃣  Checking /auth/me after logout (should NOT be logged in)...');
    const meResp2 = await makeRequest('GET', '/api/v1/auth/me');
    
    if (meResp2.status === 401 || meResp2.body.error) {
      console.log('✅ User is logged out');
      console.log(`   Status: ${meResp2.status}`);
      console.log(`   Response: ${JSON.stringify(meResp2.body)}`);
    } else {
      console.log('❌ PROBLEM: User is still logged in!');
      console.log(`   Status: ${meResp2.status}`);
      console.log(`   Response: ${JSON.stringify(meResp2.body)}`);
    }
    
    // Step 5: Try again without session cookie
    console.log('\n5️⃣  Clearing cookies and trying /auth/me again...');
    sessionCookie = null;
    const meResp3 = await makeRequest('GET', '/api/v1/auth/me');
    
    if (meResp3.status === 401 || meResp3.body.error) {
      console.log('✅ No session exists (confirmed logged out)');
      console.log(`   Response: ${JSON.stringify(meResp3.body)}`);
    } else {
      console.log('❌ PROBLEM: User is still accessible without session!');
      console.log(`   Response: ${JSON.stringify(meResp3.body)}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ LOGOUT TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('The fix is working if:');
    console.log('  ✓ User is logged in after registration');
    console.log('  ✓ Logout endpoint returns success');
    console.log('  ✓ GET /auth/me returns 401 after logout');
    console.log('  ✓ No auto-login on refresh\n');
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  }
}

runTest();
