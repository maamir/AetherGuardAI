package tox_detector

import (
	"context"
	"fmt"
	"strings"
)

// TOXDetector detects toxic content in AI responses
type TOXDetector struct {
	mlModel    *MLModel
	threshold  float64
	categories []ToxicityCategory
	config     Config
}

// Config holds TOX detector configuration
type Config struct {
	EnableHateSpeech      bool
	EnableProfanity       bool
	EnableAbuse           bool
	EnableDiscrimination  bool
	MultilingualSupport   bool
	ContextAware          bool
}

// ToxicityCategory represents a category of toxic content
type ToxicityCategory struct {
	Name        string
	Keywords    []string
	Severity    string
	Description string
}

// DetectionResult represents the result of toxicity detection
type DetectionResult struct {
	IsToxic       bool
	ToxicityType  string
	Score         float64
	Severity      string
	Reason        string
	Categories    []string
	Spans         []ToxicSpan
}

// ToxicSpan represents a toxic segment in the text
type ToxicSpan struct {
	Start    int
	End      int
	Text     string
	Category string
	Score    float64
}

// NewTOXDetector creates a new toxicity detector
func NewTOXDetector(modelPath string, cfg Config) (*TOXDetector, error) {
	detector := &TOXDetector{
		threshold:  0.6, // 60% confidence threshold
		categories: buildToxicityCategories(),
		config:     cfg,
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

// Detect analyzes output for toxic content
func (d *TOXDetector) Detect(ctx context.Context, output string) (*DetectionResult, error) {
	result := &DetectionResult{
		IsToxic:    false,
		Score:      0.0,
		Categories: []string{},
		Spans:      []ToxicSpan{},
	}
	
	// 1. Keyword-based detection (fast path)
	keywordResult := d.detectWithKeywords(output)
	if keywordResult.IsToxic {
		return keywordResult, nil
	}
	
	// 2. ML-based detection (if model available)
	if d.mlModel != nil {
		mlResult, err := d.detectWithML(ctx, output)
		if err != nil {
			// Log error but don't fail - fall back to keyword-based only
			return keywordResult, nil
		}
		
		// Use ML result if confidence is higher
		if mlResult.Score > result.Score {
			result = mlResult
		}
	}
	
	return result, nil
}

// detectWithKeywords performs keyword-based toxicity detection
func (d *TOXDetector) detectWithKeywords(output string) *DetectionResult {
	result := &DetectionResult{
		IsToxic:    false,
		Score:      0.0,
		Categories: []string{},
		Spans:      []ToxicSpan{},
	}
	
	outputLower := strings.ToLower(output)
	
	for _, category := range d.categories {
		// Skip disabled categories
		if !d.isCategoryEnabled(category.Name) {
			continue
		}
		
		matchCount := 0
		var spans []ToxicSpan
		
		for _, keyword := range category.Keywords {
			if strings.Contains(outputLower, keyword) {
				matchCount++
				
				// Find all occurrences
				start := 0
				for {
					idx := strings.Index(outputLower[start:], keyword)
					if idx == -1 {
						break
					}
					
					actualStart := start + idx
					actualEnd := actualStart + len(keyword)
					
					spans = append(spans, ToxicSpan{
						Start:    actualStart,
						End:      actualEnd,
						Text:     output[actualStart:actualEnd],
						Category: category.Name,
						Score:    0.8,
					})
					
					start = actualEnd
				}
			}
		}
		
		// If multiple keywords match, flag as toxic
		if matchCount >= 2 {
			result.IsToxic = true
			result.ToxicityType = category.Name
			result.Score = 0.8
			result.Severity = category.Severity
			result.Reason = category.Description
			result.Categories = append(result.Categories, category.Name)
			result.Spans = append(result.Spans, spans...)
		}
	}
	
	return result
}

// detectWithML performs ML-based toxicity detection
func (d *TOXDetector) detectWithML(ctx context.Context, output string) (*DetectionResult, error) {
	if d.mlModel == nil {
		return &DetectionResult{}, nil
	}
	
	// Get ML model prediction
	prediction, err := d.mlModel.Predict(ctx, output)
	if err != nil {
		return nil, fmt.Errorf("ML prediction failed: %w", err)
	}
	
	result := &DetectionResult{
		IsToxic:      prediction.Score > d.threshold,
		ToxicityType: prediction.ToxicityType,
		Score:        prediction.Score,
		Severity:     prediction.Severity,
		Reason:       fmt.Sprintf("ML model detected %s with %.2f confidence", prediction.ToxicityType, prediction.Score),
		Spans:        prediction.Spans,
	}
	
	return result, nil
}

// isCategoryEnabled checks if a toxicity category is enabled
func (d *TOXDetector) isCategoryEnabled(categoryName string) bool {
	switch categoryName {
	case "hate_speech":
		return d.config.EnableHateSpeech
	case "profanity":
		return d.config.EnableProfanity
	case "abuse":
		return d.config.EnableAbuse
	case "discrimination":
		return d.config.EnableDiscrimination
	default:
		return true
	}
}

// buildToxicityCategories creates the toxicity classification categories
func buildToxicityCategories() []ToxicityCategory {
	return []ToxicityCategory{
		{
			Name:        "hate_speech",
			Keywords:    []string{"hate", "racist", "bigot", "supremacist", "nazi", "genocide", "ethnic cleansing"},
			Severity:    "critical",
			Description: "Content contains hate speech or discriminatory language",
		},
		{
			Name:        "profanity",
			Keywords:    []string{"fuck", "shit", "damn", "bitch", "asshole", "bastard", "cunt"},
			Severity:    "medium",
			Description: "Content contains profane or vulgar language",
		},
		{
			Name:        "abuse",
			Keywords:    []string{"kill yourself", "die", "worthless", "stupid", "idiot", "moron", "loser"},
			Severity:    "high",
			Description: "Content contains abusive or harmful language",
		},
		{
			Name:        "discrimination",
			Keywords:    []string{"inferior", "subhuman", "degenerate", "savage", "primitive", "backwards"},
			Severity:    "high",
			Description: "Content contains discriminatory language",
		},
		{
			Name:        "violence",
			Keywords:    []string{"murder", "torture", "assault", "attack", "harm", "hurt", "injure"},
			Severity:    "critical",
			Description: "Content promotes or describes violence",
		},
		{
			Name:        "sexual",
			Keywords:    []string{"rape", "molest", "sexual assault", "abuse", "harassment", "predator"},
			Severity:    "critical",
			Description: "Content contains inappropriate sexual content",
		},
	}
}

// SetThreshold sets the confidence threshold for ML detection
func (d *TOXDetector) SetThreshold(threshold float64) {
	d.threshold = threshold
}

// GetStats returns detection statistics
func (d *TOXDetector) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"categories_count":      len(d.categories),
		"ml_enabled":            d.mlModel != nil,
		"threshold":             d.threshold,
		"multilingual_support":  d.config.MultilingualSupport,
		"context_aware":         d.config.ContextAware,
	}
}
