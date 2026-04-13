-- Migration: Add allowed_resources column to access_tokens
-- Created: 2026-04-12
-- Stores fine-grained resource filters per token (specific KB docs, skills, personas, services)

ALTER TABLE access_tokens ADD COLUMN allowed_resources TEXT;
