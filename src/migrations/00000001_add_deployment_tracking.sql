-- Migration: Add deployment tracking table
-- Created: Initial schema migration

CREATE TABLE IF NOT EXISTS deployment_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  deployed_at TEXT NOT NULL,
  deployed_by TEXT,
  commit_sha TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  rollback_of TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_deployment_log_version ON deployment_log(version);
CREATE INDEX IF NOT EXISTS idx_deployment_log_environment ON deployment_log(environment);
