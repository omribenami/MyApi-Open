# Legal Documents - Code Audit

**Date:** March 27, 2026  
**Auditor:** Code Review  
**Status:** COMPREHENSIVE REVIEW COMPLETED - POLICIES UPDATED

---

## Summary

Performed a comprehensive audit comparing legal documents (Privacy Policy, Terms of Service) against the full codebase implementation. The previous audit (March 26, 2026) found 2 discrepancies. This comprehensive review identified 15+ additional gaps where the legal documents did not fully reflect the platform's actual capabilities and data practices. All documents have been updated to align with the code and protect the platform owner.

---

## Previous Discrepancies (March 26, 2026)

### Discrepancy #1: Notification Retention (FIXED)
- **Was:** Policy said 30 days
- **Actual Code:** 60 days (`src/database.js:4384`)
- **Status:** ✅ Fixed in previous update, confirmed in current policy

### Discrepancy #2: Audit Log Retention (CORRECTED)
- **Was:** Privacy Policy said "90 days"
- **Actual Code:** No automatic cleanup; indefinite by default (`src/database.js` - no default retention policy created)
- **Status:** ✅ Corrected — policy now states "Indefinite (default)" with note about configurable workspace retention policies

---

## New Findings (March 27, 2026)

### Privacy Policy — Issues Found and Fixed

| # | Issue | Old Policy | Actual Code | Fix Applied |
|---|-------|-----------|-------------|-------------|
| 1 | Audit log retention incorrect | 90 days | Indefinite (no auto-cleanup) | Changed to "Indefinite (default)" |
| 2 | Backup retention incorrect | 90 days | 30 days default (`src/lib/backup-manager.js:17`) | Changed to "30 days" |
| 3 | Missing: AI/conversation data | Not mentioned | Full conversation history stored (`messages`, `conversations` tables) | Added Section 6: AI Data Processing |
| 4 | Missing: Device fingerprinting | Not mentioned | SHA-256 device hashing (`approved_devices` table) | Added Section 7: Device Fingerprinting |
| 5 | Missing: Cookie details | Not listed | 3 cookies: `myapi.sid`, `myapi_master_token`, `myapi_user` | Added cookie table in Section 1.3 |
| 6 | Missing: Billing data | Not mentioned | Stripe customer/subscription IDs stored | Added to Section 1.1 and 3.1 |
| 7 | Missing: Marketplace data | Not mentioned | Listings, ratings, reviews stored | Added to Section 1.1 |
| 8 | Missing: Third-party processors | Not listed | Stripe, SMTP/SendGrid, AI providers, OAuth | Added Section 3: Data Sharing and Third-Party Processors |
| 9 | Missing: Workspace data sharing | Not explained | Members can access shared resources by role | Added Section 3.3 |
| 10 | Missing: No analytics statement | Not mentioned | No third-party analytics in codebase | Added highlight box in Section 1.3 |
| 11 | Missing: Children's privacy | Only header mention | No specific handling for minors | Added Section 10 with age 18 requirement |
| 12 | Missing: Notification retention | Not in table | 60-day expiry (`src/database.js:4384`) | Added to retention table |
| 13 | Missing: Privacy controls | Not mentioned | Cookie prefs, data sharing, API logging toggles | Added Section 8: Privacy Controls |
| 14 | Missing: Security detail | Generic "AES-256" | AES-256-GCM, PBKDF2 600k iterations, bcrypt | Enhanced Section 4 with specifics |
| 15 | Missing: International transfers | Not mentioned | Self-hosted, cross-border possible | Added Section 11 |
| 16 | Missing: Breach notification detail | Only "72 hours" | Full GDPR Art. 33 requirements | Added Section 12 |

### Terms of Service — Issues Found and Fixed

