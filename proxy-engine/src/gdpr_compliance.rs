use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// GDPR/CCPA Compliance Manager
/// Handles data retention, right to erasure, and privacy controls
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
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub region: String,
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
        region: &str,
    ) -> Result<()> {
        let created_at = Utc::now();
        let retention_days = self.config.default_retention_days;
        let expires_at = created_at + Duration::days(retention_days);

        let record = DataRetentionRecord {
            record_id: record_id.to_string(),
            user_id: user_id.to_string(),
            data_type: data_type.to_string(),
            created_at,
            expires_at,
            region: region.to_string(),
            can_be_deleted: true,
        };

        let mut retention = self.data_retention.write().await;
        retention.insert(record_id.to_string(), record);

        tracing::debug!("Recorded data retention for: {}", record_id);
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
        
        let request = DataSubjectRequest {
            request_id: request_id.clone(),
            user_id: user_id.to_string(),
            request_type: request_type.clone(),
            status: RequestStatus::Pending,
            created_at: Utc::now(),
            completed_at: None,
        };

        tracing::info!(
            "Created data subject request: {} for user: {} (type: {:?})",
            request_id,
            user_id,
            request_type
        );

        // In production, this would queue the request for processing
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
