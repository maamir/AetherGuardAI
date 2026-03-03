package models

import "time"

// CloudEvent represents a CloudEvents 1.0 compliant event
type CloudEvent struct {
	// Required fields
	ID              string                 `json:"id"`
	Source          string                 `json:"source"`
	SpecVersion     string                 `json:"specversion"`
	Type            string                 `json:"type"`
	Time            time.Time              `json:"time"`
	Data            map[string]interface{} `json:"data"`
	
	// Optional fields
	DataContentType string                 `json:"datacontenttype,omitempty"`
	DataSchema      string                 `json:"dataschema,omitempty"`
	Subject         string                 `json:"subject,omitempty"`
	
	// Extension attributes
	TenantID        string                 `json:"tenantid,omitempty"`
	CorrelationID   string                 `json:"correlationid,omitempty"`
}

// Validate checks if the CloudEvent is valid
func (e *CloudEvent) Validate() error {
	if e.ID == "" {
		return ErrInvalidEvent("id is required")
	}
	if e.Source == "" {
		return ErrInvalidEvent("source is required")
	}
	if e.SpecVersion == "" {
		e.SpecVersion = "1.0"
	}
	if e.Type == "" {
		return ErrInvalidEvent("type is required")
	}
	if e.Time.IsZero() {
		e.Time = time.Now()
	}
	return nil
}

// ErrInvalidEvent creates an invalid event error
func ErrInvalidEvent(msg string) error {
	return &InvalidEventError{Message: msg}
}

// InvalidEventError represents an invalid event error
type InvalidEventError struct {
	Message string
}

func (e *InvalidEventError) Error() string {
	return "invalid event: " + e.Message
}
