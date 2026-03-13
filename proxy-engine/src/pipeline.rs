use crate::{audit::AuditLogger, security::SecurityEngine, CompletionRequest, CompletionResponse};
use crate::crypto::{AetherSign, ProvenanceTracker, EventType};
use crate::database::Database;
use anyhow::{Context, Result};
use axum::http::HeaderMap;
use chrono::Utc;
use sha2::{Digest, Sha256};
use tracing::{warn, info, debug, error};
use uuid::Uuid;
use std::sync::Arc;

pub struct RequestPipeline {
    security: SecurityEngine,
    audit: AuditLogger,
    aether_sign: Arc<AetherSign>,
    provenance_tracker: Arc<ProvenanceTracker>,
    database: Option<Arc<Database>>,
}

impl RequestPipeline {
    pub async fn new() -> Result<Self> {
        let aether_sign = Arc::new(AetherSign::new().await?);
        let provenance_tracker = Arc::new(ProvenanceTracker::new(aether_sign.clone()).await?);
        
        // Try to connect to database, but don't fail if unavailable
        let database = match Database::new().await {
            Ok(db) => {
                info!("Pipeline: Database connection established");
                
                // Test basic connectivity
                if let Err(e) = db.test_connection().await {
                    error!("Database connectivity test failed: {}", e);
                } else {
                    info!("Database connectivity test passed");
                }
                
                Some(Arc::new(db))
            }
            Err(e) => {
                warn!("Pipeline: Database unavailable: {}. Continuing without DB logging.", e);
                None
            }
        };
        
        Ok(Self {
            security: SecurityEngine::new(),
            audit: AuditLogger::new(),
            aether_sign,
            provenance_tracker,
            database,
        })
    }

