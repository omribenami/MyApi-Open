# PHASE 6B: RBAC Middleware & Code Reviewer Gating
## Implementation Documentation

**Timeline**: March 21, 2026  
**Status**: Complete  
**Dependencies**: Phase 6A (RBAC Schema)

---

## Overview

Phase 6B implements the enforcement layer for Role-Based Access Control (RBAC) and integrates Claude Opus 4.6 as a Code Reviewer for schema deployments and critical code changes.

This phase bridges the gap between policy definition (Phase 6A schema) and enforcement, creating a secure deployment pipeline with:
- **RBAC Middleware**: Enforces role/permission checks on every protected endpoint
- **Code Review Gating**: Requires manual approval for schema migrations and deployments
- **Opus 4.6 Integration**: Async code review pipeline with Opus as the reviewer
- **Audit Logging**: Complete audit trail of all access control decisions

---

## Architecture

```
User Request
    ↓
Authentication Middleware (existing)
    ↓
RBAC Middleware (NEW)
    ├─ requireRole() → Check user has required role
    ├─ requirePermission() → Check user has specific permission
    └─ auditLog() → Log all access control decisions
    ↓
Code Review Gate Middleware (NEW - for protected resources)
    ├─ Check if resource requires review
    ├─ If yes → Submit to Opus, return 202 ACCEPTED
    └─ If no → Proceed normally
    ↓
Route Handler
    ↓
Response
```

---

## Components

### 1. RBAC Middleware (`src/middleware/rbac.js`)

**Provides:**
- `requireRole(roles)` - Middleware factory for role-based access
- `requirePermission(permission)` - Middleware for permission-based access
- `auditLog(action)` - Middleware to log all access attempts
- `roleManagement` - Helper functions for role/permission operations

**Usage:**

```javascript
// In your routes
const { createRBACMiddleware } = require('../middleware/rbac');
const rbac = createRBACMiddleware(db);

// Protect an endpoint with role requirement
app.get('/admin/users', rbac.requireRole(['admin']), (req, res) => {
  // Handler code
});

// Protect with permission requirement
app.post('/code-review/:id/approve', rbac.requirePermission('code:approve'), (req, res) => {
  // Handler code
});

// Log all attempts to access a resource
app.get('/sensitive-data', rbac.auditLog('sensitive_data_access'), (req, res) => {
  // Handler code
});
```

**Key Features:**
- Admin role automatically bypasses all checks
- Workspace-scoped: Users have different roles in different workspaces
- Audit logging included in every check
- 403 Forbidden returned for denied access

**Database Tables Used:**
- `users` - User records
- `roles` - Role definitions per workspace
- `user_roles` - User-to-role assignments
- `permissions` - Permission definitions
- `role_permissions` - Role-to-permission assignments
- `audit_log` - Access control audit trail

---

### 2. Code Review Gating (`src/middleware/codeReviewGate.js`)

**Provides:**
- `requireCodeReview(resource)` - Middleware to gate code requiring review
- `getReviewStatus()` - Endpoint to check review status
- `approveCodeReview()` - Endpoint to approve code (Code Reviewer role)
- `rejectCodeReview()` - Endpoint to reject code with reason
- `executeApprovedCode()` - Endpoint to execute after approval

**Usage:**

```javascript
const { createCodeReviewGateMiddleware } = require('../middleware/codeReviewGate');
const gate = createCodeReviewGateMiddleware(db, codeReviewService);

// Any deployment of schema/code goes through review gate
app.post('/api/v1/migrations/deploy',
  authenticate,
  rbac.requireRole(['admin']),
  gate.requireCodeReview('schema'),
  (req, res) => {
    // Handler receives 202 ACCEPTED if review required
    // Or continues normally if no review needed
  }
);
```

**Workflow:**

1. **Submit Code for Review** (POST /migrations/deploy)
   ```
   Request: {
     name: "add-user-roles",
     migration: "ALTER TABLE users ADD COLUMN role TEXT;"
   }
   Response: 202 ACCEPTED {
     reviewRequestId: "uuid",
     statusCheckEndpoint: "/api/v1/code-review/{id}/status"
   }
   ```

2. **Opus Review** (Async)
   - Submission is sent to Claude Opus 4.6
   - Opus reviews for security, performance, architecture issues
   - Results stored in `code_reviews` table

3. **Check Status** (GET /code-review/{id}/status)
   ```
   Response: {
     status: "pending|approved|rejected",
     notes: "Review findings",
     approvedBy: "opus-4.6"
   }
   ```

