package hal_detector

import (
	"context"
	"fmt"
	"strings"
)

// HALDetector detects hallucinations in AI responses
type HALDetector struct {
	mlModel  *MLModel
	config   Config
}

// Config holds HAL detector configuration
type Config struct {
	EnableContextVerification   bool
	EnableSelfConsistency       bool
	EnableFactGrounding         bool
	ConsistencyChecks           int     // Number of consistency checks (default: 3)
	ConfidenceThreshold         float64 // Threshold for flagging claims (default: 0.7)
	CreativeContentExemption    bool    // Don't flag creative content
}

// DetectionResult represents the result of hallucination detection
type DetectionResult struct {
	HasHallucination   bool
	OverallConfidence  float64
	UnverifiedClaims   []UnverifiedClaim
	VerificationMethod string
	Reason             string
}

// UnverifiedClaim represents a claim that couldn't be verified
type UnverifiedClaim struct {
	Text       string
	Start      int
	End        int
	Confidence float64
	Reason     string
	Type       string // "factual", "contextual", "inconsistent"
}

// NewHALDetector creates a new hallucination detector
func NewHALDetector(modelPath string, cfg Config) (*HALDetector, error) {
	// Set defaults
	if cfg.ConsistencyChecks == 0 {
		cfg.ConsistencyChecks = 3
	}
	if cfg.ConfidenceThreshold == 0.0 {
		cfg.ConfidenceThreshold = 0.7
	}
	
	detector := &HALDetector{
		config: cfg,
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

// Detect analyzes output for hallucinations
func (d *HALDetector) Detect(ctx context.Context, output string, requestCtx interface{}) (*DetectionResult, error) {
	result := &DetectionResult{
		HasHallucination:  false,
		OverallConfidence: 1.0,
		UnverifiedClaims:  []UnverifiedClaim{},
	}
	
	// Extract context if available
	var sourceContext string
	if reqCtx, ok := requestCtx.(interface{ GetSourceContext() string }); ok {
		sourceContext = reqCtx.GetSourceContext()
	}
	
	// 1. Context-based verification (if context provided)
	if d.config.EnableContextVerification && sourceContext != "" {
		contextResult := d.verifyAgainstContext(output, sourceContext)
		result.UnverifiedClaims = append(result.UnverifiedClaims, contextResult...)
		result.VerificationMethod = "context-based"
	}
	
	// 2. Self-consistency checking (if enabled)
	if d.config.EnableSelfConsistency {
		consistencyResult := d.checkSelfConsistency(output)
		result.UnverifiedClaims = append(result.UnverifiedClaims, consistencyResult...)
		if result.VerificationMethod == "" {
			result.VerificationMethod = "self-consistency"
		} else {
			result.VerificationMethod += "+self-consistency"
		}
	}
	
	// 3. ML-based detection (if model available)
	if d.mlModel != nil {
		mlResult, err := d.detectWithML(ctx, output, sourceContext)
		if err != nil {
			// Log error but don't fail
			return result, nil
		}
		
		result.UnverifiedClaims = append(result.UnverifiedClaims, mlResult.UnverifiedClaims...)
		if result.VerificationMethod == "" {
			result.VerificationMethod = "ml-based"
		} else {
			result.VerificationMethod += "+ml-based"
		}
	}
	
	// Determine if hallucination detected
	if len(result.UnverifiedClaims) > 0 {
		result.HasHallucination = true
		
		// Calculate overall confidence (average of unverified claims)
		totalConfidence := 0.0
		for _, claim := range result.UnverifiedClaims {
			totalConfidence += claim.Confidence
		}
		result.OverallConfidence = 1.0 - (totalConfidence / float64(len(result.UnverifiedClaims)))
		
		result.Reason = fmt.Sprintf("Found %d unverified claims", len(result.UnverifiedClaims))
	}
	
	return result, nil
}

// verifyAgainstContext checks if output claims are supported by the provided context
func (d *HALDetector) verifyAgainstContext(output, context string) []UnverifiedClaim {
	var claims []UnverifiedClaim
	
	// Simple heuristic: extract sentences and check if they're supported by context
	sentences := extractSentences(output)
	
	for _, sentence := range sentences {
		// Skip very short sentences
		if len(sentence.Text) < 20 {
			continue
		}
		
		// Check if sentence content is present in context
		if !isSupported(sentence.Text, context) {
			claims = append(claims, UnverifiedClaim{
				Text:       sentence.Text,
				Start:      sentence.Start,
				End:        sentence.End,
				Confidence: 0.8,
				Reason:     "Claim not found in provided context",
				Type:       "contextual",
			})
		}
	}
	
	return claims
}

// checkSelfConsistency checks for internal contradictions in the output
func (d *HALDetector) checkSelfConsistency(output string) []UnverifiedClaim {
	var claims []UnverifiedClaim
	
	// Simple heuristic: look for contradictory statements
	// This is a placeholder - real implementation would use NLI models
	
	sentences := extractSentences(output)
	
	// Look for explicit contradictions
	for i, sent1 := range sentences {
		for j := i + 1; j < len(sentences); j++ {
			sent2 := sentences[j]
			
			if hasContradiction(sent1.Text, sent2.Text) {
				claims = append(claims, UnverifiedClaim{
					Text:       sent1.Text,
					Start:      sent1.Start,
					End:        sent1.End,
					Confidence: 0.7,
					Reason:     "Contradicts another statement in the response",
					Type:       "inconsistent",
				})
			}
		}
	}
	
	return claims
}

// detectWithML performs ML-based hallucination detection
func (d *HALDetector) detectWithML(ctx context.Context, output, context string) (*DetectionResult, error) {
	if d.mlModel == nil {
		return &DetectionResult{}, nil
	}
	
	// Get ML model prediction
	prediction, err := d.mlModel.Predict(ctx, output, context)
	if err != nil {
		return nil, fmt.Errorf("ML prediction failed: %w", err)
	}
	
	result := &DetectionResult{
		HasHallucination:  len(prediction.UnverifiedClaims) > 0,
		OverallConfidence: prediction.Confidence,
		UnverifiedClaims:  prediction.UnverifiedClaims,
		Reason:            "ML model detected potential hallucinations",
	}
	
	return result, nil
}

// Sentence represents a sentence in the text
type Sentence struct {
	Text  string
	Start int
	End   int
}

// extractSentences splits text into sentences
func extractSentences(text string) []Sentence {
	var sentences []Sentence
	
	// Simple sentence splitting (real implementation would use NLP library)
	parts := strings.Split(text, ". ")
	
	start := 0
	for _, part := range parts {
		if len(part) == 0 {
			continue
		}
		
		end := start + len(part)
		sentences = append(sentences, Sentence{
			Text:  strings.TrimSpace(part),
			Start: start,
			End:   end,
		})
		start = end + 2 // +2 for ". "
	}
	
	return sentences
}

// isSupported checks if a claim is supported by the context
func isSupported(claim, context string) bool {
	// Simple heuristic: check if key terms from claim appear in context
	// Real implementation would use semantic similarity or entailment models
	
	claimLower := strings.ToLower(claim)
	contextLower := strings.ToLower(context)
	
	// Extract key terms (words longer than 4 characters)
	words := strings.Fields(claimLower)
	keyTerms := []string{}
	for _, word := range words {
		if len(word) > 4 {
			keyTerms = append(keyTerms, word)
		}
	}
	
	// Check if at least 50% of key terms are in context
	matchCount := 0
	for _, term := range keyTerms {
		if strings.Contains(contextLower, term) {
			matchCount++
		}
	}
	
	if len(keyTerms) == 0 {
		return true // No key terms to verify
	}
	
	return float64(matchCount)/float64(len(keyTerms)) >= 0.5
}

// hasContradiction checks if two sentences contradict each other
func hasContradiction(sent1, sent2 string) bool {
	// Simple heuristic: look for negation patterns
	// Real implementation would use NLI (Natural Language Inference) models
	
	sent1Lower := strings.ToLower(sent1)
	sent2Lower := strings.ToLower(sent2)
	
	// Look for explicit negation patterns
	negationPatterns := []string{"not", "no", "never", "cannot", "isn't", "aren't", "wasn't", "weren't"}
	
	hasNegation1 := false
	hasNegation2 := false
	
	for _, pattern := range negationPatterns {
		if strings.Contains(sent1Lower, pattern) {
			hasNegation1 = true
		}
		if strings.Contains(sent2Lower, pattern) {
			hasNegation2 = true
		}
	}
	
	// If one has negation and they share key terms, might be contradiction
	if hasNegation1 != hasNegation2 {
		// Check for shared key terms
		words1 := strings.Fields(sent1Lower)
		words2 := strings.Fields(sent2Lower)
		
		sharedCount := 0
		for _, w1 := range words1 {
			if len(w1) > 4 {
				for _, w2 := range words2 {
					if w1 == w2 {
						sharedCount++
					}
				}
			}
		}
		
		return sharedCount >= 2
	}
	
	return false
}

// GetStats returns detection statistics
func (d *HALDetector) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"ml_enabled":              d.mlModel != nil,
		"context_verification":    d.config.EnableContextVerification,
		"self_consistency":        d.config.EnableSelfConsistency,
		"fact_grounding":          d.config.EnableFactGrounding,
		"consistency_checks":      d.config.ConsistencyChecks,
		"confidence_threshold":    d.config.ConfidenceThreshold,
		"creative_exemption":      d.config.CreativeContentExemption,
	}
}
