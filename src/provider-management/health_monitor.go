package provider_management

import (
	"context"
	"time"
	
	llm_provider "github.com/aetherguard/aetherguard-ai/src/llm-provider"
)

// HealthMonitor monitors provider health and coordinates failover
type HealthMonitor struct {
	providerMgr *llm_provider.Manager
	config      HealthConfig
}

// HealthConfig holds health monitor configuration
type HealthConfig struct {
	CheckInterval    time.Duration
	FailureThreshold int
	RecoveryThreshold int
}

// NewHealthMonitor creates a new health monitor
func NewHealthMonitor(providerMgr *llm_provider.Manager, config HealthConfig) *HealthMonitor {
	if config.CheckInterval == 0 {
		config.CheckInterval = 30 * time.Second
	}
	if config.FailureThreshold == 0 {
		config.FailureThreshold = 3
	}
	if config.RecoveryThreshold == 0 {
		config.RecoveryThreshold = 3
	}
	
	monitor := &HealthMonitor{
		providerMgr: providerMgr,
		config:      config,
	}
	
	go monitor.monitorLoop()
	
	return monitor
}

// monitorLoop continuously monitors provider health
func (hm *HealthMonitor) monitorLoop() {
	ticker := time.NewTicker(hm.config.CheckInterval)
	defer ticker.Stop()
	
	for range ticker.C {
		hm.checkAllProviders()
	}
}

// checkAllProviders checks health of all providers
func (hm *HealthMonitor) checkAllProviders() {
	providers := hm.providerMgr.ListProviders()
	
	for _, name := range providers {
		provider, err := hm.providerMgr.GetProvider(name)
		if err != nil {
			continue
		}
		
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err = provider.HealthCheck(ctx)
		cancel()
		
		// Provider manager updates status internally
	}
}

// GetHealthStatus returns health status for all providers
func (hm *HealthMonitor) GetHealthStatus() map[string]llm_provider.ProviderStatus {
	return hm.providerMgr.GetProviderStatus()
}
