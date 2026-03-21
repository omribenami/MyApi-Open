-- Migration 003: Create Code Review and Migration Queue Tables
-- Phase 6B: RBAC Middleware & Code Reviewer Gating
-- Created: 2026-03-21

-- ============================================================================
-- CODE_REVIEWS TABLE
-- ============================================================================
-- Tracks code review requests and their status
-- Used for schema migrations, feature deployments, and any code that requires review
-- Integrates with Claude Opus 4.6 as the code reviewer
CREATE TABLE IF NOT EXISTS code_reviews (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'schema', 'deployment', 'migration', 'feature'
  code_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'executed', 'error'
  review_notes TEXT,
  review_data TEXT, -- JSON with detailed review results from Opus
  created_at TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  executed_at TEXT,
  approved_by TEXT REFERENCES users(id), -- User who approved (or 'opus-4.6' for Opus)
  opus_session_id TEXT, -- Session ID for async polling
  created_by_user_id TEXT REFERENCES users(id),
  UNIQUE(workspace_id, id)
);

-- ============================================================================
-- MIGRATION_QUEUE TABLE
-- ============================================================================
-- Tracks pending schema migrations waiting for code review approval
-- Links to code_reviews table for review tracking
CREATE TABLE IF NOT EXISTS migration_queue (
  id TEXT PRIMARY KEY,
  code_review_id TEXT NOT NULL REFERENCES code_reviews(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved', 'rejected', 'executed', 'failed'
  created_at TEXT NOT NULL,
  approved_at TEXT,
  rejected_at TEXT,
  executed_at TEXT,
  failure_reason TEXT,
  UNIQUE(workspace_id, name, created_at)
);

-- ============================================================================
-- AUDIT_LOG ENHANCEMENTS
-- ============================================================================
-- Ensure audit_log table has necessary columns for RBAC
-- Add columns if they don't exist (conditional in application layer)
-- ALTER TABLE audit_log ADD COLUMN granted INTEGER DEFAULT NULL;
-- ALTER TABLE audit_log ADD COLUMN workspace_id TEXT;
-- ALTER TABLE audit_log ADD COLUMN details TEXT;

-- ============================================================================
-- PERMISSIONS TABLE - Initialize with common permissions
-- ============================================================================
-- Seed default permissions if they don't exist
INSERT OR IGNORE INTO permissions (id, resource, action, description, created_at)
VALUES
  ('perm-code-review', 'code', 'review', 'Review code before deployment', datetime('now')),
  ('perm-code-approve', 'code', 'approve', 'Approve code for deployment', datetime('now')),
  ('perm-migration-deploy', 'migration', 'deploy', 'Deploy schema migrations', datetime('now')),
  ('perm-users-read', 'users', 'read', 'View user information', datetime('now')),
  ('perm-users-write', 'users', 'write', 'Modify user information', datetime('now')),
  ('perm-users-delete', 'users', 'delete', 'Delete users', datetime('now')),
  ('perm-roles-read', 'roles', 'read', 'View roles', datetime('now')),
  ('perm-roles-write', 'roles', 'write', 'Create/modify roles', datetime('now')),
  ('perm-permissions-grant', 'permissions', 'grant', 'Grant permissions to roles', datetime('now')),
  ('perm-audit-read', 'audit', 'read', 'View audit logs', datetime('now')),
  ('perm-workspace-admin', 'workspace', 'admin', 'Full workspace administration', datetime('now'));

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- Code review lookups
CREATE INDEX IF NOT EXISTS idx_code_reviews_workspace_id ON code_reviews(workspace_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_user_id ON code_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_status ON code_reviews(status);
CREATE INDEX IF NOT EXISTS idx_code_reviews_resource_type ON code_reviews(resource_type);
CREATE INDEX IF NOT EXISTS idx_code_reviews_workspace_status ON code_reviews(workspace_id, status);

-- Migration queue lookups
CREATE INDEX IF NOT EXISTS idx_migration_queue_code_review_id ON migration_queue(code_review_id);
CREATE INDEX IF NOT EXISTS idx_migration_queue_workspace_id ON migration_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_migration_queue_status ON migration_queue(status);
CREATE INDEX IF NOT EXISTS idx_migration_queue_created_at ON migration_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_migration_queue_workspace_status ON migration_queue(workspace_id, status);
