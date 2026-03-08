use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Rate limiter with per-user token budgets and request throttling
pub struct RateLimiter {
    // User ID -> Budget info
    user_budgets: Arc<RwLock<HashMap<String, UserBudget>>>,
    // User ID -> Request history
    request_history: Arc<RwLock<HashMap<String, Vec<Instant>>>>,
    // Global configuration
    config: RateLimitConfig,
}

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub default_token_budget: u32,
    pub default_requests_per_minute: u32,
    pub default_requests_per_hour: u32,
    pub budget_reset_interval: Duration,
}

#[derive(Debug, Clone)]
pub struct UserBudget {
    pub user_id: String,
    pub total_budget: u32,
    pub remaining_budget: u32,
    pub tokens_used: u32,
    pub last_reset: Instant,
    pub requests_per_minute: u32,
    pub requests_per_hour: u32,
}

#[derive(Debug)]
pub struct RateLimitResult {
    pub allowed: bool,
    pub reason: String,
    pub remaining_budget: u32,
    pub requests_remaining_minute: u32,
    pub requests_remaining_hour: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            default_token_budget: 100_000,
            default_requests_per_minute: 60,
            default_requests_per_hour: 1000,
            budget_reset_interval: Duration::from_secs(86400), // 24 hours
        }
    }
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            user_budgets: Arc::new(RwLock::new(HashMap::new())),
            request_history: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    /// Check if request is allowed under rate limits
    pub async fn check_rate_limit(
        &self,
        user_id: &str,
        tokens_requested: u32,
    ) -> Result<RateLimitResult> {
        // Check token budget
        let budget_check = self.check_token_budget(user_id, tokens_requested).await?;
        if !budget_check.allowed {
            return Ok(budget_check);
        }

        // Check request rate limits
        let rate_check = self.check_request_rate(user_id).await?;
        if !rate_check.allowed {
            return Ok(rate_check);
        }

        // All checks passed
        Ok(RateLimitResult {
            allowed: true,
            reason: "OK".to_string(),
            remaining_budget: budget_check.remaining_budget,
            requests_remaining_minute: rate_check.requests_remaining_minute,
            requests_remaining_hour: rate_check.requests_remaining_hour,
        })
    }

    /// Check token budget for user
    async fn check_token_budget(
        &self,
        user_id: &str,
        tokens_requested: u32,
    ) -> Result<RateLimitResult> {
        let mut budgets = self.user_budgets.write().await;
        
        let budget = budgets.entry(user_id.to_string()).or_insert_with(|| {
            UserBudget {
                user_id: user_id.to_string(),
                total_budget: self.config.default_token_budget,
                remaining_budget: self.config.default_token_budget,
                tokens_used: 0,
                last_reset: Instant::now(),
                requests_per_minute: self.config.default_requests_per_minute,
                requests_per_hour: self.config.default_requests_per_hour,
            }
        });

        // Check if budget needs reset
        if budget.last_reset.elapsed() >= self.config.budget_reset_interval {
            budget.remaining_budget = budget.total_budget;
            budget.tokens_used = 0;
            budget.last_reset = Instant::now();
            tracing::info!("Reset token budget for user: {}", user_id);
        }

        // Check if request exceeds budget
        if tokens_requested > budget.remaining_budget {
            return Ok(RateLimitResult {
                allowed: false,
                reason: format!(
                    "Token budget exceeded: requested {} but only {} remaining",
                    tokens_requested, budget.remaining_budget
                ),
                remaining_budget: budget.remaining_budget,
                requests_remaining_minute: 0,
                requests_remaining_hour: 0,
            });
        }

        Ok(RateLimitResult {
            allowed: true,
            reason: "OK".to_string(),
            remaining_budget: budget.remaining_budget,
            requests_remaining_minute: 0, // Will be filled by rate check
            requests_remaining_hour: 0,
        })
    }

    /// Check request rate limits
    async fn check_request_rate(&self, user_id: &str) -> Result<RateLimitResult> {
        let mut history = self.request_history.write().await;
        let now = Instant::now();
        
        let requests = history.entry(user_id.to_string()).or_insert_with(Vec::new);
        
        // Clean up old requests
        requests.retain(|&timestamp| now.duration_since(timestamp) < Duration::from_secs(3600));
        
        // Count requests in last minute and hour
        let requests_last_minute = requests
            .iter()
            .filter(|&&timestamp| now.duration_since(timestamp) < Duration::from_secs(60))
            .count() as u32;
        
        let requests_last_hour = requests.len() as u32;
        
        // Get user limits
        let budgets = self.user_budgets.read().await;
        let (rpm_limit, rph_limit) = if let Some(budget) = budgets.get(user_id) {
            (budget.requests_per_minute, budget.requests_per_hour)
        } else {
            (self.config.default_requests_per_minute, self.config.default_requests_per_hour)
        };
        
        // Check limits
        if requests_last_minute >= rpm_limit {
            return Ok(RateLimitResult {
                allowed: false,
                reason: format!(
                    "Rate limit exceeded: {} requests per minute (limit: {})",
                    requests_last_minute, rpm_limit
                ),
                remaining_budget: 0,
                requests_remaining_minute: 0,
                requests_remaining_hour: rph_limit.saturating_sub(requests_last_hour),
            });
        }
        
        if requests_last_hour >= rph_limit {
            return Ok(RateLimitResult {
                allowed: false,
                reason: format!(
                    "Rate limit exceeded: {} requests per hour (limit: {})",
                    requests_last_hour, rph_limit
                ),
                remaining_budget: 0,
                requests_remaining_minute: rpm_limit.saturating_sub(requests_last_minute),
                requests_remaining_hour: 0,
            });
        }
        
        Ok(RateLimitResult {
            allowed: true,
            reason: "OK".to_string(),
            remaining_budget: 0, // Will be filled by budget check
            requests_remaining_minute: rpm_limit.saturating_sub(requests_last_minute),
            requests_remaining_hour: rph_limit.saturating_sub(requests_last_hour),
        })
    }

    /// Record successful request
    pub async fn record_request(&self, user_id: &str, tokens_used: u32) -> Result<()> {
        // Update token budget
        let mut budgets = self.user_budgets.write().await;
        if let Some(budget) = budgets.get_mut(user_id) {
            budget.remaining_budget = budget.remaining_budget.saturating_sub(tokens_used);
            budget.tokens_used += tokens_used;
            tracing::debug!(
                "User {} used {} tokens, {} remaining",
                user_id,
                tokens_used,
                budget.remaining_budget
            );
        }
        
        // Record request timestamp
        let mut history = self.request_history.write().await;
        history
            .entry(user_id.to_string())
            .or_insert_with(Vec::new)
            .push(Instant::now());
        
        Ok(())
    }

    /// Set custom budget for user
    pub async fn set_user_budget(
        &self,
        user_id: &str,
        total_budget: u32,
        requests_per_minute: u32,
        requests_per_hour: u32,
    ) -> Result<()> {
        let mut budgets = self.user_budgets.write().await;
        
        budgets.insert(
            user_id.to_string(),
            UserBudget {
                user_id: user_id.to_string(),
                total_budget,
                remaining_budget: total_budget,
                tokens_used: 0,
                last_reset: Instant::now(),
                requests_per_minute,
                requests_per_hour,
            },
        );
        
        tracing::info!(
            "Set custom budget for user {}: {} tokens, {}/min, {}/hour",
            user_id,
            total_budget,
            requests_per_minute,
            requests_per_hour
        );
        
        Ok(())
    }

    /// Get user budget info
    pub async fn get_user_budget(&self, user_id: &str) -> Option<UserBudget> {
        let budgets = self.user_budgets.read().await;
        budgets.get(user_id).cloned()
    }

    /// Get all user budgets (for admin dashboard)
    pub async fn get_all_budgets(&self) -> HashMap<String, UserBudget> {
        let budgets = self.user_budgets.read().await;
        budgets.clone()
    }

    /// Reset user budget
    pub async fn reset_user_budget(&self, user_id: &str) -> Result<()> {
        let mut budgets = self.user_budgets.write().await;
        
        if let Some(budget) = budgets.get_mut(user_id) {
            budget.remaining_budget = budget.total_budget;
            budget.tokens_used = 0;
            budget.last_reset = Instant::now();
            tracing::info!("Manually reset budget for user: {}", user_id);
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_token_budget() {
        let config = RateLimitConfig {
            default_token_budget: 1000,
            ..Default::default()
        };
        let limiter = RateLimiter::new(config);

        // First request should succeed
        let result = limiter.check_rate_limit("user1", 500).await.unwrap();
        assert!(result.allowed);

        // Record the request
        limiter.record_request("user1", 500).await.unwrap();

        // Second request should succeed
        let result = limiter.check_rate_limit("user1", 400).await.unwrap();
        assert!(result.allowed);

        // Third request should fail (exceeds budget)
        let result = limiter.check_rate_limit("user1", 200).await.unwrap();
        assert!(!result.allowed);
    }

    #[tokio::test]
    async fn test_rate_limiting() {
        let config = RateLimitConfig {
            default_requests_per_minute: 2,
            ..Default::default()
        };
        let limiter = RateLimiter::new(config);

        // First two requests should succeed
        for _ in 0..2 {
            let result = limiter.check_rate_limit("user2", 100).await.unwrap();
            assert!(result.allowed);
            limiter.record_request("user2", 100).await.unwrap();
        }

        // Third request should fail (rate limit)
        let result = limiter.check_rate_limit("user2", 100).await.unwrap();
        assert!(!result.allowed);
    }
}
