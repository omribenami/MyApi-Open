/**
 * Phase 9: Advanced Guest Token Scoping - Test Suite
 * 
 * Tests fine-grained scope system for guest access tokens
 */

const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://localhost:4500';
const TIMEOUT = 5000;

// Helper function to make HTTP requests
async function request(method, path, body = null, authToken = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUT
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Test Suite
const tests = [];
let masterToken = null;

// ====== Setup ======

async function setupTests() {
  console.log('🔧 Setting up tests...');
  
  // Get master token from initial bootstrap
  try {
    const res = await request('GET', '/health');
    if (res.status === 200) {
      console.log('✓ Server is running');
    }
  } catch (e) {
    console.error('✗ Server is not running. Start it with: cd src && node index.js');
    process.exit(1);
  }

  // For tests, we'll use the first full scope token as master
  // In real scenario, you'd get this from server startup logs
  const tokensRes = await request('GET', '/api/v1/tokens');
  if (tokensRes.status === 200 && tokensRes.body.data && tokensRes.body.data.length > 0) {
    // Find the master token (scope = "full")
    const masterTokenData = tokensRes.body.data.find(t => 
      t.scope === 'full' || JSON.stringify(t.scope) === '["admin:*"]'
    );
    if (masterTokenData) {
      masterToken = masterTokenData.hash;
    }
  }

  console.log('✓ Setup complete\n');
}

// ====== Test Cases ======

// Test 1: Create token with single scope
tests.push({
  name: 'Create token with single scope (identity:read)',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Single Scope Token',
      scopes: 'identity:read',
      description: 'Token with single scope'
    }, masterToken);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.body.data.id, 'Token ID should exist');
    assert(res.body.data.token, 'Token should be returned');
    assert(Array.isArray(res.body.data.scopes), 'Scopes should be an array');
    assert(res.body.data.scopes.includes('identity:read'), 'Should have identity:read scope');
    return res.body.data;
  }
});

// Test 2: Create token with multiple scopes
tests.push({
  name: 'Create token with multiple scopes',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Multi Scope Token',
      scopes: ['identity:read', 'brain:chat', 'audit:read'],
      description: 'Token with multiple scopes'
    }, masterToken);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.body.data.scopes.length >= 3, 'Should have at least 3 scopes');
    assert(res.body.data.scopes.includes('identity:read'), 'Should have identity:read');
    assert(res.body.data.scopes.includes('brain:chat'), 'Should have brain:chat');
    assert(res.body.data.scopes.includes('audit:read'), 'Should have audit:read');
    return res.body.data;
  }
});

// Test 3: Create token with scope template
tests.push({
  name: 'Create token with "read" scope template',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Read Template Token',
      scopes: 'read',
      expiresInHours: 24
    }, masterToken);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    const scopes = res.body.data.scopes;
    assert(scopes.includes('identity:read'), 'Should include identity:read');
    assert(scopes.includes('vault:read'), 'Should include vault:read');
    assert(scopes.includes('services:read'), 'Should include services:read');
    assert(scopes.includes('brain:read'), 'Should include brain:read');
    assert(scopes.includes('audit:read'), 'Should include audit:read');
    assert(!scopes.includes('identity:write'), 'Should NOT include write scopes');
    return res.body.data;
  }
});

// Test 4: Create token with invalid scope
tests.push({
  name: 'Create token with invalid scope (should fail)',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Invalid Scope Token',
      scopes: 'invalid:scope'
    }, masterToken);

    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert(res.body.error, 'Should have error message');
  }
});

// Test 5: Get token details
tests.push({
  name: 'Get token details with scopes',
  async test(prevToken) {
    if (!prevToken) {
      // Create a token first
      const createRes = await request('POST', '/api/v1/tokens', {
        label: 'Getable Token',
        scopes: ['identity:read', 'brain:chat']
      }, masterToken);
      prevToken = createRes.body.data;
    }

    const res = await request('GET', `/api/v1/tokens/${prevToken.id}`, null, masterToken);

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.body.data.id, prevToken.id, 'Token ID should match');
    assert(Array.isArray(res.body.data.scopes), 'Scopes should be an array');
    assert(res.body.data.scopes.includes('identity:read'), 'Should have identity:read');
  }
});

// Test 6: List all tokens
tests.push({
  name: 'List all tokens with scopes',
  async test() {
    const res = await request('GET', '/api/v1/tokens', null, masterToken);

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Should return array of tokens');
    assert(res.body.data.length > 0, 'Should have at least one token');
    
    // Check that all tokens have scopes
    for (const token of res.body.data) {
      assert(Array.isArray(token.scopes), `Token ${token.tokenId} should have scopes array`);
    }
  }
});

// Test 7: Update token scopes
tests.push({
  name: 'Update token scopes',
  async test() {
    // Create a token first
    const createRes = await request('POST', '/api/v1/tokens', {
      label: 'Updatable Token',
      scopes: ['identity:read']
    }, masterToken);
    const tokenId = createRes.body.data.id;

    // Update its scopes
    const updateRes = await request('PUT', `/api/v1/tokens/${tokenId}`, {
      scopes: ['vault:read', 'brain:chat']
    }, masterToken);

    assert.strictEqual(updateRes.status, 200, `Expected 200, got ${updateRes.status}`);
    assert(updateRes.body.data.scopes.includes('vault:read'), 'Should have new scope vault:read');
    assert(updateRes.body.data.scopes.includes('brain:chat'), 'Should have new scope brain:chat');
    assert(!updateRes.body.data.scopes.includes('identity:read'), 'Old scope should be removed');

    // Verify with GET
    const getRes = await request('GET', `/api/v1/tokens/${tokenId}`, null, masterToken);
    assert(getRes.body.data.scopes.includes('vault:read'), 'Verified: should have vault:read');
  }
});

