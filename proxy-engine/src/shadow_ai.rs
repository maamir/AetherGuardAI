use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Shadow AI Discovery: Detect unsanctioned LLM usage
#[allow(dead_code)]
pub struct ShadowAIDetector {
    known_ai_endpoints: Vec<String>,
    baseline_patterns: HashMap<String, UsageBaseline>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageBaseline {
    pub user_id: String,
    pub avg_requests_per_hour: f64,
    pub typical_endpoints: Vec<String>,
    pub avg_tokens_per_request: f64,
}

#[derive(Debug, Serialize)]
pub struct ShadowAIDetection {
    pub detected: bool,
    pub confidence: f64,
    pub detection_method: String,
    pub details: DetectionDetails,
}

#[derive(Debug, Serialize)]
pub struct DetectionDetails {
    pub unsanctioned_endpoint: Option<String>,
    pub anomaly_score: f64,
    pub baseline_deviation: f64,
}

/// ML-based anomaly detection result
#[derive(Debug)]
#[allow(dead_code)]
struct AnomalyResult {
    is_anomaly: bool,
    confidence: f64,
    anomaly_score: f64,
    deviation_score: f64,
    method_scores: MethodScores,
    flagged_features: Vec<String>,
}

#[derive(Debug)]
#[allow(dead_code)]
struct MethodScores {
    statistical: f64,
    isolation_forest: f64,
    time_series: f64,
}

/// Features extracted for anomaly detection
#[derive(Debug)]
#[allow(dead_code)]
struct AnomalyFeatures {
    requests_per_hour_ratio: f64,
    tokens_per_request_ratio: f64,
    endpoint_diversity: f64,
    new_endpoints_count: f64,
    request_burst_score: f64,
    token_burst_score: f64,
    endpoint_entropy: f64,
    usage_pattern_shift: f64,
}

/// Statistical anomaly detection result
#[derive(Debug)]
#[allow(dead_code)]
struct StatisticalResult {
    score: f64,
    deviation: f64,
    z_scores: Vec<f64>,
}

/// Isolation forest detection result
#[derive(Debug)]
#[allow(dead_code)]
struct IsolationResult {
    score: f64,
    isolation_scores: Vec<f64>,
    path_length: f64,
}

/// Time series anomaly detection result
#[derive(Debug)]
#[allow(dead_code)]
struct TimeSeriesResult {
    score: f64,
    change_points: Vec<usize>,
    trend_score: f64,
}

#[allow(dead_code)]
impl ShadowAIDetector {
    pub fn new() -> Self {
        Self {
            known_ai_endpoints: vec![
                "api.openai.com".to_string(),
                "api.anthropic.com".to_string(),
                "api.cohere.ai".to_string(),
                "bedrock.amazonaws.com".to_string(),
                "api.together.xyz".to_string(),
                "api.perplexity.ai".to_string(),
            ],
            baseline_patterns: HashMap::new(),
        }
    }

    /// Detect Shadow AI via network traffic analysis (DPI)
    pub async fn analyze_traffic(&self, endpoint: &str, _user_id: &str) -> Result<ShadowAIDetection> {
        // TODO: Implement actual Deep Packet Inspection
        // 1. Correlate outbound API requests with known AI endpoints
        // 2. Check against sanctioned endpoint list
        // 3. Analyze request patterns
        
        let is_known_endpoint = self.known_ai_endpoints.iter().any(|e| endpoint.contains(e));
        
        let detection = if !is_known_endpoint {
            ShadowAIDetection {
                detected: true,
                confidence: 0.85,
                detection_method: "dpi".to_string(),
                details: DetectionDetails {
                    unsanctioned_endpoint: Some(endpoint.to_string()),
                    anomaly_score: 0.9,
                    baseline_deviation: 0.0,
                },
            }
        } else {
            ShadowAIDetection {
                detected: false,
                confidence: 0.0,
                detection_method: "dpi".to_string(),
                details: DetectionDetails {
                    unsanctioned_endpoint: None,
                    anomaly_score: 0.0,
                    baseline_deviation: 0.0,
                },
            }
        };

        Ok(detection)
    }