    /// Seven-stage pipeline processing
    pub async fn process(
        &self,
        mut req: CompletionRequest,
        headers: HeaderMap,
    ) -> Result<(CompletionResponse, HeaderMap)> {
        let request_id = Uuid::new_v4().to_string();
        let start_time = Utc::now();

        let ip_address = self.extract_ip_address(&headers);
        let user_agent = self.extract_user_agent(&headers);

        // Stage 1: Ingress - already handled by axum
        
        // Stage 2: Auth - validate API key and get tenant info
        let api_key_info = match self.validate_auth(&headers).await {
            Ok(info) => info,
            Err(e) => {
                // Log security event for invalid API key
                if let Some(db) = &self.database {
                    // Get the first available tenant for security events when API key is invalid
                    let fallback_tenant_id = match db.get_first_tenant_id().await {
                        Ok(Some(tenant_id)) => tenant_id,
                        Ok(None) => {
                            error!("No active tenants found in database");
                            return Err(e);
                        }
                        Err(db_err) => {
                            error!("Failed to get fallback tenant ID: {}", db_err);
                            return Err(e);
                        }
                    };
                    
                    match db.log_security_event(
                        &fallback_tenant_id,
                        None,
                        "invalid_api_key",
                        "medium",
                        "Invalid API key attempted",
                        Some(&request_id),
                        ip_address.as_deref(),
                        user_agent.as_deref(),
                        serde_json::json!({
                            "error": e.to_string(),
                            "timestamp": Utc::now().to_rfc3339()
                        }),
                    ).await {
                        Ok(event_id) => {
                            debug!("Security event logged successfully: {}", event_id);
                        }
                        Err(db_error) => {
                            error!("Failed to log security event: {}", db_error);
                        }
                    }
                }
                return Err(e);
            }
        };

        // Get tenant_id and api_key_id (use first available tenant if not available)
        let (tenant_id, api_key_id) = if let Some(info) = &api_key_info {
            (info.tenant_id, Some(info.api_key_id))
        } else {
            // Fallback when database is unavailable - use first available tenant
            match &self.database {
                Some(db) => {
                    match db.get_first_tenant_id().await {
                        Ok(Some(tenant_id)) => (tenant_id, None),
                        Ok(None) => {
                            error!("No active tenants found in database");
                            (Uuid::new_v4(), None) // Last resort
                        }
                        Err(db_err) => {
                            error!("Failed to get fallback tenant ID: {}", db_err);
                            (Uuid::new_v4(), None) // Last resort
                        }
                    }
                }
                None => (Uuid::new_v4(), None) // No database available
            }
        };

        // Stage 3: Cleanse - PII redaction, injection scan
        match self.security.scan_input(&mut req).await {
            Ok(_) => {},
            Err(e) => {
                // Log security event for blocked request
                if let Some(db) = &self.database {
                    let _ = db.log_security_event(
                        &tenant_id,
                        api_key_id.as_ref(),
                        "request_blocked",
                        "high",
                        &format!("Request blocked during cleanse stage: {}", e),
                        Some(&request_id),
                        ip_address.as_deref(),
                        user_agent.as_deref(),
                        serde_json::json!({
                            "stage": "cleanse",
                            "error": e.to_string(),
                            "model": req.model,
                            "message_count": req.messages.len()
                        }),
                    ).await;
                    
                    // Also log as activity
                    let _ = db.log_activity(
                        &tenant_id,
                        None,
                        "request_blocked",
                        &format!("Request blocked: {}", e),
                        serde_json::json!({
                            "request_id": request_id,
                            "stage": "cleanse",
                            "model": req.model,
                            "blocked": true
                        }),
                        ip_address.as_deref(),
                        user_agent.as_deref(),
                    ).await;
                }
                return Err(e);
            }
        }

        // Stage 4: AetherSign - cryptographic signing with watermarking
        let input_fingerprint = self.compute_fingerprint(&req);
        let input_signature = self.aether_sign.sign_model_checkpoint(&input_fingerprint).await
            .context("Failed to sign input fingerprint")?;
        
        // Record inference event in provenance chain
        let inference_metadata = serde_json::json!({
            "model": req.model,
            "message_count": req.messages.len(),
            "max_tokens": req.max_tokens,
            "input_fingerprint": input_fingerprint,
            "timestamp": Utc::now().to_rfc3339()
        });
        
        self.provenance_tracker.record_event(
            EventType::Inference,
            &req.model,
            inference_metadata,
            Some(&input_signature), // Use signature as watermark data
            vec![] // No cross-model references for basic inference
        ).await.context("Failed to record inference event")?;

        // Stage 5: Inference - forward to LLM provider
        let tenant_id_str = tenant_id.to_string();
        let response = self.forward_to_llm(&req, &tenant_id_str).await?;

        // Stage 6: Verify - post-inference checks
        match self.security.scan_output(&response).await {
            Ok(_) => {},
            Err(e) => {
                // Log security event for blocked response
                if let Some(db) = &self.database {
                    let _ = db.log_security_event(
                        &tenant_id,
                        api_key_id.as_ref(),
                        "response_blocked",
                        "high",
                        &format!("Response blocked during verify stage: {}", e),
                        Some(&request_id),
                        ip_address.as_deref(),
                        user_agent.as_deref(),
                        serde_json::json!({
                            "stage": "verify",
                            "error": e.to_string(),
                            "model": req.model,
                            "response_length": response.choices.get(0)
                                .map(|c| c.message.content.len())
                                .unwrap_or(0)
                        }),
                    ).await;
                }
                return Err(e);
            }
        }

        // Stage 7: Egress - prepare response with cryptographic signatures
        let output_fingerprint = self.compute_response_fingerprint(&response);
        let output_signature = self.aether_sign.sign_inference_output(
            &output_fingerprint,
            &req.model,
            Some(&input_signature) // Include input signature as watermark
        ).await.context("Failed to sign output fingerprint")?;
        
        // Log to audit trail with cryptographic proof
        self.audit.log_transaction(
            &request_id,
            &req,
            &response,
            &input_fingerprint,
            &output_fingerprint,
            start_time,
        ).await;
        
        // Log to database if available
        if let Some(db) = &self.database {
            let latency_ms = (Utc::now() - start_time).num_milliseconds() as i32;
            
            // Log successful activity
            let activity_metadata = serde_json::json!({
                "request_id": request_id,
                "model": req.model,
                "provider": "openai", // TODO: Get actual provider from response
                "latency_ms": latency_ms,
                "input_fingerprint": input_fingerprint,
                "output_fingerprint": output_fingerprint,
                "tokens": {
                    "prompt": response.usage.prompt_tokens,
                    "completion": response.usage.completion_tokens,
                    "total": response.usage.total_tokens
                }
            });
            
            if let Err(e) = db.log_activity(
                &tenant_id,
                None,
                "request_processed",
                &format!("Processed {} request to {}", req.model, "openai"),
                activity_metadata.clone(),
                ip_address.as_deref(),
                user_agent.as_deref(),
            ).await {
                error!("Failed to log activity to database: {}", e);
            }
            
            // Record usage analytics
            if let Err(e) = db.record_usage(
                &tenant_id,
                api_key_id.as_ref(),
                None, // TODO: Get provider_id from config
                response.usage.prompt_tokens as i32,
                response.usage.completion_tokens as i32,
                response.usage.total_tokens as i32,
                0.0, // TODO: Calculate actual cost based on model pricing
                latency_ms,
                false, // not blocked
            ).await {
                error!("Failed to record usage analytics: {}", e);
            }
        }

        let mut response_headers = HeaderMap::new();
        response_headers.insert("X-Request-ID", request_id.parse().unwrap());
        response_headers.insert("X-AetherSign", output_signature.parse().unwrap());
        response_headers.insert("X-AetherSign-Input", input_signature.parse().unwrap());
        
        // Add provenance information
        if let Some(active_key) = self.aether_sign.get_active_public_key() {
            response_headers.insert("X-AetherSign-Key-ID", active_key.key_id.parse().unwrap());
        }

        debug!("Request processed through 7-stage pipeline with cryptographic signatures");
        Ok((response, response_headers))
    }

