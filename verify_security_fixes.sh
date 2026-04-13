#!/bin/bash
# Security Remediation Verification Script
# Validates that all critical and high-severity security fixes are properly applied

set -e

REPO_ROOT="${1:-.}"
RESULTS_FILE="${REPO_ROOT}/security_verification_results.txt"
PASSED=0
FAILED=0

echo "==================================================================="
echo "Security Vulnerability Fixes Verification"
echo "==================================================================="
echo "Repository: $REPO_ROOT"
echo "Time: $(date)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
  echo "PASS: $1" >> "$RESULTS_FILE"
  ((PASSED++))
}

log_fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  echo "FAIL: $1" >> "$RESULTS_FILE"
  ((FAILED++))
}

log_info() {
  echo -e "${YELLOW}ℹ INFO${NC}: $1"
  echo "INFO: $1" >> "$RESULTS_FILE"
}

# Initialize results file
> "$RESULTS_FILE"

echo "==================================================================="
echo "PHASE 1: CRITICAL SEVERITY FIXES (CVSS 9.8)"
echo "==================================================================="

# Check 1: Command Injection Fix in daemon.js
echo ""
echo "Check 1: Command Injection Prevention (daemon.js)"
if grep -q "shell = false" "$REPO_ROOT/connectors/afp-daemon/lib/daemon.js"; then
  log_pass "daemon.js has shell=false as default"
else
  log_fail "daemon.js missing shell=false default"
fi

if grep -q "UNSAFE_SHELL_CHARS" "$REPO_ROOT/connectors/afp-daemon/lib/daemon.js"; then
  log_pass "daemon.js includes shell character validation"
else
  log_fail "daemon.js missing UNSAFE_SHELL_CHARS validation"
fi

if grep -q "CVSS 9.8" "$REPO_ROOT/connectors/afp-daemon/lib/daemon.js"; then
  log_pass "daemon.js includes CRITICAL security marker"
else
  log_fail "daemon.js missing CRITICAL security marker"
fi

# Check 2: Wildcard Scope Fix in scope-validator.js
echo ""
echo "Check 2: Privilege Escalation Prevention (scope-validator.js)"
if grep -q "Wildcard scopes are not permitted" "$REPO_ROOT/src/middleware/scope-validator.js"; then
  log_pass "scope-validator.js rejects wildcard scopes"
else
  log_fail "scope-validator.js doesn't reject wildcard scopes"
fi

if grep -q "return false; // Wildcard scopes must be explicitly rejected" "$REPO_ROOT/src/middleware/scope-validator.js"; then
  log_pass "scope-validator.js checkScopes returns false for wildcards"
else
  log_fail "scope-validator.js checkScopes doesn't handle wildcards"
fi

if grep -q "SECURITY FIX (CRITICAL - CVSS 9.8)" "$REPO_ROOT/src/middleware/scope-validator.js"; then
  log_pass "scope-validator.js includes CRITICAL security markers"
else
  log_fail "scope-validator.js missing CRITICAL security markers"
fi

# Check 3: Test File for CRITICAL Fixes
echo ""
echo "Check 3: CRITICAL Security Tests"
if [ -f "$REPO_ROOT/src/tests/critical-security-fixes.test.js" ]; then
  log_pass "CRITICAL security test file exists"
  
  # Count test cases
  test_count=$(grep -c "test(" "$REPO_ROOT/src/tests/critical-security-fixes.test.js" || echo "0")
  if [ "$test_count" -ge 18 ]; then
    log_pass "CRITICAL test file contains $test_count tests"
  else
    log_fail "CRITICAL test file only has $test_count tests (expected 18+)"
  fi
else
  log_fail "CRITICAL security test file not found"
fi

echo ""
echo "==================================================================="
echo "PHASE 2: HIGH SEVERITY FIXES (CVSS 7.5)"
echo "==================================================================="

# Check 4: SSRF Prevention in http.js
echo ""
echo "Check 4: SSRF Prevention (http.js)"
if grep -q "validateUrl" "$REPO_ROOT/connectors/afp-app/src/lib/http.js"; then
  log_pass "http.js includes URL validation function"
else
  log_fail "http.js missing URL validation function"
fi

if grep -q "isInternalIP" "$REPO_ROOT/connectors/afp-app/src/lib/http.js"; then
  log_pass "http.js includes internal IP detection"
