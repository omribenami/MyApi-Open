# SOC 2 Compliance Gap Analysis & Remediation Plan

> Generated: 2026-04-07

## Context

SOC 2 Type II certification requires demonstrating that security controls are not only designed but consistently operated over a period (typically 6-12 months). This document evaluates the MyApi platform against the five Trust Service Criteria (TSC) and prescribes a phased remediation roadmap.

The platform already has a solid security foundation (AES-256-GCM encryption, RBAC, scope-based tokens, device approval, Helmet headers, audit logging), but has several critical gaps that would prevent certification.

---

## SOC 2 Trust Service Criteria Assessment

### CC6 — Logical and Physical Access Controls ⚠️ PARTIAL

**Strengths:**
- Multi-token hierarchy (personal/guest/master/vault) with scope enforcement
- RBAC with workspace isolation (admin/member/viewer)
- Device approval workflow with fingerprinting
- Bcrypt passwords + optional TOTP 2FA
- httpOnly/SameSite session cookies

**Critical Gaps:**
- No idle session timeout (sessions valid 7 days without activity) — `src/index.js:~1022-1029`
- No concurrent session limit (unlimited simultaneous sessions)
- Fallback to hardcoded default vault key `'default-vault-key-change-me'` — `src/config/database.js:~1386`
- Scope enforcement not universal — some endpoints skip `scope-validator` middleware

---

### CC7 — System Operations / Monitoring ⚠️ SIGNIFICANT GAPS

**Strengths:**
- `compliance_audit_logs` table is append-only (DB-level BEFORE UPDATE/DELETE triggers) — `src/config/database.js:805-814`
- Sentry integration (optional via `SENTRY_DSN`)
- Structured logger at `src/utils/logger.js` (JSON log files in `/logs/`)

**Critical Gaps:**
- `audit_log` (main table) is NOT immutable — only `compliance_audit_logs` has triggers
- 273+ `console.log` calls in `src/index.js` alone; routes use raw console instead of structured logger
- No correlation/request IDs — logs can't be traced across middleware chain
- No alerting on: failed login spikes, scope violations, device approval abuse
- No intrusion detection — flags in `docs/SECURITY_AUDIT_OPERATIONS.md`
- Failed auth, token revocation, workspace deletion not systematically logged to `compliance_audit_logs`
- Retention cleanup (`executeRetentionCleanup()`) implemented but never scheduled — `src/config/database.js:~6200`

---

### CC8 — Change Management ✅ GOOD

**Strengths:**
- Two-stage CI/CD: `ci.yml` (lint, test, npm audit) → `deploy.yml` (pre-deploy backup, migration, health check)
- `npm audit --audit-level=high` runs on every build
- Automated pre-deploy database backup with git SHA label
- Health check polling after deployment

**Gaps:**
- No production deployment approval gate (any push to `main` auto-deploys)
- Migration rollback procedure not documented
- No code signing on artifacts

---

### CC9 — Risk Mitigation / Vendor Management ⚠️ GAPS

**Strengths:**
- `docs/INCIDENT_RESPONSE.md` — comprehensive plan with severity levels, GDPR 72-hour notification, user notification templates

**Gaps:**
- Incident Commander and legal contacts still "[TBD]" — `docs/INCIDENT_RESPONSE.md`
- No `SECURITY.md` in repo root for vulnerability disclosure
- No penetration testing history

---

### A1 — Availability ⚠️ PARTIAL

**Strengths:**
- WAL-mode SQLite with auto-checkpoint
- Automated daily backup system with 30-day retention and SHA-256 checksums — `src/lib/backup-manager.js`
- `docs/DATA_RECOVERY_GUIDE.md` with RTO/RPO guidance
- Docker health checks in `docker-compose.prod.yml`

**Critical Gaps:**
- Backups stored on local filesystem only — no off-site replication
- Backups not encrypted
- In-memory rate limiting — resets on restart, no Redis persistence

---

