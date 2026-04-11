# SOC 2 Compliance Gap Analysis & Remediation Plan

> Generated: 2026-04-07  
> Last Updated: 2026-04-11  
> Status: **Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ · Phase 4 ✅ — Evidence collection period begins**

---

## Implementation Progress

### Phase 1 — Critical Controls ✅ COMPLETE (2026-04-07)

| Item | Status | Notes |
|------|--------|-------|
| 1.1 Idle Session Timeout | ✅ Done | 20-min idle timeout + 8-hr absolute max; `src/index.js` |
| 1.2 `audit_log` Immutable | ✅ Done | BEFORE UPDATE/DELETE triggers added; `src/config/database.js` |
| 1.3 Schedule Retention Cleanup | ✅ Done | Runs on startup + daily `setInterval`; logged to `compliance_audit_logs` |
| 1.4 Remove Hardcoded Vault Key | ✅ Done | Hard error in production if `VAULT_KEY` missing or equals default |
| 1.5 Log Critical Events | ✅ Done | `auth_failed`, `token_revoked`, `scope_violation`, `2fa_failed` all logged |

### Phase 2 — High-Priority Controls ✅ COMPLETE (2026-04-07)

| Item | Status | Notes |
|------|--------|-------|
| 2.1 Request Correlation IDs | ✅ Done | `X-Request-ID` header; `AsyncLocalStorage` propagation; `src/lib/request-context.js` |
| 2.2 Structured Logger in Routes | ✅ Done | All 17 route files + `src/index.js` migrated from `console.*` to `logger.*` |
| 2.3 Encrypt Backups | ✅ Done | AES-256-GCM with `VAULT_KEY`; `.enc` extension; plaintext checksum preserved |
| 2.4 Concurrent Session Limits | ✅ Done | Max 3 sessions per user; oldest evicted; `POST /api/v1/auth/sessions/revoke-all` added |
| 2.5 Off-Site Backup Replication | ✅ Done | S3 upload via SigV4 (zero deps) when `BACKUP_S3_BUCKET` is set; non-blocking |
| 2.6 Incident Response Contacts | ✅ Done | `docs/INCIDENT_RESPONSE.md` v1.1 — all TBDs filled; `SECURITY.md` added to repo root |

### Additional Fixes (Phase 2 window)

| Fix | Notes |
|-----|-------|
| Master token canonical architecture | One token per user, same across all devices; recovered via `encrypted_token`; no longer re-created on OAuth login |
| Dashboard login page removed | Unauthenticated `/dashboard` now redirects to landing page (`/`); OAuth consent + callback flows preserved |
| Migration `004` | Added `request_id` column + index to `audit_log` and `compliance_audit_logs` |

### Additional Fixes (Phase 4 window)

| Fix | Notes |
|-----|-------|
| Per-request CSP nonce middleware | `res.locals.cspNonce`; Helmet `scriptSrc` references it via function; dashboard HTML patched at serve-time with matching `nonce=""` attributes |
| Audit log export endpoint | `GET /api/v1/audit/logs/export` — CSV or JSON, up to 50k rows, date/action filters, itself audit-logged |
| `docs/PENTEST_BRIEFING.md` | Black-box pen test scope, attack surfaces, credential matrix, expected deliverables |
| `docs/SOC2_EVIDENCE.md` | Full CC6/CC7/CC8/CC9/A1/C1/P control → file/route/test mapping ready for auditor |

### Additional Fixes (Phase 3 window)

| Fix | Notes |
|-----|-------|
| Migration `005` | `accepted_terms_at` + `accepted_privacy_policy_at` columns on `users` table |
| `src/lib/alerting.js` | New module — in-memory rate tracking + email alerts; 15-min suppression window |
| `docs/KEY_ROTATION_POLICY.md` | Quarterly schedule, step-by-step procedure, emergency rotation, audit evidence guidance |

---

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
| CC6 — Access Controls | ✅ Improved | Session timeout ✅, concurrent session limits ✅ — remaining: universal scope middleware coverage |
| CC7 — Monitoring | ✅ Good | `audit_log` immutable ✅, structured logging ✅, correlation IDs ✅, security alerting ✅ |
| CC8 — Change Management | ✅ Good | `environment: production` gate ✅ (configure required reviewer in GitHub Settings) |
| CC9 — Risk/Vendor | ✅ Good | Incident contacts ✅, `SECURITY.md` ✅ — remaining: pen test history |
| A1 — Availability | ✅ Improved | Backups encrypted ✅, S3 replication ✅ — remaining: Redis rate-limit persistence |
| C1 — Confidentiality | ✅ Improved | Key rotation endpoint ✅, quarterly policy documented ✅ |
| P — Privacy | ✅ Improved | Retention scheduler ✅, consent timestamps ✅ — remaining: backup right-to-be-forgotten |

