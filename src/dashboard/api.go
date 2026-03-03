package dashboard

import (
	"context"
	"fmt"
	"time"
)

// DashboardAPI provides APIs for the dashboard frontend
type DashboardAPI struct {
	metricsCollector *MetricsCollector
	alertManager     *AlertManager
	config           APIConfig
}

// APIConfig holds dashboard API configuration
type APIConfig struct {
	EnableRealtime    bool
	MetricsRetention  time.Duration
	RefreshInterval   time.Duration
}

// SecurityMetrics represents security-related metrics
type SecurityMetrics struct {
	TotalRequests       int64
	BlockedRequests     int64
	InputThreats        map[string]int64 // PIJ, INJ, INT counts
	OutputViolations    map[string]int64 // TOX, HAL counts
	PIIDetections       int64
	BlockRate           float64
	ThreatsByType       map[string]int64
	TopThreats          []ThreatSummary
	TimeSeriesData      []TimeSeriesPoint
}

// CostMetrics represents cost-related metrics
type CostMetrics struct {
	TotalCost          float64
	CostByProvider     map[string]float64
	CostByModel        map[string]float64
	CostByUser         map[string]float64
	TokensUsed         int64
	TokensByProvider   map[string]int64
	AverageCostPerRequest float64
	CostTrend          []TimeSeriesPoint
}

// PerformanceMetrics represents performance metrics
type PerformanceMetrics struct {
	AverageLatency     time.Duration
	P50Latency         time.Duration
	P95Latency         time.Duration
	P99Latency         time.Duration
	RequestsPerSecond  float64
	SuccessRate        float64
	ErrorRate          float64
	LatencyByStage     map[string]time.Duration
	LatencyTrend       []TimeSeriesPoint
}

// ProviderHealth represents provider health status
type ProviderHealth struct {
	ProviderName    string
	Status          string // "healthy", "degraded", "down"
	Availability    float64
	AverageLatency  time.Duration
	ErrorRate       float64
	LastCheck       time.Time
	RequestCount    int64
	FailureCount    int64
}

// ThreatSummary represents a threat summary
type ThreatSummary struct {
	ThreatType  string
	Count       int64
	Severity    string
	LastSeen    time.Time
}

// TimeSeriesPoint represents a time series data point
type TimeSeriesPoint struct {
	Timestamp time.Time
	Value     float64
	Label     string
}

// Alert represents a system alert
type Alert struct {
	ID          string
	Type        string
	Severity    string
	Message     string
	Timestamp   time.Time
	Acknowledged bool
	Details     map[string]interface{}
}

// NewDashboardAPI creates a new dashboard API
func NewDashboardAPI(config APIConfig) *DashboardAPI {
	if config.MetricsRetention == 0 {
		config.MetricsRetention = 24 * time.Hour
	}
	if config.RefreshInterval == 0 {
		config.RefreshInterval = 5 * time.Second
	}
	
	return &DashboardAPI{
		metricsCollector: NewMetricsCollector(config.MetricsRetention),
		alertManager:     NewAlertManager(),
		config:           config,
	}
}

// GetSecurityMetrics retrieves security metrics
func (api *DashboardAPI) GetSecurityMetrics(ctx context.Context, timeRange time.Duration) (*SecurityMetrics, error) {
	metrics := api.metricsCollector.GetSecurityMetrics(timeRange)
	return metrics, nil
}

// GetCostMetrics retrieves cost metrics
func (api *DashboardAPI) GetCostMetrics(ctx context.Context, timeRange time.Duration) (*CostMetrics, error) {
	metrics := api.metricsCollector.GetCostMetrics(timeRange)
	return metrics, nil
}

// GetPerformanceMetrics retrieves performance metrics
func (api *DashboardAPI) GetPerformanceMetrics(ctx context.Context, timeRange time.Duration) (*PerformanceMetrics, error) {
	metrics := api.metricsCollector.GetPerformanceMetrics(timeRange)
	return metrics, nil
}

// GetProviderHealth retrieves provider health status
func (api *DashboardAPI) GetProviderHealth(ctx context.Context) ([]ProviderHealth, error) {
	health := api.metricsCollector.GetProviderHealth()
	return health, nil
}

// GetAlerts retrieves active alerts
func (api *DashboardAPI) GetAlerts(ctx context.Context, severity string) ([]Alert, error) {
	alerts := api.alertManager.GetAlerts(severity)
	return alerts, nil
}

// AcknowledgeAlert acknowledges an alert
func (api *DashboardAPI) AcknowledgeAlert(ctx context.Context, alertID string) error {
	return api.alertManager.AcknowledgeAlert(alertID)
}

// GetDashboardSummary retrieves a summary for the dashboard
func (api *DashboardAPI) GetDashboardSummary(ctx context.Context) (*DashboardSummary, error) {
	timeRange := 1 * time.Hour
	
	security, _ := api.GetSecurityMetrics(ctx, timeRange)
	cost, _ := api.GetCostMetrics(ctx, timeRange)
	performance, _ := api.GetPerformanceMetrics(ctx, timeRange)
	providers, _ := api.GetProviderHealth(ctx)
	alerts, _ := api.GetAlerts(ctx, "")
	
	summary := &DashboardSummary{
		Security:    security,
		Cost:        cost,
		Performance: performance,
		Providers:   providers,
		Alerts:      alerts,
		Timestamp:   time.Now(),
	}
	
	return summary, nil
}

// DashboardSummary represents a complete dashboard summary
type DashboardSummary struct {
	Security    *SecurityMetrics
	Cost        *CostMetrics
	Performance *PerformanceMetrics
	Providers   []ProviderHealth
	Alerts      []Alert
	Timestamp   time.Time
}

// RecordRequest records a request for metrics
func (api *DashboardAPI) RecordRequest(request *RequestMetrics) {
	api.metricsCollector.RecordRequest(request)
}

// RequestMetrics represents metrics for a single request
type RequestMetrics struct {
	RequestID       string
	UserID          string
	TenantID        string
	Provider        string
	ModelID         string
	Timestamp       time.Time
	Latency         time.Duration
	TokensUsed      int64
	Cost            float64
	InputBlocked    bool
	OutputBlocked   bool
	BlockReason     string
	ThreatsDetected []string
	Success         bool
	ErrorType       string
}

// GetStats returns API statistics
func (api *DashboardAPI) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"realtime_enabled":   api.config.EnableRealtime,
		"metrics_retention":  api.config.MetricsRetention.String(),
		"refresh_interval":   api.config.RefreshInterval.String(),
		"total_metrics":      api.metricsCollector.GetTotalMetrics(),
		"active_alerts":      api.alertManager.GetActiveAlertCount(),
	}
}