4. **Approve/Reject** (POST /code-review/{id}/approve or /reject)
   - Code Reviewer role required
   - If approved: Code scheduled for deployment
   - If rejected: Developer notified with reason

5. **Execute** (Automatic after approval)
   - Migration/deployment executed
   - Audit log updated with executor info
   - Notifications sent to interested parties

**Database Tables Used:**
- `code_reviews` - Review requests and results
- `migration_queue` - Migration metadata and status
- `audit_log` - Review decisions logged

---

### 3. Code Review Service (`src/services/codeReviewService.js`)

**Integrates Claude Opus 4.6 for async code reviews**

**Provides:**
- `submitCodeReview()` - Send code to Opus for review
- `getReviewStatus()` - Check review result
- `getPendingReviews()` - List pending reviews
- `handleOpusCallback()` - Webhook for Opus results

**Review Criteria:**
```
Security Issues
  ├─ SQL injection, XSS vulnerabilities
  ├─ Authentication/Authorization flaws
  └─ Sensitive data exposure

Architecture & Best Practices
  ├─ Code structure and modularity
  ├─ Error handling
  └─ Logging adequacy

Performance
  ├─ N+1 queries
  ├─ Inefficient algorithms
  └─ Memory leaks

Testing
  ├─ Test coverage
  └─ Edge case handling

Database Concerns
  ├─ Schema design
  ├─ Migration safety
  └─ Data integrity
```

**Review Result Format:**
```javascript
{
  approved: true|false,
  criticalIssues: ["issue1", "issue2"],
  recommendations: ["recommendation1"],
  summary: "Human-readable summary",
  confidence: "high|medium|low"
}
```

---

### 4. Admin Routes (`src/routes/admin.js`)

**Protected endpoints for RBAC management**

**Endpoints:**
```
GET    /api/v1/admin/users                           - List users with roles
POST   /api/v1/admin/users/:id/role                  - Assign user to role
DELETE /api/v1/admin/users/:id/role/:roleId          - Remove user from role
GET    /api/v1/admin/roles                           - List roles with permissions
POST   /api/v1/admin/roles/:id/permissions/:pId/grant - Grant permission to role
DELETE /api/v1/admin/roles/:id/permissions/:pId      - Revoke permission from role
GET    /api/v1/admin/permissions                     - List all permissions
```

**All require admin role**

**Example: List Users with Roles**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.myapi.com/api/v1/admin/users
```

Response:
```json
{
  "status": "success",
  "workspace": "ws-123",
  "users": [
    {
      "id": "user-456",
      "username": "jane.smith",
      "email": "jane.smith@example.com",
      "roles": [
        { "id": "role-789", "name": "developer" }
      ]
    }
  ],
  "total": 1
}
```

---

### 5. Migrations Routes (`src/routes/migrations.js`)

**Schema migration deployment with code review gating**

**Endpoints:**
```
POST   /api/v1/migrations/deploy                     - Submit migration for review
GET    /api/v1/migrations/pending-reviews            - List pending reviews
GET    /api/v1/migrations/:id/status                 - Check migration status
POST   /api/v1/migrations/:id/approve                - Approve migration
POST   /api/v1/migrations/:id/reject                 - Reject migration
```

**Example: Deploy Migration**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "add-user-roles",
    "migration": "ALTER TABLE users ADD COLUMN role TEXT DEFAULT '\''viewer'\'';",
    "description": "Add role column to support RBAC"
  }' \
  https://api.myapi.com/api/v1/migrations/deploy
```

Response:
```json
{
  "status": "accepted",
  "message": "Schema migration submitted for code review",
  "reviewRequestId": "review-uuid",
  "resource": "schema",
  "expectedReviewTime": "5-15 minutes",
  "statusCheckEndpoint": "/api/v1/migrations/review-uuid/status",
  "approveEndpoint": "/api/v1/migrations/review-uuid/approve"
}
```

---

## Database Schema

### New Tables

**code_reviews**
```sql
CREATE TABLE code_reviews (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,  -- 'schema', 'deployment', 'feature'
  code_content TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'approved', 'rejected', 'executed', 'error'
  review_notes TEXT,
  review_data TEXT,  -- JSON with detailed results
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  executed_at TEXT,
  approved_by TEXT,  -- 'opus-4.6' or user ID
  opus_session_id TEXT
);
```

**migration_queue**
```sql
CREATE TABLE migration_queue (
  id TEXT PRIMARY KEY,
  code_review_id TEXT NOT NULL,  -- Links to code_reviews
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending_review', 'approved', 'executed', 'failed'
  created_at TEXT NOT NULL,
  approved_at TEXT,
  executed_at TEXT,
  failure_reason TEXT
);
```

