

## 12. Audit Log Schema and Retention Policy

### 12.1 Audit Log Schema

All audit log entries MUST conform to the following schema. This ensures consistency, completeness, and facilitates automated analysis and compliance reporting.

| Field Name        | Data Type   | Description                                                                 | Required | Example Value                                             |
|-------------------|-------------|-----------------------------------------------------------------------------|----------|-----------------------------------------------------------|
| `timestamp`         | ISO 8601    | UTC timestamp of the event.                                                 | Yes      | `2026-02-18T21:07:00.123Z`                                  |
| `eventType`         | String      | Category of the event (e.g., `AUTH_SUCCESS`, `API_ACCESS_DENIED`, `DATA_WRITE`). | Yes      | `API_READ`                                                |
| `level`             | String      | Log level (e.g., `INFO`, `WARN`, `ERROR`, `CRITICAL`).                    | Yes      | `INFO`                                                    |
| `actorId`           | String      | Unique identifier of the user/system performing the action.                 | Yes      | `user-12345` (user ID) or `system-gateway`                |
| `tokenId`           | String      | Unique identifier of the token used for the action (JWT `jti`).           | Yes      | `jwt-abcd1234efgh5678`                                     |
| `sourceIp`          | IP Address  | IP address of the client making the request.                                | Yes      | `203.0.113.45`                                            |
| `userAgent`         | String      | User-Agent string of the client.                                            | No       | `Mozilla/5.0 (macOS; Intel Mac OS X 10_15_7)`             |
| `resourceType`      | String      | Type of resource accessed (e.g., `IDENTITY_DOC`, `PREFERENCE`, `TOKEN`).  | Yes      | `IDENTITY_DOC`                                            |
| `resourceId`        | String      | Unique identifier of the resource accessed.                                 | Yes      | `USER.md` or `pref-engine-configs`                        |
| `action`            | String      | Specific action performed (e.g., `READ`, `WRITE`, `DELETE`, `UPDATE`, `REVOKE`). | Yes      | `READ`                                                    |
| `outcome`           | String      | Result of the action (`SUCCESS`, `FAILURE`, `DENIED`).                    | Yes      | `SUCCESS`                                                 |
| `details`           | JSON Object | Additional context specific to the event.                                   | No       | `{ "endpoint": "/api/identity/USER.md", "method": "GET" }` |
| `error`             | String      | Error message if outcome is FAILURE/DENIED.                                 | No       | `Insufficient scope: identity:write`                      |
| `requestBodyHash`   | String      | SHA256 hash of the request body (for modifications).                      | No       | `abcdef1234567890...`                                     |
| `responseMetadata`  | JSON Object | Metadata about the response (e.g., size, status code).                    | No       | `{ "statusCode": 200, "responseSize": 1200 }`         |
| `newScope`          | Array       | New scopes assigned/requested (for token events).                         | No       | `["identity:read", "connectors:read"]`                |
| `oldScope`          | Array       | Old scopes (for token updates).                                             | No       | `["identity:read"]`                                     |

**Data Type Notes:**
- All strings must be UTF-8 encoded.
- `JSON Object` fields should be properly escaped JSON strings.

### 12.2 Retention Policy

Audit logs are critical for security, compliance, and incident response. The following retention policy ensures logs are kept for a sufficient period while adhering to data minimization principles.

| Log Type                    | Retention Period | Justification                                                 | Storage Location   | Archival Policy                                            |
|-----------------------------|------------------|---------------------------------------------------------------|--------------------|------------------------------------------------------------|
| **Critical Security Events** (P0-P1 Incidents, Token Revocation, Auth Failures) | **5 years**        | Forensic analysis, regulatory compliance (e.g., PCI DSS, HIPAA), long-term threat intelligence. | Secure, off-site, immutable archive | Encrypt, then move to cold storage after 1 year.             |
| **API Access Logs** (All successful/failed API requests) | **2 years**        | General operational auditing, compliance with GDPR/CCPA, troubleshooting. | Secure, online, immutable storage | Encrypt, then move to cold storage after 6 months.           |
| **Data Modification Logs** (WRITE/DELETE actions on Vault data) | **2 years**        | Data integrity verification, non-repudiation, compliance.     | Secure, online, immutable storage | Encrypt, then move to cold storage after 6 months.           |
| **Policy Evaluation Logs** (Brain decisions) | **1 year**         | Debugging, behavior analysis, policy compliance validation.   | Secure, online storage | Encrypt, then move to cold storage after 3 months.           |
| **System Health & Performance** | **6 months**       | Operational monitoring, capacity planning, debugging.         | Online storage     | Automatically purge after 6 months.                        |

**General Principles for Retention:**
- **Immutable Storage:** All logs, once created, must be stored in an append-only, tamper-proof system (e.g., WORM - Write Once Read Many storage, dedicated log aggregation service with integrity checks).
- **Encryption at Rest:** All stored logs, both active and archived, must be encrypted using AES-256-GCM with robust key management.
- **Access Control:** Access to raw audit logs must be highly restricted and require multi-factor authentication. Access itself must be logged.
- **PII Redaction:** Sensitive Personally Identifiable Information (PII) beyond `actorId` and `sourceIp` (if applicable and necessary) must be redacted or masked during log generation to comply with GDPR/CCPA.
- **Automated Purging:** Automated processes must be in place to purge logs that have exceeded their retention period from all storage tiers.
- **Backup and Disaster Recovery:** Logs must be included in the overall backup and disaster recovery plan to ensure availability and recoverability.
- **Regular Review:** The audit log schema and retention policy will be reviewed annually by the Security Engineering and Privacy Officer teams to ensure ongoing relevance and compliance with evolving regulations.