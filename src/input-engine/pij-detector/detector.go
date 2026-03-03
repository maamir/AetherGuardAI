package pij_detector

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

// PIJDetector detects prompt injection attacks
type PIJDetector struct {
	mlModel    *MLModel
	rules      []DetectionRule
	threshold  float64
}

// DetectionResult represents the result of prompt injection detection
type DetectionResult struct {
	IsInjection bool
	Confidence  float64
	AttackType  string
	Reason      string
	Patterns    []string
}

// DetectionRule represents a rule-based detection pattern
type DetectionRule struct {
	Name        string
	Pattern     *regexp.Regexp
	AttackType  string
	Severity    string
	Description string
}

// NewPIJDetector creates a new prompt injection detector
func NewPIJDetector(modelPath string) (*PIJDetector, error) {
	detector := &PIJDetector{
		threshold: 0.7, // 70% confidence threshold
		rules:     buildDetectionRules(),
	}
	
	// Load ML model if path provided
	if modelPath != "" {
		model, err := LoadMLModel(modelPath)
		if err != nil {
			return nil, fmt.Errorf("failed to load ML model: %w", err)
		}
		detector.mlModel = model
	}
	
	return detector, nil
}

// Detect analyzes input for prompt injection attacks
func (d *PIJDetector) Detect(ctx context.Context, input string) (*DetectionResult, error) {
	result := &DetectionResult{
		IsInjection: false,
		Confidence:  0.0,
		Patterns:    []string{},
	}
	
	// 1. Rule-based detection (fast path)
	ruleResult := d.detectWithRules(input)
	if ruleResult.IsInjection {
		return ruleResult, nil
	}
	
	// 2. ML-based detection (if model available)
	if d.mlModel != nil {
		mlResult, err := d.detectWithML(ctx, input)
		if err != nil {
			// Log error but don't fail - fall back to rule-based only
			return ruleResult, nil
		}
		
		// Combine results (take higher confidence)
		if mlResult.Confidence > result.Confidence {
			result = mlResult
		}
	}
	
	return result, nil
}

// detectWithRules performs rule-based detection
func (d *PIJDetector) detectWithRules(input string) *DetectionResult {
	result := &DetectionResult{
		IsInjection: false,
		Confidence:  0.0,
		Patterns:    []string{},
	}
	
	inputLower := strings.ToLower(input)
	
	for _, rule := range d.rules {
		if rule.Pattern.MatchString(inputLower) {
			result.IsInjection = true
			result.Confidence = 0.95 // High confidence for rule matches
			result.AttackType = rule.AttackType
			result.Reason = rule.Description
			result.Patterns = append(result.Patterns, rule.Name)
		}
	}
	
	return result
}

// detectWithML performs ML-based detection
func (d *PIJDetector) detectWithML(ctx context.Context, input string) (*DetectionResult, error) {
	if d.mlModel == nil {
		return &DetectionResult{}, nil
	}
	
	// Get ML model prediction
	prediction, err := d.mlModel.Predict(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("ML prediction failed: %w", err)
	}
	
	result := &DetectionResult{
		IsInjection: prediction.Score > d.threshold,
		Confidence:  prediction.Score,
		AttackType:  prediction.Class,
		Reason:      fmt.Sprintf("ML model detected %s with %.2f confidence", prediction.Class, prediction.Score),
	}
	
	return result, nil
}

// buildDetectionRules creates the rule-based detection patterns
func buildDetectionRules() []DetectionRule {
	return []DetectionRule{
		{
			Name:        "ignore_previous_instructions",
			Pattern:     regexp.MustCompile(`ignore\s+(previous|all|above|prior)\s+instructions`),
			AttackType:  "jailbreak",
			Severity:    "high",
			Description: "Attempt to override system instructions",
		},
		{
			Name:        "system_prompt_leak",
			Pattern:     regexp.MustCompile(`(show|reveal|display|print)\s+(system|initial|original)\s+(prompt|instructions)`),
			AttackType:  "prompt_leak",
			Severity:    "high",
			Description: "Attempt to leak system prompt",
		},
		{
			Name:        "role_play_jailbreak",
			Pattern:     regexp.MustCompile(`(pretend|act|roleplay|imagine)\s+(you are|you're|to be)\s+(not|no longer|free)`),
			AttackType:  "jailbreak",
			Severity:    "high",
			Description: "Role-play based jailbreak attempt",
		},
		{
			Name:        "dan_jailbreak",
			Pattern:     regexp.MustCompile(`(do anything now|DAN|jailbreak|unrestricted mode)`),
			AttackType:  "jailbreak",
			Severity:    "critical",
			Description: "Known jailbreak technique (DAN)",
		},
		{
			Name:        "delimiter_injection",
			Pattern:     regexp.MustCompile(`(###|---|\*\*\*)\s*(system|assistant|user|instruction)`),
			AttackType:  "delimiter_injection",
			Severity:    "high",
			Description: "Delimiter-based prompt injection",
		},
		{
			Name:        "encoding_bypass",
			Pattern:     regexp.MustCompile(`(base64|hex|rot13|unicode|encode|decode)\s*[:=]`),
			AttackType:  "encoding_bypass",
			Severity:    "medium",
			Description: "Encoding-based bypass attempt",
		},
		{
			Name:        "context_switching",
			Pattern:     regexp.MustCompile(`(new context|switch context|change mode|different mode)`),
			AttackType:  "context_switch",
			Severity:    "medium",
			Description: "Context switching attempt",
		},
		{
			Name:        "instruction_override",
			Pattern:     regexp.MustCompile(`(override|bypass|disable|turn off)\s+(safety|filter|restriction|limit)`),
			AttackType:  "jailbreak",
			Severity:    "high",
			Description: "Attempt to disable safety features",
		},
	}
}

// SetThreshold sets the confidence threshold for ML detection
func (d *PIJDetector) SetThreshold(threshold float64) {
	d.threshold = threshold
}

// GetStats returns detection statistics
func (d *PIJDetector) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"rules_count":  len(d.rules),
		"ml_enabled":   d.mlModel != nil,
		"threshold":    d.threshold,
	}
}
