-- Migration 006: Add Activities Table and Update Usage Analytics
-- Description: Create activities table for comprehensive activity tracking
--              and update usage_analytics with provider_id and api_key_id

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for activities table
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_type ON activities(tenant_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_created ON activities(tenant_id, created_at);

-- Update usage_analytics table to add provider_id and api_key_id
ALTER TABLE usage_analytics 
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES llm_providers(id) ON DELETE SET NULL;

ALTER TABLE usage_analytics 
ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;

-- Create indexes for usage_analytics foreign keys
CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage_analytics(provider_id);
CREATE INDEX IF NOT EXISTS idx_usage_api_key ON usage_analytics(api_key_id);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_provider ON usage_analytics(tenant_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_api_key ON usage_analytics(tenant_id, api_key_id);

-- Add comment to activities table
COMMENT ON TABLE activities IS 'Tracks all user and system activities for audit and monitoring';
COMMENT ON COLUMN activities.activity_type IS 'Type of activity (e.g., api_call, detection_*, provider_*, policy_*, etc.)';
COMMENT ON COLUMN activities.metadata IS 'Additional context-specific data in JSON format';
