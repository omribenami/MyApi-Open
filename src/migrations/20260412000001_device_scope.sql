-- Migration: Add scope column to approved_devices
-- Created: 2026-04-12
-- Allows per-device access scope: 'read' | 'full'

ALTER TABLE approved_devices ADD COLUMN scope TEXT DEFAULT 'full';
