# SOC 2 Evidence Package

> SOC 2 Phase 4.4 — Audit Readiness  
> Last Updated: 2026-04-11  
> Prepared for: External SOC 2 Type II auditor review

This document maps each Trust Service Criteria (TSC) control to the specific source files,
routes, middleware, database tables, and test files that provide evidence of implementation
and consistent operation.

---

## How to use this document

Each control lists:
- **Where implemented** — exact file(s) and approximate line numbers
- **How to verify** — command to run or endpoint to call
- **Test coverage** — Jest test file(s) that assert the behaviour

For live evidence, the auditor should use the `GET /audit/logs/export?format=csv` endpoint
with an admin token to pull the full audit log for the observation period.

---

## CC6 — Logical and Physical Access Controls

### CC6.1 Logical access restricted to authorized users

| Control | Implementation | Test |
|---------|---------------|------|
| Bearer token auth | `src/middleware/auth.js` | `src/tests/integration.test.js` |
| Session cookie auth | `src/index.js` (~line 2200) | `src/tests/integration.test.js` |
| Master vs guest token distinction | `src/gateway/tokens.js` | `src/tests/integration.test.js` |
| Token revocation on logout | `src/index.js` `/api/v1/auth/logout` | `src/tests/integration.test.js` |

### CC6.2 Prior to issuing system credentials, the entity registers and authorizes new users

| Control | Implementation | Test |
|---------|---------------|------|
| User registration requires strong password | `src/index.js` `isStrongPassword()` | `src/tests/integration.test.js` |
| Consent timestamps recorded at registration | `src/database.js` `createUser()`, migration 005 | — |
| Device fingerprint approval for agent tokens | `src/middleware/deviceApproval.js` | `src/tests/deviceApproval.test.js` |

### CC6.3 Access removed when no longer needed

| Control | Implementation | Test |
|---------|---------------|------|
| Token revocation | `src/gateway/tokens.js` `revokeToken()` | `src/tests/integration.test.js` |
| OAuth token deletion on disconnect | `src/index.js` `/api/v1/oauth/:service/disconnect` | — |
| Account deletion cascade | `src/index.js` `DELETE /api/v1/account` | — |

### CC6.6 Logical access security measures — authentication

| Control | Implementation | Test |
|---------|---------------|------|
| bcrypt password hashing (10 rounds) | `src/database.js` `createUser()` | `src/tests/integration.test.js` |
| TOTP 2FA | `src/index.js` `speakeasy.totp.verify()` | `src/tests/integration.test.js` |
| TOTP replay protection | `src/index.js` `isTotpCodeUsed()` | — |
| Idle session timeout (20 min) | `src/index.js` idle timeout middleware | — |
| Absolute session max (8 hr) | `src/index.js` idle timeout middleware | — |
| Concurrent session limit (max 3) | `src/index.js` `userSessionRegistry` | `src/tests/integration.test.js` |
| Failed login logging | `src/index.js` `createAuditLog({action:'failed_login'})` | `src/tests/phase3.audit-security.test.js` |
| Failed login alerting (5/5 min) | `src/lib/alerting.js` `trackFailedLogin()` | — |

### CC6.7 Transmission of data restricted

| Control | Implementation | Test |
|---------|---------------|------|
| HTTPS enforced (HSTS 1yr + preload) | `src/index.js` Helmet config | — |
| SameSite=Lax session cookies | `src/index.js` session config | — |
| httpOnly cookies | `src/index.js` session config | — |

---

## CC7 — System Operations and Monitoring

### CC7.1 System vulnerabilities detected and monitored

| Control | Implementation | Test |
|---------|---------------|------|
| `npm audit` in CI pipeline | `.github/workflows/ci.yml` | — |
| Scope violation logging | `src/middleware/scope-validator.js` | `src/tests/phase3.audit-security.test.js` |
| Scope violation alerting (3/min) | `src/lib/alerting.js` `trackScopeViolation()` | — |
| Device abuse alerting (10/10 min) | `src/lib/alerting.js` `trackDeviceApprovalAbuse()` | — |

### CC7.2 Monitoring of system components

| Control | Implementation | Test |
|---------|---------------|------|
| Structured JSON logging | `src/utils/logger.js` | — |
| Request correlation IDs | `src/lib/request-context.js`, `X-Request-ID` header | `src/tests/phase3.audit-security.test.js` |
| Audit log for every request | `src/index.js` `createAuditLog()` | `src/tests/phase3.audit-security.test.js` |
| `compliance_audit_logs` append-only | `src/database.js` BEFORE UPDATE/DELETE triggers | `src/tests/phase3.audit-security.test.js` |
| `audit_log` append-only | `src/database.js` BEFORE UPDATE/DELETE triggers | `src/tests/phase3.audit-security.test.js` |
| Sentry error monitoring | `src/index.js` (optional via `SENTRY_DSN`) | — |

### CC7.3 Evaluated / responded to security events

| Control | Implementation | Test |
|---------|---------------|------|
| Incident Response Plan | `docs/INCIDENT_RESPONSE.md` | — |
| Audit log export for investigation | `src/routes/auditSecurity.js` `GET /audit/logs/export` | — |
| Security contacts defined | `SECURITY.md`, `docs/INCIDENT_RESPONSE.md` | — |

