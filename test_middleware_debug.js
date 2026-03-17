const http = require('http');

const API_BASE_URL = 'http://localhost:4500/api/v1';

function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
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

async function test() {
  console.log('Testing device approval middleware integration...\n');

  try {
    console.log('1. Testing with valid token...');
    const response = await makeRequest('GET', '/dashboard/metrics', {
      'Authorization': 'Bearer tok_2714e21694904b3dbbdbb51f736e8276',
      'User-Agent': 'TestClient/1.0',
      'X-Forwarded-For': '192.168.1.100',
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Body: ${response.raw.substring(0, 200)}`);
    
    if (response.status === 500) {
      console.log('   ✗ Got 500 error');
      console.log('   Response:', response.raw);
    } else if (response.status === 403) {
      console.log('   ✓ Got 403 - device approval required (expected)');
    } else if (response.status === 200) {
      console.log('   ✓ Got 200 - request succeeded');
    } else {
      console.log(`   ? Got ${response.status}`);
    }
  } catch (error) {
    console.log('   ✗ Error:', error.message);
  }
}

test();
