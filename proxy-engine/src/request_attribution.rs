/**
 * Request Attribution System
 * 
 * Provides comprehensive request tracking, fingerprinting, and correlation
 * for audit trails and security analysis.
 */

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use sha2::{Sha256, Digest};
use axum::http::{HeaderMap, HeaderValue};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestAttribution {
    pub request_id: String,
    pub correlation_id: String,
    pub user_id: Option<String>,
    pub tenant_id: Option<String>,
    pub fingerprint: RequestFingerprint,
    pub metadata: RequestMetadata,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestFingerprint {
    pub ip_hash: String,
    pub user_agent_hash: String,
    pub headers_hash: String,
    pub payload_hash: String,
    pub session_fingerprint: String,
    pub device_fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestMetadata {
    pub source_ip: String,
    pub user_agent: String,
    pub method: String,
    pub path: String,
    pub query_params: HashMap<String, String>,
    pub content_type: Option<String>,
    pub content_length: Option<u64>,
    pub referer: Option<String>,
    pub origin: Option<String>,
    pub x_forwarded_for: Option<String>,
    pub x_real_ip: Option<String>,
    pub accept_language: Option<String>,
    pub accept_encoding: Option<String>,
    pub connection_type: Option<String>,
    pub tls_version: Option<String>,
    pub cipher_suite: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestCorrelation {
    pub correlation_id: String,
    pub request_ids: Vec<String>,
    pub session_id: Option<String>,
    pub user_journey: Vec<RequestStep>,
    pub total_requests: u32,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub risk_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestStep {
    pub request_id: String,
    pub timestamp: DateTime<Utc>,
    pub path: String,
    pub method: String,
    pub response_status: Option<u16>,
    pub processing_time_ms: Option<u64>,
    pub security_events: Vec<String>,
}

pub struct RequestAttributionEngine {
    attributions: Arc<RwLock<HashMap<String, RequestAttribution>>>,
    correlations: Arc<RwLock<HashMap<String, RequestCorrelation>>>,
    fingerprint_cache: Arc<RwLock<HashMap<String, String>>>,
    secret_key: String,
}

impl RequestAttributionEngine {
    pub fn new(secret_key: Option<String>) -> Self {
        Self {
            attributions: Arc::new(RwLock::new(HashMap::new())),
            correlations: Arc::new(RwLock::new(HashMap::new())),
            fingerprint_cache: Arc::new(RwLock::new(HashMap::new())),
            secret_key: secret_key.unwrap_or_else(|| "aetherguard-attribution-key".to_string()),
        }
    }

    /// Create request attribution for incoming request
    pub async fn create_attribution(
        &self,
        headers: &HeaderMap,
        method: &str,
        path: &str,
        query: &str,
        body: &[u8],
        user_id: Option<String>,
        tenant_id: Option<String>,
    ) -> Result<RequestAttribution> {
        let request_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Extract metadata from request
        let metadata = self.extract_metadata(headers, method, path, query).await?;
        
        // Generate fingerprint
        let fingerprint = self.generate_fingerprint(headers, &metadata, body).await?;
        
        // Find or create correlation
        let correlation_id = self.find_or_create_correlation(&fingerprint, &metadata).await?;

        let attribution = RequestAttribution {
            request_id: request_id.clone(),
            correlation_id: correlation_id.clone(),
            user_id,
            tenant_id,
            fingerprint,
            metadata,
            created_at: now,
            updated_at: now,
        };

        // Store attribution
        {
            let mut attributions = self.attributions.write().await;
            attributions.insert(request_id.clone(), attribution.clone());
        }

        // Update correlation
        self.update_correlation(&correlation_id, &request_id, path, method).await?;

        info!(
            "Request attribution created: {} (correlation: {})",
            request_id, correlation_id
        );

        Ok(attribution)
    }

    /// Update attribution with response information
    pub async fn update_attribution(
        &self,
        request_id: &str,
        response_status: u16,
        processing_time_ms: u64,
        security_events: Vec<String>,
    ) -> Result<()> {
        let mut attributions = self.attributions.write().await;
        
        if let Some(attribution) = attributions.get_mut(request_id) {
            attribution.updated_at = Utc::now();
            
            // Update correlation with response info
            self.update_correlation_response(
                &attribution.correlation_id,
                request_id,
                response_status,
                processing_time_ms,
                security_events,
            ).await?;
            
            debug!("Attribution updated: {} (status: {})", request_id, response_status);
        } else {
            warn!("Attribution not found for request: {}", request_id);
        }

        Ok(())
    }

    /// Get attribution by request ID
    pub async fn get_attribution(&self, request_id: &str) -> Option<RequestAttribution> {
        let attributions = self.attributions.read().await;
        attributions.get(request_id).cloned()
    }

    /// Get correlation by correlation ID
    pub async fn get_correlation(&self, correlation_id: &str) -> Option<RequestCorrelation> {
        let correlations = self.correlations.read().await;
        correlations.get(correlation_id).cloned()
    }

    /// Find attributions by user ID
    pub async fn find_by_user(&self, user_id: &str) -> Vec<RequestAttribution> {
        let attributions = self.attributions.read().await;
        attributions
            .values()
            .filter(|attr| attr.user_id.as_ref() == Some(&user_id.to_string()))
            .cloned()
            .collect()
    }

    /// Find attributions by fingerprint similarity
    pub async fn find_by_fingerprint_similarity(
        &self,
        fingerprint: &RequestFingerprint,
        threshold: f64,
    ) -> Vec<RequestAttribution> {
        let attributions = self.attributions.read().await;
        let mut similar = Vec::new();

        for attribution in attributions.values() {
            let similarity = self.calculate_fingerprint_similarity(fingerprint, &attribution.fingerprint);
            if similarity >= threshold {
                similar.push(attribution.clone());
            }
        }

        similar.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        similar
    }

    /// Generate comprehensive request fingerprint
    async fn generate_fingerprint(
        &self,
        headers: &HeaderMap,
        metadata: &RequestMetadata,
        body: &[u8],
    ) -> Result<RequestFingerprint> {
        // Hash IP address for privacy
        let ip_hash = self.hash_with_secret(&metadata.source_ip);
        
        // Hash User-Agent
        let user_agent_hash = self.hash_with_secret(&metadata.user_agent);
        
        // Hash relevant headers (excluding volatile ones)
        let stable_headers = self.extract_stable_headers(headers);
        let headers_hash = self.hash_with_secret(&stable_headers);
        
        // Hash payload (first 1KB for performance)
        let payload_sample = if body.len() > 1024 { &body[..1024] } else { body };
        let payload_hash = self.hash_with_secret(&base64::encode(payload_sample));
        
        // Generate session fingerprint from multiple factors
        let session_data = format!(
            "{}:{}:{}:{}",
            metadata.source_ip,
            metadata.user_agent,
            metadata.accept_language.as_deref().unwrap_or(""),
            metadata.accept_encoding.as_deref().unwrap_or("")
        );
        let session_fingerprint = self.hash_with_secret(&session_data);
        
        // Generate device fingerprint (if available)
        let device_fingerprint = self.generate_device_fingerprint(headers, metadata).await;

        Ok(RequestFingerprint {
            ip_hash,
            user_agent_hash,
            headers_hash,
            payload_hash,
            session_fingerprint,
            device_fingerprint,
        })
    }

    /// Extract request metadata from headers and request info
    async fn extract_metadata(
        &self,
        headers: &HeaderMap,
        method: &str,
        path: &str,
        query: &str,
    ) -> Result<RequestMetadata> {
        let get_header = |name: &str| -> Option<String> {
            headers.get(name)
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        };

        // Parse query parameters
        let query_params: HashMap<String, String> = if !query.is_empty() {
            query.split('&')
                .filter_map(|pair| {
                    let mut parts = pair.splitn(2, '=');
                    match (parts.next(), parts.next()) {
                        (Some(key), Some(value)) => Some((
                            urlencoding::decode(key).ok()?.to_string(),
                            urlencoding::decode(value).ok()?.to_string()
                        )),
                        _ => None,
                    }
                })
                .collect()
        } else {
            HashMap::new()
        };

        // Extract IP address (considering proxies)
        let source_ip = get_header("x-forwarded-for")
            .or_else(|| get_header("x-real-ip"))
            .or_else(|| get_header("cf-connecting-ip"))
            .unwrap_or_else(|| "unknown".to_string());

        Ok(RequestMetadata {
            source_ip,
            user_agent: get_header("user-agent").unwrap_or_else(|| "unknown".to_string()),
            method: method.to_string(),
            path: path.to_string(),
            query_params,
            content_type: get_header("content-type"),
            content_length: get_header("content-length")
                .and_then(|s| s.parse().ok()),
            referer: get_header("referer"),
            origin: get_header("origin"),
            x_forwarded_for: get_header("x-forwarded-for"),
            x_real_ip: get_header("x-real-ip"),
            accept_language: get_header("accept-language"),
            accept_encoding: get_header("accept-encoding"),
            connection_type: get_header("connection"),
            tls_version: get_header("ssl-protocol"),
            cipher_suite: get_header("ssl-cipher"),
        })
    }

    /// Find existing correlation or create new one
    async fn find_or_create_correlation(
        &self,
        fingerprint: &RequestFingerprint,
        metadata: &RequestMetadata,
    ) -> Result<String> {
        let correlations = self.correlations.read().await;
        
        // Look for existing correlation based on session fingerprint
        for correlation in correlations.values() {
            if let Some(last_request) = correlation.user_journey.last() {
                // Check if this could be the same session (within time window)
                let time_diff = Utc::now().signed_duration_since(last_request.timestamp);
                if time_diff.num_minutes() < 30 { // 30-minute session window
                    // Check fingerprint similarity
                    if let Some(existing_attr) = self.attributions.read().await.get(&last_request.request_id) {
                        let similarity = self.calculate_fingerprint_similarity(
                            fingerprint,
                            &existing_attr.fingerprint
                        );
                        if similarity > 0.8 { // 80% similarity threshold
                            return Ok(correlation.correlation_id.clone());
                        }
                    }
                }
            }
        }
        
        drop(correlations);
        
        // Create new correlation
        let correlation_id = Uuid::new_v4().to_string();
        let correlation = RequestCorrelation {
            correlation_id: correlation_id.clone(),
            request_ids: Vec::new(),
            session_id: None,
            user_journey: Vec::new(),
            total_requests: 0,
            first_seen: Utc::now(),
            last_seen: Utc::now(),
            risk_score: 0.0,
        };

        let mut correlations = self.correlations.write().await;
        correlations.insert(correlation_id.clone(), correlation);

        Ok(correlation_id)
    }

    /// Update correlation with new request
    async fn update_correlation(
        &self,
        correlation_id: &str,
        request_id: &str,
        path: &str,
        method: &str,
    ) -> Result<()> {
        let mut correlations = self.correlations.write().await;
        
        if let Some(correlation) = correlations.get_mut(correlation_id) {
            correlation.request_ids.push(request_id.to_string());
            correlation.total_requests += 1;
            correlation.last_seen = Utc::now();
            
            let step = RequestStep {
                request_id: request_id.to_string(),
                timestamp: Utc::now(),
                path: path.to_string(),
                method: method.to_string(),
                response_status: None,
                processing_time_ms: None,
                security_events: Vec::new(),
            };
            
            correlation.user_journey.push(step);
            
            // Update risk score based on request patterns
            correlation.risk_score = self.calculate_risk_score(correlation);
        }

        Ok(())
    }

    /// Update correlation with response information
    async fn update_correlation_response(
        &self,
        correlation_id: &str,
        request_id: &str,
        response_status: u16,
        processing_time_ms: u64,
        security_events: Vec<String>,
    ) -> Result<()> {
        let mut correlations = self.correlations.write().await;
        
        if let Some(correlation) = correlations.get_mut(correlation_id) {
            // Find and update the corresponding step
            if let Some(step) = correlation.user_journey
                .iter_mut()
                .find(|s| s.request_id == request_id) {
                step.response_status = Some(response_status);
                step.processing_time_ms = Some(processing_time_ms);
                step.security_events = security_events;
            }
            
            // Recalculate risk score
            correlation.risk_score = self.calculate_risk_score(correlation);
        }

        Ok(())
    }

    /// Calculate fingerprint similarity (0.0 to 1.0)
    fn calculate_fingerprint_similarity(
        &self,
        fp1: &RequestFingerprint,
        fp2: &RequestFingerprint,
    ) -> f64 {
        let mut matches = 0;
        let mut total = 0;

        // Compare each fingerprint component
        if fp1.ip_hash == fp2.ip_hash { matches += 1; }
        total += 1;

        if fp1.user_agent_hash == fp2.user_agent_hash { matches += 1; }
        total += 1;

        if fp1.headers_hash == fp2.headers_hash { matches += 1; }
        total += 1;

        if fp1.session_fingerprint == fp2.session_fingerprint { matches += 1; }
        total += 1;

        if let (Some(d1), Some(d2)) = (&fp1.device_fingerprint, &fp2.device_fingerprint) {
            if d1 == d2 { matches += 1; }
            total += 1;
        }

        matches as f64 / total as f64
    }

    /// Calculate risk score for correlation
    fn calculate_risk_score(&self, correlation: &RequestCorrelation) -> f64 {
        let mut risk = 0.0;

        // High request frequency
        let requests_per_minute = correlation.total_requests as f64 / 
            (Utc::now().signed_duration_since(correlation.first_seen).num_minutes() as f64 + 1.0);
        if requests_per_minute > 10.0 {
            risk += 0.3;
        }

        // Security events
        let security_events: usize = correlation.user_journey
            .iter()
            .map(|step| step.security_events.len())
            .sum();
        if security_events > 0 {
            risk += (security_events as f64 * 0.1).min(0.4);
        }

        // Error responses
        let error_responses = correlation.user_journey
            .iter()
            .filter(|step| step.response_status.map_or(false, |s| s >= 400))
            .count();
        if error_responses > 3 {
            risk += 0.2;
        }

        // Unusual paths
        let unique_paths: std::collections::HashSet<_> = correlation.user_journey
            .iter()
            .map(|step| &step.path)
            .collect();
        if unique_paths.len() > 20 {
            risk += 0.1;
        }

        risk.min(1.0)
    }

    /// Extract stable headers for fingerprinting
    fn extract_stable_headers(&self, headers: &HeaderMap) -> String {
        let stable_header_names = [
            "accept",
            "accept-language",
            "accept-encoding",
            "cache-control",
            "dnt",
            "upgrade-insecure-requests",
        ];

        let mut stable_headers = Vec::new();
        for name in &stable_header_names {
            if let Some(value) = headers.get(*name) {
                if let Ok(value_str) = value.to_str() {
                    stable_headers.push(format!("{}:{}", name, value_str));
                }
            }
        }

        stable_headers.join("|")
    }

    /// Generate device fingerprint from available headers
    async fn generate_device_fingerprint(
        &self,
        headers: &HeaderMap,
        metadata: &RequestMetadata,
    ) -> Option<String> {
        // Combine device-specific information
        let device_info = format!(
            "{}:{}:{}",
            metadata.user_agent,
            metadata.accept_language.as_deref().unwrap_or(""),
            headers.get("sec-ch-ua")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
        );

        if device_info.len() > 2 {
            Some(self.hash_with_secret(&device_info))
        } else {
            None
        }
    }

    /// Hash data with secret key
    fn hash_with_secret(&self, data: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.secret_key.as_bytes());
        hasher.update(data.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Clean up old attributions (for memory management)
    pub async fn cleanup_old_attributions(&self, max_age_hours: i64) -> Result<usize> {
        let cutoff = Utc::now() - chrono::Duration::hours(max_age_hours);
        let mut removed_count = 0;

        {
            let mut attributions = self.attributions.write().await;
            attributions.retain(|_, attr| {
                if attr.created_at < cutoff {
                    removed_count += 1;
                    false
                } else {
                    true
                }
            });
        }

        {
            let mut correlations = self.correlations.write().await;
            correlations.retain(|_, corr| corr.first_seen >= cutoff);
        }

        if removed_count > 0 {
            info!("Cleaned up {} old request attributions", removed_count);
        }

        Ok(removed_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderName, HeaderValue};

    #[tokio::test]
    async fn test_create_attribution() {
        let engine = RequestAttributionEngine::new(None);
        let mut headers = HeaderMap::new();
        headers.insert("user-agent", HeaderValue::from_static("test-agent"));
        headers.insert("x-forwarded-for", HeaderValue::from_static("192.168.1.1"));

        let attribution = engine.create_attribution(
            &headers,
            "POST",
            "/api/test",
            "param=value",
            b"test body",
            Some("user123".to_string()),
            Some("tenant456".to_string()),
        ).await.unwrap();

        assert_eq!(attribution.user_id, Some("user123".to_string()));
        assert_eq!(attribution.tenant_id, Some("tenant456".to_string()));
        assert_eq!(attribution.metadata.method, "POST");
        assert_eq!(attribution.metadata.path, "/api/test");
    }

    #[tokio::test]
    async fn test_fingerprint_similarity() {
        let engine = RequestAttributionEngine::new(None);
        
        let fp1 = RequestFingerprint {
            ip_hash: "hash1".to_string(),
            user_agent_hash: "ua1".to_string(),
            headers_hash: "headers1".to_string(),
            payload_hash: "payload1".to_string(),
            session_fingerprint: "session1".to_string(),
            device_fingerprint: Some("device1".to_string()),
        };

        let fp2 = RequestFingerprint {
            ip_hash: "hash1".to_string(),
            user_agent_hash: "ua1".to_string(),
            headers_hash: "headers1".to_string(),
            payload_hash: "payload2".to_string(),
            session_fingerprint: "session1".to_string(),
            device_fingerprint: Some("device1".to_string()),
        };

        let similarity = engine.calculate_fingerprint_similarity(&fp1, &fp2);
        assert!(similarity > 0.8); // Should be high similarity
    }

    #[tokio::test]
    async fn test_correlation_creation() {
        let engine = RequestAttributionEngine::new(None);
        let mut headers = HeaderMap::new();
        headers.insert("user-agent", HeaderValue::from_static("test-agent"));

        let attr1 = engine.create_attribution(
            &headers,
            "GET",
            "/api/test1",
            "",
            b"",
            Some("user123".to_string()),
            None,
        ).await.unwrap();

        let attr2 = engine.create_attribution(
            &headers,
            "GET",
            "/api/test2",
            "",
            b"",
            Some("user123".to_string()),
            None,
        ).await.unwrap();

        // Should have same correlation ID due to similar fingerprint
        assert_eq!(attr1.correlation_id, attr2.correlation_id);
    }
}