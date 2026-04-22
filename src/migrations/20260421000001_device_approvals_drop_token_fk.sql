-- Migration: remove FK constraint on token_id in device_approvals_pending
-- Created: 2026-04-21
-- Fix: device_approvals_pending had FOREIGN KEY (token_id) REFERENCES access_tokens(id)
-- which rejects tokens from the `tokens` table (TokenManager / myapi_sk_ prefixed tokens).
-- Both token tables are valid — drop the FK so either can create pending approvals.

CREATE TABLE device_approvals_pending_new (
  id TEXT PRIMARY KEY,
  device_fingerprint TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL,
  token_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_info_json TEXT,
  ip_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  denied_at TEXT,
  denial_reason TEXT,
  approval_type TEXT DEFAULT 'device',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO device_approvals_pending_new (
  id, device_fingerprint, device_fingerprint_hash, token_id, user_id,
  device_info_json, ip_address, status, created_at, expires_at,
  approved_at, denied_at, denial_reason, approval_type
)
SELECT
  id, device_fingerprint, device_fingerprint_hash, token_id, user_id,
  device_info_json, ip_address, status, created_at, expires_at,
  approved_at, denied_at, denial_reason,
  'device'
FROM device_approvals_pending;

DROP TABLE device_approvals_pending;
ALTER TABLE device_approvals_pending_new RENAME TO device_approvals_pending;

CREATE INDEX IF NOT EXISTS idx_pending_approvals_user ON device_approvals_pending(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON device_approvals_pending(status);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_expires ON device_approvals_pending(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_token ON device_approvals_pending(token_id);
