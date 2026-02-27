const http = require('http');

/**
 * Test utility functions for MyApi test suite
 */

const BASE_URL = 'http://localhost:4500';
const DEFAULT_MASTER_TOKEN = 'test-master-token-12345'; // This will be obtained from session or created

// Helper to make HTTP requests
async function makeRequest(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: 5000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            raw: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Helper to make authenticated requests
async function authenticatedRequest(method, path, token, options = {}) {
  return makeRequest(method, path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    }
  });
}

// Test assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Assertion failed: ${message}\nExpected: ${expectedJson}\nActual: ${actualJson}`);
  }
}

function assertExists(value, message) {
  if (value === null || value === undefined) {
    throw new Error(`Assertion failed: ${message} - value does not exist`);
  }
}

function assertIncludes(array, value, message) {
  if (!Array.isArray(array) || !array.includes(value)) {
    throw new Error(`Assertion failed: ${message} - array does not include value`);
  }
}

// Test result tracking
class TestResults {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  pass() {
    this.passed++;
  }

  fail(testName, error) {
    this.failed++;
    this.errors.push({ testName, error: error.message || error });
  }

  summary() {
    return {
      total: this.passed + this.failed,
      passed: this.passed,
      failed: this.failed,
      passRate: this.passed / (this.passed + this.failed) * 100
    };
  }
}

// Helper to wait for server
async function waitForServer(maxAttempts = 30, delayMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await makeRequest('GET', '/');
      console.log('✓ Server is ready');
      return true;
    } catch (e) {
      if (i < maxAttempts - 1) {
        console.log(`Waiting for server... (${i + 1}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw new Error('Server did not start in time');
}

module.exports = {
  makeRequest,
  authenticatedRequest,
  assert,
  assertEqual,
  assertDeepEqual,
  assertExists,
  assertIncludes,
  TestResults,
  waitForServer,
  BASE_URL,
  DEFAULT_MASTER_TOKEN
};
