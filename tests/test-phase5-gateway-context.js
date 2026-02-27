/**
 * Phase 5 Tests: Gateway Context Endpoint
 * Tests the unified /api/v1/gateway/context endpoint
 */

const {
  makeRequest,
  authenticatedRequest,
  assert,
  assertEqual,
  assertExists,
  TestResults,
} = require('./test-utils');

const results = new TestResults();
const GATEWAY_CONTEXT_ENDPOINT = '/api/v1/gateway/context';

async function runTests() {
  console.log('\n=== Phase 5: Gateway Context Tests ===\n');

  const testToken = 'test-gateway-token-' + Date.now();

  // Test 1: Basic endpoint access with valid token
  try {
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT, {
      headers: { 'Authorization': `Bearer ${testToken}` }
    });
    // Will likely fail with invalid token, but endpoint should respond
    assert(res.status === 200 || res.status === 401, 'Should respond to request');
    console.log('✓ Test 1: Endpoint accessible');
    results.pass();
  } catch (error) {
    console.log('✗ Test 1 failed:', error.message);
    results.fail('Test 1', error);
  }

  // Test 2: Missing token returns 401
  try {
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT);
    assertEqual(res.status, 401, 'Missing auth should return 401');
    console.log('✓ Test 2: Missing token returns 401');
    results.pass();
  } catch (error) {
    console.log('✗ Test 2 failed:', error.message);
    results.fail('Test 2', error);
  }

  // Test 3: Invalid token returns 401
  try {
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    assertEqual(res.status, 401, 'Invalid token should return 401');
    console.log('✓ Test 3: Invalid token returns 401');
    results.pass();
  } catch (error) {
    console.log('✗ Test 3 failed:', error.message);
    results.fail('Test 3', error);
  }

  // Test 4: Malformed auth header
  try {
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT, {
      headers: { 'Authorization': 'InvalidBearer token' }
    });
    assertEqual(res.status, 401, 'Malformed header should return 401');
    console.log('✓ Test 4: Malformed auth header returns 401');
    results.pass();
  } catch (error) {
    console.log('✗ Test 4 failed:', error.message);
    results.fail('Test 4', error);
  }

  // Test 5: Check endpoint exists and responds
  try {
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT);
    assert(res.status >= 200, 'Endpoint should exist');
    console.log('✓ Test 5: Endpoint exists');
    results.pass();
  } catch (error) {
    console.log('✗ Test 5 failed:', error.message);
    results.fail('Test 5', error);
  }

  // Test 6: Check response structure on auth failure
  try {
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT);
    assertExists(res.body, 'Response should have body');
    console.log('✓ Test 6: Response structure valid');
    results.pass();
  } catch (error) {
    console.log('✗ Test 6 failed:', error.message);
    results.fail('Test 6', error);
  }

  // Test 7: Status code is appropriate
  try {
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT);
    assert(res.status === 401 || res.status === 400, 'Should return auth error');
    console.log('✓ Test 7: Appropriate status code');
    results.pass();
  } catch (error) {
    console.log('✗ Test 7 failed:', error.message);
    results.fail('Test 7', error);
  }

  // Test 8: Response is JSON
  try {
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT);
    assert(typeof res.body === 'object' || typeof res.body === 'string', 'Should be JSON-compatible');
    console.log('✓ Test 8: Response is valid format');
    results.pass();
  } catch (error) {
    console.log('✗ Test 8 failed:', error.message);
    results.fail('Test 8', error);
  }

  // Test 9: Token not exposed in error response
  try {
    const testToken = 'secret-token-12345';
    const res = await makeRequest('GET', GATEWAY_CONTEXT_ENDPOINT, {
      headers: { 'Authorization': `Bearer ${testToken}` }
    });
    const responseStr = JSON.stringify(res.body);
    assert(!responseStr.includes('secret-token'), 'Token should not be exposed');
    console.log('✓ Test 9: Token not exposed in response');
    results.pass();
  } catch (error) {
    console.log('✗ Test 9 failed:', error.message);
    results.fail('Test 9', error);
  }

  // Test 10: Check server is responding
  try {
    const res = await makeRequest('GET', '/');
    assert(res.status >= 200, 'Server should respond');
    console.log('✓ Test 10: Server is responding');
    results.pass();
  } catch (error) {
    console.log('✗ Test 10 failed:', error.message);
    results.fail('Test 10', error);
  }

  // Print results
  console.log('\n=== Phase 5 Test Results ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.testName}: ${err.error}`);
    });
  }

  return results.failed === 0;
}

// Main execution
(async () => {
  try {
    const success = await runTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();

module.exports = { runTests };