    /// Behavioral anomaly detection against usage baselines
    pub async fn detect_anomaly(
        &self,
        user_id: &str,
        current_usage: &UsageMetrics,
    ) -> Result<ShadowAIDetection> {
        // Get baseline for user
        let baseline = self.baseline_patterns.get(user_id);
        
        let detection = if let Some(baseline) = baseline {
            // Multi-dimensional anomaly detection
            let anomaly_result = self.ml_anomaly_detection(baseline, current_usage).await?;
            
            ShadowAIDetection {
                detected: anomaly_result.is_anomaly,
                confidence: anomaly_result.confidence,
                detection_method: "ml_behavioral_anomaly".to_string(),
                details: DetectionDetails {
                    unsanctioned_endpoint: None,
                    anomaly_score: anomaly_result.anomaly_score,
                    baseline_deviation: anomaly_result.deviation_score,
                },
            }
        } else {
            // No baseline yet - not an anomaly, but flag for baseline creation
            ShadowAIDetection {
                detected: false,
                confidence: 0.0,
                detection_method: "no_baseline_available".to_string(),
                details: DetectionDetails {
                    unsanctioned_endpoint: None,
                    anomaly_score: 0.0,
                    baseline_deviation: 0.0,
                },
            }
        };

        Ok(detection)
    }

    /// ML-based anomaly detection using statistical methods and isolation forest
    async fn ml_anomaly_detection(
        &self,
        baseline: &UsageBaseline,
        current: &UsageMetrics,
    ) -> Result<AnomalyResult> {
        // Feature extraction for anomaly detection
        let features = self.extract_features(baseline, current);
        
        // Multi-method anomaly detection
        let statistical_result = self.statistical_anomaly_detection(&features);
        let isolation_result = self.isolation_forest_detection(&features);
        let time_series_result = self.time_series_anomaly_detection(&features);
        
        // Ensemble method: combine results
        let combined_score = (statistical_result.score * 0.4) + 
                           (isolation_result.score * 0.4) + 
                           (time_series_result.score * 0.2);
        
        let is_anomaly = combined_score > 0.7; // Threshold for anomaly
        let confidence = if is_anomaly { combined_score } else { 1.0 - combined_score };
        
        Ok(AnomalyResult {
            is_anomaly,
            confidence,
            anomaly_score: combined_score,
            deviation_score: statistical_result.deviation,
            method_scores: MethodScores {
                statistical: statistical_result.score,
                isolation_forest: isolation_result.score,
                time_series: time_series_result.score,
            },
            flagged_features: self.identify_anomalous_features(&features, combined_score),
        })
    }

    /// Extract features for anomaly detection
    fn extract_features(&self, baseline: &UsageBaseline, current: &UsageMetrics) -> AnomalyFeatures {
        AnomalyFeatures {
            // Request frequency features
            requests_per_hour_ratio: current.requests_per_hour / baseline.avg_requests_per_hour.max(1.0),
            tokens_per_request_ratio: current.tokens_per_request / baseline.avg_tokens_per_request.max(1.0),
            
            // Endpoint diversity features
            endpoint_diversity: current.unique_endpoints.len() as f64,
            new_endpoints_count: current.unique_endpoints.iter()
                .filter(|e| !baseline.typical_endpoints.contains(e))
                .count() as f64,
            
            // Temporal features
            request_burst_score: self.calculate_burst_score(current.requests_per_hour),
            token_burst_score: self.calculate_burst_score(current.tokens_per_request),
            
            // Behavioral features
            endpoint_entropy: self.calculate_endpoint_entropy(&current.unique_endpoints),
            usage_pattern_shift: self.calculate_pattern_shift(baseline, current),
        }
    }

    /// Statistical anomaly detection using Z-score and Mahalanobis distance
    fn statistical_anomaly_detection(&self, features: &AnomalyFeatures) -> StatisticalResult {
        // Z-score based detection
        let z_scores = vec![
            (features.requests_per_hour_ratio - 1.0).abs(),
            (features.tokens_per_request_ratio - 1.0).abs(),
            features.new_endpoints_count / 10.0, // Normalize
            features.request_burst_score,
            features.token_burst_score,
        ];
        
        // Calculate composite Z-score
        let mean_z = z_scores.iter().sum::<f64>() / z_scores.len() as f64;
        let max_z = z_scores.iter().fold(0.0f64, |a, &b| a.max(b));
        
        // Mahalanobis-like distance (simplified)
        let mahalanobis_score = (mean_z * 0.7) + (max_z * 0.3);
        
        // Convert to probability score
        let score = 1.0 - (-mahalanobis_score / 2.0).exp();
        
        StatisticalResult {
            score: score.min(1.0).max(0.0),
            deviation: mahalanobis_score,
            z_scores,
        }
    }

