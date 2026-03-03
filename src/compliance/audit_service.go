package compliance

import (
	"context"
	"time"
)

// AuditService handles compliance and audit logging
type AuditService struct {
	storage AuditStorage
	config  AuditConfig
}

// AuditConfig holds audit service configuration
type AuditConfig struct {
	RetentionDays     int
	EnableGDPR        bool
	EnableCCPA        bool
	EnableDataResidency bool
}

// AuditLog represents an audit log entry
type AuditLog struct {
	ID          string
	Timestamp   time.Time
	UserID      string
	TenantID    string
	Action      string
	Resource    string
	Result      string
	IPAddress   string
	UserAgent   string
	RequestData map[string]interface{}
	Metadata    map[string]string
}

// AuditStorage interface for audit log storage
type AuditStorage interface {
	Store(log *AuditLog) error
	Search(query *SearchQuery) ([]*AuditLog, error)
	GetByID(id string) (*AuditLog, error)
	Delete(id string) error
}

// SearchQuery represents an audit log search query
type SearchQuery struct {
	UserID     string
	TenantID   string
	Action     string
	StartTime  time.Time
	EndTime    time.Time
	Limit      int
	Offset     int
}

// GDPRReport represents a GDPR compliance report
type GDPRReport struct {
	UserID        string
	DataCollected []string
	DataProcessed []string
	DataShared    []string
	RetentionDays int
	GeneratedAt   time.Time
}

// CCPAReport represents a CCPA compliance report
type CCPAReport struct {
	UserID           string
	DataCategories   []string
	BusinessPurposes []string
	ThirdParties     []string
	SaleOfData       bool
	GeneratedAt      time.Time
}

// NewAuditService creates a new audit service
func NewAuditService(storage AuditStorage, config AuditConfig) *AuditService {
	return &AuditService{
		storage: storage,
		config:  config,
	}
}

// LogAction logs an action to the audit trail
func (as *AuditService) LogAction(ctx context.Context, log *AuditLog) error {
	log.Timestamp = time.Now()
	return as.storage.Store(log)
}

// SearchLogs searches audit logs
func (as *AuditService) SearchLogs(ctx context.Context, query *SearchQuery) ([]*AuditLog, error) {
	return as.storage.Search(query)
}

// GenerateGDPRReport generates a GDPR compliance report
func (as *AuditService) GenerateGDPRReport(ctx context.Context, userID string) (*GDPRReport, error) {
	// Query audit logs for user
	query := &SearchQuery{
		UserID: userID,
		Limit:  1000,
	}
	
	logs, err := as.storage.Search(query)
	if err != nil {
		return nil, err
	}
	
	report := &GDPRReport{
		UserID:        userID,
		DataCollected: []string{"prompts", "responses", "metadata"},
		DataProcessed: []string{"input_detection", "output_filtering"},
		DataShared:    []string{"llm_providers"},
		RetentionDays: as.config.RetentionDays,
		GeneratedAt:   time.Now(),
	}
	
	return report, nil
}

// GenerateCCPAReport generates a CCPA compliance report
func (as *AuditService) GenerateCCPAReport(ctx context.Context, userID string) (*CCPAReport, error) {
	report := &CCPAReport{
		UserID:           userID,
		DataCategories:   []string{"identifiers", "commercial_information", "internet_activity"},
		BusinessPurposes: []string{"service_provision", "security", "analytics"},
		ThirdParties:     []string{"llm_providers"},
		SaleOfData:       false,
		GeneratedAt:      time.Now(),
	}
	
	return report, nil
}

// DeleteUserData deletes all data for a user (GDPR right to erasure)
func (as *AuditService) DeleteUserData(ctx context.Context, userID string) error {
	query := &SearchQuery{
		UserID: userID,
		Limit:  10000,
	}
	
	logs, err := as.storage.Search(query)
	if err != nil {
		return err
	}
	
	for _, log := range logs {
		if err := as.storage.Delete(log.ID); err != nil {
			return err
		}
	}
	
	return nil
}
