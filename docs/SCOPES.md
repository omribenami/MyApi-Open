# MyApi Scope Reference

## Overview

MyApi implements a hierarchical permission model with fine-grained scopes for guest access tokens. This allows you to delegate limited access to external agents without exposing full permissions.

## Scope Architecture

### Core Scopes

Individual scopes are organized by resource category:

#### Identity Scopes
- `identity:read` — Read user identity information (name, role, company, etc.)
- `identity:write` — Write/modify user identity information

#### Vault Scopes
- `vault:read` — Read vault tokens (without accessing the actual token values)
- `vault:write` — Create, update, delete vault tokens

#### Services Scopes
- `services:read` — List service connectors (GitHub, Google, etc.)
- `services:write` — Create, update, delete service connectors

#### Brain Scopes
- `brain:chat` — Chat with brain AI (create conversations, send messages)
- `brain:read` — Read conversations, context, knowledge base documents

#### Audit Scopes
- `audit:read` — Read audit logs of API access and actions

#### Personas Scopes
- `personas:read` — Read persona definitions (SOUL.md variants)
- `personas:write` — Create, update, delete personas

#### Admin Scope
- `admin:*` — Full admin access (grants ALL scopes, overrides restrictions)

### Scope Hierarchy

**Admin Override:**
- If a token has `admin:*`, it automatically grants all other scopes
- No other scope checks are performed
- Intended for master token and trusted administrators only

### Scope Templates (Convenience)

Instead of listing individual scopes, use templates for common patterns:

- **`read`** — All read-only endpoints
  - Expands to: `identity:read`, `vault:read`, `services:read`, `brain:read`, `audit:read`
  
- **`professional`** — Professional info access
  - Expands to: `identity:read` (limited to name, role, company, skills, education)
  
- **`availability`** — Calendar/timezone access
  - Expands to: `identity:read` (limited to availability, timezone, calendar)
  
- **`guest`** — Minimal read-only access
  - Expands to: `identity:read` (limited to user name and role only)
  
- **`admin`** — Full administrative access
  - Expands to: `admin:*`
  
- **`custom`** — User-defined scope list (you specify individual scopes)

## API Endpoints

### Token Management

#### Create Token with Scopes
```bash
POST /api/v1/tokens
Authorization: Bearer {master_token}
Content-Type: application/json

{
  "label": "AI Agent Token",
  "scopes": ["identity:read", "brain:chat"],
  "expiresInHours": 24,
  "description": "Token for external AI agent"
}
```

Or use a template:
```json
{
  "label": "Read-only Token",
  "scopes": "read",
  "expiresInHours": 7
}
```

**Response:**
```json
{
  "data": {
    "id": "tok_abc123...",
    "token": "9ff89b2d70bd...",
    "scopes": ["identity:read", "brain:chat"],
    "label": "AI Agent Token",
    "description": "Token for external AI agent",
    "createdAt": "2026-02-27T10:00:00Z",
    "expiresAt": "2026-02-28T10:00:00Z"
  }
}
```

#### Get Token Details
```bash
GET /api/v1/tokens/{token_id}
Authorization: Bearer {master_token}
```

**Response:**
```json
{
  "data": {
    "id": "tok_abc123...",
    "label": "AI Agent Token",
    "description": "Token for external AI agent",
    "scopes": ["identity:read", "brain:chat"],
    "createdAt": "2026-02-27T10:00:00Z",
    "expiresAt": "2026-02-28T10:00:00Z",
    "revokedAt": null,
    "active": true
  }
}
```

#### List All Tokens
```bash
GET /api/v1/tokens
Authorization: Bearer {master_token}
```

