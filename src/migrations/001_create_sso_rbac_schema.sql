-- Migration 001: Create SSO and RBAC Schema
-- Phase 4: Enterprise Single Sign-On and Role-Based Access Control
-- Created: 2026-03-20

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
-- Defines custom roles within a workspace
-- Each workspace can have multiple roles (Admin, Manager, Developer, Viewer, etc.)
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id),
  UNIQUE(workspace_id, name)
);

-- ============================================================================
-- PERMISSIONS TABLE
-- ============================================================================
-- Defines available permissions (what can be done in the system)
-- Follows resource:action pattern (e.g., "workspace:read", "users:write")
-- Permissions are global but can be assigned to roles per workspace
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(resource, action)
);

-- ============================================================================
-- ROLE_PERMISSIONS JUNCTION TABLE
-- ============================================================================
-- Links roles to permissions
-- Each role can have many permissions, and permissions can be assigned to many roles
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(role_id, permission_id)
);

-- ============================================================================
-- USER_ROLES JUNCTION TABLE
-- ============================================================================
-- Links users to roles within a workspace
-- A user can have multiple roles in a single workspace
-- A user can have different role sets across different workspaces
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  assigned_by_user_id TEXT REFERENCES users(id),
  UNIQUE(user_id, role_id, workspace_id)
);

-- ============================================================================
-- SSO_CONFIGURATIONS TABLE
-- ============================================================================
-- Stores SSO provider configurations for each workspace
-- Supports multiple providers per workspace (SAML, OpenID Connect, OAuth)
CREATE TABLE IF NOT EXISTS sso_configurations (
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

-- ============================================================================
-- SSO_SESSIONS TABLE
-- ============================================================================
-- Tracks active SSO sessions for audit and security
-- Useful for session management, logout tracking, and device monitoring
CREATE TABLE IF NOT EXISTS sso_sessions (
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

-- ============================================================================
-- SAML_ASSERTIONS TABLE
-- ============================================================================
-- Stores SAML assertions for audit and troubleshooting
-- Useful for debugging authentication issues
CREATE TABLE IF NOT EXISTS saml_assertions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assertion_data TEXT NOT NULL,
  attributes TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- OIDC_TOKENS TABLE
-- ============================================================================
-- Stores OIDC token information for token rotation and validation
CREATE TABLE IF NOT EXISTS oidc_tokens (
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

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- Role lookups
CREATE INDEX IF NOT EXISTS idx_roles_workspace_id ON roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_roles_workspace_id_name ON roles(workspace_id, name);

-- Permission lookups
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);

-- Role-Permission lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- User-Role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_workspace_id ON user_roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_workspace ON user_roles(user_id, workspace_id);

-- SSO Configuration lookups
CREATE INDEX IF NOT EXISTS idx_sso_configurations_workspace_id ON sso_configurations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sso_configurations_provider ON sso_configurations(provider);

-- SSO Session lookups
CREATE INDEX IF NOT EXISTS idx_sso_sessions_user_id ON sso_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_sessions_workspace_id ON sso_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sso_sessions_expires_at ON sso_sessions(expires_at);

-- SAML Assertions lookups
CREATE INDEX IF NOT EXISTS idx_saml_assertions_workspace_id ON saml_assertions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_saml_assertions_user_id ON saml_assertions(user_id);
CREATE INDEX IF NOT EXISTS idx_saml_assertions_created_at ON saml_assertions(created_at);

-- OIDC Tokens lookups
CREATE INDEX IF NOT EXISTS idx_oidc_tokens_user_id ON oidc_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oidc_tokens_workspace_id ON oidc_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_oidc_tokens_provider ON oidc_tokens(provider);