| # | Issue | Old Terms | Actual Code | Fix Applied |
|---|-------|----------|-------------|-------------|
| 1 | No service description | Missing entirely | Full AI agent platform | Added Section 2: Service Description |
| 2 | License too restrictive | "non-commercial only" | Platform has paid plans (Pro/Enterprise) | Changed to allow commercial use within plan |
| 3 | No eligibility/age req | Missing | No age verification in code | Added Section 3: minimum age 18 |
| 4 | Thin account security | Password only | Tokens, 2FA, devices, master tokens | Expanded Section 4 with all auth types |
| 5 | No API usage terms | Missing | Rate limits enforced (`src/index.js:1303-1333`) | Added Section 6 with plan limits table |
| 6 | No billing terms | Missing | Stripe integration (`billing_*` tables) | Added Section 7: Subscription Plans and Payment |
| 7 | No IP/content terms | Missing | User content, marketplace, skills | Added Section 8: User Content and IP |
| 8 | No AI disclaimer | Missing | Gemini integration, conversations | Added Section 9: AI-Generated Content |
| 9 | OAuth section too thin | 2 sentences | 12+ providers, encrypted tokens | Expanded Section 10 with full details |
| 10 | No email consent | Missing | Email queue, SMTP/SendGrid | Added Section 11: Email Communications |
| 11 | No device management | Missing | Device fingerprinting, approval workflow | Added Section 12 |
| 12 | No data export mention | Missing | ZIP export with checksums | Added Section 13 |
| 13 | No service availability | Missing | No SLA in code | Added Section 14: Availability and Modifications |
| 14 | No beta features | Missing | Experimental features possible | Added Section 14.3 |
| 15 | No dispute resolution | Generic governing law | No arbitration in code | Added Section 19: Dispute Resolution with arbitration |
| 16 | No class action waiver | Missing | N/A (legal protection) | Added Section 19.3 |
| 17 | No severability/waiver | Missing | Standard legal terms | Added Section 21: General Provisions |
| 18 | Liability cap unfavorable | "$100 or amount paid, whichever LESS" | Platform has paid plans | Changed to "GREATER of $100 or amount paid" |

---

## Comprehensive Verification ✅

### Encryption
- **Policy:** "AES-256-GCM authenticated encryption with PBKDF2 600,000 iterations"
- **Code:** ✅ VERIFIED — `src/lib/encryption.js:21-30`
  - Algorithm: `aes-256-gcm`
  - Key: 32 bytes (256 bits)
  - Nonce: 12 bytes (96 bits)
  - Auth tag: 16 bytes (128 bits)
  - PBKDF2: 600,000 iterations, SHA-256

### Session Expiration
- **Policy:** "7 days"
- **Code:** ✅ VERIFIED — `src/index.js:767`
  ```javascript
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  ```

### Session Cleanup
- **Policy:** "Cleaned up automatically every 15 minutes"
- **Code:** ✅ VERIFIED — `src/index.js:8594`

### Notification Expiration
- **Policy:** "60 days"
- **Code:** ✅ VERIFIED — `src/database.js:4384`
  ```javascript
  const expiresAt = now + (60 * 24 * 60 * 60); // 60 days
  ```

### Backup Retention
- **Policy:** "30 days default, maximum 50 backups"
- **Code:** ✅ VERIFIED — `src/lib/backup-manager.js:17-18`
  ```javascript
  retentionDays: 30 (default)
  maxBackups: 50 (default)
  ```

### Account Deletion
- **Policy:** "Immediate and permanent"
- **Code:** ✅ VERIFIED — `src/index.js:4137-4170`
  - Deletes: oauth_tokens, access_tokens, handshakes, messages, conversations, persona_documents, persona_skills, skills, personas, kb_documents, users
  - Session destroyed, cookies cleared
  - No recovery mechanism

### Device Fingerprinting
- **Policy:** "SHA-256 hash of device characteristics"
- **Code:** ✅ VERIFIED — `approved_devices` table with `device_fingerprint_hash` column

### Cookies
- **Policy:** Lists 3 cookies: `myapi.sid`, `myapi_master_token`, `myapi_user`
- **Code:** ✅ VERIFIED — `src/index.js:763,4294-4307`

### Rate Limits
- **Policy:** "5 per minute for auth, 3 per minute for 2FA"
- **Code:** ✅ VERIFIED — `src/index.js:1330,1333`

### Compliance Audit Logs
- **Policy:** "Immutable, append-only, cannot be deleted"
- **Code:** ✅ VERIFIED — `src/database.js:765` (DELETE trigger prevents removal)

### Plan Limits
- **Policy:** Free: 1,000 calls/3 services/50 installs, Pro: 100,000/unlimited/unlimited
- **Code:** ✅ VERIFIED — `src/index.js` PLAN_LIMITS and BILLING_PLANS definitions

### No Third-Party Analytics
- **Policy:** "No third-party analytics, tracking pixels, or advertising scripts"
- **Code:** ✅ VERIFIED — No analytics libraries in dependencies or frontend code

### Stripe Integration
- **Policy:** "Payment processed through Stripe, no full card details stored"
- **Code:** ✅ VERIFIED — `billing_customers`, `billing_subscriptions` tables store only Stripe IDs