    async fn validate_auth(&self, headers: &HeaderMap) -> Result<Option<crate::database::ApiKeyInfo>> {
        let api_key = headers
            .get("Authorization")
            .or_else(|| headers.get("X-API-Key"))
            .and_then(|v| v.to_str().ok())
            .context("Missing Authorization or X-API-Key header")?;

        // Extract key from Bearer token or use directly
        let key = if api_key.starts_with("Bearer ") {
            &api_key[7..]
        } else {
            api_key
        };

        // Hash the API key for database lookup
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        let key_hash = format!("{:x}", hasher.finalize());

        // Validate against database if available
        if let Some(db) = &self.database {
            match db.validate_api_key(&key_hash).await {
                Ok(Some(api_key_info)) => {
                    debug!("API key validated for tenant: {}", api_key_info.tenant_id);
                    Ok(Some(api_key_info))
                }
                Ok(None) => {
                    warn!("Invalid API key: {}", &key_hash[..8]);
                    anyhow::bail!("Invalid API key");
                }
                Err(e) => {
                    error!("Database error during API key validation: {}", e);
                    // Fall back to basic validation if database is unavailable
                    if key.len() >= 32 {
                        Ok(None) // Valid format but no tenant info
                    } else {
                        anyhow::bail!("Invalid API key format");
                    }
                }
            }
        } else {
            // Basic validation when database is unavailable
            if key.len() >= 32 {
                Ok(None) // Valid format but no tenant info
            } else {
                anyhow::bail!("Invalid API key format");
            }
        }
    }

    /// Extract IP address from headers
    fn extract_ip_address(&self, headers: &HeaderMap) -> Option<String> {
        // Check common headers for client IP
        headers
            .get("X-Forwarded-For")
            .or_else(|| headers.get("X-Real-IP"))
            .or_else(|| headers.get("CF-Connecting-IP"))
            .or_else(|| headers.get("X-Client-IP"))
            .and_then(|v| v.to_str().ok())
            .map(|ip| {
                // X-Forwarded-For can contain multiple IPs, take the first one
                ip.split(',').next().unwrap_or(ip).trim().to_string()
            })
    }

