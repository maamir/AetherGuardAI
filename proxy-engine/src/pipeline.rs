use crate::{audit::AuditLogger, security::SecurityEngine, CompletionRequest, CompletionResponse};
use anyhow::{Context, Result};
use axum::http::HeaderMap;
use chrono::Utc;
use sha2::{Digest, Sha256};
use tracing::warn;
use uuid::Uuid;

pub struct RequestPipeline {
    security: SecurityEngine,
    audit: AuditLogger,
}

impl RequestPipeline {
    pub fn new() -> Self {
        Self {
            security: SecurityEngine::new(),
            audit: AuditLogger::new(),
        }
    }

    /// Seven-stage pipeline processing
    pub async fn process(
        &self,
        mut req: CompletionRequest,
        headers: HeaderMap,
    ) -> Result<(CompletionResponse, HeaderMap)> {
        let request_id = Uuid::new_v4().to_string();
        let start_time = Utc::now();

        // Stage 1: Ingress - already handled by axum
        
        // Stage 2: Auth - validate API key
        self.validate_auth(&headers)?;

        // Stage 3: Cleanse - PII redaction, injection scan
        self.security.scan_input(&mut req).await?;

        // Stage 4: AetherSign - compute request fingerprint
        let input_fingerprint = self.compute_fingerprint(&req);

        // Stage 5: Inference - forward to LLM provider
        let response = self.forward_to_llm(&req).await?;

        // Stage 6: Verify - post-inference checks
        self.security.scan_output(&response).await?;

        // Stage 7: Egress - prepare response with audit headers
        let output_fingerprint = self.compute_response_fingerprint(&response);
        
        // Log to audit trail
        self.audit.log_transaction(
            &request_id,
            &req,
            &response,
            &input_fingerprint,
            &output_fingerprint,
            start_time,
        ).await;

        let mut response_headers = HeaderMap::new();
        response_headers.insert("X-Request-ID", request_id.parse().unwrap());
        response_headers.insert("X-AetherSign", output_fingerprint.parse().unwrap());

        Ok((response, response_headers))
    }

    fn validate_auth(&self, headers: &HeaderMap) -> Result<()> {
        let api_key = headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .context("Missing Authorization header")?;

        if !api_key.starts_with("Bearer ") {
            anyhow::bail!("Invalid Authorization format");
        }

        // TODO: Validate against Cognito/API Gateway
        Ok(())
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

    async fn forward_to_llm(&self, req: &CompletionRequest) -> Result<CompletionResponse> {
        // Check for LLM provider configuration
        // Priority: OPENAI_API_KEY > ANTHROPIC_API_KEY > AWS_BEDROCK > LLM_PROVIDER_URL
        
        if let Ok(openai_key) = std::env::var("OPENAI_API_KEY") {
            return self.forward_to_openai(req, &openai_key).await;
        }
        
        if let Ok(anthropic_key) = std::env::var("ANTHROPIC_API_KEY") {
            return self.forward_to_anthropic(req, &anthropic_key).await;
        }
        
        if let Ok(llm_url) = std::env::var("LLM_PROVIDER_URL") {
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
                    content: "This is a mock response from AetherGuard proxy. Configure an LLM provider by setting OPENAI_API_KEY, ANTHROPIC_API_KEY, or LLM_PROVIDER_URL environment variable.".to_string(),
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
}
