package llm_provider

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Manager manages multiple LLM providers with failover and load balancing
type Manager struct {
	providers map[string]Provider
	config    ManagerConfig
	mu        sync.RWMutex
}

// ManagerConfig holds manager configuration
type ManagerConfig struct {
	EnableFailover      bool
	EnableLoadBalancing bool
	HealthCheckInterval time.Duration
	MaxRetries          int
	RetryDelay          time.Duration
}

// NewManager creates a new provider manager
func NewManager(config ManagerConfig) *Manager {
	if config.HealthCheckInterval == 0 {
		config.HealthCheckInterval = 30 * time.Second
	}
	
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	
	if config.RetryDelay == 0 {
		config.RetryDelay = 1 * time.Second
	}
	
	manager := &Manager{
		providers: make(map[string]Provider),
		config:    config,
	}
	
	// Start health check loop
	if config.HealthCheckInterval > 0 {
		go manager.healthCheckLoop()
	}
	
	return manager
}

// RegisterProvider registers a provider
func (m *Manager) RegisterProvider(name string, provider Provider) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	if _, exists := m.providers[name]; exists {
		return fmt.Errorf("provider already registered: %s", name)
	}
	
	m.providers[name] = provider
	return nil
}

// GetProvider retrieves a provider by name
func (m *Manager) GetProvider(name string) (Provider, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	provider, exists := m.providers[name]
	if !exists {
		return nil, fmt.Errorf("provider not found: %s", name)
	}
	
	return provider, nil
}

// Generate generates text with automatic failover
func (m *Manager) Generate(ctx context.Context, providerName string, request *GenerateRequest) (*GenerateResponse, error) {
	provider, err := m.GetProvider(providerName)
	if err != nil {
		return nil, err
	}
	
	// Try primary provider
	response, err := m.generateWithRetry(ctx, provider, request)
	if err == nil {
		return response, nil
	}
	
	// If failover is enabled and error is retryable, try other providers
	if m.config.EnableFailover {
		if providerErr, ok := err.(*ProviderError); ok && providerErr.IsRetryable() {
			return m.failoverGenerate(ctx, providerName, request)
		}
	}
	
	return nil, err
}

// generateWithRetry generates with retry logic
func (m *Manager) generateWithRetry(ctx context.Context, provider Provider, request *GenerateRequest) (*GenerateResponse, error) {
	var lastErr error
	
	for attempt := 0; attempt < m.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Wait before retry
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(m.config.RetryDelay * time.Duration(attempt)):
			}
		}
		
		response, err := provider.Generate(ctx, request)
		if err == nil {
			return response, nil
		}
		
		lastErr = err
		
		// Check if error is retryable
		if providerErr, ok := err.(*ProviderError); ok {
			if !providerErr.IsRetryable() {
				return nil, err
			}
		}
	}
	
	return nil, fmt.Errorf("max retries exceeded: %w", lastErr)
}

// failoverGenerate attempts generation with failover providers
func (m *Manager) failoverGenerate(ctx context.Context, primaryProvider string, request *GenerateRequest) (*GenerateResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	// Try all healthy providers except the primary
	for name, provider := range m.providers {
		if name == primaryProvider {
			continue
		}
		
		status := provider.GetStatus()
		if !status.Healthy {
			continue
		}
		
		response, err := provider.Generate(ctx, request)
		if err == nil {
			return response, nil
		}
	}
	
	return nil, fmt.Errorf("all providers failed")
}

// ListProviders lists all registered providers
func (m *Manager) ListProviders() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	names := make([]string, 0, len(m.providers))
	for name := range m.providers {
		names = append(names, name)
	}
	
	return names
}

// GetProviderStatus gets status for all providers
func (m *Manager) GetProviderStatus() map[string]ProviderStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	statuses := make(map[string]ProviderStatus)
	for name, provider := range m.providers {
		statuses[name] = provider.GetStatus()
	}
	
	return statuses
}

// healthCheckLoop periodically checks provider health
func (m *Manager) healthCheckLoop() {
	ticker := time.NewTicker(m.config.HealthCheckInterval)
	defer ticker.Stop()
	
	for range ticker.C {
		m.performHealthChecks()
	}
}

// performHealthChecks checks health of all providers
func (m *Manager) performHealthChecks() {
	m.mu.RLock()
	providers := make(map[string]Provider, len(m.providers))
	for name, provider := range m.providers {
		providers[name] = provider
	}
	m.mu.RUnlock()
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	for name, provider := range providers {
		err := provider.HealthCheck(ctx)
		if err != nil {
			fmt.Printf("Health check failed for provider %s: %v\n", name, err)
		}
	}
}

// SelectProvider selects a provider based on load balancing strategy
func (m *Manager) SelectProvider(preferredProvider string) (string, Provider, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	// If preferred provider is specified and healthy, use it
	if preferredProvider != "" {
		if provider, exists := m.providers[preferredProvider]; exists {
			status := provider.GetStatus()
			if status.Healthy {
				return preferredProvider, provider, nil
			}
		}
	}
	
	// If load balancing is enabled, select based on strategy
	if m.config.EnableLoadBalancing {
		return m.selectByLoadBalancing()
	}
	
	// Otherwise, return first healthy provider
	for name, provider := range m.providers {
		status := provider.GetStatus()
		if status.Healthy {
			return name, provider, nil
		}
	}
	
	return "", nil, fmt.Errorf("no healthy providers available")
}

// selectByLoadBalancing selects provider based on load balancing
func (m *Manager) selectByLoadBalancing() (string, Provider, error) {
	var bestName string
	var bestProvider Provider
	var bestScore float64 = -1
	
	for name, provider := range m.providers {
		status := provider.GetStatus()
		if !status.Healthy {
			continue
		}
		
		// Calculate score (lower is better)
		// Score = failure_rate * 0.5 + normalized_latency * 0.5
		score := status.FailureRate * 0.5
		if status.Latency > 0 {
			normalizedLatency := float64(status.Latency.Milliseconds()) / 1000.0
			score += normalizedLatency * 0.5
		}
		
		if bestScore < 0 || score < bestScore {
			bestScore = score
			bestName = name
			bestProvider = provider
		}
	}
	
	if bestProvider == nil {
		return "", nil, fmt.Errorf("no healthy providers available")
	}
	
	return bestName, bestProvider, nil
}

// GetStats returns manager statistics
func (m *Manager) GetStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	return map[string]interface{}{
		"provider_count":        len(m.providers),
		"failover_enabled":      m.config.EnableFailover,
		"load_balancing_enabled": m.config.EnableLoadBalancing,
		"health_check_interval": m.config.HealthCheckInterval.String(),
		"max_retries":           m.config.MaxRetries,
	}
}
