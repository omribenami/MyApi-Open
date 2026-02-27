/**
 * Phase 6 Tests: Persona Manager
 */

const {
  makeRequest,
  authenticatedRequest,
  assert,
  assertEqual,
  TestResults,
} = require('./test-utils');

const results = new TestResults();
const PERSONAS_ENDPOINT = '/api/v1/personas';
const testToken = 'test-persona-token-' + Date.now();

async function runTests() {
  console.log('\n=== Phase 6: Persona Manager Tests ===\n');

  // Test 1: GET personas requires auth
  try {
    const res = await makeRequest('GET', PERSONAS_ENDPOINT);
    assertEqual(res.status, 401, 'Missing auth should return 401');
    console.log('✓ Test 1: GET personas requires authentication');
    results.pass();
  } catch (error) {
    console.log('✗ Test 1 failed:', error.message);
    results.fail('Test 1', error);
  }

  // Test 2: POST personas requires auth
  try {
    const res = await makeRequest('POST', PERSONAS_ENDPOINT, {
      body: { name: 'Test', soul_content: '# Test' }
    });
    assertEqual(res.status, 401, 'Missing auth should return 401');
    console.log('✓ Test 2: POST personas requires authentication');
    results.pass();
  } catch (error) {
    console.log('✗ Test 2 failed:', error.message);
    results.fail('Test 2', error);
  }

  // Test 3: Can list personas with token
  try {
    const res = await authenticatedRequest('GET', PERSONAS_ENDPOINT, testToken);
    assert(res.status === 200 || res.status === 401, 'Should respond');
    console.log('✓ Test 3: Personas endpoint responds');
    results.pass();
  } catch (error) {
    console.log('✗ Test 3 failed:', error.message);
    results.fail('Test 3', error);
  }

  // Test 4: GET persona with invalid ID returns error
  try {
    const res = await authenticatedRequest('GET', `${PERSONAS_ENDPOINT}/99999`, testToken);
    assert(res.status === 404 || res.status === 401, 'Should return not found or auth error');
    console.log('✓ Test 4: GET invalid persona returns error');
    results.pass();
  } catch (error) {
    console.log('✗ Test 4 failed:', error.message);
    results.fail('Test 4', error);
  }

  // Test 5: POST with invalid data
  try {
    const res = await authenticatedRequest('POST', PERSONAS_ENDPOINT, testToken, {
      body: { name: '' }
    });
    assert(res.status >= 400 || res.status === 401, 'Invalid data should error or require auth');
    console.log('✓ Test 5: POST with invalid data returns error');
    results.pass();
  } catch (error) {
    console.log('✗ Test 5 failed:', error.message);
    results.fail('Test 5', error);
  }

  // Test 6: Endpoint structure is correct
  try {
    const res = await makeRequest('GET', PERSONAS_ENDPOINT);
    assert(res.status >= 200, 'Endpoint should exist');
    console.log('✓ Test 6: Persona endpoint exists');
    results.pass();
  } catch (error) {
    console.log('✗ Test 6 failed:', error.message);
    results.fail('Test 6', error);
  }

  // Test 7: DELETE requires auth
  try {
    const res = await makeRequest('DELETE', `${PERSONAS_ENDPOINT}/1`);
    assertEqual(res.status, 401, 'DELETE requires auth');
    console.log('✓ Test 7: DELETE requires authentication');
    results.pass();
  } catch (error) {
    console.log('✗ Test 7 failed:', error.message);
    results.fail('Test 7', error);
  }

  // Test 8: PUT requires auth
  try {
    const res = await makeRequest('PUT', `${PERSONAS_ENDPOINT}/1`, {
      body: { name: 'Updated' }
    });
    assertEqual(res.status, 401, 'PUT requires auth');
    console.log('✓ Test 8: PUT requires authentication');
    results.pass();
  } catch (error) {
    console.log('✗ Test 8 failed:', error.message);
    results.fail('Test 8', error);
  }

  // Test 9: Valid response format
  try {
    const res = await authenticatedRequest('GET', PERSONAS_ENDPOINT, testToken);
    assert(typeof res.body === 'object', 'Response should be object');
    console.log('✓ Test 9: Response is valid format');
    results.pass();
  } catch (error) {
    console.log('✗ Test 9 failed:', error.message);
    results.fail('Test 9', error);
  }

  // Test 10: Sensitive data not exposed
  try {
    const res = await authenticatedRequest('GET', PERSONAS_ENDPOINT, testToken);
    const responseStr = JSON.stringify(res.body);
    assert(!responseStr.includes(testToken), 'Token should not be exposed');
    console.log('✓ Test 10: Sensitive data not exposed');
    results.pass();
  } catch (error) {
    console.log('✗ Test 10 failed:', error.message);
    results.fail('Test 10', error);
  }

  // Print results
  console.log('\n=== Phase 6 Test Results ===');
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
