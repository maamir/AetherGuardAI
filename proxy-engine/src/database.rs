use anyhow::{Context, Result};
use chrono::{Utc, Timelike};
use serde_json::Value as JsonValue;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};
use std::env;
use tracing::{info, warn};
use uuid::Uuid;

/// Database connection pool
pub struct Database {
    pool: PgPool,
}

impl Database {
    /// Create a new database connection
    pub async fn new() -> Result<Self> {
        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| {
                "postgresql://aetherguard:password@postgres:5432/aetherguard".to_string()
            });

        info!("Connecting to database: {}", database_url.split('@').last().unwrap_or("unknown"));
        info!("Full database URL (masked): postgresql://aetherguard:***@{}", 
              database_url.split('@').last().unwrap_or("unknown"));

        let pool = PgPoolOptions::new()
            .max_connections(20)
            .connect(&database_url)
            .await
            .context("Failed to connect to PostgreSQL")?;

        info!("Database connection established");

        Ok(Self { pool })
    }

    /// Log an activity
    pub async fn log_activity(
        &self,
        tenant_id: &Uuid,
        user_id: Option<&Uuid>,
        activity_type: &str,
        description: &str,
        metadata: JsonValue,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<Uuid> {
        let activity_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO activities 
            (id, tenant_id, user_id, activity_type, description, activity_metadata, ip_address, user_agent, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(activity_id)
        .bind(tenant_id)
        .bind(user_id)
        .bind(activity_type)
        .bind(description)
        .bind(metadata)
        .bind(ip_address)
        .bind(user_agent)
        .bind(Utc::now())
        .execute(&self.pool)
        .await
        .context("Failed to log activity")?;

        Ok(activity_id)
    }

    /// Record usage analytics
    pub async fn record_usage(
        &self,
        tenant_id: &Uuid,
        api_key_id: Option<&Uuid>,
        provider_id: Option<&Uuid>,
        prompt_tokens: i32,
        completion_tokens: i32,
        total_tokens: i32,
        cost_usd: f64,
        latency_ms: i32,
        was_blocked: bool,
    ) -> Result<()> {
        let date = Utc::now().date_naive();
        let hour = Utc::now().hour() as i32;

        // Upsert usage analytics (aggregate by hour)
        sqlx::query(
            r#"
            INSERT INTO usage_analytics 
            (id, tenant_id, api_key_id, provider_id, date, hour,
             total_requests, successful_requests, blocked_requests,
             prompt_tokens, completion_tokens, total_tokens,
             cost_usd, avg_latency_ms, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10, $11, $12, $13, NOW())
            ON CONFLICT (tenant_id, date, hour, COALESCE(api_key_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(provider_id, '00000000-0000-0000-0000-000000000000'::uuid))
            DO UPDATE SET
                total_requests = usage_analytics.total_requests + 1,
                successful_requests = usage_analytics.successful_requests + $7,
                blocked_requests = usage_analytics.blocked_requests + $8,
                prompt_tokens = usage_analytics.prompt_tokens + $9,
                completion_tokens = usage_analytics.completion_tokens + $10,
                total_tokens = usage_analytics.total_tokens + $11,
                cost_usd = usage_analytics.cost_usd + $12,
                avg_latency_ms = ((usage_analytics.avg_latency_ms * usage_analytics.total_requests) + $13) / (usage_analytics.total_requests + 1)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(provider_id)
        .bind(date)
        .bind(hour)
        .bind(if was_blocked { 0 } else { 1 }) // successful_requests
        .bind(if was_blocked { 1 } else { 0 }) // blocked_requests
        .bind(prompt_tokens)
        .bind(completion_tokens)
        .bind(total_tokens)
        .bind(cost_usd)
        .bind(latency_ms)
        .execute(&self.pool)
        .await
        .context("Failed to record usage analytics")?;

        Ok(())
    }

    /// Log a security event
    #[allow(dead_code)]
    pub async fn log_security_event(
        &self,
        tenant_id: &Uuid,
        api_key_id: Option<&Uuid>,
        event_type: &str,
        severity: &str,
        description: &str,
        request_id: Option<&str>,
        source_ip: Option<&str>,
        user_agent: Option<&str>,
        metadata: JsonValue,
    ) -> Result<Uuid> {
        let event_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO security_events 
            (id, tenant_id, api_key_id, event_type, severity, description, 
             request_id, source_ip, user_agent, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            "#,
        )
        .bind(event_id)
        .bind(tenant_id)
        .bind(api_key_id)
        .bind(event_type)
        .bind(severity)
        .bind(description)
        .bind(request_id)
        .bind(source_ip)
        .bind(user_agent)
        .bind(metadata)
        .execute(&self.pool)
        .await
        .context("Failed to log security event")?;

        Ok(event_id)
    }

    /// Validate API key and get tenant info
    #[allow(dead_code)]
    pub async fn validate_api_key(&self, api_key_hash: &str) -> Result<Option<ApiKeyInfo>> {
        let result = sqlx::query(
            r#"
            SELECT 
                ak.id as api_key_id,
                ak.tenant_id,
                ak.is_active,
                t.status as tenant_status,
                t.is_active as tenant_is_active
            FROM api_keys ak
            JOIN tenants t ON ak.tenant_id = t.id
            WHERE ak.key_hash = $1
            "#,
        )
        .bind(api_key_hash)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to validate API key")?;

        if let Some(row) = result {
            let is_active: bool = row.try_get("is_active")?;
            let tenant_is_active: bool = row.try_get("tenant_is_active")?;
            let tenant_status: String = row.try_get("tenant_status")?;

            if is_active && tenant_is_active && tenant_status == "active" {
                Ok(Some(ApiKeyInfo {
                    api_key_id: row.try_get("api_key_id")?,
                    tenant_id: row.try_get("tenant_id")?,
                }))
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }

    /// Test basic database connectivity
    #[allow(dead_code)]
    pub async fn test_connection(&self) -> Result<()> {
        // Test 1: Basic connectivity
        let result = sqlx::query("SELECT 1 as test_value")
            .fetch_one(&self.pool)
            .await
            .context("Failed to execute test query")?;
        
        let test_value: i32 = result.try_get("test_value")?;
        info!("Database connectivity test successful: {}", test_value);
        
        // Test 2: Check if tenants table exists and count rows
        let count_result = sqlx::query("SELECT COUNT(*) as tenant_count FROM tenants")
            .fetch_one(&self.pool)
            .await
            .context("Failed to count tenants")?;
            
        let tenant_count: i64 = count_result.try_get("tenant_count")?;
        info!("Tenants table has {} rows", tenant_count);
        
        // Test 3: Try to fetch one tenant
        let tenant_result = sqlx::query("SELECT id, name FROM tenants LIMIT 1")
            .fetch_optional(&self.pool)
            .await
            .context("Failed to fetch tenant")?;
            
        if let Some(row) = tenant_result {
            let tenant_id: uuid::Uuid = row.try_get("id")?;
            let tenant_name: String = row.try_get("name")?;
            info!("Found tenant: {} ({})", tenant_name, tenant_id);
        } else {
            warn!("No tenants found in database");
        }
        
        Ok(())
    }
    #[allow(dead_code)]
    pub async fn get_first_tenant_id(&self) -> Result<Option<Uuid>> {
        let result = sqlx::query(
            r#"
            SELECT id FROM tenants 
            LIMIT 1
            "#,
        )
        .fetch_optional(&self.pool)
        .await
        .context("Failed to get first tenant ID")?;

        if let Some(row) = result {
            Ok(Some(row.try_get("id")?))
        } else {
            Ok(None)
        }
    }
    #[allow(dead_code)]
    pub async fn test_insert(&self) -> Result<()> {
        let test_tenant_id = Uuid::parse_str("6c2d14c2-77e0-4e6b-827e-6dee496eb5b3")?;
        let event_id = Uuid::new_v4();
        
        let result = sqlx::query(
            r#"
            INSERT INTO security_events 
            (id, tenant_id, event_type, severity, description, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            "#,
        )
        .bind(event_id)
        .bind(test_tenant_id)
        .bind("test_from_rust")
        .bind("low")
        .bind("Test insert from Rust")
        .bind(serde_json::json!({"test": true}))
        .execute(&self.pool)
        .await?;
        
        info!("Test insert result: rows_affected={}", result.rows_affected());
        Ok(())
    }
    #[allow(dead_code)]
    pub async fn get_provider_config(&self, tenant_id: &Uuid, provider_id: &Uuid) -> Result<Option<ProviderConfig>> {
        let result = sqlx::query(
            r#"
            SELECT 
                id,
                provider_type,
                provider_name,
                api_key_encrypted,
                provider_url,
                model_name,
                model_config,
                is_active
            FROM llm_providers
            WHERE tenant_id = $1 AND id = $2 AND is_active = true
            "#,
        )
        .bind(tenant_id)
        .bind(provider_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to get provider config")?;

        if let Some(row) = result {
            Ok(Some(ProviderConfig {
                id: row.try_get("id")?,
                provider_type: row.try_get("provider_type")?,
                provider_name: row.try_get("provider_name")?,
                api_key_encrypted: row.try_get("api_key_encrypted")?,
                api_key_decrypted: row.try_get("api_key_encrypted")?, // TODO: Decrypt this
                provider_url: row.try_get("provider_url")?,
                model_name: row.try_get("model_name")?,
                model_config: row.try_get("model_config")?,
            }))
        } else {
            Ok(None)
        }
    }

    /// Get the active LLM provider for a tenant (first active provider or default)
    #[allow(dead_code)]
    pub async fn get_active_llm_provider(&self, tenant_id: &str) -> Result<Option<ProviderConfig>> {
        let tenant_uuid = Uuid::parse_str(tenant_id)
            .context("Invalid tenant ID format")?;
        
        let result = sqlx::query(
            r#"
            SELECT 
                id,
                provider_type,
                provider_name,
                api_key_encrypted,
                provider_url,
                model_name,
                model_config,
                is_active,
                is_default
            FROM llm_providers
            WHERE tenant_id = $1 AND is_active = true
            ORDER BY is_default DESC, created_at ASC
            LIMIT 1
            "#,
        )
        .bind(&tenant_uuid)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to get active LLM provider")?;

        if let Some(row) = result {
            Ok(Some(ProviderConfig {
                id: row.try_get("id")?,
                provider_type: row.try_get("provider_type")?,
                provider_name: row.try_get("provider_name")?,
                api_key_encrypted: row.try_get("api_key_encrypted")?,
                api_key_decrypted: row.try_get("api_key_encrypted")?, // TODO: Decrypt this
                provider_url: row.try_get("provider_url")?,
                model_name: row.try_get("model_name")?,
                model_config: row.try_get("model_config")?,
            }))
        } else {
            Ok(None)
        }
    }
}

/// API key validation result
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ApiKeyInfo {
    pub api_key_id: Uuid,
    pub tenant_id: Uuid,
}

/// Provider configuration
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ProviderConfig {
    pub id: Uuid,
    pub provider_type: String,
    pub provider_name: Option<String>,
    pub api_key_encrypted: Option<String>,
    pub api_key_decrypted: Option<String>,  // Decrypted API key for use
    pub provider_url: Option<String>,
    pub model_name: Option<String>,
    pub model_config: Option<JsonValue>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires database connection
    async fn test_database_connection() {
        let db = Database::new().await;
        assert!(db.is_ok());
    }
}
