package rate_limiting

import (
	"context"
	"time"
	
	"golang.org/x/time/rate"
)

// RateLimiter implements token bucket rate limiting per tenant
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	limits   map[string]RateLimit
}

// RateLimit defines rate limiting parameters
type RateLimit struct {
	RequestsPerSecond int
	BurstSize         int
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		limits:   make(map[string]RateLimit),
	}
}

// SetLimit sets the rate limit for a tenant
func (rl *RateLimiter) SetLimit(tenantID string, limit RateLimit) {
	rl.limits[tenantID] = limit
	rl.limiters[tenantID] = rate.NewLimiter(
		rate.Limit(limit.RequestsPerSecond),
		limit.BurstSize,
	)
}

// Allow checks if a request is allowed for a tenant
func (rl *RateLimiter) Allow(tenantID string) bool {
	limiter, exists := rl.limiters[tenantID]
	if !exists {
		// Default limit if not configured
		rl.SetLimit(tenantID, RateLimit{
			RequestsPerSecond: 100,
			BurstSize:         200,
		})
		limiter = rl.limiters[tenantID]
	}
	
	return limiter.Allow()
}

// Wait waits until a request is allowed (with timeout)
func (rl *RateLimiter) Wait(ctx context.Context, tenantID string) error {
	limiter, exists := rl.limiters[tenantID]
	if !exists {
		rl.SetLimit(tenantID, RateLimit{
			RequestsPerSecond: 100,
			BurstSize:         200,
		})
		limiter = rl.limiters[tenantID]
	}
	
	return limiter.Wait(ctx)
}

// GetLimit returns the current rate limit for a tenant
func (rl *RateLimiter) GetLimit(tenantID string) (RateLimit, bool) {
	limit, exists := rl.limits[tenantID]
	return limit, exists
}
