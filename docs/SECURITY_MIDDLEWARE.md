# MyApi Security Middleware Specifications

**Version:** 1.0  
**Date:** 2026-02-18  
**Owner:** Security Engineering Team  
**Review Cycle:** Quarterly

---

## 1. Introduction

This document outlines the specifications for security middleware components within the MyApi platform. These middleware components are primarily deployed at the Gateway layer, acting as a critical enforcement point for security policies, and also play a role in data protection and access control within the Brain layer.

---

## 2. Middleware Components and Responsibilities

### 2.1 Authentication Middleware

**Location:** Gateway Layer

**Responsibility:** Validate the authenticity and integrity of incoming tokens.

**Specifications:**
- **Token Type Support:** JWT (JSON Web Tokens)
- **Algorithm:** RS256 (asymmetric signing with Public Key Infrastructure)
- **Validation Steps:**
    1. **Format Validation:** Verify token is a well-formed JWT (header.payload.signature).
    2. **Signature Verification:** Use the configured public key to verify `RS256` signature.
    3. **Expiry Check (`exp` claim):** Reject expired tokens. Consider a small grace period (e.g., 60 seconds) for clock skew, but log the event.
    4. **Not Before Check (`nbf` claim):** Reject tokens used before activation time.
    5. **Issuer Check (`iss` claim):** Verify the token issuer matches the expected `myapi.example`.
    6. **Audience Check (`aud` claim):** Verify the token audience matches the target service (e.g., `myapi-gateway`).
    7. **JTI (JWT ID) Blacklist Check:** Consult a real-time blacklist/revocation list to ensure the `jti` has not been revoked.

**Output:**
- On successful validation: Decorate the request context with decoded token claims (user ID, scopes, `jti`).
- On failure: Return `HTTP 401 Unauthorized` with a generic error message.

### 2.2 Authorization (Scope) Middleware

**Location:** Gateway Layer (Primary), Brain Layer (Secondary/Defense-in-Depth)

**Responsibility:** Enforce granular access control based on token scopes and requested resources.

**Specifications:**
- **Input:** Decoded token claims (including `scope` array) from Authentication Middleware; Requested API endpoint/resource.
- **Policy Enforcement:**
    1. **Pre-defined Mappings:** Maintain a mapping of API endpoints/HTTP methods to required scopes (e.g., `GET /api/identity/*` requires `identity:read`).
    2. **Wildcard Support:** Support wildcard scopes (e.g., `data:*` grants access to all data-related operations).
    3. **Least Privilege Principle:** Default denial; explicitly required scopes must be present in the token.
    4. **Granular Resource Check (Brain Layer):** For data-access operations, the Brain performs a second-level check, potentially based on document IDs or ownership.

**Output:**
- On sufficient authorization: Allow request to proceed.
- On insufficient authorization: Return `HTTP 403 Forbidden` with a generic error message. Log the scope violation.

### 2.3 Rate Limiting Middleware

**Location:** Gateway Layer

**Responsibility:** Protect against API abuse, DDoS attacks, and resource exhaustion by limiting the number of requests clients can make within a time window.

**Specifications:**
- **Identifiers:** Rate limit by authenticated token (`jti`), IP address (for unauthenticated requests), or authenticated user ID.
- **Limits:**
    - **Personal Token:** 100 requests per minute (`/minute`).
    - **Guest Token:** 10 requests per minute (`/minute`).
    - **Unauthenticated:** 5 requests per minute (`/minute`).
- **Exceeding Limits:**
    - Return `HTTP 429 Too Many Requests`.
    - Include `Retry-After` header indicating when the client can retry.
    - Log all rate limit violations.
- **Burst Capacity:** Allow for short bursts above the average rate, but enforce the long-term average.
- **Distributed Counting:** Support distributed rate limiting across multiple Gateway instances (e.g., using Redis).

### 2.4 Input Validation Middleware

**Location:** Gateway Layer, Brain Layer

**Responsibility:** Validate and sanitize all incoming request payloads and query parameters to prevent injection attacks and ensure data integrity.

**Specifications:**
- **Schema Enforcement:** Use JSON Schema or OpenAPI specification to validate payload structure and data types for all API endpoints.
- **Sanitization:**
    - HTML/Script tag removal for any user-supplied text fields.
    - URL encoding/decoding where appropriate.
    - Whitelist known safe characters/patterns.
- **Error Handling:**
    - Return `HTTP 400 Bad Request` with specific validation errors (but avoid disclosing internal logic).
    - Log invalid input attempts.