    /// Extract User-Agent from headers
    fn extract_user_agent(&self, headers: &HeaderMap) -> Option<String> {
        headers
            .get("User-Agent")
            .and_then(|v| v.to_str().ok())
            .map(|ua| ua.to_string())
    }

    fn compute_fingerprint(&self, req: &CompletionRequest) -> String {
        let mut hasher = Sha256::new();
        hasher.update(serde_json::to_string(req).unwrap().as_bytes());
        format!("sha256:{:x}", hasher.finalize())
    }

    fn compute_response_fingerprint(&self, resp: &CompletionResponse) -> String {
        let mut hasher = Sha256::new();
        hasher.update(serde_json::to_string(resp).unwrap().as_bytes());
        format!("sha256:{:x}", hasher.finalize())
    }

    async fn forward_to_llm(&self, req: &CompletionRequest, tenant_id: &str) -> Result<CompletionResponse> {
        debug!("forward_to_llm called for tenant_id: {}", tenant_id);
        
        // First, try to get LLM provider from database for this tenant
        if let Some(db) = &self.database {
            debug!("Database available, querying for LLM provider");
            match db.get_active_llm_provider(tenant_id).await {
                Ok(Some(provider)) => {
                    let provider_name = provider.provider_name.as_deref().unwrap_or("Unknown");
                    info!("Using LLM provider from database: {} ({}) for tenant {}", provider_name, provider.provider_type, tenant_id);
                    
                    // Route based on provider type
                    match provider.provider_type.as_str() {
                        "openai" => {
                            if let Some(api_key) = provider.api_key_decrypted {
                                info!("Forwarding to OpenAI with API key from database");
                                return self.forward_to_openai(req, &api_key).await;
                            } else {
                                warn!("OpenAI provider found but no API key available");
                            }
                        }
                        "anthropic" => {
                            if let Some(api_key) = provider.api_key_decrypted {
                                info!("Forwarding to Anthropic with API key from database");
                                return self.forward_to_anthropic(req, &api_key).await;
                            } else {
                                warn!("Anthropic provider found but no API key available");
                            }
                        }
                        "custom" | _ => {
                            if let (Some(url), Some(api_key)) = (provider.provider_url, provider.api_key_decrypted) {
                                info!("Forwarding to custom provider at {}", url);
                                match self.try_forward_to_provider_with_key(&url, req, &api_key).await {
                                    Ok(response) => return Ok(response),
                                    Err(e) => warn!("Custom LLM provider failed: {}", e),
                                }
                            } else {
                                warn!("Custom provider found but missing URL or API key");
                            }
                        }
                    }
                }
                Ok(None) => {
                    info!("No active LLM provider configured for tenant {}", tenant_id);
                }
                Err(e) => {
                    warn!("Failed to fetch LLM provider from database for tenant {}: {}", tenant_id, e);
                }
            }
        } else {
            debug!("Database not available, skipping database provider lookup");
        }
        
        // Fallback to environment variables (for backward compatibility)
        if let Ok(openai_key) = std::env::var("OPENAI_API_KEY") {
            info!("Using OpenAI from environment variable");
            return self.forward_to_openai(req, &openai_key).await;
        }
        
        if let Ok(anthropic_key) = std::env::var("ANTHROPIC_API_KEY") {
            info!("Using Anthropic from environment variable");
            return self.forward_to_anthropic(req, &anthropic_key).await;
        }
        
        if let Ok(llm_url) = std::env::var("LLM_PROVIDER_URL") {
            info!("Using custom LLM provider from environment variable");
            // Try custom LLM provider (OpenAI-compatible API)
            match self.try_forward_to_provider(&llm_url, req).await {
                Ok(response) => return Ok(response),
                Err(e) => warn!("Custom LLM provider unavailable: {}", e),
            }
        }
        
        // Fallback to mock response
        warn!("No LLM provider configured, using mock response");
        Ok(CompletionResponse {
            id: format!("chatcmpl-{}", Uuid::new_v4()),
            model: req.model.clone(),
            choices: vec![crate::Choice {
                message: crate::Message {
                    role: "assistant".to_string(),
                    content: "This is a mock response from AetherGuard proxy. Please configure an LLM provider in the web portal (LLM Providers page) or set OPENAI_API_KEY, ANTHROPIC_API_KEY, or LLM_PROVIDER_URL environment variable.".to_string(),
                },
                finish_reason: "stop".to_string(),
            }],
            usage: crate::Usage {
                prompt_tokens: req.messages.iter().map(|m| m.content.len() as u32 / 4).sum::<u32>(),
                completion_tokens: 20,
                total_tokens: req.messages.iter().map(|m| m.content.len() as u32 / 4).sum::<u32>() + 20,
            },
        })
    }
    
