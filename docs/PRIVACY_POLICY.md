# Privacy Policy

**Last Updated:** March 26, 2026  
**Effective Date:** March 26, 2026

## 1. Introduction

MyApi ("we," "us," "our," or "Company") operates the MyApi platform (the "Service"). This Privacy Policy explains our data collection, usage, and protection practices.

**We are committed to:**
- Protecting your personal data
- Being transparent about how we use your information
- Complying with GDPR, CCPA, and other privacy regulations
- Giving you control over your data

---

## 2. What Data We Collect

### 2.1 Information You Provide Directly

**Account Registration:**
- Email address
- Username
- Password (hashed, never stored plaintext)
- Display name (optional)
- Avatar/profile picture (optional)
- Timezone (optional)

**Service Connections:**
- OAuth tokens from connected services (Google, GitHub, LinkedIn, etc.)
- Service-specific user IDs and profile information
- API keys or credentials you provide

**Team & Workspace:**
- Team member information
- Workspace settings and configurations
- Invitations and membership data

**Communication:**
- Messages in team collaboration features
- Notifications and preferences
- Support tickets (if you contact us)

### 2.2 Information Automatically Collected

**Usage Data:**
- IP address
- Browser type and version
- Device information (User-Agent)
- Pages accessed and time spent
- Referral sources
- Clicks and interactions

**Authentication & Security:**
- Login timestamps and locations
- 2FA authentication events
- Device approval fingerprints
- Session information

**API Activity:**
- API calls made through your account
- Service connections and disconnections
- Token creation and revocation events
- Rate limiting events

---

## 3. How We Use Your Data

### 3.1 To Provide the Service
- Authenticate your account
- Store and manage your settings
- Connect to OAuth services on your behalf
- Process your API requests
- Send notifications
- Manage team memberships

### 3.2 To Improve the Service
- Analyze usage patterns (anonymized)
- Identify bugs and errors
- Develop new features
- Optimize performance
- Conduct A/B testing

### 3.3 For Security & Compliance
- Detect and prevent fraud
- Enforce our Terms of Service
- Comply with legal obligations
- Protect against unauthorized access
- Investigate security incidents
- Maintain audit logs

### 3.4 For Communications
- Send transactional emails (login, password reset)
- Send notifications you've subscribed to
- Respond to support requests
- Announce important changes

### 3.5 We DO NOT
- Sell your personal data to third parties
- Share your data for marketing purposes
- Use your data to create detailed user profiles
- Train AI models on your private data
- Share OAuth tokens with third parties

---

## 4. Data Storage & Protection

### 4.1 Where Your Data Is Stored
- **Primary:** AWS/Cloud servers (US-based)
- **Backups:** Encrypted daily backups
- **Retention:** See Section 5

### 4.2 How We Protect Your Data
- **Encryption in Transit:** TLS 1.2+ (HTTPS)
- **Encryption at Rest:** AES-256-GCM for sensitive tokens
- **Authentication:** Multi-factor authentication support
- **Access Control:** Role-based access, workspace isolation
- **Firewalls:** Network security and DDoS protection
- **Monitoring:** Real-time security monitoring

### 4.3 OAuth Token Storage
- OAuth tokens are **encrypted with AES-256** before storage
- Tokens are **never logged in plaintext**
- Tokens are **automatically revoked on logout**
- We do not use your OAuth tokens except:
  - To call the service APIs you've authorized
  - With the exact scopes you've approved
  - In accordance with the service's ToS

---

## 5. Data Retention

| Data Type | Retention Period | Notes |
|-----------|------------------|-------|
| Account Information | Until deletion | User can delete anytime |
| OAuth Tokens | Until disconnected | Auto-deleted on logout |
| Session Data | 7 days | Auto-cleanup, idle sessions |
| Notifications | 30 days | Auto-deleted after 30 days |
| Audit Logs | 90 days | For security investigation |
| Backup Data | 30 days | For disaster recovery |
| API Usage Data | 90 days | For analytics (anonymized) |

**User Deletion:** When you delete your account, all associated data is permanently deleted within 30 days, except audit logs (kept for 90 days for legal compliance).

---

## 6. Your Privacy Rights

### 6.1 GDPR Rights (EU Users)

**You have the right to:**

1. **Access (Article 15)** - Request a copy of all your data
   - Use: Settings → Export Data
   - Format: JSON/ZIP
   - Timeline: Within 30 days

2. **Rectification (Article 16)** - Correct inaccurate data
   - Update: Settings → Profile
   - Or contact: privacy@myapiai.com

3. **Erasure (Article 17)** - Delete your data
   - Use: Settings → Delete Account
   - Timeline: Deleted within 30 days
   - Exceptions: Audit logs kept for 90 days (legal requirement)

