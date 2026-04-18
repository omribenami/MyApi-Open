-- Migration: approved_devices token-scoped uniqueness
-- Created: 2026-04-18
-- Fix: UNIQUE on device_fingerprint_hash alone let an approval under ANY
-- token for a given user auto-authorize unrelated guest tokens on the same
-- device. Rebuild the table with UNIQUE(token_id, device_fingerprint_hash)
-- so each (token, device) pair requires its own explicit approval.

CREATE TABLE approved_devices_new (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_info_json TEXT,
  ip_address TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  connection_type TEXT DEFAULT 'fingerprint',
  public_key TEXT,
  key_fingerprint TEXT,
  UNIQUE(token_id, device_fingerprint_hash),
  FOREIGN KEY (token_id) REFERENCES access_tokens(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO approved_devices_new (
  id, token_id, user_id, device_fingerprint, device_fingerprint_hash,
  device_name, device_info_json, ip_address, approved_at, last_used_at,
  revoked_at, created_at, connection_type, public_key, key_fingerprint
)
SELECT
  id, token_id, user_id, device_fingerprint, device_fingerprint_hash,
  device_name, device_info_json, ip_address, approved_at, last_used_at,
  revoked_at, created_at,
  COALESCE(connection_type, 'fingerprint'), public_key, key_fingerprint
FROM approved_devices;

DROP TABLE approved_devices;
ALTER TABLE approved_devices_new RENAME TO approved_devices;

CREATE INDEX IF NOT EXISTS idx_approved_devices_user_token ON approved_devices(user_id, token_id);
CREATE INDEX IF NOT EXISTS idx_approved_devices_fingerprint ON approved_devices(device_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_approved_devices_key_fp ON approved_devices(key_fingerprint);