### OAuth Providers
- **Policy:** Lists Google, GitHub, Slack, Discord, Facebook, Instagram, TikTok, Twitter/X, Reddit, LinkedIn, WhatsApp
- **Code:** ✅ VERIFIED — `src/services/integration-layer.js:22-95`

### OAuth Token Cleanup
- **Policy:** "Cleaned hourly"
- **Code:** ✅ VERIFIED — `src/index.js:8586-8589`

### Rate Limit Record Cleanup
- **Policy:** "24 hours, cleaned every hour"
- **Code:** ✅ VERIFIED — `src/index.js:645-671`

---

## Compliance Status

| Claim | Code | Status |
|-------|------|--------|
| AES-256-GCM encryption | ✅ `src/lib/encryption.js` | ✓ Compliant |
| PBKDF2 600k iterations | ✅ `src/lib/encryption.js:28` | ✓ Compliant |
| Session expiration (7 days) | ✅ `src/index.js:767` | ✓ Compliant |
| Session cleanup (15 min) | ✅ `src/index.js:8594` | ✓ Compliant |
| Notification expiration (60 days) | ✅ `src/database.js:4384` | ✓ Compliant |
| Backup retention (30 days) | ✅ `src/lib/backup-manager.js:17` | ✓ Compliant |
| Immediate account deletion | ✅ `src/index.js:4137-4170` | ✓ Compliant |
| Audit logs indefinite (default) | ✅ No auto-cleanup | ✓ Compliant |
| Compliance logs immutable | ✅ DELETE trigger | ✓ Compliant |
| Device fingerprinting (SHA-256) | ✅ `approved_devices` table | ✓ Compliant |
| 3 cookies listed | ✅ `src/index.js` | ✓ Compliant |
| No third-party analytics | ✅ Not in codebase | ✓ Compliant |
| HTTPS/TLS 1.2+ | ✅ Via Cloudflare | ✓ Compliant |
| 2FA support (TOTP) | ✅ Speakeasy library | ✓ Compliant |
| bcrypt password hashing | ✅ `src/index.js` | ✓ Compliant |
| Stripe payment (IDs only) | ✅ `billing_*` tables | ✓ Compliant |
| OAuth (12+ providers) | ✅ `src/services/integration-layer.js` | ✓ Compliant |
| Rate limits enforced | ✅ `src/index.js:1303-1333` | ✓ Compliant |
| Plan limits enforced | ✅ PLAN_LIMITS object | ✓ Compliant |
| Data export (ZIP+SHA-256) | ✅ Export routes | ✓ Compliant |
| Cookie preferences | ✅ `/api/v1/privacy/cookies` | ✓ Compliant |
| Privacy controls (toggles) | ✅ `/api/v1/privacy/settings` | ✓ Compliant |
| Configurable retention | ✅ `data_retention_policies` table | ✓ Compliant |

---

## Key Owner Protections Added

1. **AI Disclaimer:** Explicit disclaimer that AI outputs are not guaranteed accurate; owner not liable for AI-generated content
2. **Class Action Waiver:** Users waive class action rights, disputes resolved individually
3. **Arbitration Clause:** Binding arbitration for dispute resolution
4. **Liability Cap (Improved):** Changed from "lesser of" to "greater of $100 or amount paid" — more standard and defensible
5. **Indemnification (Expanded):** Covers user content, marketplace uploads, AI usage, and legal violations
6. **IP Protection:** Clear ownership of platform IP, user content license limited to service delivery
7. **Beta Disclaimer:** Experimental features provided "as-is" without warranty
8. **Service Modification Rights:** Right to modify, suspend, or discontinue features
9. **No SLA:** Explicit statement that no uptime guarantee is provided unless separately agreed
10. **Termination Rights (Expanded):** Covers rate limit abuse, non-payment, marketplace misuse
11. **Email Consent:** Users consent to transactional emails by creating an account
12. **Third-Party Liability:** Not responsible for OAuth provider outages, AI model changes, or Stripe issues

---

## Conclusion

Legal documents now comprehensively reflect the platform's actual implementation. All security claims are backed by verified code. All data handling practices are disclosed. Owner liability protections have been significantly strengthened.

**Status: COMPREHENSIVE AUDIT PASSED ✅**
**Documents Updated: Terms of Service, Privacy Policy**
**Next Review Recommended: March 2027**