---

## CC8 — Change Management

### CC8.1 Infrastructure and software changes are authorized and tested

| Control | Implementation | Test |
|---------|---------------|------|
| CI: lint, test, `npm audit` on every push | `.github/workflows/ci.yml` | — |
| Production deployment approval gate | `.github/workflows/deploy.yml` `environment: production` | — |
| Pre-deploy database backup | `.github/workflows/deploy.yml` + `src/scripts/backup.js` | — |
| Health check after deploy | `.github/workflows/deploy.yml` health polling | — |
| Database migration versioning | `src/database.js` `safeMigration()`, `schema_migrations` table | — |

---

## CC9 — Risk Mitigation

### CC9.1 Risk assessment process

| Control | Implementation | Test |
|---------|---------------|------|
| Security audit documentation | `docs/SECURITY_AUDIT_OPERATIONS.md` | — |
| SOC 2 gap analysis | `docs/SOC2_COMPLIANCE_PLAN.md` | — |
| Production readiness checklist | `docs/PRODUCTION_READINESS_CHECKLIST.md` | — |

### CC9.2 Vendor / third-party management

| Control | Implementation | Test |
|---------|---------------|------|
| Penetration testing briefing | `docs/PENTEST_BRIEFING.md` | — |
| Vulnerability disclosure policy | `SECURITY.md` | — |

---

## A1 — Availability

### A1.1 System availability maintained

| Control | Implementation | Test |
|---------|---------------|------|
| SQLite WAL mode | `src/database.js` `PRAGMA journal_mode = WAL` | — |
| Daily encrypted backup | `src/lib/backup-manager.js` | — |
| S3 off-site backup replication | `src/lib/backup-manager.js` SigV4 upload | — |
| Backup integrity (SHA-256 checksum) | `src/lib/backup-manager.js` | — |
| Data recovery guide | `docs/DATA_RECOVERY_GUIDE.md` | — |
| Docker health checks | `src/Dockerfile` / `docker-compose.prod.yml` | — |
| In-memory rate limiting | `src/index.js` `express-rate-limit` | `src/tests/integration.test.js` |

---

## C1 — Confidentiality

### C1.1 Confidential information protected

| Control | Implementation | Test |
|---------|---------------|------|
| OAuth token AES-256-GCM encryption | `src/lib/encryption.js`, `src/database.js` | `src/tests/integration.test.js` |
| Vault token bcrypt storage | `src/database.js` `createVaultToken()` | — |
| Encryption key versioning | `src/database.js` `key_versions` table | — |
| Key rotation endpoint (admin + 2FA) | `src/index.js` `POST /api/v1/admin/security/rotate-key` | — |
| Key rotation policy | `docs/KEY_ROTATION_POLICY.md` | — |
| PBKDF2 key derivation (600k iter) | `src/lib/encryption.js` | — |
| Full-disk encryption requirement | `docs/PRODUCTION_READINESS_CHECKLIST.md` §Host Security | — |

---

## P — Privacy

### P1 Notice and communication of privacy practices

| Control | Implementation | Test |
|---------|---------------|------|
| Privacy policy | `docs/PRIVACY_POLICY.md`, `src/public/legal/privacy.html` | — |
| Terms of service | `docs/TERMS_OF_SERVICE.md`, `src/public/legal/terms.html` | — |
| Consent timestamps on registration | `src/database.js` `accepted_terms_at`, `accepted_privacy_policy_at` | — |

### P4 Privacy notice and consent

| Control | Implementation | Test |
|---------|---------------|------|
| Right to export (data portability) | `src/routes/export.js` `GET /api/v1/export` | — |
| Right to deletion (right to be forgotten) | `src/index.js` `DELETE /api/v1/account` | — |
| Retention policy execution | `src/database.js` `executeRetentionCleanup()`, daily scheduler | `src/tests/phase5-retention.test.js` |

---

## Audit Log Export — Evidence Collection

To pull audit evidence for a time period:

```bash
# Export full audit log as CSV (replace dates and token)
curl "https://api.example.com/api/v1/audit/logs/export?format=csv&start=2026-01-01&end=2026-04-11" \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -o "audit-logs-Q1-2026.csv"

# Export specific event type (e.g. key rotations)
curl "https://api.example.com/api/v1/audit/logs/export?format=csv&action=key_rotation" \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -o "key-rotation-events.csv"

# Check compliance_audit_logs (append-only table)
# Accessible via the DB directly — auditor receives read-only DB snapshot
sqlite3 myapi.db "SELECT * FROM compliance_audit_logs ORDER BY timestamp DESC LIMIT 100;"
```

---

## Pending Evidence (to be filed after events occur)

| Item | Status | Where to file |
|------|--------|--------------|
| Penetration test report | Pending engagement | Attach to this document |
| Key rotation records (Q2 2026) | Pending rotation | `audit_log` action=`key_rotation` |
| Production deployment approval screenshots | Collect per deploy | Append to this document |
| LUKS / disk encryption verification screenshot | Pending production setup | Append to this document |
| Incident response drills | None yet | `docs/INCIDENT_RESPONSE.md` |
