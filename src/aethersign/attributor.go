package aethersign

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"time"
)

// Attributor handles response attribution and provenance tracking
type Attributor struct {
	secretKey []byte
	config    AttributorConfig
}

// AttributorConfig holds attributor configuration
type AttributorConfig struct {
	IncludeModelVersion bool
	IncludeTimestamp    bool
	IncludeUserID       bool
	IncludeRequestID    bool
	HashAlgorithm       string // "SHA256", "SHA512"
}

// Attribution represents response attribution metadata
type Attribution struct {
	ResponseID      string
	ResponseHash    string
	ModelID         string
	ModelVersion    string
	Timestamp       int64
	UserID          string
	RequestID       string
	ProvenanceChain []ProvenanceRecord
	Signature       string
}

// ProvenanceRecord represents a provenance tracking entry
type ProvenanceRecord struct {
	Timestamp   int64
	Stage       string // "input", "processing", "output", "delivery"
	Component   string
	Action      string
	Hash        string
	Metadata    map[string]string
}

// AttributionResult represents the result of attribution
type AttributionResult struct {
	Success     bool
	Attribution *Attribution
	Error       error
}

// VerifyAttributionResult represents the result of attribution verification
type VerifyAttributionResult struct {
	Valid       bool
	Attribution *Attribution
	Tampered    bool
	Error       error
}

// NewAttributor creates a new response attributor
func NewAttributor(secretKey []byte, cfg AttributorConfig) (*Attributor, error) {
	if len(secretKey) == 0 {
		return nil, fmt.Errorf("secret key is required")
	}
	
	// Set defaults
	if cfg.HashAlgorithm == "" {
		cfg.HashAlgorithm = "SHA256"
	}
	
	return &Attributor{
		secretKey: secretKey,
		config:    cfg,
	}, nil
}

// AttributeResponse creates attribution for a response
func (a *Attributor) AttributeResponse(responseText string, metadata ResponseMetadata) (*AttributionResult, error) {
	result := &AttributionResult{
		Success: false,
	}
	
	// 1. Generate response hash
	responseHash := a.hashResponse(responseText)
	
	// 2. Generate response ID
	responseID := a.generateResponseID(metadata)
	
	// 3. Create attribution
	attribution := &Attribution{
		ResponseID:      responseID,
		ResponseHash:    responseHash,
		ModelID:         metadata.ModelID,
		ModelVersion:    metadata.ModelVersion,
		Timestamp:       time.Now().Unix(),
		UserID:          metadata.UserID,
		RequestID:       metadata.RequestID,
		ProvenanceChain: metadata.ProvenanceChain,
	}
	
	// 4. Sign attribution
	signature := a.signAttribution(attribution)
	attribution.Signature = signature
	
	result.Success = true
	result.Attribution = attribution
	
	return result, nil
}

// VerifyAttribution verifies response attribution
func (a *Attributor) VerifyAttribution(responseText string, attribution *Attribution) (*VerifyAttributionResult, error) {
	result := &VerifyAttributionResult{
		Valid:       false,
		Attribution: attribution,
		Tampered:    false,
	}
	
	// 1. Verify response hash
	expectedHash := a.hashResponse(responseText)
	if expectedHash != attribution.ResponseHash {
		result.Tampered = true
		result.Error = fmt.Errorf("response hash mismatch")
		return result, result.Error
	}
	
	// 2. Verify signature
	expectedSignature := a.signAttribution(attribution)
	if expectedSignature != attribution.Signature {
		result.Tampered = true
		result.Error = fmt.Errorf("signature mismatch")
		return result, result.Error
	}
	
	result.Valid = true
	return result, nil
}

// AddProvenanceRecord adds a provenance record to the chain
func (a *Attributor) AddProvenanceRecord(attribution *Attribution, stage, component, action string, metadata map[string]string) {
	record := ProvenanceRecord{
		Timestamp: time.Now().Unix(),
		Stage:     stage,
		Component: component,
		Action:    action,
		Hash:      a.hashString(fmt.Sprintf("%s:%s:%s", stage, component, action)),
		Metadata:  metadata,
	}
	
	attribution.ProvenanceChain = append(attribution.ProvenanceChain, record)
	
	// Update signature
	attribution.Signature = a.signAttribution(attribution)
}

// hashResponse computes hash of response text
func (a *Attributor) hashResponse(responseText string) string {
	hash := sha256.Sum256([]byte(responseText))
	return base64.StdEncoding.EncodeToString(hash[:])
}

// hashString computes hash of a string
func (a *Attributor) hashString(text string) string {
	hash := sha256.Sum256([]byte(text))
	return base64.StdEncoding.EncodeToString(hash[:])
}

// generateResponseID generates a unique response ID
func (a *Attributor) generateResponseID(metadata ResponseMetadata) string {
	data := fmt.Sprintf("%s:%s:%d:%s", 
		metadata.RequestID, 
		metadata.ModelVersion, 
		time.Now().UnixNano(), 
		metadata.UserID)
	
	hash := sha256.Sum256([]byte(data))
	return base64.URLEncoding.EncodeToString(hash[:])[:16]
}

// signAttribution creates HMAC signature for attribution
func (a *Attributor) signAttribution(attribution *Attribution) string {
	// Create canonical representation
	data := fmt.Sprintf("%s:%s:%s:%s:%d:%s:%s",
		attribution.ResponseID,
		attribution.ResponseHash,
		attribution.ModelID,
		attribution.ModelVersion,
		attribution.Timestamp,
		attribution.UserID,
		attribution.RequestID)
	
	// Add provenance chain to signature
	for _, record := range attribution.ProvenanceChain {
		data += fmt.Sprintf(":%s:%s:%s:%s",
			record.Stage,
			record.Component,
			record.Action,
			record.Hash)
	}
	
	// Compute HMAC
	h := hmac.New(sha256.New, a.secretKey)
	h.Write([]byte(data))
	signature := h.Sum(nil)
	
	return base64.StdEncoding.EncodeToString(signature)
}

// ResponseMetadata contains metadata for response attribution
type ResponseMetadata struct {
	ModelID         string
	ModelVersion    string
	UserID          string
	RequestID       string
	ProvenanceChain []ProvenanceRecord
}

// GetProvenanceChain retrieves the provenance chain for a response
func (a *Attributor) GetProvenanceChain(attribution *Attribution) []ProvenanceRecord {
	return attribution.ProvenanceChain
}

// ExportAttribution exports attribution to a portable format
func (a *Attributor) ExportAttribution(attribution *Attribution) (string, error) {
	// TODO: Implement JSON or protobuf serialization
	return fmt.Sprintf("Attribution[ResponseID=%s, ModelVersion=%s, Timestamp=%d]",
		attribution.ResponseID,
		attribution.ModelVersion,
		attribution.Timestamp), nil
}

// ImportAttribution imports attribution from a portable format
func (a *Attributor) ImportAttribution(data string) (*Attribution, error) {
	// TODO: Implement JSON or protobuf deserialization
	return nil, fmt.Errorf("not implemented")
}