**Response:**
```json
{
  "data": [
    {
      "tokenId": "tok_abc123...",
      "label": "AI Agent Token",
      "scopes": ["identity:read", "brain:chat"],
      "createdAt": "2026-02-27T10:00:00Z",
      "expiresAt": "2026-02-28T10:00:00Z",
      "active": true
    },
    {
      "tokenId": "tok_def456...",
      "label": "Read-only Token",
      "scopes": ["identity:read", "vault:read", "services:read", "brain:read", "audit:read"],
      "createdAt": "2026-02-25T10:00:00Z",
      "expiresAt": null,
      "active": true
    }
  ]
}
```

#### Update Token Scopes
```bash
PUT /api/v1/tokens/{token_id}
Authorization: Bearer {master_token}
Content-Type: application/json

{
  "scopes": ["identity:read", "vault:read"]
}
```

**Response:**
```json
{
  "data": {
    "id": "tok_abc123...",
    "scopes": ["identity:read", "vault:read"],
    "updatedAt": "2026-02-27T11:00:00Z"
  }
}
```

#### Revoke Token
```bash
DELETE /api/v1/tokens/{token_id}
Authorization: Bearer {master_token}
```

**Response:**
```json
{
  "data": {
    "tokenId": "tok_abc123...",
    "revoked": true
  }
}
```

### Scope Queries

#### List Available Scopes
```bash
GET /api/v1/scopes
Authorization: Bearer {master_token}
```

**Response:**
```json
{
  "data": {
    "scopes": [
      {
        "name": "identity:read",
        "description": "Read user identity information",
        "category": "identity",
        "permissions": null
      },
      {
        "name": "identity:write",
        "description": "Write user identity information",
        "category": "identity",
        "permissions": null
      },
      ...
    ],
    "templates": {
      "read": ["identity:read", "vault:read", "services:read", "brain:read", "audit:read"],
      "professional": ["identity:read"],
      "availability": ["identity:read"],
      "guest": ["identity:read"],
      "admin": ["admin:*"]
    }
  }
}
```

## Scope Validation

### How Scopes are Checked

1. **Authentication First**: Token must be valid and not revoked
2. **Scope Check**: Endpoint checks if token has required scope(s)
3. **Hierarchy**: `admin:*` overrides all individual scope checks
4. **Error Response**: Returns `403 Forbidden` if insufficient scope

### Example: Checking Endpoint Access

```javascript
// If token has admin:*
token.scopes = ["admin:*"]
// Can access ANY endpoint ✓

// If token has specific scopes
token.scopes = ["identity:read", "brain:chat"]
// Can access:
//   - GET /api/v1/identity ✓
//   - POST /api/v1/brain/chat ✓
//   - GET /api/v1/vault/tokens ✗ (need vault:read)
//   - POST /api/v1/vault/tokens ✗ (need vault:write)
```

### Endpoint-to-Scope Mapping

| Endpoint | Method | Required Scope |
|----------|--------|----------------|
| `/api/v1/identity` | GET | `identity:read` |
| `/api/v1/identity/professional` | GET | `identity:read` |
| `/api/v1/identity/availability` | GET | `identity:read` |
| `/api/v1/vault/tokens` | GET | `vault:read` |
| `/api/v1/vault/tokens` | POST | `vault:write` |
| `/api/v1/connectors` | GET | `services:read` |
| `/api/v1/connectors` | POST | `services:write` |
| `/api/v1/brain/chat` | POST | `brain:chat` |
| `/api/v1/brain/conversations` | GET | `brain:read` |
| `/api/v1/audit` | GET | `audit:read` |
| `/api/v1/personas` | GET/POST | `personas:read`/`personas:write` |

## Security Best Practices

### 1. Principle of Least Privilege
Grant only the minimum scopes needed:
```bash
# ✓ Good: Specific scopes
scopes: ["identity:read", "brain:chat"]

# ✗ Avoid: Overly broad
scopes: "admin"
```

### 2. Token Expiration
Always set expiration for guest tokens:
```bash
# ✓ Good: Time-limited
expiresInHours: 24

# ✗ Avoid: Never expires
# (no expiresInHours parameter)
```

