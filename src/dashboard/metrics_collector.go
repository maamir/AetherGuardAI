package dashboard

import (
	"sync"
	"time"
)

// MetricsCollector collects and aggregates metrics
type MetricsCollector struct {
	requests  []RequestMetrics
	retention time.Duration
	mu        sync.RWMutex
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(retention time.Duration) *MetricsCollector {
	collector := &MetricsCollector{
		requests:  make([]RequestMetrics, 0),
		retention: retention,
	}
	
	// Start cleanup goroutine
	go collector.cleanupLoop()
	
	return collector
}

// RecordRequest records a request metric
func (mc *MetricsCollector) RecordRequest(request *RequestMetrics) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	
	mc.requests = append(mc.requests, *request)
}

// GetSecurityMetrics calculates security metrics
func (mc *MetricsCollector) GetSecurityMetrics(timeRange time.Duration) *SecurityMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	
	cutoff := time.Now().Add(-timeRange)
	
	metrics := &SecurityMetrics{
		InputThreats:     make(map[string]int64),
		OutputViolations: make(map[string]int64),
		ThreatsByType:    make(map[string]int64),
		TopThreats:       []ThreatSummary{},
		TimeSeriesData:   []TimeSeriesPoint{},
	}
	
	for _, req := range mc.requests {
		if req.Timestamp.Before(cutoff) {
			continue
		}
		
		metrics.TotalRequests++
		
		if req.InputBlocked || req.OutputBlocked {
			metrics.BlockedRequests++
		}
		
		for _, threat := range req.ThreatsDetected {
			metrics.ThreatsByType[threat]++
		}
	}
	
	if metrics.TotalRequests > 0 {
		metrics.BlockRate = float64(metrics.BlockedRequests) / float64(metrics.TotalRequests)
	}
	
	return metrics
}

// GetCostMetrics calculates cost metrics
func (mc *MetricsCollector) GetCostMetrics(timeRange time.Duration) *CostMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	
	cutoff := time.Now().Add(-timeRange)
	
	metrics := &CostMetrics{
		CostByProvider:   make(map[string]float64),
		CostByModel:      make(map[string]float64),
		CostByUser:       make(map[string]float64),
		TokensByProvider: make(map[string]int64),
		CostTrend:        []TimeSeriesPoint{},
	}
	
	requestCount := int64(0)
	
	for _, req := range mc.requests {
		if req.Timestamp.Before(cutoff) {
			continue
		}
		
		metrics.TotalCost += req.Cost
		metrics.TokensUsed += req.TokensUsed
		metrics.CostByProvider[req.Provider] += req.Cost
		metrics.CostByModel[req.ModelID] += req.Cost
		metrics.CostByUser[req.UserID] += req.Cost
		metrics.TokensByProvider[req.Provider] += req.TokensUsed
		requestCount++
	}
	
	if requestCount > 0 {
		metrics.AverageCostPerRequest = metrics.TotalCost / float64(requestCount)
	}
	
	return metrics
}

// GetPerformanceMetrics calculates performance metrics
func (mc *MetricsCollector) GetPerformanceMetrics(timeRange time.Duration) *PerformanceMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	
	cutoff := time.Now().Add(-timeRange)
	
	metrics := &PerformanceMetrics{
		LatencyByStage: make(map[string]time.Duration),
		LatencyTrend:   []TimeSeriesPoint{},
	}
	
	var latencies []time.Duration
	successCount := int64(0)
	errorCount := int64(0)
	
	for _, req := range mc.requests {
		if req.Timestamp.Before(cutoff) {
			continue
		}
		
		latencies = append(latencies, req.Latency)
		
		if req.Success {
			successCount++
		} else {
			errorCount++
		}
	}
	
	if len(latencies) > 0 {
		metrics.AverageLatency = calculateAverage(latencies)
		metrics.P50Latency = calculatePercentile(latencies, 0.50)
		metrics.P95Latency = calculatePercentile(latencies, 0.95)
		metrics.P99Latency = calculatePercentile(latencies, 0.99)
		
		totalRequests := successCount + errorCount
		if totalRequests > 0 {
			metrics.SuccessRate = float64(successCount) / float64(totalRequests)
			metrics.ErrorRate = float64(errorCount) / float64(totalRequests)
			metrics.RequestsPerSecond = float64(totalRequests) / timeRange.Seconds()
		}
	}
	
	return metrics
}

// GetProviderHealth calculates provider health
func (mc *MetricsCollector) GetProviderHealth() []ProviderHealth {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	
	providerStats := make(map[string]*providerStats)
	
	for _, req := range mc.requests {
		if _, exists := providerStats[req.Provider]; !exists {
			providerStats[req.Provider] = &providerStats{
				latencies: []time.Duration{},
			}
		}
		
		stats := providerStats[req.Provider]
		stats.requestCount++
		stats.latencies = append(stats.latencies, req.Latency)
		
		if !req.Success {
			stats.failureCount++
		}
		
		if req.Timestamp.After(stats.lastSeen) {
			stats.lastSeen = req.Timestamp
		}
	}
	
	health := make([]ProviderHealth, 0, len(providerStats))
	
	for provider, stats := range providerStats {
		errorRate := float64(0)
		if stats.requestCount > 0 {
			errorRate = float64(stats.failureCount) / float64(stats.requestCount)
		}
		
		status := "healthy"
		if errorRate > 0.5 {
			status = "down"
		} else if errorRate > 0.1 {
			status = "degraded"
		}
		
		health = append(health, ProviderHealth{
			ProviderName:   provider,
			Status:         status,
			Availability:   1.0 - errorRate,
			AverageLatency: calculateAverage(stats.latencies),
			ErrorRate:      errorRate,
			LastCheck:      stats.lastSeen,
			RequestCount:   stats.requestCount,
			FailureCount:   stats.failureCount,
		})
	}
	
	return health
}

// GetTotalMetrics returns total metrics count
func (mc *MetricsCollector) GetTotalMetrics() int {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	return len(mc.requests)
}

// cleanupLoop periodically removes old metrics
func (mc *MetricsCollector) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		mc.cleanup()
	}
}

// cleanup removes metrics older than retention period
func (mc *MetricsCollector) cleanup() {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	
	cutoff := time.Now().Add(-mc.retention)
	
	filtered := make([]RequestMetrics, 0)
	for _, req := range mc.requests {
		if req.Timestamp.After(cutoff) {
			filtered = append(filtered, req)
		}
	}
	
	mc.requests = filtered
}

// providerStats holds provider statistics
type providerStats struct {
	requestCount int64
	failureCount int64
	latencies    []time.Duration
	lastSeen     time.Time
}

// calculateAverage calculates average duration
func calculateAverage(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	
	total := time.Duration(0)
	for _, d := range durations {
		total += d
	}
	
	return total / time.Duration(len(durations))
}

// calculatePercentile calculates percentile duration
func calculatePercentile(durations []time.Duration, percentile float64) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	
	// Simple percentile calculation (should use proper sorting in production)
	index := int(float64(len(durations)) * percentile)
	if index >= len(durations) {
		index = len(durations) - 1
	}
	
	return durations[index]
}
