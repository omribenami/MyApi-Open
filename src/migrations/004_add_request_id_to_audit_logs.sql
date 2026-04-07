-- Migration: Add request_id correlation column to audit logs (SOC2 Phase 2)
-- Enables cross-layer log tracing via X-Request-ID header

ALTER TABLE audit_log ADD COLUMN request_id TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON audit_log(request_id);

ALTER TABLE compliance_audit_logs ADD COLUMN request_id TEXT;
CREATE INDEX IF NOT EXISTS idx_compliance_audit_request_id ON compliance_audit_logs(request_id);
