# Database Schema - Phase 4: Enterprise SSO + RBAC

## Overview

This document describes the database schema for Phase 4 of MyApi, which implements Enterprise Single Sign-On (SSO) and Role-Based Access Control (RBAC).

## Architecture

### Migration System

MyApi uses a file-based migration system for managing database schema changes:

- **Location**: `src/migrations/`
- **Format**: SQL files with numeric prefixes (e.g., `001_create_sso_rbac_schema.sql`)
- **Tracking**: A `migrations` table tracks which migrations have been applied
- **Runner**: `src/lib/migrationRunner.js` handles migration execution and tracking

#### Running Migrations

Migrations are automatically run during application startup via `runMigrations()` in `src/index.js`, called immediately after `initDatabase()`.

#### Manual Migration Check

```javascript
const { runMigrations } = require('./database');
const result = runMigrations();
console.log(result); // Shows applied and failed migrations
```

## Schema Tables

### 1. Roles Table

**Purpose**: Defines custom roles within workspaces

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id),
  UNIQUE(workspace_id, name)
);
```

**Key Points**:
- Roles are workspace-scoped (different workspaces have different role sets)
- Role names are unique per workspace
- Each role tracks who created it and when

**Example Roles**:
- Admin
- Manager
- Developer
- Viewer
- Custom roles per organizational needs

### 2. Permissions Table

**Purpose**: Defines available permissions (capabilities) in the system

```sql
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(resource, action)
);
```

**Key Points**:
- Permissions follow a `resource:action` pattern
- Permissions are global (shared across all workspaces)
- Permissions are created once and reused across roles

**Example Permissions**:
- `workspace:read` - View workspace details
- `workspace:write` - Modify workspace settings
- `users:read` - View users
- `users:write` - Create/modify users
- `roles:read` - View roles
- `roles:write` - Create/modify roles
- `sso:read` - View SSO configurations
- `sso:write` - Modify SSO configurations

### 3. Role-Permissions Junction Table

**Purpose**: Links roles to permissions (many-to-many relationship)

```sql
CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(role_id, permission_id)
);
```

**Key Points**:
- Each role can have multiple permissions
- Each permission can be assigned to multiple roles
- Prevents duplicate assignments

### 4. User-Roles Junction Table

**Purpose**: Links users to roles within workspaces

```sql
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  assigned_by_user_id TEXT REFERENCES users(id),
  UNIQUE(user_id, role_id, workspace_id)
);
```

**Key Points**:
- Users can have multiple roles in the same workspace
- Users can have different role sets in different workspaces
- Tracks who assigned the role and when
- Prevents duplicate role assignments per user/workspace combo

**Example**:
```
User1 + Admin Role + Workspace1
User1 + Manager Role + Workspace2
User2 + Developer Role + Workspace1
```

### 5. SSO Configurations Table

**Purpose**: Stores SSO provider configurations for each workspace

```sql
CREATE TABLE sso_configurations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  config TEXT NOT NULL,
  active INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id),
  UNIQUE(workspace_id, provider)
);
```

**Key Points**:
- Each workspace can configure multiple SSO providers
- Only one provider per workspace (each provider is unique per workspace)
- Configuration is stored as JSON
- Active flag determines which provider is currently in use
- Tracks who created the configuration and when

**Supported Providers**:
- `saml` - SAML 2.0
- `oidc` - OpenID Connect
- `oauth` - OAuth 2.0 delegation

**Example Config (SAML)**:
```json
{
  "entryPoint": "https://idp.example.com/sso",
  "issuer": "myapi",
  "cert": "...",
  "identifierFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  "attributeMapping": {
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "surname": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
  }
}
```

### 6. SSO Sessions Table

**Purpose**: Tracks active SSO sessions for audit and security

```sql
CREATE TABLE sso_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  session_data TEXT,
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
```

**Key Points**:
- Tracks active sessions per user/workspace/provider combo
- Useful for session management and device monitoring
- Supports session revocation (logout)
- Tracks last activity for session timeout logic

### 7. SAML Assertions Table

**Purpose**: Stores SAML assertions for audit and troubleshooting

```sql
CREATE TABLE saml_assertions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assertion_data TEXT NOT NULL,
  attributes TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL
);
```

**Key Points**:
- Useful for debugging SAML authentication issues
- Status values: `success`, `failed`, `pending`
- Stores complete assertion for audit trail
- User may be NULL if assertion couldn't be mapped to a user

### 8. OIDC Tokens Table

**Purpose**: Stores OIDC token information for token rotation and validation

```sql
CREATE TABLE oidc_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  id_token TEXT,
  expires_at TEXT NOT NULL,
  token_metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Key Points**:
- Stores access, refresh, and ID tokens
- Token metadata can store additional claims
- Supports refresh token rotation
- Tracks token expiration for cleanup

## Indexes

All tables include appropriate indexes for common query patterns:

- **Role lookups**: `workspace_id`, `workspace_id + name`
- **Permission lookups**: `resource + action`
- **User-role queries**: `user_id`, `role_id`, `workspace_id`, `user_id + workspace_id`
- **SSO queries**: `workspace_id`, `provider`, `expires_at`
- **Session queries**: `user_id`, `workspace_id`, `expires_at`
- **Audit trail**: `created_at`

