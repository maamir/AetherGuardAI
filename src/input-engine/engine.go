package input_engine

import (
	"context"
	"fmt"
	
	pij "github.com/aetherguard/aetherguard-ai/src/input-engine/pij-detector"
	inj "github.com/aetherguard/aetherguard-ai/src/input-engine/inj-detector"
	int_detector "github.com/aetherguard/aetherguard-ai/src/input-engine/int-detector"
	pii "github.com/aetherguard/aetherguard-ai/src/input-engine/pii-detector"
	"github.com/aetherguard/aetherguard-ai/src/input-engine/sanitizer"
)

// InputEngine coordinates all input detection components
type InputEngine struct {
	pijDetector *pij.PIJDetector
	injDetector *inj.INJDetector
	intDetector *int_detector.INTDetector
	piiDetector *pii.PIIDetector
	sanitizer   *sanitizer.Sanitizer
	config      Config
}

// Config holds input engine configuration
type Config struct {
	EnablePIJ        bool
	EnableINJ        bool
	EnableINT        bool
	EnablePII        bool
	EnableSanitizer  bool
	PIJModelPath     string
	INTModelPath     string
	BlockOnDetection bool
	RedactPII        bool
	SanitizerConfig  sanitizer.Config
	PIIConfig        pii.Config
}

// DetectionResult represents the combined detection result
type DetectionResult struct {
	Blocked          bool
	PIJDetected      bool
	INJDetected      bool
	INTDetected      bool
	PIIDetected      bool
	Sanitized        bool
	PIJResult        *pij.DetectionResult
	INJResult        *inj.DetectionResult
	INTResult        *int_detector.DetectionResult
	PIIResult        *pii.DetectionResult
	SanitizedResult  *sanitizer.SanitizationResult
	ProcessedInput   string
	BlockReason      string
}

// NewInputEngine creates a new input engine
func NewInputEngine(cfg Config) (*InputEngine, error) {
	engine := &InputEngine{
		config: cfg,
	}
	
	// Initialize PIJ detector
	if cfg.EnablePIJ {
		pijDetector, err := pij.NewPIJDetector(cfg.PIJModelPath)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize PIJ detector: %w", err)
		}
		engine.pijDetector = pijDetector
	}
	
	// Initialize INJ detector
	if cfg.EnableINJ {
		engine.injDetector = inj.NewINJDetector()
	}
	
	// Initialize INT detector
	if cfg.EnableINT {
		intDetector, err := int_detector.NewINTDetector(cfg.INTModelPath)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize INT detector: %w", err)
		}
		engine.intDetector = intDetector
	}
	
	// Initialize PII detector
	if cfg.EnablePII {
		engine.piiDetector = pii.NewPIIDetector(cfg.PIIConfig)
	}
	
	// Initialize Sanitizer
	if cfg.EnableSanitizer {
		engine.sanitizer = sanitizer.NewSanitizer(cfg.SanitizerConfig)
	}
	
	return engine, nil
}

// ProcessInput analyzes input through all detection layers
func (e *InputEngine) ProcessInput(ctx context.Context, input string) (*DetectionResult, error) {
	result := &DetectionResult{
		Blocked:        false,
		ProcessedInput: input,
	}
	
	// Step 1: Sanitize input first (if enabled)
	processedInput := input
	if e.config.EnableSanitizer && e.sanitizer != nil {
		sanitizedResult, err := e.sanitizer.Sanitize(ctx, input)
		if err != nil {
			return nil, fmt.Errorf("sanitization failed: %w", err)
		}
		
		result.SanitizedResult = sanitizedResult
		result.Sanitized = sanitizedResult.ModificationsCount > 0
		processedInput = sanitizedResult.SanitizedText
		result.ProcessedInput = processedInput
	}
	
	// Step 2: Run PIJ detection
	if e.config.EnablePIJ && e.pijDetector != nil {
		pijResult, err := e.pijDetector.Detect(ctx, processedInput)
		if err != nil {
			return nil, fmt.Errorf("PIJ detection failed: %w", err)
		}
		
		result.PIJResult = pijResult
		result.PIJDetected = pijResult.IsInjection
		
		if pijResult.IsInjection && e.config.BlockOnDetection {
			result.Blocked = true
			result.BlockReason = fmt.Sprintf("Prompt injection detected: %s", pijResult.Reason)
			return result, nil
		}
	}
	
	// Step 3: Run INJ detection
	if e.config.EnableINJ && e.injDetector != nil {
		injResult, err := e.injDetector.Detect(ctx, processedInput)
		if err != nil {
			return nil, fmt.Errorf("INJ detection failed: %w", err)
		}
		
		result.INJResult = injResult
		result.INJDetected = injResult.IsInjection
		
		if injResult.IsInjection && e.config.BlockOnDetection {
			result.Blocked = true
			result.BlockReason = fmt.Sprintf("%s injection detected: %s", 
				injResult.InjectionType, injResult.Reason)
			return result, nil
		}
	}
	
	// Step 4: Run INT detection
	if e.config.EnableINT && e.intDetector != nil {
		intResult, err := e.intDetector.Detect(ctx, processedInput)
		if err != nil {
			return nil, fmt.Errorf("INT detection failed: %w", err)
		}
		
		result.INTResult = intResult
		result.INTDetected = intResult.IsMalicious
		
		if intResult.IsMalicious && e.config.BlockOnDetection {
			result.Blocked = true
			result.BlockReason = fmt.Sprintf("Malicious intent detected: %s (confidence: %.2f)", 
				intResult.Intent, intResult.Confidence)
			return result, nil
		}
	}
	
	// Step 5: Run PII detection and redaction
	if e.config.EnablePII && e.piiDetector != nil {
		piiResult, err := e.piiDetector.Detect(ctx, processedInput)
		if err != nil {
			return nil, fmt.Errorf("PII detection failed: %w", err)
		}
		
		result.PIIResult = piiResult
		result.PIIDetected = piiResult.HasPII
		
		// Update processed input with redacted text if PII found and redaction enabled
		if piiResult.HasPII && e.config.RedactPII {
			result.ProcessedInput = piiResult.RedactedText
		}
	}
	
	return result, nil
}

// GetStats returns engine statistics
func (e *InputEngine) GetStats() map[string]interface{} {
	stats := map[string]interface{}{
		"pij_enabled":       e.config.EnablePIJ,
		"inj_enabled":       e.config.EnableINJ,
		"int_enabled":       e.config.EnableINT,
		"pii_enabled":       e.config.EnablePII,
		"sanitizer_enabled": e.config.EnableSanitizer,
	}
	
	if e.pijDetector != nil {
		stats["pij_stats"] = e.pijDetector.GetStats()
	}
	
	if e.injDetector != nil {
		stats["inj_stats"] = e.injDetector.GetStats()
	}
	
	if e.intDetector != nil {
		stats["int_stats"] = e.intDetector.GetStats()
	}
	
	if e.piiDetector != nil {
		stats["pii_stats"] = e.piiDetector.GetStats()
	}
	
	if e.sanitizer != nil {
		stats["sanitizer_stats"] = e.sanitizer.GetStats()
	}
	
	return stats
}