4. **Portability (Article 20)** - Export your data in standard format
   - Use: Settings → Export Data
   - Formats: JSON, CSV, ZIP

5. **Object (Article 21)** - Opt-out of certain processing
   - Contact: privacy@myapiai.com

6. **Withdraw Consent (Article 7)** - Withdraw consent anytime
   - Contact: privacy@myapiai.com

### 6.2 CCPA Rights (California Users)

**You have the right to:**

1. **Know** - What personal information is collected
   - Use: Settings → Export Data

2. **Delete** - Request deletion of your data
   - Use: Settings → Delete Account

3. **Opt-Out** - Opt out of data sales (we don't sell)
   - We don't sell personal information

4. **Non-Discrimination** - Not be discriminated for exercising rights
   - Guaranteed

### 6.3 How to Exercise Your Rights

**Self-Service:**
- Account deletion: Settings → Delete Account
- Data export: Settings → Export Data
- Profile update: Settings → Profile

**Via Email:**
- Email: privacy@myapiai.com
- Subject: "[GDPR/CCPA Request] [Your request type]"
- Include: Full name, email, request type, supporting details
- Response time: 30 days (GDPR), 45 days (CCPA)

**Via Mail:**
- MyApi Privacy Team
- [Company Address]

---

## 7. Cookies & Tracking

### 7.1 Session Cookies
- **Purpose:** Keep you logged in
- **Type:** httpOnly (JavaScript cannot access)
- **Duration:** 7 days
- **Name:** `myapi.sid`
- **Required:** Yes (for authentication)

### 7.2 Analytics Cookies
- **Purpose:** Understand how you use MyApi
- **Tools:** Google Analytics (optional)
- **Duration:** Varies by tool
- **Control:** You can disable in browser settings

### 7.3 Do Not Track
- We respect the DNT (Do Not Track) signal
- If you enable DNT, we don't use analytics

---

## 8. Third-Party Services

### 8.1 OAuth Providers
When you connect services (Google, GitHub, etc.):
- You're redirected to their login
- You see their privacy policy and approve scopes
- We receive a token valid only for approved scopes
- We store the token encrypted
- **Your data stays with them** (we don't download your entire profile)

### 8.2 Email Service (Resend)
- Used for: Transactional emails (login, notifications)
- Privacy: [Resend Privacy Policy](https://resend.com/privacy)

### 8.3 Other Integrations
- Cloudflare (DDoS protection, DNS)
- AWS (hosting, backups)
- GitHub (source code hosting)

Each has their own privacy policy. We only share data necessary for the service.

---

## 9. Security & Data Breaches

### 9.1 Security Measures
- HTTPS encryption (TLS 1.2+)
- AES-256 encryption for sensitive data
- Regular security audits
- Intrusion detection monitoring
- Rate limiting to prevent abuse
- Input validation to prevent injection attacks

### 9.2 In Case of a Breach
- **Investigation:** We immediately investigate
- **Notification:** Affected users notified within 72 hours (GDPR)
- **Authority:** Reported to relevant authorities
- **Transparency:** Full disclosure of what happened
- **Support:** We provide credit monitoring if applicable

### 9.3 Report a Security Issue
- Email: security@myapiai.com
- Do NOT post publicly before we respond
- We will acknowledge within 48 hours
- We will provide fixes and timeline

---

## 10. Children's Privacy

MyApi is not intended for users under 13 years old. We do not knowingly collect data from children under 13. If you believe we have collected data from a child, please contact privacy@myapiai.com.

---

## 11. International Data Transfer

We are based in the United States. By using MyApi, you consent to the transfer of your data to the US. We implement appropriate safeguards:
- Standard Contractual Clauses (SCC) for EU data
- Adequacy decisions where applicable
- Data minimization practices

---

## 12. Changes to This Privacy Policy

We may update this policy from time to time. When we make material changes:
- We'll notify you via email
- We'll update the "Last Updated" date
- Material changes require your consent

---

## 13. Contact Us

**For privacy questions or requests:**

- **Email:** privacy@myapiai.com
- **Website:** https://www.myapiai.com/privacy
- **Mailing Address:** 
  MyApi Privacy Team
  [Your Company Address]

**Data Protection Officer (EU):**
- Email: dpo@myapiai.com

**Response Time:**
- General inquiries: 5 business days
- Legal requests: 30 days (GDPR), 45 days (CCPA)

---

## 14. Additional Resources

- [Terms of Service](./TERMS_OF_SERVICE.md)
- [Data Processing Agreement](./DPA.md)
- [Security Information](./docs/SECURITY_AUDIT_PHASE3.md)
- [Incident Response Plan](./INCIDENT_RESPONSE.md)

---

**This Privacy Policy is provided "as-is" and subject to our Terms of Service. If there's any conflict between this policy and our Terms of Service, the Terms of Service will prevail.**