## Relationships Diagram

```
┌─────────────────────────────────────────────────┐
│ users                                           │
│ ├─ id (PK)                                      │
│ ├─ username                                     │
│ └─ ...                                          │
└──────────┬──────────────────────────────────────┘
           │
           │ 1-to-many
           │
           ├──────────────────────────────────────┐
           │                                      │
    ┌──────▼────────┐              ┌──────────────▼──────┐
    │ user_roles    │              │ sso_sessions        │
    │ ├─ user_id (FK)             │ ├─ user_id (FK)    │
    │ ├─ role_id (FK) ────────┐   │ ├─ workspace_id(FK)│
    │ ├─ workspace_id (FK) ┐  │   │ └─ provider        │
    │ └─ ...               │  │   └─────────────────────┘
    │                      │  │
    │                      │  └─────────┐
    │                      │            │
    │        ┌─────────────▼──┐         │
    │        │ roles          │         │
    │        │ ├─ id (PK)     │         │
    │        │ ├─ name        │         │
    │        │ └─ workspace_id└─────────┼─────────┐
    │        └──────┬────────┘          │         │
    │               │                   │         │
    │        ┌──────▼────────────────────┘         │
    │        │ role_permissions                   │
    │        │ ├─ role_id (FK)                    │
    │        │ └─ permission_id (FK) ───┐         │
    │        │                           │        │
    │        │                    ┌──────▼────┐   │
    │        │                    │permissions│   │
    │        │                    │ ├─ id     │   │
    │        │                    │ ├─ resource   │
    │        │                    │ └─ action│   │
    │        │                    └──────────┘   │
    │        │                                   │
    │        └───────────────────────────────────┘
    │
    └────────────────────────┬────────────────────┐
                             │                    │
                    ┌────────▼───────┐   ┌────────▼──────────┐
                    │ workspaces     │   │sso_configurations │
                    │ ├─ id (PK)     │   │ ├─ workspace_id   │
                    │ ├─ name        │   │ ├─ provider       │
                    │ └─ ...         │   │ └─ config (JSON)  │
                    └────────────────┘   └───────────────────┘
```

## Data Flow Examples

### Example 1: User Authentication with SAML

1. User logs in via SAML
2. SAML assertion received and stored in `saml_assertions`
3. SSO session created in `sso_sessions`
4. User's roles fetched from `user_roles` join `roles`
5. Role permissions fetched from `role_permissions` join `permissions`
6. User granted access based on permissions

### Example 2: Creating a Custom Role

1. Admin clicks "Create Role" in UI
2. New role created in `roles` table with `workspace_id` and admin's `user_id`
3. Admin selects permissions
4. Permissions linked in `role_permissions` table
5. Admin assigns role to users via `user_roles`

### Example 3: Setting Up SSO for Workspace

1. Admin navigates to workspace SSO settings
2. Selects "Configure SAML"
3. Enters SAML configuration (entity ID, endpoint, certificate, etc.)
4. Configuration saved to `sso_configurations` with `active = 0`
5. Admin tests and then activates
6. Configuration updated with `active = 1`

## Cleanup & Maintenance

### Expired Session Cleanup

SAML assertions and SSO sessions older than retention period should be cleaned up:

```javascript
function cleanupExpiredSessions(retentionDays = 90) {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  
  // Cleanup old SAML assertions
  db.prepare(`
    DELETE FROM saml_assertions WHERE created_at < ?
  `).run(cutoffDate);
  
  // Cleanup revoked sessions older than retention period
  db.prepare(`
    DELETE FROM sso_sessions WHERE revoked_at < ?
  `).run(cutoffDate);
}
```

## Future Extensions

These tables support future enhancements:

1. **Attribute-Based Access Control (ABAC)**: Add condition rules to permissions
2. **Time-Based Access**: Add time windows to user_roles
3. **MFA Enforcement**: Add mfa_required flag to roles or sso_sessions
4. **Audit Compliance**: Extend saml_assertions and sso_sessions for compliance reporting
5. **Multi-Factor Recovery**: Store recovery codes linked to users
6. **Just-In-Time Provisioning**: Automatically create users from SSO assertions

## Performance Considerations

1. **User Role Resolution**: `user_id + workspace_id` index enables fast permission checks
2. **Session Lookups**: `expires_at` index supports efficient session cleanup queries
3. **Config Reads**: SSO configurations are likely cached; consider materialized view for frequent checks
4. **Permission Checks**: Consider caching role-permission mappings per user per workspace

## Testing

See `docs/DATABASE_SCHEMA_PHASE4.md` for test cases and examples.

## Related Files

- Migration runner: `src/lib/migrationRunner.js`
- Database functions: `src/database.js` (functions prefixed with `create/get/update/delete` for RBAC)
- API endpoints: `src/routes/` (to be implemented in Phase 4)
- RBAC middleware: `src/middleware/` (to be implemented in Phase 4)