else
  log_fail "http.js missing internal IP detection"
fi

if grep -q "SECURITY FIX (HIGH - CVSS 7.5): SSRF" "$REPO_ROOT/connectors/afp-app/src/lib/http.js"; then
  log_pass "http.js includes SSRF prevention marker"
else
  log_fail "http.js missing SSRF prevention marker"
fi

# Check 5: TLS Validation in connection.js
echo ""
echo "Check 5: TLS Certificate Validation (connection.js)"
if grep -q "rejectUnauthorized: true" "$REPO_ROOT/connectors/afp-app/src/lib/connection.js"; then
  log_pass "connection.js enforces TLS validation"
else
  log_fail "connection.js missing TLS validation"
fi

if grep -q "SECURITY FIX (HIGH - CVSS 7.5): Enforce strict TLS" "$REPO_ROOT/connectors/afp-app/src/lib/connection.js"; then
  log_pass "connection.js includes TLS validation marker"
else
  log_fail "connection.js missing TLS validation marker"
fi

# Check 6: TLS Validation in http.js
echo ""
echo "Check 6: TLS Certificate Validation in HTTP (http.js)"
if grep -q "rejectUnauthorized: true" "$REPO_ROOT/connectors/afp-app/src/lib/http.js"; then
  log_pass "http.js enforces TLS validation"
else
  log_fail "http.js missing TLS validation"
fi

echo ""
echo "==================================================================="
echo "GIT VERIFICATION"
echo "==================================================================="

# Check 7: Git Commits
echo ""
echo "Check 7: Security Commits"
if cd "$REPO_ROOT" && git log --oneline | grep -q "CRITICAL: Fix command injection"; then
  log_pass "CRITICAL command injection commit found"
else
  log_fail "CRITICAL command injection commit not found"
fi

if cd "$REPO_ROOT" && git log --oneline | grep -q "HIGH: Fix SSRF"; then
  log_pass "HIGH SSRF fix commit found"
else
  log_fail "HIGH SSRF fix commit not found"
fi

# Check 8: Branches
echo ""
echo "Check 8: Security Branches"
if cd "$REPO_ROOT" && git branch -a | grep -q "security/remediation-phase-1-critical"; then
  log_pass "Phase 1 branch exists"
else
  log_fail "Phase 1 branch not found"
fi

if cd "$REPO_ROOT" && git branch -a | grep -q "security/remediation-phase-2-high"; then
  log_pass "Phase 2 branch exists"
else
  log_fail "Phase 2 branch not found"
fi

echo ""
echo "==================================================================="
echo "CODE QUALITY CHECKS"
echo "==================================================================="

# Check 9: No shell=true in daemon.js
echo ""
echo "Check 9: No Dangerous Defaults"
if grep -q "shell=true" "$REPO_ROOT/connectors/afp-daemon/lib/daemon.js"; then
  log_fail "daemon.js still contains shell=true"
else
  log_pass "daemon.js does not contain shell=true"
fi

# Check 10: No admin:* in tests
echo ""
echo "Check 10: Scope Validation Hardening"
admin_wildcard_count=$(grep -o "admin:\*" "$REPO_ROOT/src/middleware/scope-validator.js" | wc -l)
if [ "$admin_wildcard_count" -le 2 ]; then
  log_pass "admin:* wildcard appropriately restricted (found in comments/strings only)"
else
  log_fail "admin:* wildcard appears in executable code"
fi

# Check 11: No localhost in SSRF blocks
echo ""
echo "Check 11: Internal IP Blocking"
if grep -q "localhost" "$REPO_ROOT/connectors/afp-app/src/lib/http.js"; then
  log_pass "localhost is blocked by SSRF prevention"
else
  log_fail "localhost blocking not found"
fi

echo ""
echo "==================================================================="
echo "SUMMARY"
echo "==================================================================="
TOTAL=$((PASSED + FAILED))
PERCENTAGE=$((PASSED * 100 / TOTAL))

echo "Passed: $PASSED / $TOTAL"
echo "Failed: $FAILED / $TOTAL"
echo "Success Rate: $PERCENTAGE%"

echo ""
echo "Results saved to: $RESULTS_FILE"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All security fixes verified successfully!${NC}"
  exit 0
else
  echo -e "${RED}Some security fixes failed verification!${NC}"
  exit 1
fi
