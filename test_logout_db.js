#!/usr/bin/env node

/**
 * Database-level test for logout persistence
 * Verifies that sessions are actually removed from SQLite on logout
 */

const http = require('http');
const BetterSqlite3 = require('better-sqlite3');
const path = require('path');

const BASE_URL = 'http://localhost:4500';
const dbPath = path.join(__dirname, 'src', 'db.sqlite');

const testUser = {
  email: `db-test-${Date.now()}@example.com`,
  password: 'TestPassword123',
  username: `dbtest${Date.now()}`,
  displayName: 'DB Test User'
};

let sessionCookie = null;

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

function getSessionCount() {
  try {
    const db = new BetterSqlite3(dbPath);
    const result = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
    db.close();
    return result.count;
  } catch (error) {
    return -1;
  }
}

function getSessionSids() {
  try {
    const db = new BetterSqlite3(dbPath);
    const results = db.prepare('SELECT sid FROM sessions ORDER BY expire DESC LIMIT 10').all();
    db.close();
    return results.map(r => r.sid);
  } catch (error) {
    return [];
  }
}

async function runTest() {
  console.log('🔬 Database-Level Logout Test\n');
  console.log(`Test user: ${testUser.email}\n`);
  
  try {
    // Step 1: Check initial session count
    const initialCount = getSessionCount();
    console.log(`📊 Initial session count: ${initialCount}`);
    
    // Step 2: Register user
    console.log('\n1️⃣ Registering user...');
    const registerResp = await makeRequest('POST', '/api/v1/auth/register', testUser);
    if (registerResp.status !== 200) {
      throw new Error(`Registration failed: ${registerResp.status}`);
    }
    console.log('   ✅ User registered');
    console.log(`   📝 Session cookie: ${sessionCookie ? sessionCookie.substring(0, 30) + '...' : 'none'}`);
    
    // Step 3: Check session count after registration
    const afterRegisterCount = getSessionCount();
    console.log(`\n📊 Session count after registration: ${afterRegisterCount}`);
    if (afterRegisterCount <= initialCount) {
      console.log('   ⚠️  No new session created (expected for this auth method)');
    } else {
      console.log(`   ✅ New session created (+${afterRegisterCount - initialCount})`);
    }
    
    // Step 4: Login to get a real session
    console.log('\n2️⃣ Logging in...');
    const loginResp = await makeRequest('POST', '/api/v1/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    if (loginResp.status !== 200) {
      console.log('   ⚠️  Login response:', loginResp);
      console.log('   (This might be expected - testing logout without session)');
    } else {
      console.log('   ✅ User logged in');
      console.log(`   📝 Session cookie: ${sessionCookie ? sessionCookie.substring(0, 30) + '...' : 'none'}`);
    }
    
    // Step 5: Check session count after login
    const afterLoginCount = getSessionCount();
    console.log(`\n📊 Session count after login: ${afterLoginCount}`);
    if (afterLoginCount > afterRegisterCount) {
      console.log(`   ✅ New session created (+${afterLoginCount - afterRegisterCount})`);
    } else {
      console.log('   ⚠️  No new session detected');
    }
    
    // Step 6: Get the current session SIDs
    const beforeLogoutSids = getSessionSids();
    console.log(`\n📋 Top 10 session SIDs before logout:`);
    beforeLogoutSids.slice(0, 3).forEach(sid => {
      console.log(`   - ${sid}`);
    });
    
    // Step 7: Logout
    console.log('\n3️⃣ Logging out...');
    const logoutResp = await makeRequest('POST', '/api/v1/auth/logout');
    if (logoutResp.status !== 200) {
      throw new Error(`Logout failed: ${logoutResp.status}`);
    }
    console.log('   ✅ Logout successful');
    console.log(`   📝 Response: ${JSON.stringify(logoutResp.body)}`);
    
    // Step 8: Check session count after logout
    const afterLogoutCount = getSessionCount();
    console.log(`\n📊 Session count after logout: ${afterLogoutCount}`);
    if (afterLogoutCount < afterLoginCount) {
      console.log(`   ✅ Session removed from database (-${afterLoginCount - afterLogoutCount})`);
    } else {
      console.log(`   ⚠️  Session count unchanged (${afterLogoutCount} vs ${afterLoginCount})`);
      console.log('   💡 This could indicate the session is NOT being properly destroyed!');
    }
    
    // Step 9: Try to use the session after logout
    console.log('\n4️⃣ Attempting to use session after logout...');
    const meResp = await makeRequest('GET', '/api/v1/auth/me');
    if (meResp.status === 401 || (meResp.status === 200 && !meResp.body.success)) {
      console.log('   ✅ Session is invalid (user NOT logged in)');
    } else {
      console.log('   ⚠️  PROBLEM: Session is still valid!');
      console.log(`   📝 Response: ${JSON.stringify(meResp.body).substring(0, 100)}`);
      console.log('   This indicates the logout persistence bug!');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ LOGOUT FIX VERIFICATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Initial sessions: ${initialCount}`);
    console.log(`Final sessions: ${afterLogoutCount}`);
    console.log(`Change: ${afterLogoutCount - initialCount}`);
    
    if (afterLogoutCount < afterLoginCount) {
      console.log('\n✅ SUCCESS: Sessions are properly removed on logout');
    } else {
      console.log('\n⚠️  WARNING: Sessions may not be properly cleaned up');
    }
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  }
}

runTest();
