#!/bin/bash

echo "=== Test: Verify secret validation in production ==="

# Move the .env file temporarily
mv src/.env src/.env.backup

# Test that server fails without any secrets
echo "Testing server startup without .env file..."
NODE_ENV=production timeout 3 node src/index.js 2>&1 | tee /tmp/startup-test.log | grep -i "fatal\|missing" | head -5

# Check the exit code
if grep -q "FATAL ERROR: Missing required secrets" /tmp/startup-test.log || grep -q "Missing required secrets" /tmp/startup-test.log; then
  echo "✅ PASS: Server correctly validates required secrets in production"
  TEST1_PASS=1
else
  echo "❌ FAIL: Server did not show expected error for missing secrets"
  TEST1_PASS=0
fi

# Restore the .env file
mv src/.env.backup src/.env

echo ""
echo "=== Test: Verify session cleanup message ==="

# Test in development mode with secrets loaded
NODE_ENV=development timeout 3 node src/index.js 2>&1 | grep "Session cleanup scheduled" 

if [ $? -eq 0 ]; then
  echo "✅ PASS: Server logs session cleanup scheduled message"
  TEST2_PASS=1
else
  echo "❌ FAIL: Server did not log session cleanup message"
  TEST2_PASS=0
fi

if [ $TEST1_PASS -eq 1 ] && [ $TEST2_PASS -eq 1 ]; then
  echo ""
  echo "=== All tests passed! ==="
  exit 0
else
  echo ""
  echo "=== Some tests failed ==="
  exit 1
fi
