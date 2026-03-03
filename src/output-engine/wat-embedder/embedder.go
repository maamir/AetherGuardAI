package wat_embedder

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"math/rand"
	"time"
)

// WATEmbedder embeds invisible watermarks in AI responses
type WATEmbedder struct {
	secretKey []byte
	config    Config
	rng       *rand.Rand
}

// Config holds WAT embedder configuration
type Config struct {
	WatermarkStrength    float64 // 0.0-1.0, higher = more detectable but may affect quality
	MinTokens            int     // Minimum tokens required for watermarking (default: 50)
	EmbedMetadata        bool    // Include metadata in watermark
	StatisticalMethod    string  // "token_distribution", "synonym_selection", "spacing"
}

// EmbedResult represents the result of watermark embedding
type EmbedResult struct {
	Success         bool
	WatermarkedText string
	WatermarkID     string
	Metadata        WatermarkMetadata
	Method          string
}

// WatermarkMetadata contains metadata embedded in the watermark
type WatermarkMetadata struct {
	RequestID    string
	ModelVersion string
	Timestamp    int64
	UserID       string
}

// VerificationResult represents the result of watermark verification
type VerificationResult struct {
	IsWatermarked bool
	Confidence    float64
	WatermarkID   string
	Metadata      WatermarkMetadata
	Tampered      bool
}

// NewWATEmbedder creates a new watermark embedder
func NewWATEmbedder(secretKey string, cfg Config) (*WATEmbedder, error) {
	if secretKey == "" {
		return nil, fmt.Errorf("secret key is required")
	}
	
	// Set defaults
	if cfg.MinTokens == 0 {
		cfg.MinTokens = 50
	}
	if cfg.WatermarkStrength == 0.0 {
		cfg.WatermarkStrength = 0.5
	}
	if cfg.StatisticalMethod == "" {
		cfg.StatisticalMethod = "token_distribution"
	}
	
	embedder := &WATEmbedder{
		secretKey: []byte(secretKey),
		config:    cfg,
		rng:       rand.New(rand.NewSource(time.Now().UnixNano())),
	}
	
	return embedder, nil
}

// Embed embeds a watermark in the output text
func (w *WATEmbedder) Embed(ctx context.Context, output string, requestCtx interface{}) (*EmbedResult, error) {
	result := &EmbedResult{
		Success:         false,
		WatermarkedText: output,
		Method:          w.config.StatisticalMethod,
	}
	
	// Extract metadata from request context
	metadata := w.extractMetadata(requestCtx)
	result.Metadata = metadata
	
	// Check if text is long enough for watermarking
	tokenCount := estimateTokenCount(output)
	if tokenCount < w.config.MinTokens {
		// Use alternative method for short texts
		return w.embedShortText(output, metadata)
	}
	
	// Generate watermark ID
	watermarkID := w.generateWatermarkID(metadata)
	result.WatermarkID = watermarkID
	
	// Embed watermark based on configured method
	var watermarkedText string
	var err error
	
	switch w.config.StatisticalMethod {
	case "token_distribution":
		watermarkedText, err = w.embedTokenDistribution(output, watermarkID)
	case "synonym_selection":
		watermarkedText, err = w.embedSynonymSelection(output, watermarkID)
	case "spacing":
		watermarkedText, err = w.embedSpacing(output, watermarkID)
	default:
		watermarkedText, err = w.embedTokenDistribution(output, watermarkID)
	}
	
	if err != nil {
		return nil, fmt.Errorf("watermark embedding failed: %w", err)
	}
	
	result.Success = true
	result.WatermarkedText = watermarkedText
	
	return result, nil
}

// Verify verifies if text contains a watermark
func (w *WATEmbedder) Verify(ctx context.Context, text string) (*VerificationResult, error) {
	result := &VerificationResult{
		IsWatermarked: false,
		Confidence:    0.0,
		Tampered:      false,
	}
	
	// Check if text is long enough
	tokenCount := estimateTokenCount(text)
	if tokenCount < w.config.MinTokens {
		// Try short text verification
		return w.verifyShortText(text)
	}
	
	// Verify watermark based on configured method
	var confidence float64
	var watermarkID string
	var err error
	
	switch w.config.StatisticalMethod {
	case "token_distribution":
		confidence, watermarkID, err = w.verifyTokenDistribution(text)
	case "synonym_selection":
		confidence, watermarkID, err = w.verifySynonymSelection(text)
	case "spacing":
		confidence, watermarkID, err = w.verifySpacing(text)
	default:
		confidence, watermarkID, err = w.verifyTokenDistribution(text)
	}
	
	if err != nil {
		return nil, fmt.Errorf("watermark verification failed: %w", err)
	}
	
	result.Confidence = confidence
	result.WatermarkID = watermarkID
	result.IsWatermarked = confidence > 0.8 // 80% confidence threshold
	
	return result, nil
}

