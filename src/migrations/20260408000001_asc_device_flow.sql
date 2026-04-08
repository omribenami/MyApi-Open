-- Migration: ASC + OAuth Device Flow support
-- Created: 2026-04-08

-- OAuth Device Flow (RFC 8628) authorization codes
CREATE TABLE IF NOT EXISTS oauth_device_codes (
  id TEXT PRIMARY KEY,
  device_code TEXT UNIQUE NOT NULL,
  user_code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  scope TEXT,
  user_id TEXT,               -- set when user approves
  access_token_id TEXT,       -- set when token issued
  status TEXT DEFAULT 'pending', -- pending | approved | denied | expired
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  denied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_device_codes_device_code ON oauth_device_codes(device_code);
CREATE INDEX IF NOT EXISTS idx_device_codes_user_code   ON oauth_device_codes(user_code);
CREATE INDEX IF NOT EXISTS idx_device_codes_status      ON oauth_device_codes(status);

-- ASC (Agentic Secure Connection): add public-key identity columns to approved_devices
-- connection_type: 'fingerprint' (default) | 'asc' | 'device_flow'
ALTER TABLE approved_devices ADD COLUMN connection_type TEXT DEFAULT 'fingerprint';
ALTER TABLE approved_devices ADD COLUMN public_key TEXT;
ALTER TABLE approved_devices ADD COLUMN key_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_approved_devices_key_fp ON approved_devices(key_fingerprint);

-- ASC pending registrations reuse device_approvals_pending with fingerprint = key_fingerprint
-- No schema change needed there.
