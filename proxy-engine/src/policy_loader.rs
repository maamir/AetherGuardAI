use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;

/// Git-backed policy loader
/// Loads policies from filesystem (Git repository)
pub struct PolicyLoader {
    policy_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyFile {
    pub version: String,
    pub policies: Vec<PolicyDefinition>,
    pub metadata: Option<PolicyMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyDefinition {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub priority: Option<u32>,
    pub rules: Vec<RuleDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleDefinition {
    pub id: String,
    pub condition: serde_json::Value,
    pub action: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyMetadata {
    pub author: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub git_commit: Option<String>,
    pub git_branch: Option<String>,
}

impl PolicyLoader {
    pub fn new<P: AsRef<Path>>(policy_dir: P) -> Self {
        Self {
            policy_dir: policy_dir.as_ref().to_path_buf(),
        }
    }

    /// Load all policies from directory
    pub fn load_policies(&self) -> Result<Vec<PolicyFile>> {
        let mut policies = Vec::new();

        if !self.policy_dir.exists() {
            tracing::warn!("Policy directory does not exist: {:?}", self.policy_dir);
            return Ok(policies);
        }

        // Read all .json and .yaml files
        for entry in fs::read_dir(&self.policy_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    match ext.to_str() {
                        Some("json") => {
                            if let Ok(policy) = self.load_json_policy(&path) {
                                policies.push(policy);
                            }
                        }
                        Some("yaml") | Some("yml") => {
                            if let Ok(policy) = self.load_yaml_policy(&path) {
                                policies.push(policy);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        tracing::info!("Loaded {} policy files from {:?}", policies.len(), self.policy_dir);
        Ok(policies)
    }

    /// Load policy from JSON file
    fn load_json_policy(&self, path: &Path) -> Result<PolicyFile> {
        let content = fs::read_to_string(path)
            .with_context(|| format!("Failed to read policy file: {:?}", path))?;
        
        let policy: PolicyFile = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse JSON policy: {:?}", path))?;
        
        tracing::debug!("Loaded JSON policy from {:?}", path);
        Ok(policy)
    }

    /// Load policy from YAML file
    fn load_yaml_policy(&self, path: &Path) -> Result<PolicyFile> {
        let content = fs::read_to_string(path)
            .with_context(|| format!("Failed to read policy file: {:?}", path))?;
        
        let policy: PolicyFile = serde_yaml::from_str(&content)
            .with_context(|| format!("Failed to parse YAML policy: {:?}", path))?;
        
        tracing::debug!("Loaded YAML policy from {:?}", path);
        Ok(policy)
    }

    /// Watch for policy changes (file system watcher)
    pub async fn watch_for_changes<F>(&self, callback: F) -> Result<()>
    where
        F: Fn(Vec<PolicyFile>) + Send + 'static,
    {
        // TODO: Implement file system watcher
        // Use notify crate to watch for changes
        // Reload policies when files change
        // Call callback with new policies
        
        tracing::info!("Policy watcher not yet implemented");
        Ok(())
    }

    /// Get Git metadata for policy directory
    pub fn get_git_metadata(&self) -> Result<PolicyMetadata> {
        // TODO: Use git2 crate to get commit info
        // For now, return placeholder
        
        Ok(PolicyMetadata {
            author: Some("system".to_string()),
            created_at: Some(chrono::Utc::now().to_rfc3339()),
            updated_at: Some(chrono::Utc::now().to_rfc3339()),
            git_commit: None,
            git_branch: None,
        })
    }

    /// Validate policy file
    pub fn validate_policy(&self, policy: &PolicyFile) -> Result<()> {
        // Check version format
        if policy.version.is_empty() {
            anyhow::bail!("Policy version cannot be empty");
        }

        // Check policies
        if policy.policies.is_empty() {
            tracing::warn!("Policy file contains no policies");
        }

        // Validate each policy
        for p in &policy.policies {
            if p.id.is_empty() {
                anyhow::bail!("Policy ID cannot be empty");
            }
            if p.name.is_empty() {
                anyhow::bail!("Policy name cannot be empty");
            }
            if p.rules.is_empty() {
                tracing::warn!("Policy {} has no rules", p.id);
            }
        }

        Ok(())
    }

    /// Export policies to file
    pub fn export_policies(&self, policies: &[PolicyFile], format: &str) -> Result<String> {
        match format {
            "json" => {
                let json = serde_json::to_string_pretty(policies)?;
                Ok(json)
            }
            "yaml" => {
                let yaml = serde_yaml::to_string(policies)?;
                Ok(yaml)
            }
            _ => anyhow::bail!("Unsupported format: {}", format),
        }
    }
}

/// Example policy file structure
pub fn example_policy_json() -> &'static str {
    r#"{
  "version": "1.0.0",
  "policies": [
    {
      "id": "token-budget",
      "name": "Token Budget Enforcement",
      "description": "Enforce per-user token budgets",
      "enabled": true,
      "priority": 100,
      "rules": [
        {
          "id": "budget-exceeded",
          "condition": {
            "type": "TokenBudgetExceeded",
            "user_id": "default",
            "threshold": 100000
          },
          "action": "Deny",
          "message": "Token budget exceeded"
        }
      ]
    }
  ],
  "metadata": {
    "author": "security-team",
    "created_at": "2026-03-08T00:00:00Z",
    "git_commit": "abc123",
    "git_branch": "main"
  }
}"#
}

pub fn example_policy_yaml() -> &'static str {
    r#"version: "1.0.0"
policies:
  - id: token-budget
    name: Token Budget Enforcement
    description: Enforce per-user token budgets
    enabled: true
    priority: 100
    rules:
      - id: budget-exceeded
        condition:
          type: TokenBudgetExceeded
          user_id: default
          threshold: 100000
        action: Deny
        message: Token budget exceeded
metadata:
  author: security-team
  created_at: "2026-03-08T00:00:00Z"
  git_commit: abc123
  git_branch: main
"#
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_load_json_policy() {
        let temp_dir = TempDir::new().unwrap();
        let policy_path = temp_dir.path().join("test-policy.json");
        
        fs::write(&policy_path, example_policy_json()).unwrap();
        
        let loader = PolicyLoader::new(temp_dir.path());
        let policies = loader.load_policies().unwrap();
        
        assert_eq!(policies.len(), 1);
        assert_eq!(policies[0].version, "1.0.0");
        assert_eq!(policies[0].policies.len(), 1);
    }

    #[test]
    fn test_validate_policy() {
        let policy = PolicyFile {
            version: "1.0.0".to_string(),
            policies: vec![PolicyDefinition {
                id: "test".to_string(),
                name: "Test Policy".to_string(),
                description: None,
                enabled: true,
                priority: None,
                rules: vec![],
            }],
            metadata: None,
        };
        
        let loader = PolicyLoader::new(".");
        assert!(loader.validate_policy(&policy).is_ok());
    }
}