### C1 — Confidentiality ✅ STRONG FOUNDATION

**Strengths:**
- AES-256-GCM with PBKDF2 (600k iterations) — `src/lib/encryption.js`
- OAuth tokens and vault tokens encrypted in DB
- `encryption_keys` table supports key rotation mechanism

**Critical Gaps:**
- No automated key rotation schedule — same keys used indefinitely
- Database file itself not encrypted at rest (field-level encryption exists but disk is plaintext)
- Data export ZIP not encrypted — `src/routes/export.js`

---

### P — Privacy ⚠️ PARTIAL

**Strengths:**
- Account deletion cascade — `DELETE /api/v1/account`
- Data export endpoint — `/api/v1/export`
- Privacy settings toggles — `src/index.js`
- `data_retention_policies` table per workspace

**Gaps:**
- No consent timestamp tracking (`accepted_terms_at`, `accepted_privacy_at` not stored)
- Retention policies implemented but never executed (no scheduler)
- Right-to-be-forgotten not extended to backups

---

## Status Summary

| TSC Criteria | Status | Key Issues |
|---|---|---|
| CC6 — Access Controls | Partial | No session timeout, no concurrent session limits |
| CC7 — Monitoring | Significant gaps | `audit_log` mutable, no structured logging, no alerting |
| CC8 — Change Management | Good | Missing prod deployment approval gate |
| CC9 — Risk/Vendor | Gaps | Incident contacts unassigned, no SECURITY.md |
| A1 — Availability | Partial | Backups unencrypted and local-only |
| C1 — Confidentiality | Strong foundation | No key rotation policy |
| P — Privacy | Partial | Retention never runs, no consent timestamps |

---

## Phased Remediation Plan

### Phase 1 — Critical Controls (Weeks 1-2)

Hard blockers for SOC 2 Type II.

**1.1 Idle Session Timeout**
- File: `src/index.js` (session config ~line 1022)
- Add middleware tracking `req.session.lastActivity`; reject if > 20 minutes idle
- Update session `maxAge` to 8 hours absolute maximum

**1.2 Make `audit_log` Immutable**
- File: `src/config/database.js`
- Add BEFORE UPDATE/DELETE triggers to `audit_log` table (same pattern as `compliance_audit_logs` at lines 805-814)

**1.3 Schedule Retention Cleanup**
- File: `src/index.js` (startup section)
- Call `executeRetentionCleanup()` on startup and schedule via `setInterval` (daily)
- Log each cleanup run to `compliance_audit_logs`

**1.4 Remove Hardcoded Default Key**
- File: `src/config/database.js:~1386`
- Throw hard error if `VAULT_KEY` is missing or equals default value in production
- Gate on `NODE_ENV !== 'test'`

**1.5 Log Critical Events to `compliance_audit_logs`**
- Events to add: `auth_failed`, `token_revoked`, `workspace_deleted`, `scope_violation`, `2fa_failed`
- Files: `src/middleware/auth.js`, `src/gateway/tokens.js`, `src/middleware/scope-validator.js`, `src/index.js`

---

### Phase 2 — High-Priority Controls (Weeks 3-5)

**2.1 Add Request Correlation IDs**
- File: `src/index.js` (early middleware)
- Generate `X-Request-ID` via `crypto.randomUUID()` on each request
- Propagate to all audit log entries

**2.2 Replace `console.log` with Structured Logger**
- Files: All `src/routes/*.js` and `src/index.js`
- Import `src/utils/logger.js`; replace `console.log/warn/error` with `logger.info/warn/error`
- Include `{ requestId, workspaceId, userId }` in log metadata

**2.3 Encrypt Backups**
- File: `src/lib/backup-manager.js`
- Encrypt backup file using `src/lib/encryption.js` with `VAULT_KEY` after creation
- Store checksum of plaintext before encryption; use `.enc` extension

