#!/usr/bin/env node

const http = require('http');
const {
  buildServiceDefinition,
  validateExecutionInput,
  executeServiceMethod,
} = require('../services/integration-layer');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4500';
const TEST_TOKEN = 'test-services-token-' + Date.now();

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request({
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
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

const results = { passed: 0, failed: 0 };
function pass(name) { console.log(`✓ ${name}`); results.passed += 1; }
function fail(name, err) { console.log(`✗ ${name}: ${err.message || err}`); results.failed += 1; }

async function run() {
  console.log('\n=== Services Integration Tests ===\n');

  try {
    const service = {
      id: 1,
      name: 'github',
      label: 'GitHub',
      category_name: 'dev',
      category_label: 'Development',
      auth_type: 'oauth2',
      api_endpoint: 'https://api.github.com',
      documentation_url: 'https://docs.github.com',
    };
    const methods = [{ method_name: 'get_user', http_method: 'GET', endpoint: '/user', parameters: '[]' }];
    const def = buildServiceDefinition(service, methods);
    if (!def.executionContract || !Array.isArray(def.methods) || def.methods.length !== 1) {
      throw new Error('Service definition missing execution contract/method metadata');
    }
    pass('buildServiceDefinition returns standardized contract');
  } catch (e) { fail('buildServiceDefinition returns standardized contract', e); }

  try {
    const def = buildServiceDefinition({ name: 'x', label: 'X', auth_type: 'oauth2' }, []);
    const invalid = validateExecutionInput(def, '', {});
    if (invalid.ok !== false || invalid.status !== 400) throw new Error('Expected 400 on missing method');
    pass('validateExecutionInput rejects missing method');
  } catch (e) { fail('validateExecutionInput rejects missing method', e); }

  try {
    const def = buildServiceDefinition({ name: 'x', label: 'X', auth_type: 'oauth2' }, []);
    const method = def.methods[0];
    const execution = await executeServiceMethod({ serviceDef: def, method, params: { a: 1 } });
    if (!execution.ok || !execution.data || execution.data.params.a !== 1) {
      throw new Error('Execution contract invalid');
    }
    pass('executeServiceMethod returns normalized result');
  } catch (e) { fail('executeServiceMethod returns normalized result', e); }

  try {
    const res = await request('GET', '/api/v1/services');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const first = (res.body?.data || [])[0];
    if (!first || !first.authType || !first.executionContract) {
      throw new Error('Service payload missing standardized fields');
    }
    pass('GET /api/v1/services returns standardized services');
  } catch (e) { fail('GET /api/v1/services returns standardized services', e); }

  try {
    const servicesRes = await request('GET', '/api/v1/services');
    const first = (servicesRes.body?.data || [])[0];
    if (!first) throw new Error('No services available to test execute endpoint');
    const methodName = first.methods?.[0]?.methodName || 'default_request';

    const execRes = await request('POST', `/api/v1/services/${first.name}/execute`, { method: methodName, params: { ping: true } }, TEST_TOKEN);
    if (![200, 401, 403].includes(execRes.status)) {
      throw new Error(`Unexpected execute status ${execRes.status}`);
    }
    pass('POST /api/v1/services/:serviceName/execute responds with expected status');
  } catch (e) { fail('POST /api/v1/services/:serviceName/execute responds with expected status', e); }

  console.log('\n=== Services Integration Test Summary ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);

  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});