- **SQL Injection Prevention:** Ensure all database interactions use parameterized queries/prepared statements; middleware should not handle this directly but enforce that downstream layers use them.

### 2.5 Audit Logging Middleware

**Location:** Gateway Layer (API requests), Brain Layer (policy decisions, data access), Vault (data modifications)

**Responsibility:** Capture and log all security-relevant events for auditing, forensics, and compliance.

**Specifications:**
- **Event Types:**
    - Authentication attempts (success/failure)
    - Token issuance, revocation, and scope changes
    - API requests (successful, failed, forbidden)
    - Data access (reads, writes, deletions) including resource ID
    - Policy evaluation decisions (allow/deny)
    - Configuration changes
    - System errors and security anomalies
- **Data Captured (see Audit Log Schema for details):**
    - Timestamp (UTC)
    - Event Type
    - User ID (if authenticated)
    - Token ID (`jti`)
    - Source IP address
    - Requested resource/endpoint
    - HTTP method
    - Outcome (success/failure)
    - Error details (if applicable)
    - Affected data/resource IDs
- **Security:**
    - Asynchronous logging to minimize impact on request latency.
    - Write-once, append-only logs (immutable).
    - Encrypted at rest.
    - PII redaction for sensitive data fields in logs.
    - Secure transfer to a dedicated, restricted log aggregation system.

### 2.6 Data Minimization Middleware (Brain Layer)

**Location:** Brain Layer

**Responsibility:** Ensure that only the necessary data is returned to the requester based on their token scopes and the specific query, applying data masking where required.

**Specifications:**
- **Conditional Data Fields:** Remove fields from the response payload that the token's scopes do not explicitly permit.
- **Data Masking:** For certain sensitive fields (e.g., full social security numbers, API keys), mask portions of the data (e.g., `XXXX-XX-1234`) even if the scope permits access, unless explicitly requested for full access.
- **Response Truncation:** Limit the amount of data returned (e.g., number of historical entries, size of documents) to prevent bulk data exfiltration.
- **Policy Engine Integration:** This middleware relies heavily on the Brain's policy engine to determine what data elements are safe to return.

### 2.7 Security Headers Middleware

**Location:** Gateway Layer

**Responsibility:** Add critical HTTP security headers to all API responses to protect clients from common web vulnerabilities.

**Specifications:**
- **HTTP Strict Transport Security (HSTS):** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (only after successful preload applies).
- **Content Security Policy (CSP):** `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; require-trusted-types-for 'script';` (tailor as needed).
- **X-Content-Type-Options:** `X-Content-Type-Options: nosniff`.
- **X-Frame-Options:** `X-Frame-Options: DENY`.
- **Referrer-Policy:** `Referrer-Policy: same-origin`.
- **Permissions-Policy:** `Permissions-Policy: geolocation=(), microphone=()` (restrict browser features).

---

## 3. Integration with Architecture Layers

- **Gateway:** Hosts Authentication, Authorization, Rate Limiting, Input Validation, Audit Logging (request/response), and Security Headers middleware.
- **Brain:** Hosts Authorization (re-check), Input Validation, Audit Logging (policy decisions, data access), and Data Minimization middleware.
- **Vault:** Directly integrates with Audit Logging for all data modifications and sensitive reads.

---

## 4. Error Handling and Logging

- **Generic Errors:** All security middleware should return generic error messages to clients (e.g., `Unauthorized`, `Forbidden`, `Bad Request`) to avoid information disclosure.
- **Detailed Internal Logging:** For every security event (success or failure), a detailed log entry must be created by the Audit Logging Middleware for internal analysis and forensics.
- **Metric Collection:** Increment relevant metrics (e.g., `auth_success`, `auth_fail`, `rate_limit_hits`) for monitoring and alerting.

---

## 5. Deployment and Configuration

- **Configuration-driven:** Middleware behavior should be configurable via environment variables or a secure configuration service (e.g., `AUTH_PUBLIC_KEY`, `RATE_LIMITS_PERSONAL`).
- **Ordered Execution:** Middleware execution order is critical (e.g., Authentication -> Authorization -> Rate Limiting -> Input Validation).
- **Fail-Safe Defaults:** If configuration is missing or invalid, middleware should default to the most secure (fail-closed) posture.
- **Idempotency:** Middleware should not have side effects that prevent retries (unless explicitly designed, like revocation).

---

**END OF SECURITY MIDDLEWARE SPECIFICATIONS**
