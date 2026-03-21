-- Migration 002: Vault Token Instructions Schema
-- Phase 4.5: API Instruction Layer for Token Vault
-- Created: 2026-03-20

-- ============================================================================
-- VAULT TOKEN INSTRUCTIONS TABLE
-- ============================================================================
-- Stores instructions and examples for API tokens so external AI agents can
-- learn how to use any service automatically.
-- 
-- Each token can have:
-- - User-provided instructions (editable, auto_generated = false)
-- - Auto-generated instructions (read-only, auto_generated = true, can be edited to override)
-- - JSON examples showing real API interactions
-- - Metadata about how instructions were created
CREATE TABLE IF NOT EXISTS vault_token_instructions (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL UNIQUE REFERENCES access_tokens(id) ON DELETE CASCADE,
  instructions TEXT NOT NULL,
  examples TEXT,
  auto_generated INTEGER DEFAULT 0,
  learned_from_skill_id TEXT,
  learned_from_agent_id TEXT,
  learned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by_user_id TEXT,
  FOREIGN KEY (token_id) REFERENCES access_tokens(id) ON DELETE CASCADE
);

-- ============================================================================
-- VAULT TOKEN INSTRUCTION VERSIONS TABLE
-- ============================================================================
-- Maintains history of instruction changes for audit trail and rollback capability
-- Tracks who edited what and when
CREATE TABLE IF NOT EXISTS vault_token_instruction_versions (
  id TEXT PRIMARY KEY,
  token_instruction_id TEXT NOT NULL REFERENCES vault_token_instructions(id) ON DELETE CASCADE,
  instructions_previous TEXT NOT NULL,
  instructions_new TEXT NOT NULL,
  examples_previous TEXT,
  examples_new TEXT,
  auto_generated_previous INTEGER,
  auto_generated_new INTEGER,
  changed_by_user_id TEXT,
  change_reason TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- SERVICE TYPE INSTRUCTIONS TABLE
-- ============================================================================
-- Stores global instructions for service types (e.g., "github", "slack")
-- These serve as templates that can be used when no token-specific instructions exist
-- Manually curated by admins or auto-generated from multiple token interactions
CREATE TABLE IF NOT EXISTS service_type_instructions (
  id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL UNIQUE,
  instructions TEXT NOT NULL,
  examples TEXT,
  auto_generated INTEGER DEFAULT 0,
  aggregated_from_token_count INTEGER DEFAULT 0,
  last_updated_at TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- Token-specific instruction lookups
CREATE INDEX IF NOT EXISTS idx_vault_token_instructions_token_id ON vault_token_instructions(token_id);
CREATE INDEX IF NOT EXISTS idx_vault_token_instructions_created_at ON vault_token_instructions(created_at);
CREATE INDEX IF NOT EXISTS idx_vault_token_instructions_auto_generated ON vault_token_instructions(auto_generated);
CREATE INDEX IF NOT EXISTS idx_vault_token_instructions_learned_skill ON vault_token_instructions(learned_from_skill_id);
CREATE INDEX IF NOT EXISTS idx_vault_token_instructions_learned_agent ON vault_token_instructions(learned_from_agent_id);

-- Instruction version lookups
CREATE INDEX IF NOT EXISTS idx_vault_token_instruction_versions_token_instruction_id ON vault_token_instruction_versions(token_instruction_id);
CREATE INDEX IF NOT EXISTS idx_vault_token_instruction_versions_created_at ON vault_token_instruction_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_vault_token_instruction_versions_changed_by ON vault_token_instruction_versions(changed_by_user_id);

-- Service type instruction lookups
CREATE INDEX IF NOT EXISTS idx_service_type_instructions_service_name ON service_type_instructions(service_name);
CREATE INDEX IF NOT EXISTS idx_service_type_instructions_auto_generated ON service_type_instructions(auto_generated);
CREATE INDEX IF NOT EXISTS idx_service_type_instructions_updated_at ON service_type_instructions(updated_at);
