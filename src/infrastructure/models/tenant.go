package models

import (
	"time"
	"github.com/google/uuid"
)

// TenantStatus represents the status of a tenant
type TenantStatus string

const (
	TenantStatusActive    TenantStatus = "active"
	TenantStatusSuspended TenantStatus = "suspended"
	TenantStatusDeleted   TenantStatus = "deleted"
)

// SubscriptionTier represents the subscription level
type SubscriptionTier string

const (
	TierFree       SubscriptionTier = "free"
	TierPro        SubscriptionTier = "pro"
	TierEnterprise SubscriptionTier = "enterprise"
)

// Tenant represents a tenant in the multi-tenant system
type Tenant struct {
	TenantID         uuid.UUID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	TenantName       string           `gorm:"type:varchar(255);not null;uniqueIndex"`
	SchemaName       string           `gorm:"type:varchar(63);not null;uniqueIndex"`
	Status           TenantStatus     `gorm:"type:varchar(20);not null;default:'active'"`
	SubscriptionTier SubscriptionTier `gorm:"type:varchar(20);not null;default:'free'"`
	CreatedAt        time.Time        `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt        time.Time        `gorm:"not null;default:CURRENT_TIMESTAMP"`
	Metadata         map[string]interface{} `gorm:"type:jsonb"`
}

// TableName specifies the table name for GORM
func (Tenant) TableName() string {
	return "tenants"
}