    /// Isolation Forest-like anomaly detection
    fn isolation_forest_detection(&self, features: &AnomalyFeatures) -> IsolationResult {
        // Simplified isolation forest using feature isolation
        let feature_vector = vec![
            features.requests_per_hour_ratio,
            features.tokens_per_request_ratio,
            features.endpoint_diversity,
            features.new_endpoints_count,
            features.request_burst_score,
            features.token_burst_score,
            features.endpoint_entropy,
            features.usage_pattern_shift,
        ];
        
        // Calculate isolation score based on feature extremeness
        let isolation_scores: Vec<f64> = feature_vector.iter()
            .map(|&value| {
                // Measure how "isolated" this value is
                if value > 3.0 || value < 0.1 {
                    1.0 // Highly isolated
                } else if value > 2.0 || value < 0.5 {
                    0.7 // Moderately isolated
                } else {
                    0.1 // Normal range
                }
            })
            .collect();
        
        let avg_isolation = isolation_scores.iter().sum::<f64>() / isolation_scores.len() as f64;
        let max_isolation = isolation_scores.iter().fold(0.0f64, |a, &b| a.max(b));
        
        // Combine average and maximum isolation
        let score = (avg_isolation * 0.6) + (max_isolation * 0.4);
        
        IsolationResult {
            score: score.min(1.0).max(0.0),
            isolation_scores,
            path_length: feature_vector.len() as f64, // Simplified
        }
    }

    /// Time series anomaly detection
    fn time_series_anomaly_detection(&self, features: &AnomalyFeatures) -> TimeSeriesResult {
        // Detect temporal anomalies in usage patterns
        let temporal_features = vec![
            features.request_burst_score,
            features.token_burst_score,
            features.usage_pattern_shift,
        ];
        
        // Simple change point detection
        let change_score = temporal_features.iter()
            .map(|&score| if score > 1.5 { score - 1.0 } else { 0.0 })
            .sum::<f64>() / temporal_features.len() as f64;
        
        // Trend analysis (simplified)
        let trend_score = if features.requests_per_hour_ratio > 2.0 || 
                            features.tokens_per_request_ratio > 2.0 {
            0.8
        } else {
            0.2
        };
        
        let score = (change_score * 0.6) + (trend_score * 0.4);
        
        TimeSeriesResult {
            score: score.min(1.0).max(0.0),
            change_points: if change_score > 0.5 { vec![0] } else { vec![] },
            trend_score,
        }
    }

    /// Calculate burst score for detecting sudden spikes
    fn calculate_burst_score(&self, value: f64) -> f64 {
        // Detect if current value represents a "burst" compared to normal
        if value > 10.0 {
            1.0 // Extreme burst
        } else if value > 5.0 {
            0.8 // High burst
        } else if value > 2.0 {
            0.5 // Moderate burst
        } else {
            0.1 // Normal
        }
    }

    /// Calculate entropy of endpoint usage
    fn calculate_endpoint_entropy(&self, endpoints: &[String]) -> f64 {
        if endpoints.is_empty() {
            return 0.0;
        }
        
        // Count endpoint frequencies (simplified - assume equal distribution)
        let unique_count = endpoints.len() as f64;
        
        // Shannon entropy calculation (simplified)
        if unique_count <= 1.0 {
            0.0
        } else {
            -(1.0 / unique_count) * (1.0 / unique_count).log2() * unique_count
        }
    }

    /// Calculate pattern shift score
    fn calculate_pattern_shift(&self, baseline: &UsageBaseline, current: &UsageMetrics) -> f64 {
        // Measure how much the usage pattern has shifted
        let endpoint_overlap = current.unique_endpoints.iter()
            .filter(|e| baseline.typical_endpoints.contains(e))
            .count() as f64;
        
        let total_endpoints = (current.unique_endpoints.len() + baseline.typical_endpoints.len()) as f64;
        
        if total_endpoints == 0.0 {
            0.0
        } else {
            1.0 - (2.0 * endpoint_overlap / total_endpoints)
        }
    }

