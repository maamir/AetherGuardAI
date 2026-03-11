use crate::{CompletionRequest, CompletionResponse};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tracing::warn;

#[derive(Debug, Serialize)]
pub struct SecurityCheckResult {
    pub pii_detected: bool,
    pub injection_score: f32,
    pub toxicity_score: f32,
    pub hallucination_flag: bool,
    pub dos_detected: bool,
    pub adversarial_detected: bool,
}

#[derive(Debug, Deserialize)]
struct DoSCheckResponse {
    allowed: bool,
    reason: String,
    complexity_score: f32,
}

#[derive(Debug, Deserialize)]
struct AdversarialCheckResponse {
    adversarial_detected: bool,
    normalized_text: String,
    attacks_found: Vec<String>,
}

pub struct SecurityEngine {
    ml_service_url: String,
    http_client: reqwest::Client,
}

impl SecurityEngine {
    pub fn new() -> Self {
        Self {
            ml_service_url: std::env::var("ML_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:8001".to_string()),
            http_client: reqwest::Client::new(),
        }
    }

    /// Stage 3: Input scanning - PII, injection, malicious intent, DoS, adversarial, secrets
    pub async fn scan_input(&self, req: &mut CompletionRequest) -> Result<()> {
        // Extract prompt content
        let prompt_content = req
            .messages
            .iter()
            .map(|m| m.content.as_str())
            .collect::<Vec<_>>()
            .join("\n");

        // Check for adversarial inputs and normalize
        let normalized_content = self.check_adversarial(&prompt_content).await?;
        
        // Check for secrets/credentials
        self.check_secrets(&normalized_content).await?;
        
        // Check for DoS patterns
        self.check_dos(&normalized_content, req.max_tokens).await?;

        // Call ML service for injection detection
        let injection_score = self.check_prompt_injection(&normalized_content).await?;
        if injection_score > 0.7 {
            anyhow::bail!("Prompt injection detected (score: {:.2})", injection_score);
        }

        // Toxicity check on input prompt
        let toxicity_score = self.check_toxicity(&normalized_content).await?;
        if toxicity_score > 0.7 {
            anyhow::bail!("Harmful content detected in prompt (score: {:.2})", toxicity_score);
        }

        // PII detection and redaction
        self.redact_pii(req).await?;

        Ok(())
    }

    /// Stage 6: Output scanning - toxicity, hallucination, bias
    pub async fn scan_output(&self, resp: &CompletionResponse) -> Result<()> {
        let content = &resp.choices[0].message.content;

        // Toxicity check
        let toxicity_score = self.check_toxicity(content).await?;
        if toxicity_score > 0.8 {
            anyhow::bail!("Toxic content detected (score: {:.2})", toxicity_score);
        }

        Ok(())
    }

    async fn check_prompt_injection(&self, prompt: &str) -> Result<f32> {
        // Try to call ML service first
        match self.call_ml_injection_detector(prompt).await {
            Ok(score) => Ok(score),
            Err(e) => {
                warn!("ML injection detector unavailable ({}), using heuristic", e);
                // Fallback to heuristic detection
                let suspicious_patterns = [
                    "ignore previous", "disregard", "system:", "admin mode", 
                    "override", "bypass", "jailbreak", "prompt injection",
                    "forget everything", "new instructions"
                ];
                let score = suspicious_patterns
                    .iter()
                    .filter(|p| prompt.to_lowercase().contains(*p))
                    .count() as f32
                    / suspicious_patterns.len() as f32;

                Ok(score)
            }
        }
    }

    async fn call_ml_injection_detector(&self, prompt: &str) -> Result<f32> {
        let url = format!("{}/detect/injection", self.ml_service_url);
        let payload = serde_json::json!({
            "text": prompt
        });

        let response = self.http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .context("Failed to call injection detection service")?;

        if !response.status().is_success() {
            anyhow::bail!("Injection detection service returned error: {}", response.status());
        }

        let result: serde_json::Value = response.json().await
            .context("Failed to parse injection detection response")?;

        let score = result["injection_score"].as_f64().unwrap_or(0.0) as f32;
        Ok(score)
    }

