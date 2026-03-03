package request_processor

import (
	"context"
	"fmt"
	"time"
	
	input_engine "github.com/aetherguard/aetherguard-ai/src/input-engine"
	output_engine "github.com/aetherguard/aetherguard-ai/src/output-engine"
	llm_provider "github.com/aetherguard/aetherguard-ai/src/llm-provider"
	"github.com/aetherguard/aetherguard-ai/src/aethersign"
)

// RequestProcessor orchestrates the complete request processing pipeline
type RequestProcessor struct {
	inputEngine   *input_engine.InputEngine
	outputEngine  *output_engine.OutputEngine
	providerMgr   *llm_provider.Manager
	aethersign    *aethersign.AetherSign
	config        Config
}

// Config holds request processor configuration
type Config struct {
	EnableInputProcessing  bool
	EnableOutputProcessing bool
	EnableAttribution      bool
	EnableModelVerification bool
	DefaultProvider        string
	Timeout                time.Duration
	MaxRetries             int
}

// ProcessRequest represents a request to process
type ProcessRequest struct {
	RequestID     string
	UserID        string
	TenantID      string
	Prompt        string
	SystemPrompt  string
	ModelID       string
	Provider      string
	MaxTokens     int
	Temperature   float64
	TopP          float64
	TopK          int
	StopSequences []string
	Metadata      map[string]string
}

// ProcessResponse represents the complete processing result
type ProcessResponse struct {
	RequestID         string
	ResponseText      string
	ProcessedText     string
	InputBlocked      bool
	OutputBlocked     bool
	BlockReason       string
	Warnings          []string
	InputResult       *input_engine.DetectionResult
	OutputResult      *output_engine.ProcessingResult
	LLMResponse       *llm_provider.GenerateResponse
	Attribution       *aethersign.Attribution
	TotalLatency      time.Duration
	ProcessingStages  []ProcessingStage
}

// ProcessingStage represents a stage in the processing pipeline
type ProcessingStage struct {
	Name      string
	StartTime time.Time
	EndTime   time.Time
	Duration  time.Duration
	Success   bool
	Error     error
}

