use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// GDPR/CCPA Compliance Manager
/// Handles data retention, right to erasure, and privacy controls
#[allow(dead_code)]
pub struct ComplianceManager {
    config: ComplianceConfig,
    user_consents: Arc<RwLock<HashMap<String, UserConsent>>>,
    data_retention: Arc<RwLock<HashMap<String, DataRetentionRecord>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceConfig {
    /// Data retention period in days
    pub default_retention_days: i64,
    /// Enable GDPR compliance
    pub gdpr_enabled: bool,
    /// Enable CCPA compliance
    pub ccpa_enabled: bool,
    /// Automatic data deletion
    pub auto_delete_enabled: bool,
    /// Regions subject to GDPR
    pub gdpr_regions: Vec<String>,
    /// Regions subject to CCPA
    pub ccpa_regions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConsent {
    pub user_id: String,
    pub consent_given: bool,
    pub consent_date: DateTime<Utc>,
    pub consent_version: String,
    pub purposes: Vec<String>,
    pub region: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataRetentionRecord {
    pub record_id: String,
    pub user_id: String,
    pub data_type: String,
    pub data_classification: String,
    pub region: String,
    pub consent_given: bool,
    pub processing_restricted: bool,
    pub processing_objected: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub can_be_deleted: bool,
}

#[derive(Debug, Serialize)]
pub struct DataSubjectRequest {
    pub request_id: String,
    pub user_id: String,
    pub request_type: RequestType,
    pub status: RequestStatus,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RequestType {
    Access,           // Right to access
    Rectification,    // Right to rectification
    Erasure,          // Right to erasure (right to be forgotten)
    Portability,      // Right to data portability
    Restriction,      // Right to restriction of processing
    Objection,        // Right to object
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RequestStatus {
    Pending,
    InProgress,
    Completed,
    Rejected,
}

impl Default for ComplianceConfig {
    fn default() -> Self {
        Self {
            default_retention_days: 90, // 90 days default
            gdpr_enabled: true,
            ccpa_enabled: true,
            auto_delete_enabled: true,
            gdpr_regions: vec![
                "EU".to_string(),
                "UK".to_string(),
                "EEA".to_string(),
            ],
            ccpa_regions: vec!["CA".to_string(), "US-CA".to_string()],
        }
    }
}

#[allow(dead_code)]
impl ComplianceManager {
    pub fn new(config: ComplianceConfig) -> Self {
        Self {
            config,
            user_consents: Arc::new(RwLock::new(HashMap::new())),
            data_retention: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check if user is in GDPR region
    pub fn is_gdpr_applicable(&self, region: &str) -> bool {
        self.config.gdpr_enabled && self.config.gdpr_regions.contains(&region.to_string())
    }

    /// Check if user is in CCPA region
    pub fn is_ccpa_applicable(&self, region: &str) -> bool {
        self.config.ccpa_enabled && self.config.ccpa_regions.contains(&region.to_string())
    }

    /// Record user consent
    pub async fn record_consent(
        &self,
        user_id: &str,
        region: &str,
        purposes: Vec<String>,
    ) -> Result<()> {
        let consent = UserConsent {
            user_id: user_id.to_string(),
            consent_given: true,
            consent_date: Utc::now(),
            consent_version: "1.0".to_string(),
            purposes,
            region: region.to_string(),
        };

        let mut consents = self.user_consents.write().await;
        consents.insert(user_id.to_string(), consent);

        tracing::info!("Recorded consent for user: {}", user_id);
        Ok(())
    }

    /// Check if user has given consent
    pub async fn has_consent(&self, user_id: &str, purpose: &str) -> bool {
        let consents = self.user_consents.read().await;
        
        if let Some(consent) = consents.get(user_id) {
            consent.consent_given && consent.purposes.contains(&purpose.to_string())
        } else {
            false
        }
    }

    /// Record data for retention tracking
    pub async fn record_data(
        &self,
        record_id: &str,
        user_id: &str,
        data_type: &str,
        data_classification: &str,
        region: &str,
        consent_given: bool,
    ) -> Result<()> {
        let created_at = Utc::now();
        let retention_days = self.config.default_retention_days;
        let expires_at = created_at + Duration::days(retention_days);

        let record = DataRetentionRecord {
            record_id: record_id.to_string(),
            user_id: user_id.to_string(),
            data_type: data_type.to_string(),
            data_classification: data_classification.to_string(),
            region: region.to_string(),
            consent_given,
            processing_restricted: false,
            processing_objected: false,
            created_at,
            updated_at: created_at,
            expires_at,
            can_be_deleted: true,
        };

        let mut retention = self.data_retention.write().await;
        retention.insert(record_id.to_string(), record);

        tracing::debug!("Recorded data retention for: {} (consent: {})", record_id, consent_given);
        Ok(())
    }

    /// Get expired records that should be deleted
    pub async fn get_expired_records(&self) -> Vec<DataRetentionRecord> {
        let retention = self.data_retention.read().await;
        let now = Utc::now();

        retention
            .values()
            .filter(|record| record.expires_at < now && record.can_be_deleted)
            .cloned()
            .collect()
    }

    /// Delete expired data (automatic cleanup)
    pub async fn cleanup_expired_data(&self) -> Result<usize> {
        let expired = self.get_expired_records().await;
        let count = expired.len();

        if count > 0 {
            let mut retention = self.data_retention.write().await;
            for record in expired {
                retention.remove(&record.record_id);
                tracing::info!("Deleted expired record: {}", record.record_id);
            }
        }

        Ok(count)
    }

    /// Handle data subject request (GDPR Article 15-21)
    pub async fn handle_data_subject_request(
        &self,
        user_id: &str,
        request_type: RequestType,
    ) -> Result<DataSubjectRequest> {
        let request_id = uuid::Uuid::new_v4().to_string();
        
        let mut request = DataSubjectRequest {
            request_id: request_id.clone(),
            user_id: user_id.to_string(),
            request_type: request_type.clone(),
            status: RequestStatus::Pending,
            created_at: Utc::now(),
            completed_at: None,
        };

        // Process the request based on type
        match request_type {
            RequestType::Access => {
                // Right to access (Article 15)
                let user_data = self.get_user_data(user_id).await?;
                request.status = RequestStatus::Completed;
                request.completed_at = Some(Utc::now());
                
                tracing::info!(
                    "Data access request completed: {} for user: {} ({} records)",
                    request_id, user_id, user_data.len()
                );
            }
            RequestType::Erasure => {
                // Right to erasure (Article 17)
                let deleted_count = self.erase_user_data(user_id).await?;
                request.status = RequestStatus::Completed;
                request.completed_at = Some(Utc::now());
                
                tracing::info!(
                    "Data erasure request completed: {} for user: {} ({} records deleted)",
                    request_id, user_id, deleted_count
                );
            }
            RequestType::Portability => {
                // Right to data portability (Article 20)
                let exported_data = self.export_user_data(user_id).await?;
                request.status = RequestStatus::Completed;
                request.completed_at = Some(Utc::now());
                
                tracing::info!(
                    "Data portability request completed: {} for user: {} ({} bytes exported)",
                    request_id, user_id, exported_data.len()
                );
            }
            RequestType::Rectification => {
                // Right to rectification (Article 16)
                request.status = RequestStatus::Pending; // Requires manual review
                
                tracing::info!(
                    "Data rectification request created: {} for user: {} (manual review required)",
                    request_id, user_id
                );
            }
            RequestType::Restriction => {
                // Right to restriction of processing (Article 18)
                self.restrict_user_processing(user_id).await?;
                request.status = RequestStatus::Completed;
                request.completed_at = Some(Utc::now());
                
                tracing::info!(
                    "Data processing restriction applied: {} for user: {}",
                    request_id, user_id
                );
            }
            RequestType::Objection => {
                // Right to object (Article 21)
                self.record_processing_objection(user_id).await?;
                request.status = RequestStatus::Completed;
                request.completed_at = Some(Utc::now());
                
                tracing::info!(
                    "Processing objection recorded: {} for user: {}",
                    request_id, user_id
                );
            }
        }

        Ok(request)
    }

    /// Right to erasure (GDPR Article 17)
    pub async fn erase_user_data(&self, user_id: &str) -> Result<usize> {
        let mut retention = self.data_retention.write().await;
        let mut consents = self.user_consents.write().await;

        // Remove all data for user
        let records_to_remove: Vec<String> = retention
            .iter()
            .filter(|(_, record)| record.user_id == user_id && record.can_be_deleted)
            .map(|(id, _)| id.clone())
            .collect();

        let count = records_to_remove.len();
        for record_id in records_to_remove {
            retention.remove(&record_id);
        }

        // Remove consent
        consents.remove(user_id);

        tracing::info!("Erased {} records for user: {}", count, user_id);
        Ok(count)
    }

    /// Right to access (GDPR Article 15)
    pub async fn get_user_data(&self, user_id: &str) -> Result<Vec<DataRetentionRecord>> {
        let retention = self.data_retention.read().await;
        
        let user_records: Vec<DataRetentionRecord> = retention
            .values()
            .filter(|record| record.user_id == user_id)
            .cloned()
            .collect();

        tracing::info!("Retrieved {} records for user: {}", user_records.len(), user_id);
        Ok(user_records)
    }

    /// Right to data portability (GDPR Article 20)
    pub async fn export_user_data(&self, user_id: &str) -> Result<String> {
        let records = self.get_user_data(user_id).await?;
        let consents = self.user_consents.read().await;
        
        let export_data = serde_json::json!({
            "user_id": user_id,
            "export_date": Utc::now().to_rfc3339(),
            "consent": consents.get(user_id),
            "records": records,
        });

        let json = serde_json::to_string_pretty(&export_data)?;
        tracing::info!("Exported data for user: {}", user_id);
        Ok(json)
    }

    /// Get compliance status for user
    pub async fn get_compliance_status(&self, user_id: &str, region: &str) -> ComplianceStatus {
        let has_consent = self.has_consent(user_id, "data_processing").await;
        let gdpr_applicable = self.is_gdpr_applicable(region);
        let ccpa_applicable = self.is_ccpa_applicable(region);
        
        let retention = self.data_retention.read().await;
        let record_count = retention
            .values()
            .filter(|r| r.user_id == user_id)
            .count();

        ComplianceStatus {
            user_id: user_id.to_string(),
            region: region.to_string(),
            gdpr_applicable,
            ccpa_applicable,
            has_consent,
            record_count,
            retention_days: self.config.default_retention_days,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ComplianceStatus {
    pub user_id: String,
    pub region: String,
    pub gdpr_applicable: bool,
    pub ccpa_applicable: bool,
    pub has_consent: bool,
    pub record_count: usize,
    pub retention_days: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_consent_management() {
        let manager = ComplianceManager::new(ComplianceConfig::default());
        
        manager
            .record_consent("user1", "EU", vec!["data_processing".to_string()])
            .await
            .unwrap();
        
        assert!(manager.has_consent("user1", "data_processing").await);
        assert!(!manager.has_consent("user1", "marketing").await);
    }

    #[tokio::test]
    async fn test_data_retention() {
        let manager = ComplianceManager::new(ComplianceConfig::default());
        
        manager
            .record_data("rec1", "user1", "audit_log", "EU")
            .await
            .unwrap();
        
        let records = manager.get_user_data("user1").await.unwrap();
        assert_eq!(records.len(), 1);
    }

    #[tokio::test]
    async fn test_right_to_erasure() {
        let manager = ComplianceManager::new(ComplianceConfig::default());
        
        manager
            .record_data("rec1", "user1", "audit_log", "EU")
            .await
            .unwrap();
        
        let count = manager.erase_user_data("user1").await.unwrap();
        assert_eq!(count, 1);
        
        let records = manager.get_user_data("user1").await.unwrap();
        assert_eq!(records.len(), 0);
    }
}

#[allow(dead_code)]
impl ComplianceManager {
    /// Restrict processing for a user (Article 18)
    pub async fn restrict_user_processing(&self, user_id: &str) -> Result<()> {
        let mut retention = self.data_retention.write().await;
        
        // Mark all user records as processing-restricted
        for record in retention.values_mut() {
            if record.user_id == user_id {
                record.processing_restricted = true;
                record.updated_at = Utc::now();
            }
        }
        
        tracing::info!("Processing restriction applied for user: {}", user_id);
        Ok(())
    }

    /// Record processing objection (Article 21)
    pub async fn record_processing_objection(&self, user_id: &str) -> Result<()> {
        let mut retention = self.data_retention.write().await;
        
        // Mark user as having objected to processing
        for record in retention.values_mut() {
            if record.user_id == user_id {
                record.processing_objected = true;
                record.updated_at = Utc::now();
            }
        }
        
        tracing::info!("Processing objection recorded for user: {}", user_id);
        Ok(())
    }

    /// Enforce GDPR compliance for request
    pub async fn enforce_gdpr_compliance(
        &self,
        user_id: &str,
        region: &str,
        processing_purpose: &str,
    ) -> Result<ComplianceEnforcement> {
        let is_gdpr_applicable = self.is_gdpr_applicable(region);
        
        if !is_gdpr_applicable {
            return Ok(ComplianceEnforcement {
                allowed: true,
                reason: "GDPR not applicable for region".to_string(),
                requirements: vec![],
            });
        }

        // Check if user has valid consent
        let has_consent = self.has_consent(user_id, processing_purpose).await;
        
        // Check if processing is restricted
        let is_restricted = self.is_processing_restricted(user_id).await;
        
        // Check if user has objected to processing
        let has_objected = self.has_processing_objection(user_id).await;

        let mut requirements = Vec::new();
        let mut allowed = true;

        if !has_consent {
            allowed = false;
            requirements.push("Valid consent required for data processing".to_string());
        }

        if is_restricted {
            allowed = false;
            requirements.push("Data processing is restricted for this user".to_string());
        }

        if has_objected {
            allowed = false;
            requirements.push("User has objected to data processing".to_string());
        }

        // Check data retention limits
        if self.is_data_retention_exceeded(user_id).await {
            requirements.push("Data retention period exceeded - consider deletion".to_string());
        }

        let reason = if allowed {
            "GDPR compliance requirements met".to_string()
        } else {
            format!("GDPR compliance violations: {}", requirements.join(", "))
        };

        Ok(ComplianceEnforcement {
            allowed,
            reason,
            requirements,
        })
    }

    /// Check if processing is restricted for user
    pub async fn is_processing_restricted(&self, user_id: &str) -> bool {
        let retention = self.data_retention.read().await;
        retention.values().any(|record| 
            record.user_id == user_id && record.processing_restricted
        )
    }

    /// Check if user has objected to processing
    pub async fn has_processing_objection(&self, user_id: &str) -> bool {
        let retention = self.data_retention.read().await;
        retention.values().any(|record| 
            record.user_id == user_id && record.processing_objected
        )
    }

    /// Check if data retention period is exceeded
    async fn is_data_retention_exceeded(&self, user_id: &str) -> bool {
        let retention = self.data_retention.read().await;
        let cutoff = Utc::now() - chrono::Duration::days(self.config.default_retention_days);
        
        retention.values().any(|record| 
            record.user_id == user_id && record.created_at < cutoff
        )
    }

    /// Get GDPR compliance report
    pub async fn get_compliance_report(&self) -> ComplianceReport {
        let retention = self.data_retention.read().await;
        let total_records = retention.len();
        
        let mut gdpr_applicable = 0;
        let mut ccpa_applicable = 0;
        let mut consent_given = 0;
        let mut processing_restricted = 0;
        let mut processing_objected = 0;
        let mut retention_exceeded = 0;
        
        let cutoff = Utc::now() - chrono::Duration::days(self.config.default_retention_days);
        
        for record in retention.values() {
            if self.is_gdpr_applicable(&record.region) {
                gdpr_applicable += 1;
            }
            if self.is_ccpa_applicable(&record.region) {
                ccpa_applicable += 1;
            }
            if record.consent_given {
                consent_given += 1;
            }
            if record.processing_restricted {
                processing_restricted += 1;
            }
            if record.processing_objected {
                processing_objected += 1;
            }
            if record.created_at < cutoff {
                retention_exceeded += 1;
            }
        }

        ComplianceReport {
            total_records,
            gdpr_applicable,
            ccpa_applicable,
            consent_given,
            processing_restricted,
            processing_objected,
            retention_exceeded,
            compliance_score: self.calculate_compliance_score(
                total_records,
                consent_given,
                processing_restricted,
                retention_exceeded,
            ),
            generated_at: Utc::now(),
        }
    }

    /// Calculate overall compliance score (0.0 to 1.0)
    fn calculate_compliance_score(
        &self,
        total: usize,
        consent_given: usize,
        processing_restricted: usize,
        retention_exceeded: usize,
    ) -> f64 {
        if total == 0 {
            return 1.0;
        }

        let consent_score = consent_given as f64 / total as f64;
        let restriction_penalty = (processing_restricted as f64 / total as f64) * 0.2;
        let retention_penalty = (retention_exceeded as f64 / total as f64) * 0.3;

        (consent_score - restriction_penalty - retention_penalty).max(0.0).min(1.0)
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ComplianceEnforcement {
    pub allowed: bool,
    pub reason: String,
    pub requirements: Vec<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ComplianceReport {
    pub total_records: usize,
    pub gdpr_applicable: usize,
    pub ccpa_applicable: usize,
    pub consent_given: usize,
    pub processing_restricted: usize,
    pub processing_objected: usize,
    pub retention_exceeded: usize,
    pub compliance_score: f64,
    pub generated_at: DateTime<Utc>,
}