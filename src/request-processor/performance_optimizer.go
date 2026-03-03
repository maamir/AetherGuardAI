package request_processor

import (
	"context"
	"sync"
	"time"
)

// PerformanceOptimizer optimizes request processing performance
type PerformanceOptimizer struct {
	cache  *ResponseCache
	config OptimizerConfig
	mu     sync.RWMutex
}

// OptimizerConfig holds optimizer configuration
type OptimizerConfig struct {
	EnableCaching       bool
	CacheTTL            time.Duration
	EnableParallelStages bool
	MaxConcurrentRequests int
}

// ResponseCache caches responses for identical requests
type ResponseCache struct {
	entries map[string]*CacheEntry
	mu      sync.RWMutex
	ttl     time.Duration
}

// CacheEntry represents a cached response
type CacheEntry struct {
	Response  *ProcessResponse
	Timestamp time.Time
}

// NewPerformanceOptimizer creates a new performance optimizer
func NewPerformanceOptimizer(config OptimizerConfig) *PerformanceOptimizer {
	if config.CacheTTL == 0 {
		config.CacheTTL = 5 * time.Minute
	}
	
	if config.MaxConcurrentRequests == 0 {
		config.MaxConcurrentRequests = 100
	}
	
	optimizer := &PerformanceOptimizer{
		config: config,
	}
	
	if config.EnableCaching {
		optimizer.cache = NewResponseCache(config.CacheTTL)
		go optimizer.cache.cleanupLoop()
	}
	
	return optimizer
}

// NewResponseCache creates a new response cache
func NewResponseCache(ttl time.Duration) *ResponseCache {
	return &ResponseCache{
		entries: make(map[string]*CacheEntry),
		ttl:     ttl,
	}
}

// Get retrieves a cached response
func (rc *ResponseCache) Get(key string) (*ProcessResponse, bool) {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	
	entry, exists := rc.entries[key]
	if !exists {
		return nil, false
	}
	
	// Check if expired
	if time.Since(entry.Timestamp) > rc.ttl {
		return nil, false
	}
	
	return entry.Response, true
}

// Set stores a response in cache
func (rc *ResponseCache) Set(key string, response *ProcessResponse) {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	
	rc.entries[key] = &CacheEntry{
		Response:  response,
		Timestamp: time.Now(),
	}
}

// cleanupLoop periodically removes expired entries
func (rc *ResponseCache) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		rc.cleanup()
	}
}

// cleanup removes expired entries
func (rc *ResponseCache) cleanup() {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	
	now := time.Now()
	for key, entry := range rc.entries {
		if now.Sub(entry.Timestamp) > rc.ttl {
			delete(rc.entries, key)
		}
	}
}

// GenerateCacheKey generates a cache key for a request
func (po *PerformanceOptimizer) GenerateCacheKey(request *ProcessRequest) string {
	// Simple cache key based on prompt and model
	// In production, use a proper hash function
	return request.Prompt + ":" + request.ModelID
}

// GetCachedResponse retrieves a cached response if available
func (po *PerformanceOptimizer) GetCachedResponse(request *ProcessRequest) (*ProcessResponse, bool) {
	if !po.config.EnableCaching || po.cache == nil {
		return nil, false
	}
	
	key := po.GenerateCacheKey(request)
	return po.cache.Get(key)
}

// CacheResponse stores a response in cache
func (po *PerformanceOptimizer) CacheResponse(request *ProcessRequest, response *ProcessResponse) {
	if !po.config.EnableCaching || po.cache == nil {
		return
	}
	
	key := po.GenerateCacheKey(request)
	po.cache.Set(key, response)
}

// OptimizeRequest optimizes a request before processing
func (po *PerformanceOptimizer) OptimizeRequest(request *ProcessRequest) {
	// Optimize max_tokens if not set
	if request.MaxTokens == 0 {
		request.MaxTokens = 1000
	}
	
	// Optimize temperature
	if request.Temperature == 0 {
		request.Temperature = 0.7
	}
	
	// Limit max_tokens to reasonable value
	if request.MaxTokens > 4000 {
		request.MaxTokens = 4000
	}
}

// ProcessWithOptimization processes a request with optimization
func (po *PerformanceOptimizer) ProcessWithOptimization(
	ctx context.Context,
	request *ProcessRequest,
	processor *RequestProcessor,
) (*ProcessResponse, error) {
	
	// Check cache first
	if cachedResponse, found := po.GetCachedResponse(request); found {
		return cachedResponse, nil
	}
	
	// Optimize request
	po.OptimizeRequest(request)
	
	// Process request
	response, err := processor.Process(ctx, request)
	if err != nil {
		return nil, err
	}
	
	// Cache successful response
	if !response.InputBlocked && !response.OutputBlocked {
		po.CacheResponse(request, response)
	}
	
	return response, nil
}

// GetStats returns optimizer statistics
func (po *PerformanceOptimizer) GetStats() map[string]interface{} {
	stats := map[string]interface{}{
		"caching_enabled":        po.config.EnableCaching,
		"cache_ttl":              po.config.CacheTTL.String(),
		"parallel_stages_enabled": po.config.EnableParallelStages,
		"max_concurrent_requests": po.config.MaxConcurrentRequests,
	}
	
	if po.cache != nil {
		po.cache.mu.RLock()
		stats["cache_entries"] = len(po.cache.entries)
		po.cache.mu.RUnlock()
	}
	
	return stats
}