// Test 8: Get available scopes
tests.push({
  name: 'Get available scopes list',
  async test() {
    const res = await request('GET', '/api/v1/scopes', null, masterToken);

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.scopes, 'Should have scopes list');
    assert(Array.isArray(res.body.data.scopes), 'Scopes should be array');
    assert(res.body.data.scopes.length > 0, 'Should have at least one scope');
    
    // Check for key scopes
    const scopeNames = res.body.data.scopes.map(s => s.name);
    assert(scopeNames.includes('identity:read'), 'Should have identity:read');
    assert(scopeNames.includes('brain:chat'), 'Should have brain:chat');
    assert(scopeNames.includes('admin:*'), 'Should have admin:*');

    // Check templates
    assert(res.body.data.templates, 'Should have templates');
    assert(Array.isArray(res.body.data.templates.read), 'read template should exist');
    assert(Array.isArray(res.body.data.templates.professional), 'professional template should exist');
  }
});

// Test 9: Revoke token
tests.push({
  name: 'Revoke token',
  async test() {
    // Create a token
    const createRes = await request('POST', '/api/v1/tokens', {
      label: 'Revokable Token',
      scopes: ['identity:read']
    }, masterToken);
    const tokenId = createRes.body.data.id;

    // Revoke it
    const revokeRes = await request('DELETE', `/api/v1/tokens/${tokenId}`, null, masterToken);

    assert.strictEqual(revokeRes.status, 200, `Expected 200, got ${revokeRes.status}`);
    assert.strictEqual(revokeRes.body.data.revoked, true, 'Should be revoked');

    // Verify it's revoked
    const getRes = await request('GET', `/api/v1/tokens/${tokenId}`, null, masterToken);
    assert.strictEqual(getRes.body.data.active, false, 'Token should be inactive');
    assert(getRes.body.data.revokedAt, 'Should have revokedAt timestamp');
  }
});

// Test 10: Unauthorized token should fail
tests.push({
  name: 'Unauthorized token (no Bearer auth)',
  async test() {
    const res = await request('GET', '/api/v1/tokens'); // No auth token

    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    assert(res.body.error, 'Should have error message');
  }
});

// Test 11: Non-master token should not create tokens
tests.push({
  name: 'Non-master token cannot create tokens',
  async test() {
    // Create a guest token
    const createRes = await request('POST', '/api/v1/tokens', {
      label: 'Guest Token',
      scopes: ['identity:read']
    }, masterToken);
    const guestToken = createRes.body.data.token;

    // Try to create another token with guest token
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Another Token',
      scopes: ['identity:read']
    }, guestToken);

    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    assert(res.body.error, 'Should deny access');
  }
});

// Test 12: Token with expiration
tests.push({
  name: 'Create token with expiration',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Expiring Token',
      scopes: ['identity:read'],
      expiresInHours: 1
    }, masterToken);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.body.data.expiresAt, 'Should have expiresAt');
    const expiresAt = new Date(res.body.data.expiresAt);
    const now = new Date();
    const diffMs = expiresAt - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    assert(diffHours > 0.5 && diffHours < 1.5, `Should expire in ~1 hour, got ${diffHours.toFixed(2)}`);
  }
});

// Test 13: Scope deduplication
tests.push({
  name: 'Scope deduplication when creating token',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Duplicate Scope Token',
      scopes: ['identity:read', 'identity:read', 'brain:chat', 'brain:chat']
    }, masterToken);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert.strictEqual(res.body.data.scopes.length, 2, 'Should deduplicate scopes');
    assert(res.body.data.scopes.includes('identity:read'), 'Should have identity:read once');
    assert(res.body.data.scopes.includes('brain:chat'), 'Should have brain:chat once');
  }
});

// Test 14: Missing scopes field
tests.push({
  name: 'Create token without scopes field (should fail)',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'No Scopes Token'
      // Missing scopes field
    }, masterToken);

    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert(res.body.error, 'Should have error about missing scopes');
  }
});

// Test 15: Professional scope template
tests.push({
  name: 'Professional scope template',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Professional Token',
      scopes: 'professional'
    }, masterToken);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.body.data.scopes.includes('identity:read'), 'Should have identity:read');
  }
});

// Test 16: Admin scope template
tests.push({
  name: 'Admin scope template',
  async test() {
    const res = await request('POST', '/api/v1/tokens', {
      label: 'Admin Token',
      scopes: 'admin'
    }, masterToken);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.body.data.scopes.includes('admin:*'), 'Should have admin:*');
  }
});

// ====== Test Runner ======

async function runTests() {
  console.log('🧪 Running Phase 9 Scoping Tests\n');
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    try {
      console.log(`[${i + 1}/${tests.length}] ${test.name}...`);
      await test.test();
      console.log('  ✓ PASS\n');
      passed++;
    } catch (error) {
      console.log(`  ✗ FAIL: ${error.message}\n`);
      failed++;
    }
  }

  // Summary
  console.log('════════════════════════════════════════');
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`⊘ Skipped: ${skipped}`);
  console.log(`Total: ${tests.length}`);
  console.log('════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⚠️  Some tests failed!');
    process.exit(1);
  } else {
    console.log('✨ All tests passed!');
    process.exit(0);
  }
}

// ====== CLI Entry Point ======

if (require.main === module) {
  setupTests().then(runTests).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}

module.exports = { request, tests, runTests };
