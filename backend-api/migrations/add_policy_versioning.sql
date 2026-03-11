-- Migration: Add Policy Versioning
-- Date: 2026-03-15
-- Description: Add policy version tracking and templates

-- Create policy_versions table
CREATE TABLE IF NOT EXISTS policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy_configs(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    changes TEXT,
    UNIQUE(policy_id, version)
);

-- Create policy_templates table
CREATE TABLE IF NOT EXISTS policy_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    is_preset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_policy_versions_policy_id ON policy_versions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_versions_created_at ON policy_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_templates_tenant_id ON policy_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_templates_is_preset ON policy_templates(is_preset);

-- Add comments
COMMENT ON TABLE policy_versions IS 'Tracks all versions of policy configurations';
COMMENT ON TABLE policy_templates IS 'Stores policy templates (preset and custom)';