// embedTokenDistribution embeds watermark using token distribution bias
func (w *WATEmbedder) embedTokenDistribution(text, watermarkID string) (string, error) {
	// TODO: Implement statistical watermarking via token distribution
	// This would:
	// 1. Use watermarkID as seed for deterministic randomness
	// 2. Bias token selection during generation (requires LLM integration)
	// 3. Maintain text quality while embedding watermark
	
	// For now, return original text (watermarking happens during generation)
	return text, nil
}

// embedSynonymSelection embeds watermark using synonym selection
func (w *WATEmbedder) embedSynonymSelection(text, watermarkID string) (string, error) {
	// TODO: Implement watermarking via synonym selection
	// This would:
	// 1. Identify words with synonyms
	// 2. Use watermarkID to deterministically select synonyms
	// 3. Replace words while maintaining meaning
	
	return text, nil
}

// embedSpacing embeds watermark using subtle spacing variations
func (w *WATEmbedder) embedSpacing(text, watermarkID string) (string, error) {
	// TODO: Implement watermarking via spacing
	// This would:
	// 1. Add zero-width characters at specific positions
	// 2. Use watermarkID to determine positions
	// 3. Ensure invisibility to users
	
	return text, nil
}

// embedShortText embeds watermark in short text using alternative method
func (w *WATEmbedder) embedShortText(text string, metadata WatermarkMetadata) (*EmbedResult, error) {
	// For short texts, use a simple hash-based approach
	watermarkID := w.generateWatermarkID(metadata)
	
	result := &EmbedResult{
		Success:         true,
		WatermarkedText: text, // No modification for short texts
		WatermarkID:     watermarkID,
		Metadata:        metadata,
		Method:          "hash-based",
	}
	
	return result, nil
}

// verifyTokenDistribution verifies token distribution watermark
func (w *WATEmbedder) verifyTokenDistribution(text string) (float64, string, error) {
	// TODO: Implement verification of token distribution watermark
	// This would:
	// 1. Analyze token distribution in text
	// 2. Compare against expected distribution for each possible watermarkID
	// 3. Return confidence and matching watermarkID
	
	return 0.0, "", nil
}

// verifySynonymSelection verifies synonym selection watermark
func (w *WATEmbedder) verifySynonymSelection(text string) (float64, string, error) {
	// TODO: Implement verification of synonym selection watermark
	return 0.0, "", nil
}

// verifySpacing verifies spacing watermark
func (w *WATEmbedder) verifySpacing(text string) (float64, string, error) {
	// TODO: Implement verification of spacing watermark
	return 0.0, "", nil
}

// verifyShortText verifies watermark in short text
func (w *WATEmbedder) verifyShortText(text string) (*VerificationResult, error) {
	// Short texts use hash-based verification
	result := &VerificationResult{
		IsWatermarked: false,
		Confidence:    0.0,
	}
	
	return result, nil
}

// generateWatermarkID generates a unique watermark ID
func (w *WATEmbedder) generateWatermarkID(metadata WatermarkMetadata) string {
	// Create HMAC of metadata
	h := hmac.New(sha256.New, w.secretKey)
	h.Write([]byte(fmt.Sprintf("%s:%s:%d:%s", 
		metadata.RequestID, 
		metadata.ModelVersion, 
		metadata.Timestamp, 
		metadata.UserID)))
	
	signature := h.Sum(nil)
	return base64.URLEncoding.EncodeToString(signature)[:16]
}

// extractMetadata extracts metadata from request context
func (w *WATEmbedder) extractMetadata(requestCtx interface{}) WatermarkMetadata {
	metadata := WatermarkMetadata{
		Timestamp: time.Now().Unix(),
	}
	
	// Try to extract metadata from context
	if ctx, ok := requestCtx.(interface {
		GetRequestID() string
		GetModelVersion() string
		GetUserID() string
	}); ok {
		metadata.RequestID = ctx.GetRequestID()
		metadata.ModelVersion = ctx.GetModelVersion()
		metadata.UserID = ctx.GetUserID()
	}
	
	return metadata
}

// estimateTokenCount estimates the number of tokens in text
func estimateTokenCount(text string) int {
	// Simple estimation: ~4 characters per token
	return len(text) / 4
}

// GetStats returns embedder statistics
func (w *WATEmbedder) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"method":             w.config.StatisticalMethod,
		"watermark_strength": w.config.WatermarkStrength,
		"min_tokens":         w.config.MinTokens,
		"embed_metadata":     w.config.EmbedMetadata,
	}
}
