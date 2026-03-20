#!/usr/bin/env node

/**
 * Comprehensive test suite for bug fixes
 * Tests: BUG-1, BUG-2, BUG-3, BUG-4
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:4500';

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (err) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: err.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
  }
}

async function runTests() {
  console.log('=== Testing Bug Fixes ===\n');

  // BUG-3: Register returns 201 instead of 200
  console.log('--- BUG-3: Register Status Code ---');
  await test('Register endpoint returns 201', async () => {
    const username = `testuser_${Date.now()}`;
    const res = await makeRequest('POST', '/api/v1/auth/register', {
      username,
      password: 'password123',
      email: 'test@example.com',
      display_name: 'Test User'
    });
    
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.body.data, 'Response should have data field');
    assert(res.body.data.user, 'Response should have user object');
    assert.strictEqual(res.body.data.user.username, username, 'Username mismatch');
  });

  // BUG-2: /api/v1/services returns 200 (not 401)
  console.log('\n--- BUG-2: Services Endpoint Public Access ---');
  await test('/api/v1/services returns 200 without auth', async () => {
    const res = await makeRequest('GET', '/api/v1/services');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.data || res.body.success, 'Response should have data or success field');
  });

  await test('/api/v1/services returns service list', async () => {
    const res = await makeRequest('GET', '/api/v1/services');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    if (res.body.data) {
      assert(Array.isArray(res.body.data), 'Services should be an array');
    }
  });

  await test('/api/v1/services/categories returns 200 without auth', async () => {
    const res = await makeRequest('GET', '/api/v1/services/categories');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  });

  // BUG-1: Rate limiting doesn't block Bearer tokens (should be handled by device approval)
  console.log('\n--- BUG-1: Rate Limiting with Bearer Tokens ---');
  await test('Bearer token requests skip global rate limiter', async () => {
    // Create a token first
    const registerRes = await makeRequest('POST', '/api/v1/auth/register', {
      username: `tokentest_${Date.now()}`,
      password: 'password123'
    });
    const token = registerRes.body.data.token;

    // Multiple requests with Bearer token should not get rate limited by global limiter
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest('GET', '/api/v1/dashboard/metrics', null, {
        'Authorization': `Bearer ${token}`
      });
      // Should either succeed (200) or fail with device approval (403), not rate limit (429)
      assert(res.status !== 429, `Request ${i} should not be rate limited globally (got ${res.status})`);
    }
  });

  // BUG-4: Dashboard metrics endpoint works after login
  console.log('\n--- BUG-4: Dashboard Metrics Loading ---');
  await test('Dashboard metrics accessible after session auth', async () => {
    // Register and login
    const username = `dashtest_${Date.now()}`;
    const registerRes = await makeRequest('POST', '/api/v1/auth/register', {
      username,
      password: 'password123'
    });

    const sessionToken = registerRes.body.data.token;
    
    // The session should be set up by the register endpoint
    // Try to access dashboard metrics
    const metricsRes = await makeRequest('GET', '/api/v1/dashboard/metrics', null, {
      'Authorization': `Bearer ${sessionToken}`
    });

    // Should return 200 (success) or 403 (device not approved), but not 401 (unauthorized)
    assert(metricsRes.status !== 401, `Dashboard metrics should be accessible, got ${metricsRes.status}`);
    
    if (metricsRes.status === 200) {
      assert(metricsRes.body, 'Metrics response should have body');
      // Verify we got actual metrics
      assert(typeof metricsRes.body.approvedDevices === 'number', 'Should have approvedDevices metric');
      assert(typeof metricsRes.body.connectedServices === 'number', 'Should have connectedServices metric');
    }
  });

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  
  if (testResults.failed > 0) {
    console.log('\nFailed tests:');
    testResults.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  }
}

// Wait for server to be ready
async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      await makeRequest('GET', '/health');
      console.log('Server is ready\n');
      return;
    } catch (err) {
      if (i < 29) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error('Server failed to start within 30 seconds');
      }
    }
  }
}

// Run tests
waitForServer()
  .then(() => runTests())
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