    async fn redact_pii(&self, req: &mut CompletionRequest) -> Result<()> {
        // TODO: Call Presidio service for PII detection/redaction
        // For now, basic pattern matching
        for message in &mut req.messages {
            message.content = self.simple_pii_redact(&message.content);
        }
        Ok(())
    }

    fn simple_pii_redact(&self, text: &str) -> String {
        // Basic email redaction as placeholder
        let email_pattern = regex::Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
            .unwrap();
        email_pattern.replace_all(text, "[EMAIL_REDACTED]").to_string()
    }

    async fn check_toxicity(&self, content: &str) -> Result<f32> {
        // Try to call ML service first
        match self.call_ml_toxicity_detector(content).await {
            Ok(score) => Ok(score),
            Err(e) => {
                warn!("ML toxicity detector unavailable ({}), using heuristic", e);
                // Fallback to keyword-based detection
                let toxic_words = [
                    "hate", "violence", "explicit", "abuse", "harassment",
                    "discrimination", "threat", "offensive", "inappropriate"
                ];
                let score = toxic_words
                    .iter()
                    .filter(|w| content.to_lowercase().contains(*w))
                    .count() as f32
                    / toxic_words.len() as f32;

                Ok(score)
            }
        }
    }

    async fn call_ml_toxicity_detector(&self, content: &str) -> Result<f32> {
        let url = format!("{}/detect/toxicity", self.ml_service_url);
        let payload = serde_json::json!({
            "text": content
        });

        let response = self.http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .context("Failed to call toxicity detection service")?;

        if !response.status().is_success() {
            anyhow::bail!("Toxicity detection service returned error: {}", response.status());
        }

        let result: serde_json::Value = response.json().await
            .context("Failed to parse toxicity detection response")?;

        let score = result["score"].as_f64().unwrap_or(0.0) as f32;
        Ok(score)
    }

    /// Check for DoS attack patterns
    async fn check_dos(&self, content: &str, max_tokens: Option<u32>) -> Result<()> {
        let url = format!("{}/detect/dos", self.ml_service_url);
        
        let payload = serde_json::json!({
            "text": content,
            "requested_tokens": max_tokens
        });

        let response = self.http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .context("Failed to call DoS detection service")?;

        if !response.status().is_success() {
            tracing::warn!("DoS detection service returned error, allowing request");
            return Ok(());
        }

        let result: DoSCheckResponse = response.json().await
            .context("Failed to parse DoS detection response")?;

        if !result.allowed {
            anyhow::bail!("DoS attack detected: {}", result.reason);
        }

        Ok(())
    }

    /// Check for adversarial inputs and normalize
    async fn check_adversarial(&self, content: &str) -> Result<String> {
        let url = format!("{}/detect/adversarial", self.ml_service_url);
        
        let payload = serde_json::json!({
            "text": content
        });

        let response = self.http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .context("Failed to call adversarial detection service")?;

        if !response.status().is_success() {
            tracing::warn!("Adversarial detection service returned error, using original text");
            return Ok(content.to_string());
        }

        let result: AdversarialCheckResponse = response.json().await
            .context("Failed to parse adversarial detection response")?;

        if result.adversarial_detected {
            tracing::info!(
                "Adversarial input detected and normalized. Attacks: {:?}",
                result.attacks_found
            );
        }

        // Return normalized text
        Ok(result.normalized_text)
    }
    
    /// Check for secrets and credentials
    async fn check_secrets(&self, content: &str) -> Result<()> {
        let url = format!("{}/detect/secrets", self.ml_service_url);
        
        let payload = serde_json::json!({
            "text": content
        });

        let response = self.http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .context("Failed to call secrets detection service")?;

        if !response.status().is_success() {
            tracing::warn!("Secrets detection service returned error, allowing request");
            return Ok(());
        }

        let result: serde_json::Value = response.json().await
            .context("Failed to parse secrets detection response")?;

        let secrets_found = result["secrets_found"].as_bool().unwrap_or(false);
        
        if secrets_found {
            let count = result["count"].as_u64().unwrap_or(0);
            anyhow::bail!("Secrets/credentials detected in request ({} found). Remove sensitive data before sending.", count);
        }

        Ok(())
    }
}