---

## Phased Remediation Plan

### Phase 1 — Critical Controls ✅ COMPLETE

Hard blockers for SOC 2 Type II.

**1.1 Idle Session Timeout** ✅
- Implemented: 20-min idle check + 8-hr absolute max in `src/index.js`

**1.2 Make `audit_log` Immutable** ✅
- Implemented: BEFORE UPDATE/DELETE triggers in `src/config/database.js`

**1.3 Schedule Retention Cleanup** ✅
- Implemented: runs on startup + daily interval; logged to `compliance_audit_logs`

**1.4 Remove Hardcoded Default Key** ✅
- Implemented: hard error in production if `VAULT_KEY` missing or equals default

**1.5 Log Critical Events to `compliance_audit_logs`** ✅
- Implemented: `auth_failed`, `token_revoked`, `workspace_deleted`, `scope_violation`, `2fa_failed`

---

### Phase 2 — High-Priority Controls ✅ COMPLETE

**2.1 Add Request Correlation IDs** ✅
- Implemented: `src/lib/request-context.js` (AsyncLocalStorage); `X-Request-ID` header on all responses; propagated to logger and audit logs via migration `004`

**2.2 Replace `console.log` with Structured Logger** ✅
- Implemented: all 17 route files + `src/index.js` use `logger.info/warn/error`

**2.3 Encrypt Backups** ✅
- Implemented: AES-256-GCM with `VAULT_KEY`; `.enc` extension; plaintext checksum preserved

**2.4 Concurrent Session Limits** ✅
- Implemented: `userSessionRegistry` Map, max 3 per user, oldest evicted; `POST /api/v1/auth/sessions/revoke-all` added

**2.5 Off-Site Backup Replication** ✅
- Implemented: SigV4 S3 upload (zero deps) when `BACKUP_S3_BUCKET` set; non-blocking

**2.6 Assign Incident Response Contacts** ✅
- Implemented: `docs/INCIDENT_RESPONSE.md` v1.1 — all TBDs filled; `SECURITY.md` added to repo root

---

### Phase 3 — SOC 2 Alignment ✅ COMPLETE (2026-04-11)

| Item | Status | Notes |
|------|--------|-------|
| 3.1 Key Rotation Policy | ✅ Done | `POST /api/v1/admin/security/rotate-key` (admin + 2FA gate); `docs/KEY_ROTATION_POLICY.md` quarterly schedule |
| 3.2 Production Deployment Approval Gate | ✅ Done | `environment: production` already in `deploy.yml`; comment added explaining GitHub Settings required reviewer step |
| 3.3 Security Alerting | ✅ Done | `src/lib/alerting.js` — 5 failed logins/5 min, 3 scope violations/min, 10 device requests/10 min → email to `SECURITY_ALERT_EMAIL` |
| 3.4 Consent Timestamp Tracking | ✅ Done | Migration 005: `accepted_terms_at` + `accepted_privacy_policy_at` on `users`; populated at registration |
| 3.5 Full-Disk Encryption Guidance | ✅ Done | LUKS/cloud CMK requirement + verification steps added to `docs/PRODUCTION_READINESS_CHECKLIST.md` §Host Security |

---

### Phase 4 — Hardening & Audit Readiness ✅ COMPLETE (2026-04-11)

| Item | Status | Notes |
|------|--------|-------|
| 4.1 Penetration Testing | ✅ Done | `docs/PENTEST_BRIEFING.md` — scope, targets, methodology, deliverables; firm engagement pending |
| 4.2 Audit Log Export | ✅ Done | `GET /api/v1/audit/logs/export?format=csv\|json&start=&end=&action=` — admin only, up to 50k rows, audit logged |
| 4.3 CSP Hardening | ✅ Done | Per-request nonce middleware; Helmet `scriptSrc` uses nonce function; dashboard HTML patched at serve time; `styleSrc: unsafe-inline` retained (React inline style constraint, documented) |
| 4.4 SOC 2 Evidence Package | ✅ Done | `docs/SOC2_EVIDENCE.md` — full TSC control → file/route/test mapping for auditor review |

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
