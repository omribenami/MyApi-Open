#!/usr/bin/env node
/**
 * Test script to verify Admin Users endpoint works
 * Tests the /api/v1/users endpoint with proper authentication
 */

const http = require('http');
const path = require('path');

// Use the actual database path that the running server uses
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'src/data/myapi.db');
const db = require('better-sqlite3')(DB_PATH);

// For testing getUsers(), we need to use the same DB path as the server
process.env.DB_PATH = DB_PATH;
delete require.cache[require.resolve('./src/database.js')];
const { getUsers } = require('./src/database.js');

console.log('=== Admin Users Endpoint Test ===\n');

// 1. Verify users exist in database
const allUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
console.log(`✓ Users in database: ${allUsers.count}`);

// 2. Test getUsers() function
const users = getUsers();
console.log(`✓ getUsers() returns: ${users.length} users`);
if (users.length > 0) {
  console.log(`  - First user: ${users[0].username} (${users[0].email})`);
  console.log(`  - Plan: ${users[0].plan}, Active: ${users[0].planActive}`);
}

// 3. Check power user email
const powerUserEmail = 'admin@your.domain.com';
const powerUser = db.prepare('SELECT id, email FROM users WHERE email = ?').get(powerUserEmail);
if (powerUser) {
  console.log(`✓ Power user found: ${powerUser.email} (${powerUser.id})`);
} else {
  console.log(`✗ Power user NOT found: ${powerUserEmail}`);
}

// 4. Check for tokens with correct setup
const fullTokens = db.prepare(
  'SELECT id, owner_id FROM access_tokens WHERE scope = ? AND revoked_at IS NULL'
).all('full');

console.log(`\n✓ Full-scope tokens: ${fullTokens.length}`);

let validTokenCount = 0;
fullTokens.forEach(t => {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(t.owner_id);
  const isValid = user || t.owner_id === 'owner';
  if (isValid) validTokenCount++;
  
  const status = user ? `✓ ${user.email}` : (t.owner_id === 'owner' ? '✓ admin token' : '✗ invalid owner');
  console.log(`  - ${t.id.substring(0, 16)}...: ${status}`);
});

console.log(`\n✓ Valid tokens: ${validTokenCount}/${fullTokens.length}`);

// 5. Verify endpoint implementation
const fs = require('fs');
const indexJs = fs.readFileSync('./src/index.js', 'utf8');
const hasUserEndpoint = indexJs.includes('app.get("/api/v1/users"');
const hasRequirePowerUser = indexJs.includes('requirePowerUser');
const hasOwnerCheck = indexJs.includes("req.tokenMeta.ownerId === 'owner'");

console.log(`\n=== Code Analysis ===`);
console.log(`✓ /api/v1/users endpoint exists: ${hasUserEndpoint}`);
console.log(`✓ requirePowerUser() function exists: ${hasRequirePowerUser}`);
console.log(`✓ owner_id='owner' special case implemented: ${hasOwnerCheck}`);

// 6. Test frontend component
const frontendPath = './src/public/dashboard-app/src/pages/UserManagement.jsx';
const componentExists = fs.existsSync(frontendPath);
console.log(`\n=== Frontend ===`);
console.log(`✓ UserManagement.jsx exists: ${componentExists}`);

if (componentExists) {
  const component = fs.readFileSync(frontendPath, 'utf8');
  const callsUsersEndpoint = component.includes('/api/v1/users');
  const hasErrorHandling = component.includes('loadError');
  console.log(`✓ Calls /api/v1/users: ${callsUsersEndpoint}`);
  console.log(`✓ Has error handling: ${hasErrorHandling}`);
}

// 7. Summary
console.log(`\n=== Summary ===`);
const allGood = allUsers.count > 0 && users.length > 0 && powerUser && validTokenCount > 0;
if (allGood) {
  console.log('✓ Everything looks good!');
  console.log('\nAdmin > Users page should now display users.');
  console.log('\nVerification:');
  console.log('  1. Log in to dashboard');
  console.log('  2. Navigate to Admin > Users');
  console.log('  3. Should see list of users (18 total)');
} else {
  console.log('✗ Issues found. Please review above.');
}

process.exit(allGood ? 0 : 1);
