-- Migration: Add Provider Health and Reports
-- Date: 2026-03-15
-- Description: Add provider health metrics, custom reports, and scheduled reports

-- Create provider_health_metrics table
CREATE TABLE IF NOT EXISTS provider_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('online', 'offline', 'degraded')),
    response_time INTEGER NOT NULL,
    error_rate DECIMAL(5,2) NOT NULL,
    uptime DECIMAL(5,2) NOT NULL,
    requests_per_minute INTEGER NOT NULL,
    average_latency INTEGER NOT NULL,
    checked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create custom_reports table
CREATE TABLE IF NOT EXISTS custom_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metrics JSONB NOT NULL,
    filters JSONB NOT NULL DEFAULT '[]'::jsonb,
    visualization VARCHAR(20) NOT NULL CHECK (visualization IN ('table', 'chart', 'both')),
    date_range INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create scheduled_reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    recipients JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    next_run TIMESTAMP NOT NULL,
    last_run TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add fallback_providers column to llm_providers
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS fallback_providers JSONB DEFAULT '[]'::jsonb;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_provider_health_provider_id ON provider_health_metrics(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_health_checked_at ON provider_health_metrics(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_reports_tenant_id ON custom_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant_id ON scheduled_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_is_active ON scheduled_reports(is_active);

-- Add comments
COMMENT ON TABLE provider_health_metrics IS 'Tracks health metrics for LLM providers';
COMMENT ON TABLE custom_reports IS 'Stores custom report configurations';
COMMENT ON TABLE scheduled_reports IS 'Stores scheduled report delivery configurations';
COMMENT ON COLUMN llm_providers.fallback_providers IS 'Array of fallback provider configurations with priority';