// NewRequestProcessor creates a new request processor
func NewRequestProcessor(
	inputEngine *input_engine.InputEngine,
	outputEngine *output_engine.OutputEngine,
	providerMgr *llm_provider.Manager,
	aethersign *aethersign.AetherSign,
	config Config,
) (*RequestProcessor, error) {
	
	// Set defaults
	if config.Timeout == 0 {
		config.Timeout = 120 * time.Second
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	
	return &RequestProcessor{
		inputEngine:  inputEngine,
		outputEngine: outputEngine,
		providerMgr:  providerMgr,
		aethersign:   aethersign,
		config:       config,
	}, nil
}

// Process processes a complete request through the pipeline
func (rp *RequestProcessor) Process(ctx context.Context, request *ProcessRequest) (*ProcessResponse, error) {
	startTime := time.Now()
	
	response := &ProcessResponse{
		RequestID:        request.RequestID,
		Warnings:         []string{},
		ProcessingStages: []ProcessingStage{},
	}
	
	// Stage 1: Input Processing
	if rp.config.EnableInputProcessing && rp.inputEngine != nil {
		stage := rp.startStage("input_processing")
		
		inputResult, err := rp.inputEngine.ProcessInput(ctx, request.Prompt)
		if err != nil {
			stage.Error = err
			rp.endStage(&stage, false)
			response.ProcessingStages = append(response.ProcessingStages, stage)
			return nil, fmt.Errorf("input processing failed: %w", err)
		}
		
		response.InputResult = inputResult
		
		// Check if input is blocked
		if inputResult.Blocked {
			response.InputBlocked = true
			response.BlockReason = inputResult.BlockReason
			rp.endStage(&stage, true)
			response.ProcessingStages = append(response.ProcessingStages, stage)
			response.TotalLatency = time.Since(startTime)
			return response, nil
		}
		
		// Use processed input (sanitized + redacted)
		request.Prompt = inputResult.ProcessedInput
		
		rp.endStage(&stage, true)
		response.ProcessingStages = append(response.ProcessingStages, stage)
	}
	
	// Stage 2: Model Verification (if enabled)
	if rp.config.EnableModelVerification && rp.aethersign != nil {
		stage := rp.startStage("model_verification")
		
		// TODO: Verify model signature before inference
		// This would require model data access
		
		rp.endStage(&stage, true)
		response.ProcessingStages = append(response.ProcessingStages, stage)
	}
	
	// Stage 3: LLM Inference
	stage := rp.startStage("llm_inference")
	
	provider := request.Provider
	if provider == "" {
		provider = rp.config.DefaultProvider
	}
	
	llmRequest := &llm_provider.GenerateRequest{
		ModelID:       request.ModelID,
		Prompt:        request.Prompt,
		SystemPrompt:  request.SystemPrompt,
		MaxTokens:     request.MaxTokens,
		Temperature:   request.Temperature,
		TopP:          request.TopP,
		TopK:          request.TopK,
		StopSequences: request.StopSequences,
		Metadata:      request.Metadata,
	}
	
	llmResponse, err := rp.providerMgr.Generate(ctx, provider, llmRequest)
	if err != nil {
		stage.Error = err
		rp.endStage(&stage, false)
		response.ProcessingStages = append(response.ProcessingStages, stage)
		return nil, fmt.Errorf("LLM inference failed: %w", err)
	}
	
	response.LLMResponse = llmResponse
	response.ResponseText = llmResponse.Text
	response.ProcessedText = llmResponse.Text
	
	rp.endStage(&stage, true)
	response.ProcessingStages = append(response.ProcessingStages, stage)
	
	// Stage 4: Output Processing
	if rp.config.EnableOutputProcessing && rp.outputEngine != nil {
		stage := rp.startStage("output_processing")
		
		requestContext := &output_engine.RequestContext{
			RequestID:     request.RequestID,
			UserID:        request.UserID,
			ModelVersion:  request.ModelID,
			Timestamp:     time.Now().Unix(),
			InputPrompt:   request.Prompt,
			SourceContext: request.SystemPrompt,
		}
		
		outputResult, err := rp.outputEngine.ProcessOutput(ctx, llmResponse.Text, requestContext)
		if err != nil {
			stage.Error = err
			rp.endStage(&stage, false)
			response.ProcessingStages = append(response.ProcessingStages, stage)
			return nil, fmt.Errorf("output processing failed: %w", err)
		}
		
		response.OutputResult = outputResult
		
		// Check if output is blocked
		if outputResult.Blocked {
			response.OutputBlocked = true
			response.BlockReason = outputResult.BlockReason
			rp.endStage(&stage, true)
			response.ProcessingStages = append(response.ProcessingStages, stage)
			response.TotalLatency = time.Since(startTime)
			return response, nil
		}
		
		// Add warnings
		response.Warnings = append(response.Warnings, outputResult.Warnings...)
		
		// Use processed output (watermarked)
		response.ProcessedText = outputResult.ProcessedOutput
		
		rp.endStage(&stage, true)
		response.ProcessingStages = append(response.ProcessingStages, stage)
	}
	
	// Stage 5: Response Attribution
	if rp.config.EnableAttribution && rp.aethersign != nil {
		stage := rp.startStage("response_attribution")
		
		metadata := aethersign.ResponseMetadata{
			ModelID:      request.ModelID,
			ModelVersion: request.ModelID,
			UserID:       request.UserID,
			RequestID:    request.RequestID,
		}
		
		attrResult, err := rp.aethersign.AttributeResponse(response.ProcessedText, metadata)
		if err != nil {
			stage.Error = err
			rp.endStage(&stage, false)
			response.ProcessingStages = append(response.ProcessingStages, stage)
			// Don't fail the request, just log the error
			response.Warnings = append(response.Warnings, fmt.Sprintf("Attribution failed: %v", err))
		} else {
			response.Attribution = attrResult.Attribution
			rp.endStage(&stage, true)
			response.ProcessingStages = append(response.ProcessingStages, stage)
		}
	}
	
	response.TotalLatency = time.Since(startTime)
	return response, nil
}

// startStage starts a processing stage
func (rp *RequestProcessor) startStage(name string) ProcessingStage {
	return ProcessingStage{
		Name:      name,
		StartTime: time.Now(),
	}
}

// endStage ends a processing stage
func (rp *RequestProcessor) endStage(stage *ProcessingStage, success bool) {
	stage.EndTime = time.Now()
	stage.Duration = stage.EndTime.Sub(stage.StartTime)
	stage.Success = success
}

// GetStats returns processor statistics
func (rp *RequestProcessor) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"input_processing_enabled":  rp.config.EnableInputProcessing,
		"output_processing_enabled": rp.config.EnableOutputProcessing,
		"attribution_enabled":       rp.config.EnableAttribution,
		"model_verification_enabled": rp.config.EnableModelVerification,
		"default_provider":          rp.config.DefaultProvider,
		"timeout":                   rp.config.Timeout.String(),
		"max_retries":               rp.config.MaxRetries,
	}
}

// ValidateRequest validates a process request
func (rp *RequestProcessor) ValidateRequest(request *ProcessRequest) error {
	if request.RequestID == "" {
		return fmt.Errorf("request ID is required")
	}
	
	if request.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	
	if request.ModelID == "" {
		return fmt.Errorf("model ID is required")
	}
	
	if request.MaxTokens <= 0 {
		request.MaxTokens = 1000 // Default
	}
	
	if request.Temperature < 0 || request.Temperature > 2 {
		return fmt.Errorf("temperature must be between 0 and 2")
	}
	
	return nil
}
