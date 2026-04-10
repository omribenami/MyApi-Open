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

## Contact

- Security reports: security@myapiai.com
- General enquiries: hello@myapiai.com