### Existing Tables (Phase 6A)

- `users` - User records
- `roles` - Role definitions (workspace-scoped)
- `permissions` - Permission definitions (global)
- `user_roles` - User-to-role assignments
- `role_permissions` - Role-to-permission assignments
- `audit_log` - Access control audit trail

---

## Default Permissions

Seeded during migration 003:

```
code:review          - Review code before deployment
code:approve         - Approve code for deployment
migration:deploy     - Deploy schema migrations
users:read           - View user information
users:write          - Modify user information
users:delete         - Delete users
roles:read           - View roles
roles:write          - Create/modify roles
permissions:grant    - Grant permissions to roles
audit:read           - View audit logs
workspace:admin      - Full workspace administration
```

---

## Integration with index.js

**Add to main Express app:**

```javascript
const { createRBACMiddleware } = require('./middleware/rbac');
const { createCodeReviewGateMiddleware } = require('./middleware/codeReviewGate');
const createAdminRoutes = require('./routes/admin');
const createMigrationsRoutes = require('./routes/migrations');
const CodeReviewService = require('./services/codeReviewService');

// Initialize middleware
const rbac = createRBACMiddleware(db);
const codeReviewService = new CodeReviewService(db);
const codeReviewGate = createCodeReviewGateMiddleware(db, codeReviewService);

// Register admin routes
app.use('/api/v1/admin',
  authenticate,
  rbac.requireRole(['admin']),
  createAdminRoutes(db, rbac)
);

// Register migration routes
app.use('/api/v1/migrations',
  authenticate,
  rbac.requireRole(['admin']),
  createMigrationsRoutes(db, codeReviewGate)
);

// Code review status/approval endpoints
app.get('/api/v1/code-review/:id/status',
  authenticate,
  codeReviewGate.getReviewStatus
);

app.post('/api/v1/code-review/:id/approve',
  authenticate,
  rbac.requirePermission('code:approve'),
  codeReviewGate.approveCodeReview
);

app.post('/api/v1/code-review/:id/reject',
  authenticate,
  rbac.requirePermission('code:approve'),
  codeReviewGate.rejectCodeReview
);

// Opus webhook (optional, for production)
app.post('/api/v1/webhooks/code-review',
  async (req, res) => {
    try {
      const result = await codeReviewService.handleOpusCallback(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
```

---

## Testing

**Run tests:**
```bash
npm test tests/rbac.test.js
```

**Test Coverage:**
- ✅ RBAC role checks (allow/deny)
- ✅ Permission checks
- ✅ Audit logging (success/failure)
- ✅ Admin endpoints (list, assign, revoke)
- ✅ Code review gating (submit, approve, reject)
- ✅ Real-world scenarios (developer workflow)

---

## Usage Example: Complete Workflow

### Scenario: Developer deploys schema migration

**1. Developer submits migration for review**
```bash
curl -X POST \
  -H "Authorization: Bearer $DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "add-workspace-multitenancy",
    "migration": "ALTER TABLE users ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);"
  }' \
  https://api.myapi.com/api/v1/migrations/deploy
```

**Response: 202 ACCEPTED**
```json
{
  "status": "accepted",
  "reviewRequestId": "review-abc123",
  "statusCheckEndpoint": "/api/v1/migrations/review-abc123/status"
}
```

**2. Developer checks review status**
```bash
curl -H "Authorization: Bearer $DEVELOPER_TOKEN" \
  https://api.myapi.com/api/v1/migrations/review-abc123/status
```

**Response (still pending):**
```json
{
  "reviewStatus": "pending",
  "createdAt": "2026-03-21T10:00:00Z",
  "expectedReviewTime": "5-15 minutes"
}
```

**3. Opus reviews code asynchronously**
- Reviews for security issues
- Checks for schema design best practices
- Verifies migration safety
- Returns: APPROVED or REJECTED with findings

**4. Code Reviewer checks pending reviews**
```bash
curl -H "Authorization: Bearer $REVIEWER_TOKEN" \
  https://api.myapi.com/api/v1/migrations/pending-reviews
```

**5. Code Reviewer approves migration**
```bash
curl -X POST \
  -H "Authorization: Bearer $REVIEWER_TOKEN" \
  https://api.myapi.com/api/v1/migrations/review-abc123/approve
```

**6. Migration automatically executes**
- Schema change applied
- Execution logged
- Notifications sent
- Audit trail recorded

---

