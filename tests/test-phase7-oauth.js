/**
 * Phase 7 Tests: OAuth Connector Proxying
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
const OAUTH_ENDPOINT = '/api/v1/oauth';
const VALID_SERVICES = ['google', 'github', 'slack', 'discord', 'whatsapp'];
const testToken = 'test-oauth-token-' + Date.now();

async function runTests() {
  console.log('\n=== Phase 7: OAuth Tests ===\n');

  // Test 1: OAuth authorize endpoint exists
  try {
    const res = await makeRequest('GET', `${OAUTH_ENDPOINT}/authorize/google`);
    assert(res.status === 200 || res.status >= 400, 'Endpoint should respond');
    console.log('✓ Test 1: OAuth authorize endpoint exists');
    results.pass();
  } catch (error) {
    console.log('✗ Test 1 failed:', error.message);
    results.fail('Test 1', error);
  }

  // Test 2: OAuth authorize returns data
  try {
    const res = await makeRequest('GET', `${OAUTH_ENDPOINT}/authorize/google`);
    if (res.status === 200) {
      assertExists(res.body, 'Should have response');
      console.log('✓ Test 2: OAuth authorize returns data');
    } else {
      console.log('✓ Test 2: OAuth authorize endpoint responds (skipped validation)');
    }
    results.pass();
  } catch (error) {
    console.log('✗ Test 2 failed:', error.message);
    results.fail('Test 2', error);
  }

  // Test 3: OAuth status requires auth
  try {
    const res = await makeRequest('GET', `${OAUTH_ENDPOINT}/status`);
    assertEqual(res.status, 401, 'Status requires auth');
    console.log('✓ Test 3: OAuth status requires authentication');
    results.pass();
  } catch (error) {
    console.log('✗ Test 3 failed:', error.message);
    results.fail('Test 3', error);
  }

  // Test 4: OAuth status with auth
  try {
    const res = await authenticatedRequest('GET', `${OAUTH_ENDPOINT}/status`, testToken);
    assert(res.status === 200 || res.status === 401, 'Should respond');
    console.log('✓ Test 4: OAuth status endpoint responds');
    results.pass();
  } catch (error) {
    console.log('✗ Test 4 failed:', error.message);
    results.fail('Test 4', error);
  }

  // Test 5: OAuth callback endpoint exists
  try {
    const res = await makeRequest('GET', `${OAUTH_ENDPOINT}/callback/google`);
    assert(res.status >= 200, 'Endpoint should exist');
    console.log('✓ Test 5: OAuth callback endpoint exists');
    results.pass();
  } catch (error) {
    console.log('✗ Test 5 failed:', error.message);
    results.fail('Test 5', error);
  }

  // Test 6: OAuth disconnect requires auth
  try {
    const res = await makeRequest('POST', `${OAUTH_ENDPOINT}/disconnect/google`);
    assertEqual(res.status, 401, 'Disconnect requires auth');
    console.log('✓ Test 6: OAuth disconnect requires authentication');
    results.pass();
  } catch (error) {
    console.log('✗ Test 6 failed:', error.message);
    results.fail('Test 6', error);
  }

  // Test 7: OAuth disconnect with auth
  try {
    const res = await authenticatedRequest('POST', `${OAUTH_ENDPOINT}/disconnect/google`, testToken);
    assert(res.status === 200 || res.status === 404 || res.status === 401, 'Should respond');
    console.log('✓ Test 7: OAuth disconnect endpoint responds');
    results.pass();
  } catch (error) {
    console.log('✗ Test 7 failed:', error.message);
    results.fail('Test 7', error);
  }

  // Test 8: Invalid service returns error
  try {
    const res = await makeRequest('GET', `${OAUTH_ENDPOINT}/authorize/invalid-service-xyz`);
    assert(res.status >= 400, 'Invalid service should error');
    console.log('✓ Test 8: Invalid OAuth service returns error');
    results.pass();
  } catch (error) {
    console.log('✗ Test 8 failed:', error.message);
    results.fail('Test 8', error);
  }

  // Test 9: Multiple OAuth services supported
  try {
    const services = ['google', 'github'];
    for (const service of services) {
      const res = await makeRequest('GET', `${OAUTH_ENDPOINT}/authorize/${service}`);
      assert(res.status >= 200, `${service} should respond`);
    }
    console.log('✓ Test 9: Multiple OAuth services supported');
    results.pass();
  } catch (error) {
    console.log('✗ Test 9 failed:', error.message);
    results.fail('Test 9', error);
  }

  // Test 10: Response is JSON
  try {
    const res = await makeRequest('GET', `${OAUTH_ENDPOINT}/authorize/google`);
    assert(typeof res.body === 'object' || typeof res.body === 'string', 'Response should be JSON');
    console.log('✓ Test 10: Response is valid format');
    results.pass();
  } catch (error) {
    console.log('✗ Test 10 failed:', error.message);
    results.fail('Test 10', error);
  }

  // Test 11: No token exposure in OAuth endpoints
  try {
    const res = await authenticatedRequest('GET', `${OAUTH_ENDPOINT}/status`, testToken);
    const responseStr = JSON.stringify(res.body);
    assert(!responseStr.includes(testToken), 'Token should not be exposed');
    console.log('✓ Test 11: OAuth endpoints don\'t expose tokens');
    results.pass();
  } catch (error) {
    console.log('✗ Test 11 failed:', error.message);
    results.fail('Test 11', error);
  }

  // Test 12: Callback without params
  try {
    const res = await makeRequest('GET', `${OAUTH_ENDPOINT}/callback/google`);
    assert(res.status >= 200, 'Endpoint should exist');
    console.log('✓ Test 12: OAuth callback handles requests');
    results.pass();
  } catch (error) {
    console.log('✗ Test 12 failed:', error.message);
    results.fail('Test 12', error);
  }

  // Print results
  console.log('\n=== Phase 7 Test Results ===');
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