**2.4 Concurrent Session Limits**
- File: `src/index.js` (login route)
- Track active sessions per user; enforce max 3, invalidate oldest on new login
- Add `POST /api/v1/auth/sessions/revoke-all` endpoint

**2.5 Off-Site Backup Replication**
- File: `src/lib/backup-manager.js`
- Upload encrypted backup to S3 if `BACKUP_S3_BUCKET` env var is set
- Non-blocking: log failure, don't crash

**2.6 Assign Incident Response Contacts**
- File: `docs/INCIDENT_RESPONSE.md`
- Replace all "[TBD]" placeholders with real contacts
- Add `SECURITY.md` to repo root with responsible disclosure process

---

### Phase 3 — SOC 2 Alignment (Weeks 6-8)

**3.1 Key Rotation Policy**
- Files: `src/lib/encryption.js`, `src/config/database.js`
- Implement `rotateEncryptionKey()`: generate new key, re-encrypt all encrypted fields, bump `encryption_version`
- Add `/admin/security/rotate-key` endpoint (admin + 2FA required)
- Document quarterly rotation schedule

**3.2 Production Deployment Approval Gate**
- File: `.github/workflows/deploy.yml`
- Add `environment: production` with required reviewer in GitHub repo settings

**3.3 Security Alerting**
- File: new `src/lib/alerting.js`
- Alert on: 5+ failed logins in 5 min from same IP, 3+ scope violations in 1 min, device approval abuse
- Use existing email infrastructure

**3.4 Consent Timestamp Tracking**
- File: `src/config/database.js` (users table migration)
- Add `accepted_terms_at` and `accepted_privacy_policy_at` columns
- Populate on signup and future policy updates

**3.5 Full-Disk Encryption Guidance**
- Infrastructure-level (not a code change)
- Document LUKS (Linux) requirement for production host
- Add to `docs/PRODUCTION_READINESS_CHECKLIST.md`

---

### Phase 4 — Hardening & Audit Readiness (Weeks 9-12)

**4.1 Penetration Testing**
- Engage external security firm for black-box pen test
- Target: auth flows, IDOR, injection, RBAC bypass

**4.2 Audit Log Export Endpoint**
- File: `src/routes/auditSecurity.js`
- `GET /audit/logs/export?format=csv&start=&end=` — admin only

**4.3 CSP Hardening**
- File: `src/index.js` (Helmet config)
- Replace `unsafe-inline` with script nonces

**4.4 SOC 2 Evidence Package**
- Create `docs/SOC2_EVIDENCE.md` mapping each control to specific routes, tables, middleware, and test files for auditor review

---

## Critical Files Reference

| File | Relevant Changes |
|------|---------|
| `src/index.js` | Session timeout middleware, retention scheduler, correlation ID middleware |
| `src/config/database.js` | `audit_log` immutability triggers, remove hardcoded key fallback, consent columns |
| `src/middleware/auth.js` | Log `auth_failed` to `compliance_audit_logs` |
| `src/middleware/scope-validator.js` | Log `scope_violation` to `compliance_audit_logs` |
| `src/gateway/tokens.js` | Log `token_revoked` to `compliance_audit_logs` |
| `src/lib/backup-manager.js` | Encrypt backups, S3 upload |
| `src/utils/logger.js` | Add `requestId` support |
| `docs/INCIDENT_RESPONSE.md` | Fill in TBD contacts |
| `.github/workflows/deploy.yml` | Add environment approval gate |

---

## Verification Checklist

After each phase, verify:
- [ ] `npm test` passes with no regressions
- [ ] `npx jest src/tests/phase3.audit-security.test.js` passes
- [ ] Login → idle 20 min → session expires
- [ ] `UPDATE compliance_audit_logs SET ...` is rejected by DB
- [ ] Backup files are binary-encrypted (not readable as SQLite)
- [ ] Phase 4: mock auditor walkthrough of evidence package

**SOC 2 Type II readiness: ~10-14 weeks of implementation, then 6-12 months of evidence collection before formal audit.**
