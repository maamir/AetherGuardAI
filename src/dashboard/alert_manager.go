package dashboard

import (
	"fmt"
	"sync"
	"time"
)

// AlertManager manages system alerts
type AlertManager struct {
	alerts map[string]*Alert
	mu     sync.RWMutex
}

// NewAlertManager creates a new alert manager
func NewAlertManager() *AlertManager {
	return &AlertManager{
		alerts: make(map[string]*Alert),
	}
}

// CreateAlert creates a new alert
func (am *AlertManager) CreateAlert(alertType, severity, message string, details map[string]interface{}) *Alert {
	am.mu.Lock()
	defer am.mu.Unlock()
	
	alert := &Alert{
		ID:           fmt.Sprintf("alert-%d", time.Now().UnixNano()),
		Type:         alertType,
		Severity:     severity,
		Message:      message,
		Timestamp:    time.Now(),
		Acknowledged: false,
		Details:      details,
	}
	
	am.alerts[alert.ID] = alert
	return alert
}

// GetAlerts retrieves alerts filtered by severity
func (am *AlertManager) GetAlerts(severity string) []Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()
	
	alerts := make([]Alert, 0)
	
	for _, alert := range am.alerts {
		if severity == "" || alert.Severity == severity {
			alerts = append(alerts, *alert)
		}
	}
	
	return alerts
}

// AcknowledgeAlert acknowledges an alert
func (am *AlertManager) AcknowledgeAlert(alertID string) error {
	am.mu.Lock()
	defer am.mu.Unlock()
	
	alert, exists := am.alerts[alertID]
	if !exists {
		return fmt.Errorf("alert not found: %s", alertID)
	}
	
	alert.Acknowledged = true
	return nil
}

// GetActiveAlertCount returns count of unacknowledged alerts
func (am *AlertManager) GetActiveAlertCount() int {
	am.mu.RLock()
	defer am.mu.RUnlock()
	
	count := 0
	for _, alert := range am.alerts {
		if !alert.Acknowledged {
			count++
		}
	}
	
	return count
}

// CheckThresholds checks metrics against thresholds and creates alerts
func (am *AlertManager) CheckThresholds(metrics *SecurityMetrics) {
	// High block rate alert
	if metrics.BlockRate > 0.5 {
		am.CreateAlert(
			"high_block_rate",
			"warning",
			fmt.Sprintf("Block rate is %.2f%% (threshold: 50%%)", metrics.BlockRate*100),
			map[string]interface{}{
				"block_rate":       metrics.BlockRate,
				"blocked_requests": metrics.BlockedRequests,
				"total_requests":   metrics.TotalRequests,
			},
		)
	}
	
	// High threat detection alert
	if metrics.BlockedRequests > 1000 {
		am.CreateAlert(
			"high_threat_volume",
			"critical",
			fmt.Sprintf("High threat volume detected: %d blocked requests", metrics.BlockedRequests),
			map[string]interface{}{
				"blocked_requests": metrics.BlockedRequests,
				"threats_by_type":  metrics.ThreatsByType,
			},
		)
	}
}