    async fn forward_to_openai(&self, req: &CompletionRequest, api_key: &str) -> Result<CompletionResponse> {
        let client = reqwest::Client::new();
        
        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(req)
            .send()
            .await
            .context("Failed to connect to OpenAI API")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("OpenAI API returned error {}: {}", status, error_text);
        }

        let completion: CompletionResponse = response.json().await
            .context("Failed to parse OpenAI API response")?;

        Ok(completion)
    }
    
    async fn forward_to_anthropic(&self, req: &CompletionRequest, api_key: &str) -> Result<CompletionResponse> {
        let client = reqwest::Client::new();
        
        // Convert OpenAI format to Anthropic format
        let anthropic_request = serde_json::json!({
            "model": req.model.clone(),
            "messages": req.messages.iter().map(|m| {
                serde_json::json!({
                    "role": m.role.clone(),
                    "content": m.content.clone()
                })
            }).collect::<Vec<_>>(),
            "max_tokens": req.max_tokens.unwrap_or(1024),
        });
        
        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&anthropic_request)
            .send()
            .await
            .context("Failed to connect to Anthropic API")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("Anthropic API returned error {}: {}", status, error_text);
        }

        let anthropic_response: serde_json::Value = response.json().await
            .context("Failed to parse Anthropic API response")?;
        
        // Convert Anthropic format back to OpenAI format
        let content = anthropic_response["content"][0]["text"]
            .as_str()
            .unwrap_or("No response")
            .to_string();
        
        Ok(CompletionResponse {
            id: anthropic_response["id"].as_str().unwrap_or("").to_string(),
            model: req.model.clone(),
            choices: vec![crate::Choice {
                message: crate::Message {
                    role: "assistant".to_string(),
                    content,
                },
                finish_reason: anthropic_response["stop_reason"].as_str().unwrap_or("stop").to_string(),
            }],
            usage: crate::Usage {
                prompt_tokens: anthropic_response["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32,
                completion_tokens: anthropic_response["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32,
                total_tokens: (anthropic_response["usage"]["input_tokens"].as_u64().unwrap_or(0) + 
                              anthropic_response["usage"]["output_tokens"].as_u64().unwrap_or(0)) as u32,
            },
        })
    }

    async fn try_forward_to_provider(&self, url: &str, req: &CompletionRequest) -> Result<CompletionResponse> {
        let client = reqwest::Client::new();
        let response = client
            .post(&format!("{}/v1/chat/completions", url))
            .json(req)
            .send()
            .await
            .context("Failed to connect to LLM provider")?;

        if !response.status().is_success() {
            anyhow::bail!("LLM provider returned error: {}", response.status());
        }

        let completion: CompletionResponse = response.json().await
            .context("Failed to parse LLM provider response")?;

        Ok(completion)
    }

    async fn try_forward_to_provider_with_key(&self, url: &str, req: &CompletionRequest, api_key: &str) -> Result<CompletionResponse> {
        let client = reqwest::Client::new();
        let response = client
            .post(&format!("{}/v1/chat/completions", url))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(req)
            .send()
            .await
            .context("Failed to connect to LLM provider")?;

        if !response.status().is_success() {
            anyhow::bail!("LLM provider returned error: {}", response.status());
        }

        let completion: CompletionResponse = response.json().await
            .context("Failed to parse LLM provider response")?;

        Ok(completion)
    }
}
