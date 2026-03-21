#!/bin/bash

echo "=== Test 1: Check that server fails without SESSION_SECRET in production ==="
cd /opt/MyApi

# Create a test that tries to start the server in production without SESSION_SECRET
# We'll timeout after 3 seconds to prevent hanging
NODE_ENV=production \
  JWT_SECRET="test-jwt-secret" \
  ENCRYPTION_KEY="32-character-encryption-key-here!!" \
  timeout 3 node src/index.js 2>&1 | head -20 | grep -q "FATAL ERROR"

if [ $? -eq 0 ]; then
  echo "✅ PASS: Server correctly rejects missing SESSION_SECRET in production"
else
  echo "❌ FAIL: Server did not show expected error"
  exit 1
fi

echo ""
echo "=== Test 2: Check that all required secrets are validated ==="
NODE_ENV=production \
  timeout 3 node src/index.js 2>&1 | head -20 | grep -q "Missing required secrets"

if [ $? -eq 0 ]; then
  echo "✅ PASS: Server checks for all required secrets"
else
  echo "❌ FAIL: Server did not validate all secrets"
  exit 1
fi

echo ""
echo "=== Test 3: Check that server logs session cleanup message ==="
NODE_ENV=development \
  SESSION_SECRET="test" \
  JWT_SECRET="test" \
  ENCRYPTION_KEY="32-character-encryption-key-here!!" \
  timeout 3 node src/index.js 2>&1 | grep -q "Session cleanup scheduled"

if [ $? -eq 0 ]; then
  echo "✅ PASS: Server logs session cleanup scheduled message"
else
  echo "❌ FAIL: Server did not log session cleanup message"
  exit 1
fi

echo ""
echo "=== All validation tests passed! ==="
