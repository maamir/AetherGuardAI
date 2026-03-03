package int_detector

import (
	"context"
	"fmt"
	"strings"
)

// INTDetector detects malicious intent in user input
type INTDetector struct {
	mlModel   *MLModel
	threshold float64
	categories []IntentCategory
}

// IntentCategory represents a category of malicious intent
type IntentCategory struct {
	Name        string
	Keywords    []string
	Severity    string
	Description string
}

// DetectionResult represents the result of intent classification
type DetectionResult struct {
	IsMalicious bool
	Intent      string
	Confidence  float64
	ThreatScore float64
	Reason      string
	Categories  []string
}

// NewINTDetector creates a new malicious intent detector
func NewINTDetector(modelPath string) (*INTDetector, error) {
	detector := &INTDetector{
		threshold:  0.6, // 60% confidence threshold
		categories: buildIntentCategories(),
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

// Detect analyzes input for malicious intent
func (d *INTDetector) Detect(ctx context.Context, input string) (*DetectionResult, error) {
	result := &DetectionResult{
		IsMalicious: false,
		Confidence:  0.0,
		ThreatScore: 0.0,
		Categories:  []string{},
	}
	
	// 1. Keyword-based classification (fast path)
	keywordResult := d.classifyWithKeywords(input)
	if keywordResult.IsMalicious {
		return keywordResult, nil
	}
	
	// 2. ML-based classification (if model available)
	if d.mlModel != nil {
		mlResult, err := d.classifyWithML(ctx, input)
		if err != nil {
			// Log error but don't fail - fall back to keyword-based only
			return keywordResult, nil
		}
		
		// Use ML result if confidence is higher
		if mlResult.Confidence > result.Confidence {
			result = mlResult
		}
	}
	
	return result, nil
}

// classifyWithKeywords performs keyword-based intent classification
func (d *INTDetector) classifyWithKeywords(input string) *DetectionResult {
	result := &DetectionResult{
		IsMalicious: false,
		Confidence:  0.0,
		ThreatScore: 0.0,
		Categories:  []string{},
	}
	
	inputLower := strings.ToLower(input)
	
	for _, category := range d.categories {
		matchCount := 0
		for _, keyword := range category.Keywords {
			if strings.Contains(inputLower, keyword) {
				matchCount++
			}
		}
		
		// If multiple keywords match, flag as malicious
		if matchCount >= 2 {
			result.IsMalicious = true
			result.Intent = category.Name
			result.Confidence = 0.8
			result.ThreatScore = calculateThreatScore(category.Severity)
			result.Reason = category.Description
			result.Categories = append(result.Categories, category.Name)
		}
	}
	
	return result
}

// classifyWithML performs ML-based intent classification
func (d *INTDetector) classifyWithML(ctx context.Context, input string) (*DetectionResult, error) {
	if d.mlModel == nil {
		return &DetectionResult{}, nil
	}
	
	// Get ML model prediction
	prediction, err := d.mlModel.Predict(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("ML prediction failed: %w", err)
	}
	
	result := &DetectionResult{
		IsMalicious: prediction.Score > d.threshold,
		Intent:      prediction.Intent,
		Confidence:  prediction.Score,
		ThreatScore: prediction.ThreatScore,
		Reason:      fmt.Sprintf("ML model detected %s intent with %.2f confidence", prediction.Intent, prediction.Score),
	}
	
	return result, nil
}

// buildIntentCategories creates the intent classification categories
func buildIntentCategories() []IntentCategory {
	return []IntentCategory{
		{
			Name:        "malware_generation",
			Keywords:    []string{"malware", "virus", "trojan", "ransomware", "keylogger", "backdoor", "exploit", "payload"},
			Severity:    "critical",
			Description: "Intent to generate malware or malicious code",
		},
		{
			Name:        "social_engineering",
			Keywords:    []string{"phishing", "scam", "fraud", "impersonate", "deceive", "manipulate", "trick"},
			Severity:    "high",
			Description: "Intent to create social engineering content",
		},
		{
			Name:        "harassment",
			Keywords:    []string{"harass", "bully", "threaten", "intimidate", "stalk", "doxx", "swat"},
			Severity:    "high",
			Description: "Intent to harass or threaten individuals",
		},
		{
			Name:        "illegal_activity",
			Keywords:    []string{"illegal", "crime", "steal", "hack", "break into", "bypass security", "crack password"},
			Severity:    "critical",
			Description: "Intent to engage in illegal activities",
		},
		{
			Name:        "misinformation",
			Keywords:    []string{"fake news", "disinformation", "propaganda", "mislead", "false information"},
			Severity:    "medium",
			Description: "Intent to spread misinformation",
		},
		{
			Name:        "privacy_violation",
			Keywords:    []string{"spy", "surveillance", "track", "monitor", "collect data", "scrape"},
			Severity:    "high",
			Description: "Intent to violate privacy",
		},
		{
			Name:        "financial_fraud",
			Keywords:    []string{"ponzi", "pyramid scheme", "investment scam", "money laundering", "credit card fraud"},
			Severity:    "critical",
			Description: "Intent to commit financial fraud",
		},
	}
}

// calculateThreatScore converts severity to numeric score
func calculateThreatScore(severity string) float64 {
	switch severity {
	case "critical":
		return 1.0
	case "high":
		return 0.8
	case "medium":
		return 0.5
	case "low":
		return 0.3
	default:
		return 0.0
	}
}

// SetThreshold sets the confidence threshold for ML detection
func (d *INTDetector) SetThreshold(threshold float64) {
	d.threshold = threshold
}

// GetStats returns detection statistics
func (d *INTDetector) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"categories_count": len(d.categories),
		"ml_enabled":       d.mlModel != nil,
		"threshold":        d.threshold,
	}
}
