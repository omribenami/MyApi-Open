#!/bin/bash

# Comprehensive test for all bug fixes
set -e

API_URL="${API_URL:-http://localhost:4500}"
PASSED=0
FAILED=0

echo "=== MyApi Bug Fix Tests ==="
echo

# Helper functions
test_result() {
  if [ $1 -eq 0 ]; then
    echo "✓ $2"
    ((PASSED++))
  else
    echo "✗ $2"
    ((FAILED++))
  fi
}

# BUG-3: Register returns 201
echo "--- BUG-3: Register Endpoint Status Code ---"
STATUS=$(curl -s -X POST $API_URL/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"bug3test_'$(date +%s)'","password":"password123"}' \
  -o /dev/null -w "%{http_code}")
[ "$STATUS" = "201" ]
test_result $? "Register endpoint returns 201 (got $STATUS)"

# BUG-2: /api/v1/services is public
echo
echo "--- BUG-2: Services Endpoint Public Access ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/api/v1/services)
[ "$STATUS" = "200" ]
test_result $? "Services endpoint returns 200 without auth (got $STATUS)"

SERVICES=$(curl -s $API_URL/api/v1/services)
COUNT=$(echo "$SERVICES" | jq '.data | length // 0')
[ "$COUNT" -gt 0 ]
test_result $? "Services endpoint returns service list ($COUNT items)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/api/v1/services/categories)
[ "$STATUS" = "200" ]
test_result $? "Services categories endpoint returns 200 (got $STATUS)"

# BUG-1: Rate limiting doesn't block Bearer tokens excessively
echo
echo "--- BUG-1: Rate Limiting with Bearer Tokens ---"
TOKEN=$(curl -s -X POST $API_URL/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"bug1test_'$(date +%s)'","password":"password123"}' | jq -r '.data.token')

# Multiple requests with Bearer token should not all be rate limited
# Note: Some may get 403 (device not approved), but shouldn't all get 429
RATE_LIMIT_COUNT=0
for i in {1..3}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    $API_URL/api/v1/dashboard/metrics)
  if [ "$STATUS" = "429" ]; then
    ((RATE_LIMIT_COUNT++))
  fi
done
[ "$RATE_LIMIT_COUNT" -eq 0 ]
test_result $? "Bearer token requests skip global rate limiter (no 429 responses)"

# BUG-4: Dashboard metrics load after login
echo
echo "--- BUG-4: Dashboard Metrics Loading ---"
COOKIE_JAR="/tmp/test_cookies_$$.txt"
trap "rm -f $COOKIE_JAR" EXIT

# Register and create session
curl -s -X POST $API_URL/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d '{"username":"bug4test_'$(date +%s)'","password":"password123"}' > /dev/null

# Access metrics with session cookie
METRICS=$(curl -s -b "$COOKIE_JAR" $API_URL/api/v1/dashboard/metrics)
DEVICES=$(echo "$METRICS" | jq '.approvedDevices // -1')
[ "$DEVICES" -ge 0 ]
test_result $? "Dashboard metrics accessible (approvedDevices: $DEVICES)"

TIMESTAMP=$(echo "$METRICS" | jq '.timestamp // empty')
[ -n "$TIMESTAMP" ]
test_result $? "Dashboard metrics include timestamp"

# Summary
echo
echo "=== Test Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -gt 0 ]; then
  echo
  echo "Some tests failed!"
  exit 1
else
  echo
  echo "✓ All tests passed!"
  exit 0
fi
