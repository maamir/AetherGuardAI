-- AetherGuard Backend API - API Keys Enhancement
-- Version: 1.0.0
-- Description: Enhance API keys table with additional fields

-- Enhance API Keys Table
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix VARCHAR(10);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_suffix VARCHAR(10);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit INTEGER;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS monthly_quota INTEGER;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_ip VARCHAR(45);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES admin_users(id);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoke_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