## Security Considerations

### Admin Role Bypass
Admin users bypass all RBAC checks. This is intentional for administrative operations. However:
- All admin actions are logged
- Audit logs can be reviewed
- Admin actions trigger notifications

### Code Review Integration
Code review requirements are **mandatory** for:
- All schema migrations
- All deployments to production
- All changes to audit/security systems

### Workspace Isolation
- Roles are workspace-scoped
- Users can have different roles in different workspaces
- Permissions are global but enforced per workspace
- Audit logs include workspace context

### Permission Naming Convention
Permissions follow `resource:action` pattern:
- `code:review` - Review code
- `code:approve` - Approve code
- `migration:deploy` - Deploy migrations
- `users:delete` - Delete users

This makes permission checks consistent and easily understandable.

---

## Audit Trail Example

**All access decisions are logged:**

```javascript
{
  id: "audit-789",
  user_id: "user-456",
  action: "permission_check",
  resource: "/admin/users",
  permission: "users:read",
  granted: true,  // 1 or 0
  timestamp: "2026-03-21T10:00:00Z",
  ip_address: "203.0.113.42",
  method: "GET",
  workspace_id: "ws-123"
}
```

**Denied attempts are also logged:**

```javascript
{
  id: "audit-790",
  user_id: "user-999",
  action: "role_check",
  resource: "/admin/users",
  granted: false,  // Access denied
  timestamp: "2026-03-21T10:01:00Z",
  ip_address: "203.0.113.50",
  method: "GET",
  details: {
    requiredRoles: "admin",
    userRoles: "viewer"
  }
}
```

---

## Future Enhancements

### Phase 6C: Planned
- [ ] Role hierarchy (roles can inherit from other roles)
- [ ] Time-based permissions (access valid only during certain hours)
- [ ] Resource-level permissions (granular control per resource)
- [ ] Delegation (ability to delegate permissions)
- [ ] Approval workflows (multiple approvers)

### Integration Points
- **Notifications**: Alert on code review results
- **Webhooks**: Integrate with external CI/CD systems
- **Analytics**: Dashboard for access patterns
- **Compliance**: Export audit logs for regulatory requirements

---

## Git Commits

### Commit 1: RBAC Middleware Foundation
```
feat(rbac): implement role-based access control middleware

- Add requireRole() middleware for role-based endpoint protection
- Add requirePermission() middleware for permission-based access
- Add auditLog() middleware for access control audit trail
- Include roleManagement helper functions
- Middleware factory pattern for database injection

Files: src/middleware/rbac.js
```

### Commit 2: Code Review Gating System
```
feat(code-review): integrate Claude Opus 4.6 as code reviewer

- Implement requireCodeReview() middleware for gating code deployment
- Add async polling for Opus review results
- Implement approval/rejection endpoints (Code Reviewer role)
- Create code review service with Opus integration
- Support webhook callbacks from Opus

Files:
  src/middleware/codeReviewGate.js
  src/services/codeReviewService.js
```

### Commit 3: Admin & Migration Routes
```
feat(routes): add protected admin and migration endpoints

- Create /admin/users endpoints for user role management
- Create /admin/roles endpoints for permission management
- Create /migrations/deploy endpoint with code review gating
- Implement approval workflow for schema migrations
- Add status check endpoints for reviews

Files:
  src/routes/admin.js
  src/routes/migrations.js
```

### Commit 4: Database Schema & Tests
```
feat(db): add code review tables and permissions

- Create code_reviews table for tracking review requests
- Create migration_queue table for migration metadata
- Seed default permissions for RBAC
- Add comprehensive test suite for all features

Files:
  src/migrations/003_create_code_review_tables.sql
  tests/rbac.test.js
```

---

## Troubleshooting

**Issue: User gets 403 even though they have the role**
- Check workspace_id in session matches user_roles
- Verify role exists in database
- Check audit_log for actual permission check result
- Admin role requires explicit role assignment, no special treatment

**Issue: Code review not returning 202**
- Ensure resource requires review (schema, deployment, etc.)
- Check code_content is not empty in request body
- Verify codeReviewService is initialized
- Check Opus service is reachable

**Issue: Migration not executing after approval**
- Check code_reviews status is 'approved'
- Verify execution endpoint is called
- Check database for error state
- Review audit_log for execution details

---

## References

- **Phase 6A**: RBAC Schema Design
- **Audit Logging**: Activity audit trail
- **Claude Opus 4.6**: Code review integration

---

**Last Updated**: March 21, 2026  
**Status**: COMPLETE ✅
