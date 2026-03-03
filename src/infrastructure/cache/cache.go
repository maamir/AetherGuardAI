package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	
	"github.com/redis/go-redis/v9"
	
	"github.com/aetherguard/aetherguard-ai/src/infrastructure/config"
)

// CacheManager manages Redis cache operations
type CacheManager struct {
	client *redis.ClusterClient
	config config.CacheConfig
}

// NewCacheManager creates a new cache manager
func NewCacheManager(cfg config.CacheConfig) (*CacheManager, error) {
	var client *redis.ClusterClient
	
	if cfg.ClusterMode {
		client = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs:        cfg.Addresses,
			Password:     cfg.Password,
			PoolSize:     cfg.PoolSize,
			MinIdleConns: cfg.MinIdleConns,
			MaxRetries:   cfg.MaxRetries,
		})
	} else {
		// For non-cluster mode, use first address
		client = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs:        []string{cfg.Addresses[0]},
			Password:     cfg.Password,
			PoolSize:     cfg.PoolSize,
			MinIdleConns: cfg.MinIdleConns,
			MaxRetries:   cfg.MaxRetries,
		})
	}
	
	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}
	
	return &CacheManager{
		client: client,
		config: cfg,
	}, nil
}

// Get retrieves a value from cache
func (m *CacheManager) Get(ctx context.Context, key string) (interface{}, error) {
	val, err := m.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, ErrCacheMiss
	}
	if err != nil {
		// Fail-open: return error but don't block operation
		return nil, fmt.Errorf("cache get failed: %w", err)
	}
	
	var result interface{}
	if err := json.Unmarshal([]byte(val), &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached value: %w", err)
	}
	
	return result, nil
}

// Set stores a value in cache with TTL
func (m *CacheManager) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	if ttl == 0 {
		ttl = m.config.DefaultTTL
	}
	
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}
	
	if err := m.client.Set(ctx, key, data, ttl).Err(); err != nil {
		// Fail-open: log error but don't block operation
		return fmt.Errorf("cache set failed: %w", err)
	}
	
	return nil
}

// Delete removes a value from cache
func (m *CacheManager) Delete(ctx context.Context, key string) error {
	if err := m.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("cache delete failed: %w", err)
	}
	return nil
}

// Invalidate removes all keys matching a pattern
func (m *CacheManager) Invalidate(ctx context.Context, pattern string) error {
	iter := m.client.Scan(ctx, 0, pattern, 0).Iterator()
	for iter.Next(ctx) {
		if err := m.client.Del(ctx, iter.Val()).Err(); err != nil {
			return fmt.Errorf("failed to delete key %s: %w", iter.Val(), err)
		}
	}
	if err := iter.Err(); err != nil {
		return fmt.Errorf("cache invalidation failed: %w", err)
	}
	return nil
}

// HealthCheck performs a health check on Redis
func (m *CacheManager) HealthCheck(ctx context.Context) error {
	if err := m.client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("Redis ping failed: %w", err)
	}
	return nil
}

// Close closes the Redis connection
func (m *CacheManager) Close() error {
	return m.client.Close()
}

// GenerateKey generates a cache key with tenant context
func GenerateKey(tenantID, entityType, entityID string) string {
	return fmt.Sprintf("%s:%s:%s", tenantID, entityType, entityID)
}

// ErrCacheMiss indicates a cache miss
var ErrCacheMiss = fmt.Errorf("cache miss")
