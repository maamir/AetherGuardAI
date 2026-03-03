package output_engine

import (
	"context"
	"fmt"
	
	tox "github.com/aetherguard/aetherguard-ai/src/output-engine/tox-detector"
	hal "github.com/aetherguard/aetherguard-ai/src/output-engine/hal-detector"
	wat "github.com/aetherguard/aetherguard-ai/src/output-engine/wat-embedder"
)

// OutputEngine coordinates all output detection and processing components
type OutputEngine struct {
	toxDetector *tox.TOXDetector
	halDetector *hal.HALDetector
	watEmbedder *wat.WATEmbedder
	config      Config
}

// Config holds output engine configuration
type Config struct {
	EnableTOX        bool
	EnableHAL        bool
	EnableWAT        bool
	TOXModelPath     string
	HALModelPath     string
	BlockOnToxicity  bool
	ToxicityLevel    string // "strict", "moderate", "permissive"
	WatermarkKey     string
	HALConfig        hal.Config
	TOXConfig        tox.Config
	WATConfig        wat.Config
}

// ProcessingResult represents the combined output processing result
type ProcessingResult struct {
	Blocked          bool
	ToxicityDetected bool
	HallucinationDetected bool
	Watermarked      bool
	TOXResult        *tox.DetectionResult
	HALResult        *hal.DetectionResult
	WATResult        *wat.EmbedResult
	ProcessedOutput  string
	BlockReason      string
	Warnings         []string
}

// NewOutputEngine creates a new output engine
func NewOutputEngine(cfg Config) (*OutputEngine, error) {
	engine := &OutputEngine{
		config: cfg,
	}
	
	// Initialize TOX detector
	if cfg.EnableTOX {
		toxDetector, err := tox.NewTOXDetector(cfg.TOXModelPath, cfg.TOXConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize TOX detector: %w", err)
		}
		engine.toxDetector = toxDetector
	}
	
	// Initialize HAL detector
	if cfg.EnableHAL {
		halDetector, err := hal.NewHALDetector(cfg.HALModelPath, cfg.HALConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize HAL detector: %w", err)
		}
		engine.halDetector = halDetector
	}
	
	// Initialize WAT embedder
	if cfg.EnableWAT {
		watEmbedder, err := wat.NewWATEmbedder(cfg.WatermarkKey, cfg.WATConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize WAT embedder: %w", err)
		}
		engine.watEmbedder = watEmbedder
	}
	
	return engine, nil
}

// ProcessOutput analyzes and processes LLM output through all detection layers
func (e *OutputEngine) ProcessOutput(ctx context.Context, output string, requestContext *RequestContext) (*ProcessingResult, error) {
	result := &ProcessingResult{
		Blocked:         false,
		ProcessedOutput: output,
		Warnings:        []string{},
	}
	
	processedOutput := output
	
	// Step 1: Run TOX detection (toxicity filtering)
	if e.config.EnableTOX && e.toxDetector != nil {
		toxResult, err := e.toxDetector.Detect(ctx, processedOutput)
		if err != nil {
			return nil, fmt.Errorf("TOX detection failed: %w", err)
		}
		
		result.TOXResult = toxResult
		result.ToxicityDetected = toxResult.IsToxic
		
		// Check if we should block based on toxicity level
		if toxResult.IsToxic && e.shouldBlockToxicity(toxResult) {
			result.Blocked = true
			result.BlockReason = fmt.Sprintf("Toxic content detected: %s (score: %.2f)", 
				toxResult.ToxicityType, toxResult.Score)
			return result, nil
		}
		
		// Add warning if toxic but not blocking
		if toxResult.IsToxic {
			result.Warnings = append(result.Warnings, 
				fmt.Sprintf("Warning: Potentially toxic content detected (%s)", toxResult.ToxicityType))
		}
	}
	
	// Step 2: Run HAL detection (hallucination detection)
	if e.config.EnableHAL && e.halDetector != nil {
		halResult, err := e.halDetector.Detect(ctx, processedOutput, requestContext)
		if err != nil {
			return nil, fmt.Errorf("HAL detection failed: %w", err)
		}
		
		result.HALResult = halResult
		result.HallucinationDetected = halResult.HasHallucination
		
		// Add warnings for hallucinations (typically don't block, just warn)
		if halResult.HasHallucination {
			for _, claim := range halResult.UnverifiedClaims {
				result.Warnings = append(result.Warnings, 
					fmt.Sprintf("Unverified claim: %s (confidence: %.2f)", 
						claim.Text, claim.Confidence))
			}
		}
	}
	
	// Step 3: Embed watermark (WAT)
	if e.config.EnableWAT && e.watEmbedder != nil {
		watResult, err := e.watEmbedder.Embed(ctx, processedOutput, requestContext)
		if err != nil {
			return nil, fmt.Errorf("WAT embedding failed: %w", err)
		}
		
		result.WATResult = watResult
		result.Watermarked = watResult.Success
		processedOutput = watResult.WatermarkedText
		result.ProcessedOutput = processedOutput
	}
	
	return result, nil
}

// shouldBlockToxicity determines if toxicity should block the response
func (e *OutputEngine) shouldBlockToxicity(toxResult *tox.DetectionResult) bool {
	if !e.config.BlockOnToxicity {
		return false
	}
	
	// Determine threshold based on configured toxicity level
	var threshold float64
	switch e.config.ToxicityLevel {
	case "strict":
		threshold = 0.3 // Block anything above 30%
	case "moderate":
		threshold = 0.6 // Block anything above 60%
	case "permissive":
		threshold = 0.8 // Block only severe toxicity above 80%
	default:
		threshold = 0.6 // Default to moderate
	}
	
	return toxResult.Score >= threshold
}

// GetStats returns engine statistics
func (e *OutputEngine) GetStats() map[string]interface{} {
	stats := map[string]interface{}{
		"tox_enabled": e.config.EnableTOX,
		"hal_enabled": e.config.EnableHAL,
		"wat_enabled": e.config.EnableWAT,
		"toxicity_level": e.config.ToxicityLevel,
	}
	
	if e.toxDetector != nil {
		stats["tox_stats"] = e.toxDetector.GetStats()
	}
	
	if e.halDetector != nil {
		stats["hal_stats"] = e.halDetector.GetStats()
	}
	
	if e.watEmbedder != nil {
		stats["wat_stats"] = e.watEmbedder.GetStats()
	}
	
	return stats
}

// RequestContext provides context for output processing
type RequestContext struct {
	RequestID     string
	UserID        string
	ModelVersion  string
	Timestamp     int64
	InputPrompt   string
	SourceContext string // Original context provided with the prompt
}
