# Encryption Key Rotation Policy

> SOC 2 Phase 3.1 — C1 Confidentiality criterion  
> Last Updated: 2026-04-11

---

## Overview

This policy defines the schedule, procedure, and audit requirements for rotating encryption keys
used to protect OAuth tokens and vault tokens stored in the MyApi database.

All encrypted fields use AES-256-GCM with PBKDF2 key derivation (600k iterations).
Key versions are tracked in the `encryption_keys` / `key_versions` tables.

---

## Rotation Schedule

| Key | Rotation cadence | Next due |
|-----|-----------------|----------|
| `VAULT_KEY` (OAuth + vault token encryption) | **Quarterly** | 2026-07-01 |
| `ENCRYPTION_KEY` (field-level PII) | Quarterly | 2026-07-01 |
| `JWT_SECRET` (session signing) | Annually or on compromise | 2027-01-01 |

**Quarterly dates:** January 1, April 1, July 1, October 1

---

## Rotation Procedure

### Prerequisites
1. Access to the production server with admin credentials.
2. A valid TOTP code if 2FA is enabled on the admin account.
3. A backup of the current database (verify via `/api/v1/admin/backup`).

### Steps

```bash
# 1. Take a pre-rotation backup
curl -X POST https://api.example.com/api/v1/admin/backup \
  -H "Authorization: Bearer $MASTER_TOKEN"

# 2. Generate a new VAULT_KEY (32 random bytes, hex-encoded)
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "New key: $NEW_KEY"   # Store immediately in secrets manager

# 3. Call the rotate-key endpoint (supply TOTP code if 2FA is enabled)
curl -X POST https://api.example.com/api/v1/admin/security/rotate-key \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vaultKey\": \"$NEW_KEY\", \"totpCode\": \"$TOTP\"}"

# Expected response:
# { "ok": true, "newVersion": 2, "tokensRotated": 12, "timestamp": "..." }

# 4. Update VAULT_KEY in the production .env / secrets manager
# (Restart the server to pick up the new key)

# 5. Verify key status
curl https://api.example.com/api/v1/keys/status \
  -H "Authorization: Bearer $MASTER_TOKEN"
```

### Post-Rotation Checks
- [ ] `GET /api/v1/keys/status` shows new version as `active`
- [ ] OAuth service connections still work (test at least one service)
- [ ] `key_rotation` event appears in `compliance_audit_logs`
- [ ] Old key version is marked `retired` in `key_versions` table

---

## Emergency Rotation (On Compromise)

If a key is suspected to be compromised:

1. Immediately rotate the key using the procedure above.
2. Revoke all active OAuth tokens via the dashboard (Settings → Services → Disconnect All).
3. File an incident report per `docs/INCIDENT_RESPONSE.md`.
4. Notify affected users if their data may have been exposed.

---

## Audit Evidence

For each rotation, capture:
- Timestamp from the API response
- `newVersion` and `tokensRotated` values
- `compliance_audit_logs` entry with `action = 'key_rotation'`

Store this evidence in the SOC 2 evidence package (`docs/SOC2_EVIDENCE.md`).

---

## Key Storage Requirements

- `VAULT_KEY` must be stored in a dedicated secrets manager (AWS Secrets Manager, HashiCorp Vault, or equivalent).
- Keys must **never** appear in git history, log files, or API responses.
- The previous key must be retained in the secrets manager for at least 30 days after rotation
  (to decrypt any token that was missed during rotation) before being destroyed.
