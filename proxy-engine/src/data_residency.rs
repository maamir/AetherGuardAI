/**
 * Data Residency Enforcement System
 * 
 * Ensures data remains within specified geographic boundaries
 * for compliance with GDPR, CCPA, and other regional regulations.
 */

use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};
use chrono::{DateTime, Utc};
use reqwest::Client;
use std::net::IpAddr;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataResidencyPolicy {
    pub policy_id: String,
    pub name: String,
    pub description: String,
    pub allowed_regions: Vec<String>,
    pub blocked_regions: Vec<String>,
    pub data_classification: DataClassification,
    pub enforcement_level: EnforcementLevel,
    pub exceptions: Vec<ResidencyException>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataClassification {
    Public,
    Internal,
    Confidential,
    Restricted,
    PersonalData,
    SensitivePersonalData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnforcementLevel {
    Advisory,    // Log violations but allow
    Warning,     // Log and warn but allow
    Blocking,    // Block violating requests
    Strict,      // Block and audit all violations
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResidencyException {
    pub exception_id: String,
    pub reason: String,
    pub allowed_regions: Vec<String>,
    pub user_patterns: Vec<String>,
    pub ip_ranges: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub approved_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeolocationInfo {
    pub ip_address: String,
    pub country_code: String,
    pub country_name: String,
    pub region_code: String,
    pub region_name: String,
    pub city: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
    pub isp: String,
    pub organization: String,
    pub is_proxy: bool,
    pub is_vpn: bool,
    pub is_tor: bool,
    pub threat_level: ThreatLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResidencyViolation {
    pub violation_id: String,
    pub request_id: String,
    pub user_id: Option<String>,
    pub tenant_id: Option<String>,
    pub policy_id: String,
    pub source_ip: String,
    pub detected_region: String,
    pub allowed_regions: Vec<String>,
    pub violation_type: ViolationType,
    pub enforcement_action: EnforcementAction,
    pub geolocation: GeolocationInfo,
    pub timestamp: DateTime<Utc>,
    pub resolved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ViolationType {
    UnauthorizedRegion,
    BlockedRegion,
    CrossBorderTransfer,
    ProxyDetected,
    VpnDetected,
    TorDetected,
    SuspiciousLocation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnforcementAction {
    Allowed,
    Warned,
    Blocked,
    Audited,
    Escalated,
}

#[allow(dead_code)]
pub struct DataResidencyEnforcer {
    policies: Arc<RwLock<HashMap<String, DataResidencyPolicy>>>,
    violations: Arc<RwLock<HashMap<String, ResidencyViolation>>>,
    geolocation_cache: Arc<RwLock<HashMap<String, GeolocationInfo>>>,
    http_client: Client,
    geolocation_api_key: Option<String>,
    default_policy: DataResidencyPolicy,
}

#[allow(dead_code)]
impl DataResidencyEnforcer {
    pub fn new(geolocation_api_key: Option<String>) -> Self {
        let default_policy = DataResidencyPolicy {
            policy_id: "default".to_string(),
            name: "Default Data Residency Policy".to_string(),
            description: "Default policy allowing all regions".to_string(),
            allowed_regions: vec!["*".to_string()],
            blocked_regions: vec![],
            data_classification: DataClassification::Internal,
            enforcement_level: EnforcementLevel::Advisory,
            exceptions: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            enabled: true,
        };

        Self {
            policies: Arc::new(RwLock::new(HashMap::new())),
            violations: Arc::new(RwLock::new(HashMap::new())),
            geolocation_cache: Arc::new(RwLock::new(HashMap::new())),
            http_client: Client::new(),
            geolocation_api_key,
            default_policy,
        }
    }

    /// Enforce data residency for a request
    pub async fn enforce_residency(
        &self,
        request_id: &str,
        user_id: Option<&str>,
        tenant_id: Option<&str>,
        source_ip: &str,
        data_classification: DataClassification,
    ) -> Result<EnforcementResult> {
        // Get geolocation information
        let geolocation = self.get_geolocation(source_ip).await?;
        
        // Find applicable policy
        let policy = self.find_applicable_policy(tenant_id, &data_classification).await;
        
        // Check if request violates policy
        let violation_check = self.check_violation(&policy, &geolocation, source_ip).await?;
        
        match violation_check {
            Some(violation_type) => {
                // Handle violation
                let enforcement_action = self.handle_violation(
                    request_id,
                    user_id,
                    tenant_id,
                    &policy,
                    &geolocation,
                    violation_type.clone(),
                ).await?;
                
                Ok(EnforcementResult {
                    allowed: matches!(enforcement_action, EnforcementAction::Allowed | EnforcementAction::Warned),
                    policy_id: policy.policy_id.clone(),
                    detected_region: geolocation.country_code.clone(),
                    violation_type: Some(violation_type.clone()),
                    enforcement_action: enforcement_action.clone(),
                    geolocation: geolocation.clone(),
                    message: self.get_enforcement_message(&enforcement_action, &violation_type),
                })
            }
            None => {
                // No violation
                debug!(
                    "Data residency check passed: {} from {} ({})",
                    request_id, source_ip, geolocation.country_code
                );
                
                Ok(EnforcementResult {
                    allowed: true,
                    policy_id: policy.policy_id.clone(),
                    detected_region: geolocation.country_code.clone(),
                    violation_type: None,
                    enforcement_action: EnforcementAction::Allowed,
                    geolocation,
                    message: "Request allowed".to_string(),
                })
            }
        }
    }

    /// Get geolocation information for IP address
    async fn get_geolocation(&self, ip_address: &str) -> Result<GeolocationInfo> {
        // Check cache first
        {
            let cache = self.geolocation_cache.read().await;
            if let Some(cached) = cache.get(ip_address) {
                return Ok(cached.clone());
            }
        }

        // Parse IP address
        let ip: IpAddr = ip_address.parse()
            .map_err(|_| anyhow!("Invalid IP address: {}", ip_address))?;

        // Skip private/local IPs
        if self.is_private_ip(&ip) {
            let local_geo = GeolocationInfo {
                ip_address: ip_address.to_string(),
                country_code: "LOCAL".to_string(),
                country_name: "Local Network".to_string(),
                region_code: "LOCAL".to_string(),
                region_name: "Local Network".to_string(),
                city: "Local".to_string(),
                latitude: 0.0,
                longitude: 0.0,
                timezone: "UTC".to_string(),
                isp: "Local Network".to_string(),
                organization: "Private".to_string(),
                is_proxy: false,
                is_vpn: false,
                is_tor: false,
                threat_level: ThreatLevel::Low,
            };

            // Cache the result
            {
                let mut cache = self.geolocation_cache.write().await;
                cache.insert(ip_address.to_string(), local_geo.clone());
            }

            return Ok(local_geo);
        }

        // Query geolocation service
        let geolocation = self.query_geolocation_service(ip_address).await
            .unwrap_or_else(|e| {
                warn!("Geolocation query failed for {}: {}", ip_address, e);
                self.create_fallback_geolocation(ip_address)
            });

        // Cache the result
        {
            let mut cache = self.geolocation_cache.write().await;
            cache.insert(ip_address.to_string(), geolocation.clone());
        }

        Ok(geolocation)
    }

    /// Query external geolocation service
    async fn query_geolocation_service(&self, ip_address: &str) -> Result<GeolocationInfo> {
        if let Some(api_key) = &self.geolocation_api_key {
            // Use premium geolocation service (e.g., MaxMind, IPinfo)
            let url = format!("https://ipinfo.io/{}?token={}", ip_address, api_key);
            
            let response = self.http_client
                .get(&url)
                .timeout(std::time::Duration::from_secs(5))
                .send()
                .await?;

            if response.status().is_success() {
                let data: serde_json::Value = response.json().await?;
                return self.parse_ipinfo_response(ip_address, &data);
            }
        }

        // Fallback to free service
        self.query_free_geolocation_service(ip_address).await
    }

    /// Query free geolocation service
    async fn query_free_geolocation_service(&self, ip_address: &str) -> Result<GeolocationInfo> {
        let url = format!("http://ip-api.com/json/{}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,proxy,query", ip_address);
        
        let response = self.http_client
            .get(&url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            return self.parse_ip_api_response(ip_address, &data);
        }

        Err(anyhow!("Geolocation service unavailable"))
    }

    /// Parse IPinfo.io response
    fn parse_ipinfo_response(&self, ip_address: &str, data: &serde_json::Value) -> Result<GeolocationInfo> {
        let country_code = data["country"].as_str().unwrap_or("UNKNOWN").to_string();
        let region = data["region"].as_str().unwrap_or("").to_string();
        let city = data["city"].as_str().unwrap_or("").to_string();
        let org = data["org"].as_str().unwrap_or("").to_string();
        
        // Parse location coordinates
        let (lat, lon) = if let Some(loc) = data["loc"].as_str() {
            let coords: Vec<&str> = loc.split(',').collect();
            if coords.len() == 2 {
                (
                    coords[0].parse().unwrap_or(0.0),
                    coords[1].parse().unwrap_or(0.0)
                )
            } else {
                (0.0, 0.0)
            }
        } else {
            (0.0, 0.0)
        };

        // Detect threats
        let is_proxy = data["proxy"].as_bool().unwrap_or(false);
        let is_vpn = org.to_lowercase().contains("vpn") || org.to_lowercase().contains("proxy");
        let is_tor = org.to_lowercase().contains("tor");

        let threat_level = if is_tor {
            ThreatLevel::Critical
        } else if is_vpn || is_proxy {
            ThreatLevel::High
        } else {
            ThreatLevel::Low
        };

        Ok(GeolocationInfo {
            ip_address: ip_address.to_string(),
            country_code,
            country_name: data["country"].as_str().unwrap_or("Unknown").to_string(),
            region_code: region.clone(),
            region_name: region,
            city,
            latitude: lat,
            longitude: lon,
            timezone: data["timezone"].as_str().unwrap_or("UTC").to_string(),
            isp: data["org"].as_str().unwrap_or("Unknown").to_string(),
            organization: org,
            is_proxy,
            is_vpn,
            is_tor,
            threat_level,
        })
    }

    /// Parse ip-api.com response
    fn parse_ip_api_response(&self, ip_address: &str, data: &serde_json::Value) -> Result<GeolocationInfo> {
        if data["status"].as_str() != Some("success") {
            return Err(anyhow!("Geolocation query failed: {}", 
                data["message"].as_str().unwrap_or("Unknown error")));
        }

        let country_code = data["countryCode"].as_str().unwrap_or("UNKNOWN").to_string();
        let org = data["org"].as_str().unwrap_or("").to_string();
        let isp = data["isp"].as_str().unwrap_or("").to_string();
        
        // Detect threats
        let is_proxy = data["proxy"].as_bool().unwrap_or(false);
        let is_vpn = org.to_lowercase().contains("vpn") || 
                     isp.to_lowercase().contains("vpn") ||
                     org.to_lowercase().contains("proxy");
        let is_tor = org.to_lowercase().contains("tor") || 
                     isp.to_lowercase().contains("tor");

        let threat_level = if is_tor {
            ThreatLevel::Critical
        } else if is_vpn || is_proxy {
            ThreatLevel::High
        } else {
            ThreatLevel::Low
        };

        Ok(GeolocationInfo {
            ip_address: ip_address.to_string(),
            country_code,
            country_name: data["country"].as_str().unwrap_or("Unknown").to_string(),
            region_code: data["region"].as_str().unwrap_or("").to_string(),
            region_name: data["regionName"].as_str().unwrap_or("").to_string(),
            city: data["city"].as_str().unwrap_or("").to_string(),
            latitude: data["lat"].as_f64().unwrap_or(0.0),
            longitude: data["lon"].as_f64().unwrap_or(0.0),
            timezone: data["timezone"].as_str().unwrap_or("UTC").to_string(),
            isp,
            organization: org,
            is_proxy,
            is_vpn,
            is_tor,
            threat_level,
        })
    }

    /// Create fallback geolocation when service is unavailable
    fn create_fallback_geolocation(&self, ip_address: &str) -> GeolocationInfo {
        GeolocationInfo {
            ip_address: ip_address.to_string(),
            country_code: "UNKNOWN".to_string(),
            country_name: "Unknown".to_string(),
            region_code: "UNKNOWN".to_string(),
            region_name: "Unknown".to_string(),
            city: "Unknown".to_string(),
            latitude: 0.0,
            longitude: 0.0,
            timezone: "UTC".to_string(),
            isp: "Unknown".to_string(),
            organization: "Unknown".to_string(),
            is_proxy: false,
            is_vpn: false,
            is_tor: false,
            threat_level: ThreatLevel::Medium, // Unknown is medium risk
        }
    }

    /// Check if IP is private/local
    fn is_private_ip(&self, ip: &IpAddr) -> bool {
        match ip {
            IpAddr::V4(ipv4) => {
                ipv4.is_private() || ipv4.is_loopback() || ipv4.is_link_local()
            }
            IpAddr::V6(ipv6) => {
                ipv6.is_loopback() || ipv6.is_unspecified()
            }
        }
    }

    /// Find applicable data residency policy
    async fn find_applicable_policy(
        &self,
        tenant_id: Option<&str>,
        data_classification: &DataClassification,
    ) -> DataResidencyPolicy {
        let policies = self.policies.read().await;
        
        // Look for tenant-specific policy first
        if let Some(tenant) = tenant_id {
            let tenant_policy_id = format!("tenant_{}", tenant);
            if let Some(policy) = policies.get(&tenant_policy_id) {
                if policy.enabled {
                    return policy.clone();
                }
            }
        }

        // Look for classification-specific policy
        let classification_policy_id = format!("classification_{:?}", data_classification).to_lowercase();
        if let Some(policy) = policies.get(&classification_policy_id) {
            if policy.enabled {
                return policy.clone();
            }
        }

        // Return default policy
        self.default_policy.clone()
    }

    /// Check if request violates data residency policy
    async fn check_violation(
        &self,
        policy: &DataResidencyPolicy,
        geolocation: &GeolocationInfo,
        source_ip: &str,
    ) -> Result<Option<ViolationType>> {
        // Check for blocked regions
        if policy.blocked_regions.contains(&geolocation.country_code) {
            return Ok(Some(ViolationType::BlockedRegion));
        }

        // Check for allowed regions (if not wildcard)
        if !policy.allowed_regions.contains(&"*".to_string()) &&
           !policy.allowed_regions.contains(&geolocation.country_code) {
            return Ok(Some(ViolationType::UnauthorizedRegion));
        }

        // Check for proxy/VPN/Tor
        if geolocation.is_tor {
            return Ok(Some(ViolationType::TorDetected));
        }
        
        if geolocation.is_vpn {
            return Ok(Some(ViolationType::VpnDetected));
        }
        
        if geolocation.is_proxy {
            return Ok(Some(ViolationType::ProxyDetected));
        }

        // Check for suspicious locations (high threat level)
        if matches!(geolocation.threat_level, ThreatLevel::Critical) {
            return Ok(Some(ViolationType::SuspiciousLocation));
        }

        // Check exceptions
        for exception in &policy.exceptions {
            if self.matches_exception(exception, source_ip, geolocation).await {
                debug!("Request matches exception: {}", exception.exception_id);
                return Ok(None); // Exception allows the request
            }
        }

        Ok(None) // No violation
    }

    /// Check if request matches an exception
    async fn matches_exception(
        &self,
        exception: &ResidencyException,
        source_ip: &str,
        geolocation: &GeolocationInfo,
    ) -> bool {
        // Check if exception is expired
        if let Some(expires_at) = exception.expires_at {
            if Utc::now() > expires_at {
                return false;
            }
        }

        // Check allowed regions
        if !exception.allowed_regions.is_empty() &&
           !exception.allowed_regions.contains(&geolocation.country_code) {
            return false;
        }

        // Check IP ranges
        if !exception.ip_ranges.is_empty() {
            let matches_ip = exception.ip_ranges.iter().any(|range| {
                self.ip_matches_range(source_ip, range)
            });
            if !matches_ip {
                return false;
            }
        }

        true
    }

    /// Check if IP matches CIDR range
    fn ip_matches_range(&self, ip: &str, range: &str) -> bool {
        // Simple implementation - in production use proper CIDR matching
        if range.contains('/') {
            // CIDR notation
            let parts: Vec<&str> = range.split('/').collect();
            if parts.len() == 2 {
                let network = parts[0];
                // For simplicity, just check if IP starts with network
                return ip.starts_with(network);
            }
        } else {
            // Exact match
            return ip == range;
        }
        false
    }

    /// Handle data residency violation
    async fn handle_violation(
        &self,
        request_id: &str,
        user_id: Option<&str>,
        tenant_id: Option<&str>,
        policy: &DataResidencyPolicy,
        geolocation: &GeolocationInfo,
        violation_type: ViolationType,
    ) -> Result<EnforcementAction> {
        let violation_id = uuid::Uuid::new_v4().to_string();
        
        let enforcement_action = match policy.enforcement_level {
            EnforcementLevel::Advisory => EnforcementAction::Allowed,
            EnforcementLevel::Warning => EnforcementAction::Warned,
            EnforcementLevel::Blocking => EnforcementAction::Blocked,
            EnforcementLevel::Strict => EnforcementAction::Blocked,
        };

        // Create violation record
        let violation = ResidencyViolation {
            violation_id: violation_id.clone(),
            request_id: request_id.to_string(),
            user_id: user_id.map(|s| s.to_string()),
            tenant_id: tenant_id.map(|s| s.to_string()),
            policy_id: policy.policy_id.clone(),
            source_ip: geolocation.ip_address.clone(),
            detected_region: geolocation.country_code.clone(),
            allowed_regions: policy.allowed_regions.clone(),
            violation_type: violation_type.clone(),
            enforcement_action: enforcement_action.clone(),
            geolocation: geolocation.clone(),
            timestamp: Utc::now(),
            resolved: false,
        };

        // Store violation
        {
            let mut violations = self.violations.write().await;
            violations.insert(violation_id.clone(), violation);
        }

        // Log violation
        match enforcement_action {
            EnforcementAction::Blocked => {
                warn!(
                    "Data residency violation BLOCKED: {} from {} ({:?})",
                    request_id, geolocation.ip_address, violation_type
                );
            }
            EnforcementAction::Warned => {
                warn!(
                    "Data residency violation WARNING: {} from {} ({:?})",
                    request_id, geolocation.ip_address, violation_type
                );
            }
            _ => {
                info!(
                    "Data residency violation LOGGED: {} from {} ({:?})",
                    request_id, geolocation.ip_address, violation_type
                );
            }
        }

        Ok(enforcement_action)
    }

    /// Get enforcement message
    fn get_enforcement_message(&self, action: &EnforcementAction, violation_type: &ViolationType) -> String {
        match action {
            EnforcementAction::Blocked => {
                format!("Request blocked due to data residency violation: {:?}", violation_type)
            }
            EnforcementAction::Warned => {
                format!("Data residency warning: {:?}", violation_type)
            }
            EnforcementAction::Allowed => {
                "Request allowed".to_string()
            }
            _ => {
                format!("Data residency check: {:?}", violation_type)
            }
        }
    }

    /// Add or update data residency policy
    pub async fn set_policy(&self, policy: DataResidencyPolicy) -> Result<()> {
        let mut policies = self.policies.write().await;
        policies.insert(policy.policy_id.clone(), policy.clone());
        
        info!("Data residency policy updated: {}", policy.policy_id);
        Ok(())
    }

    /// Get policy by ID
    pub async fn get_policy(&self, policy_id: &str) -> Option<DataResidencyPolicy> {
        let policies = self.policies.read().await;
        policies.get(policy_id).cloned()
    }

    /// List all policies
    pub async fn list_policies(&self) -> Vec<DataResidencyPolicy> {
        let policies = self.policies.read().await;
        policies.values().cloned().collect()
    }

    /// Get violations for analysis
    pub async fn get_violations(&self, limit: Option<usize>) -> Vec<ResidencyViolation> {
        let violations = self.violations.read().await;
        let mut violation_list: Vec<_> = violations.values().cloned().collect();
        violation_list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        
        if let Some(limit) = limit {
            violation_list.truncate(limit);
        }
        
        violation_list
    }

    /// Clean up old violations and cache entries
    pub async fn cleanup(&self, max_age_hours: i64) -> Result<usize> {
        let cutoff = Utc::now() - chrono::Duration::hours(max_age_hours);
        let mut removed_count = 0;

        // Clean violations
        {
            let mut violations = self.violations.write().await;
            violations.retain(|_, violation| {
                if violation.timestamp < cutoff {
                    removed_count += 1;
                    false
                } else {
                    true
                }
            });
        }

        // Clean geolocation cache
        {
            let mut cache = self.geolocation_cache.write().await;
            cache.clear(); // Simple approach - clear all cache
        }

        if removed_count > 0 {
            info!("Cleaned up {} old data residency violations", removed_count);
        }

        Ok(removed_count)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnforcementResult {
    pub allowed: bool,
    pub policy_id: String,
    pub detected_region: String,
    pub violation_type: Option<ViolationType>,
    pub enforcement_action: EnforcementAction,
    pub geolocation: GeolocationInfo,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_private_ip_detection() {
        let enforcer = DataResidencyEnforcer::new(None);
        
        let private_ips = vec![
            "192.168.1.1",
            "10.0.0.1",
            "172.16.0.1",
            "127.0.0.1",
        ];

        for ip in private_ips {
            let parsed: IpAddr = ip.parse().unwrap();
            assert!(enforcer.is_private_ip(&parsed), "IP {} should be private", ip);
        }
    }

    #[tokio::test]
    async fn test_policy_enforcement() {
        let enforcer = DataResidencyEnforcer::new(None);
        
        // Create restrictive policy
        let policy = DataResidencyPolicy {
            policy_id: "test".to_string(),
            name: "Test Policy".to_string(),
            description: "Test".to_string(),
            allowed_regions: vec!["US".to_string()],
            blocked_regions: vec!["CN".to_string()],
            data_classification: DataClassification::Confidential,
            enforcement_level: EnforcementLevel::Blocking,
            exceptions: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            enabled: true,
        };

        enforcer.set_policy(policy).await.unwrap();

        // Test with local IP (should be allowed)
        let result = enforcer.enforce_residency(
            "test-request",
            Some("user123"),
            Some("tenant456"),
            "192.168.1.1",
            DataClassification::Confidential,
        ).await.unwrap();

        assert!(result.allowed);
        assert_eq!(result.detected_region, "LOCAL");
    }

    #[tokio::test]
    async fn test_geolocation_fallback() {
        let enforcer = DataResidencyEnforcer::new(None);
        
        // Test with invalid IP
        let geo = enforcer.create_fallback_geolocation("invalid-ip");
        assert_eq!(geo.country_code, "UNKNOWN");
        assert_eq!(geo.threat_level, ThreatLevel::Medium);
    }
}