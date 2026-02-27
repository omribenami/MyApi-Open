/**
 * Test suite for Phase 8: Personal Brain
 * Tests context assembly, knowledge base, and LLM integration
 */

const http = require('http');
const assert = require('assert');

const TEST_TOKEN = 'test_token_' + Math.random().toString(36).substr(2, 9);
const BASE_URL = 'http://localhost:4500';

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
            headers: res.headers
          };
          resolve(response);
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers
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

async function test(name, fn) {
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ 
      name, 
      status: 'FAIL',
      error: error.message 
    });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('Starting Phase 8 Brain Tests...\n');

  // Test 1: Create a conversation
  let conversationId;
  await test('Create conversation', async () => {
    const res = await request('POST', '/api/v1/brain/chat', {
      message: 'Hello, what is your name?'
    });
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.conversationId, 'Response should contain conversationId');
    conversationId = res.body.conversationId;
    assert(res.body.response, 'Response should contain assistant response');
  });

  // Test 2: Get conversations list
  await test('Get conversations list', async () => {
    const res = await request('GET', '/api/v1/brain/conversations');
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body), 'Response should be an array');
    assert(res.body.length > 0, 'Should have at least one conversation');
  });

  // Test 3: Get conversation history
  await test('Get conversation history', async () => {
    const res = await request('GET', `/api/v1/brain/conversations/${conversationId}`);
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.conversation, 'Response should contain conversation');
    assert(Array.isArray(res.body.messages), 'Response should contain messages array');
    assert(res.body.messages.length >= 2, 'Should have at least 2 messages (user + assistant)');
  });

  // Test 4: Continue conversation
  await test('Continue conversation', async () => {
    const res = await request('POST', '/api/v1/brain/chat', {
      message: 'What is your purpose?',
      conversationId
    });
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.body.conversationId, conversationId, 'Should use same conversation ID');
    assert(res.body.response, 'Response should contain assistant response');
  });

  // Test 5: Get context
  await test('Get context', async () => {
    const res = await request('GET', '/api/v1/brain/context');
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.user, 'Context should contain user');
    assert(res.body.persona, 'Context should contain persona');
    assert(res.body.systemPrompt, 'Context should contain system prompt');
  });

  // Test 6: Add knowledge base document
  let docId;
  await test('Add KB document', async () => {
    const res = await request('POST', '/api/v1/brain/knowledge-base', {
      source: 'test-source',
      title: 'Test Document',
      content: 'This is a test document about artificial intelligence and machine learning.'
    });
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.id, 'Response should contain document ID');
    docId = res.body.id;
  });

  // Test 7: Get knowledge base documents
  await test('Get KB documents', async () => {
    const res = await request('GET', '/api/v1/brain/knowledge-base');
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body), 'Response should be an array');
  });

  // Test 8: Delete knowledge base document
  await test('Delete KB document', async () => {
    const res = await request('DELETE', `/api/v1/brain/knowledge-base/${docId}`);
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.success, 'Response should indicate success');
  });

  // Test 9: Missing required fields
  await test('Handle missing message field', async () => {
    const res = await request('POST', '/api/v1/brain/chat', {
      conversationId
    });
    
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert(res.body.error, 'Response should contain error message');
  });

  // Test 10: Get context with conversation
  await test('Get context with conversation', async () => {
    const res = await request('GET', `/api/v1/brain/context?conversationId=${conversationId}`);
    
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.recentMessages, 'Context should contain recent messages');
  });

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('Test Results:');
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Total: ${testResults.passed + testResults.failed}`);
  console.log('='.repeat(50));

  if (testResults.failed > 0) {
    console.log('\nFailed Tests:');
    testResults.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(`- ${t.name}: ${t.error}`);
      });
  }

  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Give server time to start
setTimeout(runTests, 2000);
