# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main) | Yes |
| Older releases | No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

Send a report to: **security@myapiai.com**

Include as much of the following as possible:
- Type of issue (e.g. SQL injection, XSS, authentication bypass, privilege escalation)
- Full path of the affected source file(s)
- Location of the affected code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- **Acknowledgement** within 48 hours confirming receipt
- **Assessment** within 5 business days classifying severity (Critical / High / Medium / Low)
- **Updates** every 7 days on remediation progress
- **Credit** in the changelog / release notes when the fix ships (unless you prefer to remain anonymous)
- We follow responsible disclosure: we ask for 90 days before public disclosure to allow time for a fix

### Scope

In scope:
- Authentication and session management flaws
- Authorization / privilege escalation (IDOR, RBAC bypass)
- Injection vulnerabilities (SQL, command, SSRF)
- Sensitive data exposure (tokens, credentials, PII)
- Cryptographic weaknesses
- OAuth implementation flaws

Out of scope:
- Denial of service (DoS/DDoS)
- Social engineering
- Physical attacks
- Issues already publicly disclosed
- Third-party services not under our control

## Disclosure Policy

MyApi follows a coordinated vulnerability disclosure model:
1. Researcher reports to security@myapiai.com
2. MyApi acknowledges and begins investigation
3. MyApi develops and tests a fix
4. Fix is deployed to production
5. MyApi and researcher coordinate on public disclosure timing (default: 90 days)

## Security Practices

- AES-256-GCM encryption for all OAuth tokens and sensitive vault data
- Bcrypt-hashed passwords (cost factor 10)
- Immutable append-only audit logs (SOC2 CC7)
- Idle session timeout (20 min) + absolute session cap (8 h)
- Concurrent session limit per user
- Device approval workflow for API access
- Scope-based access control hierarchy

## Security Scan Findings & Fixes

### Fixed Issues

#### [HIGH] Sensitive API paths exposed (swagger.json, openapi.json)
**Status:** ✅ RESOLVED (intentional)

**What:** Paths like `/api/swagger.json`, `/openapi.json` return HTTP 200 with full API spec.

**Why it's safe:** 
- Spec revelation is standard practice for public APIs — it doesn't expose secrets or credentials
- All mutating endpoints (POST/PUT/DELETE) require Bearer token authentication
- The schema alone cannot be exploited without valid API credentials
- Keeping it public is necessary for AI agents to discover and bootstrap API integration

**Implementation:** See src/index.js line 3715-3723 for public discovery paths with detailed security notes.

#### [LOW] Content Security Policy: upgrade-insecure-requests missing
**Status:** ✅ FIXED

**What:** CSP header wasn't auto-upgrading HTTP resources to HTTPS.

**Fix:** 
- Set `upgradeInsecureRequests: []` in Helmet CSP configuration (src/index.js:782)
- All HTTP requests to this domain now auto-upgrade to HTTPS
- Prevents mixed-content attacks and man-in-the-middle interception

#### [LOW] Content Security Policy: report-uri/report-to missing
**Status:** ✅ FIXED

**What:** CSP violations weren't being reported for analysis and debugging.

**Fix:**
- Added `reportUri: ['/api/v1/security/csp-report']` to CSP directives
- Created `POST /api/v1/security/csp-report` endpoint (src/index.js:1966-1980)
- All CSP violations now logged with:
  - Violated directive (e.g., script-src, style-src)
  - Blocked resource URI
  - Source file and line number where violation occurred
  - User agent and IP for debugging
- Logs appear in server console for monitoring

#### [INFO] No cookie consent mechanism detected
**Status:** ✅ IMPLEMENTED

**What:** No cookie consent banner on first visit.

**Implementation:**
- Cookie consent banner (`src/public/dashboard-app/src/components/CookieNotice.jsx`)
- Backend endpoints: `GET/PUT /api/v1/privacy/cookies`
- User can choose "Full cookies" or "Essential only" on first visit
- Preference persisted in localStorage + backend
- See CLAUDE.md for feature overview

### Pending DNS-Level Issues

#### [HIGH] Missing DMARC record
**Status:** 📋 REQUIRES DNS CONFIGURATION (not code-level)

See "Email Authentication (DMARC, SPF, DKIM)" section below for setup instructions.

#### [MEDIUM] DNSSEC not enabled
**Status:** 📋 REQUIRES REGISTRAR CONFIGURATION (not code-level)

Enable DNSSEC through your domain registrar:
- Cloudflare: https://developers.cloudflare.com/dns/dnssec/
- GoDaddy: https://www.godaddy.com/help/enable-dnssec-6420
- Namecheap: https://www.namecheap.com/support/knowledgebase/article.aspx/9722/2232/managing-dnssec-for-domains-pointed-to-custom-dns/

---

## Email Authentication (DMARC, SPF, DKIM)

Email authentication protects against spoofing and phishing attacks. Configure these DNS records for the domain sending emails from MyApi (e.g., `myapiai.com`).

### SPF (Sender Policy Framework)

Authorizes which mail servers can send emails on behalf of your domain.

**Add to DNS as a TXT record:**
```
Host: myapiai.com
Type: TXT
Value: v=spf1 include:sendgrid.net ~all
```

**Alternative formats (adjust based on your email provider):**
- **Sendgrid**: `v=spf1 include:sendgrid.net ~all`
- **AWS SES**: `v=spf1 include:amazonses.com ~all`
- **Mailgun**: `v=spf1 include:mailgun.org ~all`
- **Generic SMTP**: `v=spf1 ip4:<your-server-ip> ~all`

### DKIM (DomainKeys Identified Mail)

Cryptographically signs outgoing emails. Get the public key from your email provider.

**Steps:**
1. Log into your email provider dashboard (Sendgrid, AWS SES, etc.)
2. Find "DKIM Setup" or "Domain Signing"
3. Copy the CNAME or TXT record provided
4. Add to your DNS:

**Example (Sendgrid):**
```
Host: s1._domainkey.myapiai.com
Type: CNAME
Value: s1.domainkey.sendgrid.net
```

### DMARC (Domain-based Message Authentication, Reporting and Conformance)

Tells mail providers what to do with unsigned/unauthenticated emails.

**Add to DNS as a TXT record:**
```
Host: _dmarc.myapiai.com
Type: TXT
Value: v=DMARC1; p=reject; rua=mailto:dmarc-reports@myapiai.com; ruf=mailto:dmarc-forensics@myapiai.com
```

**Policy options:**
- `p=reject` - Reject emails that fail authentication (most secure)
- `p=quarantine` - Quarantine suspicious emails (recommended for initial rollout)
- `p=none` - Don't enforce, just monitor (monitoring only)

### DNS Verification

Verify records with online tools:
- [MXToolbox SPF Check](https://mxtoolbox.com/spf.aspx)
- [MXToolbox DKIM Check](https://mxtoolbox.com/dkim.aspx)
- [MXToolbox DMARC Check](https://mxtoolbox.com/dmarc.aspx)

**Note:** DNS changes can take up to 48 hours to propagate.

## Contact

- Security reports: security@myapiai.com
- General enquiries: hello@myapiai.com
