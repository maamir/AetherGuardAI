package models

import (
	"time"
	"github.com/google/uuid"
)

// EventCategory represents the category of an audit event
type EventCategory string

const (
	EventCategorySecurity    EventCategory = "security"
	EventCategoryCompliance  EventCategory = "compliance"
	EventCategoryOperational EventCategory = "operational"
)

// OperationStatus represents the status of an operation
type OperationStatus string

const (
	OperationStatusSuccess OperationStatus = "success"
	OperationStatusFailure OperationStatus = "failure"
)

// AuditLog represents an immutable audit trail entry
type AuditLog struct {
	LogID         uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	TenantID      uuid.UUID       `gorm:"type:uuid;not null;index:idx_audit_tenant_time"`
	Timestamp     time.Time       `gorm:"not null;index:idx_audit_time,priority:1;index:idx_audit_tenant_time,priority:2"`
	EventType     string          `gorm:"type:varchar(100);not null;index:idx_audit_event_time"`
	EventCategory EventCategory   `gorm:"type:varchar(20);not null"`
	UserID        *uuid.UUID      `gorm:"type:uuid"`
	ResourceType  string          `gorm:"type:varchar(100)"`
	ResourceID    *uuid.UUID      `gorm:"type:uuid"`
	Action        string          `gorm:"type:varchar(50);not null"`
	Status        OperationStatus `gorm:"type:varchar(20);not null"`
	IPAddress     string          `gorm:"type:inet"`
	UserAgent     string          `gorm:"type:varchar(500)"`
	RequestID     *uuid.UUID      `gorm:"type:uuid"`
	Details       map[string]interface{} `gorm:"type:jsonb"`
	Changes       map[string]interface{} `gorm:"type:jsonb"`
}

// TableName specifies the table name for GORM
func (AuditLog) TableName() string {
	return "audit_logs"
}
