package pii_detector

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

// PIIDetector detects and redacts personally identifiable information
type PIIDetector struct {
	patterns []PIIPattern
	config   Config
}

// Config holds PII detector configuration
type Config struct {
	EnableRedaction bool
	RedactionChar   string
	PreserveFormat  bool
}

// PIIPattern represents a PII detection pattern
type PIIPattern struct {
	Name        string
	Pattern     *regexp.Regexp
	Type        string
	Severity    string
	Description string
}

// DetectionResult represents the result of PII detection
type DetectionResult struct {
	HasPII        bool
	PIITypes      []string
	Matches       []PIIMatch
	RedactedText  string
	OriginalText  string
}

// PIIMatch represents a detected PII instance
type PIIMatch struct {
	Type     string
	Value    string
	Start    int
	End      int
	Redacted string
}

// NewPIIDetector creates a new PII detector
func NewPIIDetector(cfg Config) *PIIDetector {
	if cfg.RedactionChar == "" {
		cfg.RedactionChar = "*"
	}
	
	return &PIIDetector{
		patterns: buildPIIPatterns(),
		config:   cfg,
	}
}

// Detect analyzes input for PII
func (d *PIIDetector) Detect(ctx context.Context, input string) (*DetectionResult, error) {
	result := &DetectionResult{
		HasPII:       false,
		PIITypes:     []string{},
		Matches:      []PIIMatch{},
		RedactedText: input,
		OriginalText: input,
	}
	
	// Check each PII pattern
	for _, pattern := range d.patterns {
		matches := pattern.Pattern.FindAllStringSubmatchIndex(input, -1)
		
		for _, match := range matches {
			if len(match) >= 2 {
				start, end := match[0], match[1]
				value := input[start:end]
				
				// Create PII match
				piiMatch := PIIMatch{
					Type:  pattern.Type,
					Value: value,
					Start: start,
					End:   end,
				}
				
				// Redact if enabled
				if d.config.EnableRedaction {
					piiMatch.Redacted = d.redact(value, pattern.Type)
				}
				
				result.HasPII = true
				result.Matches = append(result.Matches, piiMatch)
				
				// Track unique PII types
				if !contains(result.PIITypes, pattern.Type) {
					result.PIITypes = append(result.PIITypes, pattern.Type)
				}
			}
		}
	}
	
	// Apply redactions to text
	if d.config.EnableRedaction && len(result.Matches) > 0 {
		result.RedactedText = d.applyRedactions(input, result.Matches)
	}
	
	return result, nil
}

// redact redacts a PII value
func (d *PIIDetector) redact(value, piiType string) string {
	if d.config.PreserveFormat {
		// Preserve format (e.g., XXX-XX-1234 for SSN)
		return d.redactWithFormat(value, piiType)
	}
	
	// Simple redaction
	return strings.Repeat(d.config.RedactionChar, len(value))
}

// redactWithFormat redacts while preserving format
func (d *PIIDetector) redactWithFormat(value, piiType string) string {
	switch piiType {
	case "ssn":
		// Show last 4 digits: XXX-XX-1234
		if len(value) >= 4 {
			return strings.Repeat("X", len(value)-4) + value[len(value)-4:]
		}
	case "credit_card":
		// Show last 4 digits: XXXX-XXXX-XXXX-1234
		if len(value) >= 4 {
			return strings.Repeat("X", len(value)-4) + value[len(value)-4:]
		}
	case "email":
		// Show domain: XXX@example.com
		parts := strings.Split(value, "@")
		if len(parts) == 2 {
			return strings.Repeat("X", len(parts[0])) + "@" + parts[1]
		}
	}
	
	// Default: full redaction
	return strings.Repeat(d.config.RedactionChar, len(value))
}

// applyRedactions applies all redactions to the text
func (d *PIIDetector) applyRedactions(text string, matches []PIIMatch) string {
	// Sort matches by start position (descending) to avoid offset issues
	sortedMatches := make([]PIIMatch, len(matches))
	copy(sortedMatches, matches)
	
	// Apply redactions from end to start
	result := text
	for i := len(sortedMatches) - 1; i >= 0; i-- {
		match := sortedMatches[i]
		result = result[:match.Start] + match.Redacted + result[match.End:]
	}
	
	return result
}

// buildPIIPatterns creates the PII detection patterns
func buildPIIPatterns() []PIIPattern {
	return []PIIPattern{
		{
			Name:        "ssn",
			Pattern:     regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),
			Type:        "ssn",
			Severity:    "critical",
			Description: "Social Security Number",
		},
		{
			Name:        "email",
			Pattern:     regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`),
			Type:        "email",
			Severity:    "high",
			Description: "Email address",
		},
		{
			Name:        "credit_card",
			Pattern:     regexp.MustCompile(`\b(?:\d{4}[-\s]?){3}\d{4}\b`),
			Type:        "credit_card",
			Severity:    "critical",
			Description: "Credit card number",
		},
		{
			Name:        "phone_us",
			Pattern:     regexp.MustCompile(`\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b`),
			Type:        "phone",
			Severity:    "medium",
			Description: "US phone number",
		},
		{
			Name:        "ip_address",
			Pattern:     regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`),
			Type:        "ip_address",
			Severity:    "low",
			Description: "IP address",
		},
		{
			Name:        "passport",
			Pattern:     regexp.MustCompile(`\b[A-Z]{1,2}\d{6,9}\b`),
			Type:        "passport",
			Severity:    "critical",
			Description: "Passport number",
		},
		{
			Name:        "drivers_license",
			Pattern:     regexp.MustCompile(`\b[A-Z]{1,2}\d{5,8}\b`),
			Type:        "drivers_license",
			Severity:    "high",
			Description: "Driver's license number",
		},
		{
			Name:        "date_of_birth",
			Pattern:     regexp.MustCompile(`\b(?:0[1-9]|1[0-2])[/-](?:0[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b`),
			Type:        "date_of_birth",
			Severity:    "medium",
			Description: "Date of birth",
		},
	}
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// GetStats returns detection statistics
func (d *PIIDetector) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"patterns_count":    len(d.patterns),
		"redaction_enabled": d.config.EnableRedaction,
		"preserve_format":   d.config.PreserveFormat,
	}
}