### 3. Scope Rotation
Periodically update token scopes to revoke unnecessary permissions:
```bash
# Revoke old scopes and grant new ones
PUT /api/v1/tokens/{id}
{ "scopes": ["identity:read"] }
```

### 4. Audit Trails
All scope violations are logged to the audit log with action: `scope_violation`
```bash
GET /api/v1/audit?action=scope_violation
```

### 5. No Scope Info in Errors
Scope requirements are NOT revealed in error responses (security):
```json
// ✓ Safe: Generic error
{ "error": "Forbidden", "message": "Insufficient scope for this endpoint" }

// ✗ Unsafe: Leaks information
{ "error": "Forbidden", "message": "This endpoint requires: identity:write, vault:read" }
```

## Common Workflows

### 1. Onboard External AI Agent

```bash
# 1. Create token with minimal scopes
curl -X POST http://localhost:4500/api/v1/tokens \
  -H "Authorization: Bearer {master_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Claude Agent",
    "scopes": ["identity:read", "brain:chat"],
    "expiresInHours": 24,
    "description": "Limited token for Claude integration"
  }'

# Response includes the token to share with agent
# Token expires in 24 hours automatically
```

### 2. Grant Read-Only Access

```bash
# Create token with all read scopes
curl -X POST http://localhost:4500/api/v1/tokens \
  -H "Authorization: Bearer {master_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Monitor",
    "scopes": "read",
    "expiresInHours": 720
  }'

# Can access all GET endpoints, no POST/PUT/DELETE
```

### 3. Revoke Emergency Access

```bash
# Immediately revoke a compromised token
curl -X DELETE http://localhost:4500/api/v1/tokens/{token_id} \
  -H "Authorization: Bearer {master_token}"

# Token is immediately invalid
# All scope associations are removed
```

### 4. Scope Audit

```bash
# Check what a token can access
curl http://localhost:4500/api/v1/tokens/{token_id} \
  -H "Authorization: Bearer {master_token}"

# View recent scope violations
curl "http://localhost:4500/api/v1/audit?action=scope_violation" \
  -H "Authorization: Bearer {master_token}"
```

## Error Responses

### Invalid Scope
```json
{
  "error": "Invalid scope: brain:invalid",
  "message": "Must be one of: identity:read, identity:write, vault:read, vault:write, services:read, services:write, brain:chat, brain:read, audit:read, personas:read, personas:write, admin:*"
}
```

### Missing Required Scope
```json
{
  "error": "Forbidden",
  "message": "Insufficient scope for this endpoint"
}
```

### Token Not Found
```json
{
  "error": "Token not found"
}
```

### Expired Token
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

## Migration from Old Model

If you have existing tokens using the old simple scope model:

**Old Model:**
```json
{ "scope": "read" }
{ "scope": "professional" }
{ "scope": "full" }
```

**New Model:**
```json
{ "scopes": ["identity:read", "vault:read", "services:read", "brain:read", "audit:read"] }
{ "scopes": ["identity:read"] }
{ "scopes": ["admin:*"] }
```

The system automatically handles mapping for backward compatibility.

## FAQ

**Q: Can a token have `admin:*` plus specific scopes?**
A: Yes, but `admin:*` overrides all restrictions, so the other scopes are redundant.

**Q: What happens if a token expires?**
A: The token becomes invalid and returns 401 Unauthorized. No access is granted.

**Q: Can I update a token's label or description?**
A: Currently only scopes can be updated. For other changes, revoke and recreate.

**Q: Does scope apply to webhook/event delivery?**
A: Events are delivered to the requester IP/user, not enforced separately.

**Q: Can scopes be time-based or conditional?**
A: Currently scopes are static. Time-based revocation happens via token expiration.

## References

- [Main API Reference](../README.md)
- [Database Schema](../src/database.js)
- [Scope Validator Middleware](../src/middleware/scope-validator.js)
- [Audit Logging](../src/index.js#L1200-L1250)
