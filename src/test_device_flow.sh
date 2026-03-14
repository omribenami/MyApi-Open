#!/bin/bash

# Get the master token from the database
MASTER_TOKEN=$(node -e "
const db = require('better-sqlite3')('./db.sqlite');
const token = db.prepare('SELECT id FROM access_tokens LIMIT 1').get();
console.log(token ? token.id : '');
" 2>/dev/null || echo "")

# If no token found, create one and get a user
if [ -z "$MASTER_TOKEN" ]; then
  echo "No access tokens found in database. Checking for test user..."
  # Create a test user
  TEST_USER="curl_test_user_$(date +%s)"
  MASTER_TOKEN="test_token_$(date +%s)"
  
  node -e "
  const db = require('better-sqlite3')('./db.sqlite');
  const crypto = require('crypto');
  
  // Create user
  try {
    const userId = 'user_' + crypto.randomBytes(8).toString('hex');
    db.prepare('INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
      userId, '$TEST_USER', 'Test User', 'fake_hash', new Date().toISOString()
    );
    console.log('Created user:', userId);
    
    // Create token
    const tokenId = 'token_' + crypto.randomBytes(8).toString('hex');
    const tokenHash = crypto.createHash('sha256').update('test_secret').digest('hex');
    db.prepare('INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      tokenId, tokenHash, userId, 'full', 'Test Token', new Date().toISOString()
    );
    console.log('Created token:', tokenId);
  } catch (e) {
    console.log('Failed to create:', e.message);
  }
  " 2>/dev/null
fi

echo "Testing Device Management API endpoints..."
echo "==========================================="

# List approved devices
echo -e "\n1. GET /api/v1/devices/approved"
curl -s -X GET http://localhost:4500/api/v1/devices/approved \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Failed to connect"

# Check pending approvals
echo -e "\n2. GET /api/v1/devices/approvals/pending"
curl -s -X GET http://localhost:4500/api/v1/devices/approvals/pending \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Failed to connect"

# Check activity log
echo -e "\n3. GET /api/v1/devices/activity/log"
curl -s -X GET http://localhost:4500/api/v1/devices/activity/log \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Failed to connect"

echo -e "\n==========================================="
echo "Test complete!"