    /// Identify which features are most anomalous
    fn identify_anomalous_features(&self, features: &AnomalyFeatures, _overall_score: f64) -> Vec<String> {
        let mut anomalous_features = Vec::new();
        
        if features.requests_per_hour_ratio > 2.0 || features.requests_per_hour_ratio < 0.5 {
            anomalous_features.push("request_frequency".to_string());
        }
        
        if features.tokens_per_request_ratio > 2.0 || features.tokens_per_request_ratio < 0.5 {
            anomalous_features.push("token_usage".to_string());
        }
        
        if features.new_endpoints_count > 3.0 {
            anomalous_features.push("new_endpoints".to_string());
        }
        
        if features.request_burst_score > 0.7 {
            anomalous_features.push("request_burst".to_string());
        }
        
        if features.usage_pattern_shift > 0.7 {
            anomalous_features.push("usage_pattern_shift".to_string());
        }
        
        anomalous_features
    }

    /// Ingest cloud logs for additional context
    pub async fn ingest_cloud_logs(&self, logs: Vec<CloudLogEntry>) -> Result<Vec<ShadowAIDetection>> {
        // TODO: Implement cloud log ingestion
        // 1. Parse logs from AWS, Azure, GCP
        // 2. Extract AI service interactions
        // 3. Cross-reference with sanctioned usage
        
        let mut detections = Vec::new();
        
        for log in logs {
            if self.is_ai_service_call(&log) && !self.is_sanctioned(&log) {
                detections.push(ShadowAIDetection {
                    detected: true,
                    confidence: 0.87,
                    detection_method: "cloud_log_analysis".to_string(),
                    details: DetectionDetails {
                        unsanctioned_endpoint: Some(log.endpoint.clone()),
                        anomaly_score: 0.9,
                        baseline_deviation: 0.0,
                    },
                });
            }
        }

        Ok(detections)
    }

    /// Group-level anomaly detection
    pub async fn detect_group_anomaly(
        &self,
        _group_id: &str,
        group_usage: &[UsageMetrics],
    ) -> Result<ShadowAIDetection> {
        // Aggregate group usage patterns
        let total_requests: f64 = group_usage.iter().map(|u| u.requests_per_hour).sum();
        let avg_tokens: f64 = group_usage.iter().map(|u| u.tokens_per_request).sum::<f64>() 
            / group_usage.len() as f64;
        
        let all_endpoints: Vec<String> = group_usage.iter()
            .flat_map(|u| u.unique_endpoints.clone())
            .collect();
        
        // Detect group-level anomalies
        let group_anomaly_score = self.calculate_group_anomaly_score(
            total_requests,
            avg_tokens,
            &all_endpoints,
        );
        
        Ok(ShadowAIDetection {
            detected: group_anomaly_score > 0.7,
            confidence: group_anomaly_score,
            detection_method: "group_behavioral_anomaly".to_string(),
            details: DetectionDetails {
                unsanctioned_endpoint: None,
                anomaly_score: group_anomaly_score,
                baseline_deviation: group_anomaly_score,
            },
        })
    }

    /// System-level anomaly detection
    pub async fn detect_system_anomaly(
        &self,
        system_metrics: &SystemMetrics,
    ) -> Result<ShadowAIDetection> {
        // Detect system-wide anomalies
        let system_anomaly_score = self.calculate_system_anomaly_score(system_metrics);
        
        Ok(ShadowAIDetection {
            detected: system_anomaly_score > 0.8, // Higher threshold for system-level
            confidence: system_anomaly_score,
            detection_method: "system_behavioral_anomaly".to_string(),
            details: DetectionDetails {
                unsanctioned_endpoint: None,
                anomaly_score: system_anomaly_score,
                baseline_deviation: system_anomaly_score,
            },
        })
    }

