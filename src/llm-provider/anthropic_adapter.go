package llm_provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// AnthropicAdapter implements the Provider interface for Anthropic
type AnthropicAdapter struct {
	config     ProviderConfig
	httpClient *http.Client
	status     ProviderStatus
	baseURL    string
}

// NewAnthropicAdapter creates a new Anthropic adapter
func NewAnthropicAdapter(config ProviderConfig) (*AnthropicAdapter, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("API key is required")
	}
	
	if config.Endpoint == "" {
		config.Endpoint = "https://api.anthropic.com/v1"
	}
	
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}
	
	adapter := &AnthropicAdapter{
		config:  config,
		baseURL: config.Endpoint,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		status: ProviderStatus{
			Available: true,
			Healthy:   true,
			LastCheck: time.Now(),
		},
	}
	
	return adapter, nil
}

// Generate generates text using Anthropic API
func (a *AnthropicAdapter) Generate(ctx context.Context, request *GenerateRequest) (*GenerateResponse, error) {
	startTime := time.Now()
	
	// Build Anthropic request
	reqBody := map[string]interface{}{
		"model":      request.ModelID,
		"max_tokens": request.MaxTokens,
		"messages": []map[string]string{
			{"role": "user", "content": request.Prompt},
		},
	}
	
	if request.SystemPrompt != "" {
		reqBody["system"] = request.SystemPrompt
	}
	
	if request.Temperature > 0 {
		reqBody["temperature"] = request.Temperature
	}
	
	if request.TopP > 0 {
		reqBody["top_p"] = request.TopP
	}
	
	if request.TopK > 0 {
		reqBody["top_k"] = request.TopK
	}
	
	if len(request.StopSequences) > 0 {
		reqBody["stop_sequences"] = request.StopSequences
	}
	
	// Make HTTP request
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/messages", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", a.config.APIKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	
	resp, err := a.httpClient.Do(httpReq)
	if err != nil {
		a.updateStatus(false)
		return nil, &ProviderError{
			Provider:    "anthropic",
			Message:     fmt.Sprintf("HTTP request failed: %v", err),
			Retryable:   true,
			OriginalErr: err,
		}
	}
	defer resp.Body.Close()
	
	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	if resp.StatusCode != http.StatusOK {
		a.updateStatus(false)
		return nil, &ProviderError{
			Provider:   "anthropic",
			Message:    fmt.Sprintf("API error: %s", string(body)),
			Retryable:  resp.StatusCode >= 500,
			StatusCode: resp.StatusCode,
		}
	}
	
	// Parse response
	var anthropicResp struct {
		Content []struct {
			Text string `json:"text"`
			Type string `json:"type"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
		Usage      struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	
	err = json.Unmarshal(body, &anthropicResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(anthropicResp.Content) == 0 {
		return nil, fmt.Errorf("no content in response")
	}
	
	a.updateStatus(true)
	
	response := &GenerateResponse{
		Text:         anthropicResp.Content[0].Text,
		ModelID:      request.ModelID,
		ProviderName: "anthropic",
		TokensUsed: TokenUsage{
			PromptTokens:     anthropicResp.Usage.InputTokens,
			CompletionTokens: anthropicResp.Usage.OutputTokens,
			TotalTokens:      anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		},
		FinishReason: anthropicResp.StopReason,
		Latency:      time.Since(startTime),
	}
	
	return response, nil
}

// Stream streams text generation (placeholder)
func (a *AnthropicAdapter) Stream(ctx context.Context, request *GenerateRequest) (<-chan *StreamChunk, <-chan error) {
	chunkChan := make(chan *StreamChunk)
	errChan := make(chan error, 1)
	
	go func() {
		defer close(chunkChan)
		defer close(errChan)
		
		// TODO: Implement streaming
		errChan <- fmt.Errorf("streaming not yet implemented")
	}()
	
	return chunkChan, errChan
}

// GetProviderName returns the provider name
func (a *AnthropicAdapter) GetProviderName() string {
	return "anthropic"
}

// GetModelInfo returns information about a model
func (a *AnthropicAdapter) GetModelInfo(modelID string) (*ModelInfo, error) {
	models := map[string]*ModelInfo{
		"claude-3-opus-20240229": {
			ModelID:      "claude-3-opus-20240229",
			DisplayName:  "Claude 3 Opus",
			Provider:     "anthropic",
			MaxTokens:    200000,
			InputCost:    0.015,
			OutputCost:   0.075,
			Capabilities: []string{"chat", "completion", "vision"},
			Version:      "20240229",
		},
		"claude-3-sonnet-20240229": {
			ModelID:      "claude-3-sonnet-20240229",
			DisplayName:  "Claude 3 Sonnet",
			Provider:     "anthropic",
			MaxTokens:    200000,
			InputCost:    0.003,
			OutputCost:   0.015,
			Capabilities: []string{"chat", "completion", "vision"},
			Version:      "20240229",
		},
	}
	
	info, exists := models[modelID]
	if !exists {
		return nil, fmt.Errorf("model not found: %s", modelID)
	}
	
	return info, nil
}

// ListModels lists available models
func (a *AnthropicAdapter) ListModels() ([]*ModelInfo, error) {
	return []*ModelInfo{
		{
			ModelID:      "claude-3-opus-20240229",
			DisplayName:  "Claude 3 Opus",
			Provider:     "anthropic",
			MaxTokens:    200000,
			Capabilities: []string{"chat", "completion", "vision"},
		},
		{
			ModelID:      "claude-3-sonnet-20240229",
			DisplayName:  "Claude 3 Sonnet",
			Provider:     "anthropic",
			MaxTokens:    200000,
			Capabilities: []string{"chat", "completion", "vision"},
		},
	}, nil
}

// HealthCheck checks provider health
func (a *AnthropicAdapter) HealthCheck(ctx context.Context) error {
	// Simple health check - make a minimal request
	req := &GenerateRequest{
		ModelID:   "claude-3-sonnet-20240229",
		Prompt:    "Hello",
		MaxTokens: 10,
	}
	
	_, err := a.Generate(ctx, req)
	if err != nil {
		a.updateStatus(false)
		return err
	}
	
	a.updateStatus(true)
	return nil
}

// GetStatus returns provider status
func (a *AnthropicAdapter) GetStatus() ProviderStatus {
	return a.status
}

// Configure updates provider configuration
func (a *AnthropicAdapter) Configure(config ProviderConfig) error {
	a.config = config
	a.httpClient.Timeout = config.Timeout
	return nil
}

// GetConfig returns provider configuration
func (a *AnthropicAdapter) GetConfig() ProviderConfig {
	return a.config
}

// updateStatus updates provider status
func (a *AnthropicAdapter) updateStatus(success bool) {
	a.status.LastCheck = time.Now()
	a.status.RequestCount++
	
	if success {
		a.status.Healthy = true
		a.status.Available = true
		a.status.ErrorCount = 0
	} else {
		a.status.ErrorCount++
		if a.status.ErrorCount > 5 {
			a.status.Healthy = false
		}
	}
	
	if a.status.RequestCount > 0 {
		a.status.FailureRate = float64(a.status.ErrorCount) / float64(a.status.RequestCount)
	}
}
