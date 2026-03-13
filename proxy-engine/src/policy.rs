use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Policy-as-Code engine using OPA/Rego-style rules
#[allow(dead_code)]
pub struct PolicyEngine {
    policies: HashMap<String, Policy>,
    policy_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Policy {
    pub id: String,
    pub name: String,
    pub rules: Vec<Rule>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub condition: Condition,
    pub action: Action,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Condition {
    TokenBudgetExceeded {
        user_id: String,
        threshold: u32,
    },
    MFARequired {
        endpoint_category: String,
    },
    RegionRestriction {
        allowed_regions: Vec<String>,
    },
    RateLimitExceeded {
        requests_per_minute: u32,
    },
    ContentCategory {
        prohibited_categories: Vec<String>,
    },
    ToxicityThresholdExceeded {
        threshold: f32,
        categories: Vec<String>,
    },
    ComplexityThresholdExceeded {
        threshold: f32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Allow,
    Deny,
    Flag,
    Throttle,
}

#[derive(Debug, Serialize)]
pub struct PolicyEvaluation {
    pub allowed: bool,
    pub action: Action,
    pub violated_rules: Vec<String>,
    pub policy_version: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct RequestContext {
    pub user_id: String,
    pub tokens_requested: u32,
    pub endpoint_category: Option<String>,
    pub region: String,
    pub auth: AuthContext,
    pub content_categories: Vec<String>,
    pub toxicity_scores: Option<HashMap<String, f32>>,
    pub complexity_score: Option<f32>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct AuthContext {
    pub mfa_verified: bool,
    pub role: String,
}

#[allow(dead_code)]
impl PolicyEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            policies: HashMap::new(),
            policy_version: "v1.0.0".to_string(),
        };
        
        // Load default policies
        engine.load_default_policies();
        engine
    }

    /// Evaluate request against all active policies
    pub fn evaluate(&self, context: &RequestContext) -> Result<PolicyEvaluation> {
        let mut violated_rules = Vec::new();
        let mut final_action = Action::Allow;

        for policy in self.policies.values() {
            if !policy.enabled {
                continue;
            }

            for rule in &policy.rules {
                if self.evaluate_condition(&rule.condition, context)? {
                    violated_rules.push(rule.message.clone());
                    
                    // Most restrictive action wins
                    final_action = match (&final_action, &rule.action) {
                        (_, Action::Deny) => Action::Deny,
                        (Action::Deny, _) => Action::Deny,
                        (_, Action::Throttle) => Action::Throttle,
                        (Action::Throttle, _) => Action::Throttle,
                        (_, Action::Flag) => Action::Flag,
                        _ => Action::Allow,
                    };
                }
            }
        }

        Ok(PolicyEvaluation {
            allowed: matches!(final_action, Action::Allow | Action::Flag),
            action: final_action,
            violated_rules,
            policy_version: self.policy_version.clone(),
        })
    }

    fn evaluate_condition(&self, condition: &Condition, context: &RequestContext) -> Result<bool> {
        match condition {
            Condition::TokenBudgetExceeded { user_id, threshold } => {
                if &context.user_id == user_id {
                    // TODO: Check actual token budget from database
                    Ok(context.tokens_requested > *threshold)
                } else {
                    Ok(false)
                }
            }
            Condition::MFARequired { endpoint_category } => {
                if let Some(ref ctx_category) = context.endpoint_category {
                    Ok(ctx_category == endpoint_category && !context.auth.mfa_verified)
                } else {
                    Ok(false)
                }
            }
            Condition::RegionRestriction { allowed_regions } => {
                Ok(!allowed_regions.contains(&context.region))
            }
            Condition::RateLimitExceeded { requests_per_minute: _ } => {
                // TODO: Implement actual rate limiting check
                Ok(false)
            }
            Condition::ContentCategory { prohibited_categories } => {
                Ok(context
                    .content_categories
                    .iter()
                    .any(|c| prohibited_categories.contains(c)))
            }
            Condition::ToxicityThresholdExceeded { threshold, categories } => {
                if let Some(ref scores) = context.toxicity_scores {
                    // Check if any specified category exceeds threshold
                    Ok(categories.iter().any(|cat| {
                        scores.get(cat).map_or(false, |score| score > threshold)
                    }))
                } else {
                    Ok(false)
                }
            }
            Condition::ComplexityThresholdExceeded { threshold } => {
                if let Some(complexity) = context.complexity_score {
                    Ok(complexity > *threshold)
                } else {
                    Ok(false)
                }
            }
        }
    }

    /// Load policy from JSON/YAML (Git-backed)
    pub fn load_policy(&mut self, policy: Policy) -> Result<()> {
        self.policies.insert(policy.id.clone(), policy);
        Ok(())
    }

    /// Hot-reload policies without downtime
    pub fn reload_policies(&mut self, new_policies: Vec<Policy>) -> Result<()> {
        self.policies.clear();
        for policy in new_policies {
            self.policies.insert(policy.id.clone(), policy);
        }
        tracing::info!("Policies reloaded. Total active: {}", self.policies.len());
        Ok(())
    }

    fn load_default_policies(&mut self) {
        // Example: Token budget policy
        let token_budget_policy = Policy {
            id: "token-budget".to_string(),
            name: "Token Budget Enforcement".to_string(),
            rules: vec![Rule {
                id: "budget-exceeded".to_string(),
                condition: Condition::TokenBudgetExceeded {
                    user_id: "default".to_string(),
                    threshold: 100000,
                },
                action: Action::Deny,
                message: "Token budget exceeded".to_string(),
            }],
            enabled: true,
        };

        // Example: MFA requirement for healthcare
        let mfa_policy = Policy {
            id: "mfa-healthcare".to_string(),
            name: "MFA Required for Healthcare".to_string(),
            rules: vec![Rule {
                id: "healthcare-mfa".to_string(),
                condition: Condition::MFARequired {
                    endpoint_category: "healthcare".to_string(),
                },
                action: Action::Deny,
                message: "MFA required for healthcare context requests".to_string(),
            }],
            enabled: true,
        };

        // Example: Toxicity threshold policy
        let toxicity_policy = Policy {
            id: "toxicity-threshold".to_string(),
            name: "Toxicity Threshold Enforcement".to_string(),
            rules: vec![
                Rule {
                    id: "hate-threshold".to_string(),
                    condition: Condition::ToxicityThresholdExceeded {
                        threshold: 0.8,
                        categories: vec!["hate".to_string(), "harassment".to_string()],
                    },
                    action: Action::Deny,
                    message: "Hate/harassment content exceeds threshold".to_string(),
                },
                Rule {
                    id: "violence-threshold".to_string(),
                    condition: Condition::ToxicityThresholdExceeded {
                        threshold: 0.85,
                        categories: vec!["violence".to_string()],
                    },
                    action: Action::Flag,
                    message: "Violence content flagged for review".to_string(),
                },
            ],
            enabled: true,
        };

        // Example: Complexity threshold policy
        let complexity_policy = Policy {
            id: "complexity-threshold".to_string(),
            name: "Input Complexity Threshold".to_string(),
            rules: vec![Rule {
                id: "complexity-exceeded".to_string(),
                condition: Condition::ComplexityThresholdExceeded {
                    threshold: 0.8,
                },
                action: Action::Deny,
                message: "Input complexity exceeds safety threshold".to_string(),
            }],
            enabled: true,
        };

        self.policies.insert(token_budget_policy.id.clone(), token_budget_policy);
        self.policies.insert(mfa_policy.id.clone(), mfa_policy);
        self.policies.insert(toxicity_policy.id.clone(), toxicity_policy);
        self.policies.insert(complexity_policy.id.clone(), complexity_policy);
    }

    /// Get current policy version hash (for audit logs)
    pub fn get_policy_version(&self) -> &str {
        &self.policy_version
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_budget_policy() {
        let engine = PolicyEngine::new();
        let context = RequestContext {
            user_id: "default".to_string(),
            tokens_requested: 150000,
            endpoint_category: None,
            region: "us-east-1".to_string(),
            auth: AuthContext {
                mfa_verified: true,
                role: "user".to_string(),
            },
            content_categories: vec![],
        };

        let result = engine.evaluate(&context).unwrap();
        assert!(!result.allowed);
        assert!(matches!(result.action, Action::Deny));
    }

    #[test]
    fn test_mfa_policy() {
        let engine = PolicyEngine::new();
        let context = RequestContext {
            user_id: "user123".to_string(),
            tokens_requested: 1000,
            endpoint_category: Some("healthcare".to_string()),
            region: "us-east-1".to_string(),
            auth: AuthContext {
                mfa_verified: false,
                role: "user".to_string(),
            },
            content_categories: vec![],
        };

        let result = engine.evaluate(&context).unwrap();
        assert!(!result.allowed);
        assert!(!result.violated_rules.is_empty());
    }
}