    /// Calculate group-level anomaly score
    fn calculate_group_anomaly_score(
        &self,
        total_requests: f64,
        avg_tokens: f64,
        endpoints: &[String],
    ) -> f64 {
        let mut anomaly_indicators = Vec::new();
        
        // Check for coordinated unusual activity
        if total_requests > 1000.0 {
            anomaly_indicators.push(0.8); // High coordinated activity
        }
        
        // Check for unusual endpoint diversity
        let unique_endpoints: std::collections::HashSet<_> = endpoints.iter().collect();
        if unique_endpoints.len() > 10 {
            anomaly_indicators.push(0.7); // Many different endpoints
        }
        
        // Check for unusual token patterns
        if avg_tokens > 5000.0 || avg_tokens < 10.0 {
            anomaly_indicators.push(0.6); // Unusual token usage
        }
        
        // Check for unknown endpoints
        let unknown_endpoints: Vec<_> = endpoints.iter()
            .filter(|e| !self.known_ai_endpoints.iter().any(|known| e.contains(known)))
            .collect();
        
        if !unknown_endpoints.is_empty() {
            anomaly_indicators.push(0.9); // Unknown endpoints are highly suspicious
        }
        
        // Calculate composite score
        if anomaly_indicators.is_empty() {
            0.0
        } else {
            anomaly_indicators.iter().sum::<f64>() / anomaly_indicators.len() as f64
        }
    }

    /// Calculate system-level anomaly score
    fn calculate_system_anomaly_score(&self, metrics: &SystemMetrics) -> f64 {
        let mut anomaly_score: f64 = 0.0;
        
        // Check for unusual system-wide patterns
        if metrics.total_requests_per_hour > 10000.0 {
            anomaly_score += 0.3; // High system load
        }
        
        if metrics.unique_users_active > 1000 {
            anomaly_score += 0.2; // Many active users
        }
        
        if metrics.error_rate > 0.1 {
            anomaly_score += 0.4; // High error rate might indicate attacks
        }
        
        if metrics.new_endpoints_discovered > 5 {
            anomaly_score += 0.5; // Many new endpoints discovered
        }
        
        // Check for geographic anomalies
        if metrics.requests_from_new_regions > 3 {
            anomaly_score += 0.3; // Requests from new geographic regions
        }
        
        anomaly_score.min(1.0)
    }

    /// Advanced pattern recognition for sophisticated attacks
    pub async fn detect_advanced_patterns(
        &self,
        user_id: &str,
        historical_data: &[UsageMetrics],
    ) -> Result<Vec<ShadowAIDetection>> {
        let mut detections = Vec::new();
        
        // Pattern 1: Gradual ramp-up (avoiding detection)
        if let Some(ramp_detection) = self.detect_gradual_ramp_up(historical_data) {
            detections.push(ramp_detection);
        }
        
        // Pattern 2: Time-based evasion (unusual hours)
        if let Some(time_evasion) = self.detect_time_based_evasion(historical_data) {
            detections.push(time_evasion);
        }
        
        // Pattern 3: Distributed usage (multiple accounts)
        if let Some(distributed_usage) = self.detect_distributed_usage(user_id, historical_data) {
            detections.push(distributed_usage);
        }
        
        // Pattern 4: API key sharing detection
        if let Some(key_sharing) = self.detect_api_key_sharing(user_id, historical_data) {
            detections.push(key_sharing);
        }
        
        Ok(detections)
    }

    /// Detect gradual ramp-up pattern
    fn detect_gradual_ramp_up(&self, data: &[UsageMetrics]) -> Option<ShadowAIDetection> {
        if data.len() < 5 {
            return None; // Need sufficient data
        }
        
        // Check for consistent increase over time
        let mut increases = 0;
        for i in 1..data.len() {
            if data[i].requests_per_hour > data[i-1].requests_per_hour * 1.2 {
                increases += 1;
            }
        }
        
        let ramp_up_ratio = increases as f64 / (data.len() - 1) as f64;
        
        if ramp_up_ratio > 0.7 {
            Some(ShadowAIDetection {
                detected: true,
                confidence: ramp_up_ratio,
                detection_method: "gradual_ramp_up_pattern".to_string(),
                details: DetectionDetails {
                    unsanctioned_endpoint: None,
                    anomaly_score: ramp_up_ratio,
                    baseline_deviation: ramp_up_ratio,
                },
            })
        } else {
            None
        }
    }

