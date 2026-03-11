-- Migration: Add API Key Enhancements
-- Date: 2026-03-15
-- Description: Add IP whitelist and usage alerts to API keys

-- Add ip_whitelist column (JSONB array of IP addresses/CIDR ranges)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ip_whitelist JSONB DEFAULT '[]'::jsonb;

-- Add usage_alerts column (JSONB array of alert configurations)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS usage_alerts JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_api_keys_ip_whitelist ON api_keys USING GIN (ip_whitelist);
CREATE INDEX IF NOT EXISTS idx_api_keys_usage_alerts ON api_keys USING GIN (usage_alerts);

-- Add comment for documentation
COMMENT ON COLUMN api_keys.ip_whitelist IS 'Array of allowed IP addresses or CIDR ranges';
COMMENT ON COLUMN api_keys.usage_alerts IS 'Array of usage alert configurations with threshold, channel, and destination';