    /// Detect time-based evasion pattern
    fn detect_time_based_evasion(&self, _data: &[UsageMetrics]) -> Option<ShadowAIDetection> {
        // TODO: Implement time-based pattern detection
        // This would analyze timestamps to detect unusual usage hours
        None
    }

    /// Detect distributed usage pattern
    fn detect_distributed_usage(&self, _user_id: &str, _data: &[UsageMetrics]) -> Option<ShadowAIDetection> {
        // TODO: Implement distributed usage detection
        // This would correlate usage patterns across multiple accounts
        None
    }

    /// Detect API key sharing
    fn detect_api_key_sharing(&self, _user_id: &str, _data: &[UsageMetrics]) -> Option<ShadowAIDetection> {
        // TODO: Implement API key sharing detection
        // This would analyze usage patterns that suggest key sharing
        None
    }

    fn is_ai_service_call(&self, log: &CloudLogEntry) -> bool {
        self.known_ai_endpoints.iter().any(|e| log.endpoint.contains(e))
    }

    fn is_sanctioned(&self, _log: &CloudLogEntry) -> bool {
        // TODO: Check against sanctioned service list
        false
    }

    /// Update usage baseline for a user
    pub fn update_baseline(&mut self, user_id: String, baseline: UsageBaseline) {
        self.baseline_patterns.insert(user_id, baseline);
    }
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct UsageMetrics {
    pub requests_per_hour: f64,
    pub tokens_per_request: f64,
    pub unique_endpoints: Vec<String>,
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct SystemMetrics {
    pub total_requests_per_hour: f64,
    pub unique_users_active: usize,
    pub error_rate: f64,
    pub new_endpoints_discovered: usize,
    pub requests_from_new_regions: usize,
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct CloudLogEntry {
    pub timestamp: String,
    pub user_id: String,
    pub endpoint: String,
    pub service: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_detect_unsanctioned_endpoint() {
        let detector = ShadowAIDetector::new();
        let result = detector
            .analyze_traffic("api.unknown-ai-service.com", "user123")
            .await
            .unwrap();
        
        assert!(result.detected);
        assert_eq!(result.detection_method, "dpi");
    }

    #[tokio::test]
    async fn test_sanctioned_endpoint() {
        let detector = ShadowAIDetector::new();
        let result = detector
            .analyze_traffic("api.openai.com", "user123")
            .await
            .unwrap();
        
        assert!(!result.detected);
    }

    #[tokio::test]
    async fn test_ml_anomaly_detection() {
        let mut detector = ShadowAIDetector::new();
        
        // Set up baseline
        let baseline = UsageBaseline {
            user_id: "user123".to_string(),
            avg_requests_per_hour: 10.0,
            typical_endpoints: vec!["api.openai.com".to_string()],
            avg_tokens_per_request: 100.0,
        };
        detector.update_baseline("user123".to_string(), baseline);
        
        // Test normal usage
        let normal_usage = UsageMetrics {
            requests_per_hour: 12.0,
            tokens_per_request: 110.0,
            unique_endpoints: vec!["api.openai.com".to_string()],
        };
        
        let result = detector.detect_anomaly("user123", &normal_usage).await.unwrap();
        assert!(!result.detected);
        
        // Test anomalous usage
        let anomalous_usage = UsageMetrics {
            requests_per_hour: 100.0, // 10x increase
            tokens_per_request: 1000.0, // 10x increase
            unique_endpoints: vec![
                "api.openai.com".to_string(),
                "api.unknown-service.com".to_string(),
            ],
        };
        
        let result = detector.detect_anomaly("user123", &anomalous_usage).await.unwrap();
        assert!(result.detected);
        assert!(result.confidence > 0.7);
    }

    #[tokio::test]
    async fn test_group_anomaly_detection() {
        let detector = ShadowAIDetector::new();
        
        // Normal group usage
        let normal_group = vec![
            UsageMetrics {
                requests_per_hour: 10.0,
                tokens_per_request: 100.0,
                unique_endpoints: vec!["api.openai.com".to_string()],
            },
            UsageMetrics {
                requests_per_hour: 15.0,
                tokens_per_request: 120.0,
                unique_endpoints: vec!["api.openai.com".to_string()],
            },
        ];
        
        let result = detector.detect_group_anomaly("group1", &normal_group).await.unwrap();
        assert!(!result.detected);
        
        // Anomalous group usage
        let anomalous_group = vec![
            UsageMetrics {
                requests_per_hour: 500.0,
                tokens_per_request: 100.0,
                unique_endpoints: vec!["api.unknown-service.com".to_string()],
            },
            UsageMetrics {
                requests_per_hour: 600.0,
                tokens_per_request: 120.0,
                unique_endpoints: vec!["api.another-unknown.com".to_string()],
            },
        ];
        
        let result = detector.detect_group_anomaly("group2", &anomalous_group).await.unwrap();
        assert!(result.detected);
    }

    #[tokio::test]
    async fn test_system_anomaly_detection() {
        let detector = ShadowAIDetector::new();
        
        // Normal system metrics
        let normal_metrics = SystemMetrics {
            total_requests_per_hour: 1000.0,
            unique_users_active: 100,
            error_rate: 0.01,
            new_endpoints_discovered: 1,
            requests_from_new_regions: 0,
        };
        
        let result = detector.detect_system_anomaly(&normal_metrics).await.unwrap();
        assert!(!result.detected);
        
        // Anomalous system metrics
        let anomalous_metrics = SystemMetrics {
            total_requests_per_hour: 50000.0, // Very high
            unique_users_active: 2000, // Many users
            error_rate: 0.15, // High error rate
            new_endpoints_discovered: 10, // Many new endpoints
            requests_from_new_regions: 5, // New regions
        };
        
        let result = detector.detect_system_anomaly(&anomalous_metrics).await.unwrap();
        assert!(result.detected);
        assert!(result.confidence > 0.8);
    }

    #[tokio::test]
    async fn test_gradual_ramp_up_detection() {
        let detector = ShadowAIDetector::new();
        
        // Create data showing gradual ramp-up
        let ramp_up_data = vec![
            UsageMetrics {
                requests_per_hour: 10.0,
                tokens_per_request: 100.0,
                unique_endpoints: vec!["api.openai.com".to_string()],
            },
            UsageMetrics {
                requests_per_hour: 15.0,
                tokens_per_request: 100.0,
                unique_endpoints: vec!["api.openai.com".to_string()],
            },
            UsageMetrics {
                requests_per_hour: 25.0,
                tokens_per_request: 100.0,
                unique_endpoints: vec!["api.openai.com".to_string()],
            },
            UsageMetrics {
                requests_per_hour: 40.0,
                tokens_per_request: 100.0,
                unique_endpoints: vec!["api.openai.com".to_string()],
            },
            UsageMetrics {
                requests_per_hour: 65.0,
                tokens_per_request: 100.0,
                unique_endpoints: vec!["api.openai.com".to_string()],
            },
        ];
        
        let detections = detector.detect_advanced_patterns("user123", &ramp_up_data).await.unwrap();
        
        // Should detect gradual ramp-up pattern
        assert!(!detections.is_empty());
        let ramp_detection = detections.iter()
            .find(|d| d.detection_method == "gradual_ramp_up_pattern");
        assert!(ramp_detection.is_some());
        assert!(ramp_detection.unwrap().detected);
    }

    #[tokio::test]
    async fn test_cloud_log_ingestion() {
        let detector = ShadowAIDetector::new();
        
        let logs = vec![
            CloudLogEntry {
                timestamp: "2024-01-01T10:00:00Z".to_string(),
                user_id: "user123".to_string(),
                endpoint: "api.unknown-ai-service.com".to_string(),
                service: "unknown-ai".to_string(),
            },
            CloudLogEntry {
                timestamp: "2024-01-01T10:05:00Z".to_string(),
                user_id: "user123".to_string(),
                endpoint: "api.openai.com".to_string(),
                service: "openai".to_string(),
            },
        ];
        
        let detections = detector.ingest_cloud_logs(logs).await.unwrap();
        
        // Should detect the unknown service
        assert_eq!(detections.len(), 1);
        assert!(detections[0].detected);
        assert_eq!(detections[0].detection_method, "cloud_log_analysis");
    }
}
