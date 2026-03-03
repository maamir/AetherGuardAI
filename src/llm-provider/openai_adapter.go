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

// OpenAIAdapter implements the Provider interface for OpenAI
type OpenAIAdapter struct {
	config     ProviderConfig
	httpClient *http.Client
	status     ProviderStatus
	baseURL    string
}

// NewOpenAIAdapter creates a new OpenAI adapter
func NewOpenAIAdapter(config ProviderConfig) (*OpenAIAdapter, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("API key is required")
	}
	
	if config.Endpoint == "" {
		config.Endpoint = "https://api.openai.com/v1"
	}
	
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}
	
	adapter := &OpenAIAdapter{
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

// Generate generates text using OpenAI API
func (a *OpenAIAdapter) Generate(ctx context.Context, request *GenerateRequest) (*GenerateResponse, error) {
	startTime := time.Now()
	
	// Build OpenAI request
	reqBody := map[string]interface{}{
		"model":       request.ModelID,
		"messages": []map[string]string{
			{"role": "system", "content": request.SystemPrompt},
			{"role": "user", "content": request.Prompt},
		},
		"max_tokens":  request.MaxTokens,
		"temperature": request.Temperature,
	}
	
	if request.TopP > 0 {
		reqBody["top_p"] = request.TopP
	}
	
	if len(request.StopSequences) > 0 {
		reqBody["stop"] = request.StopSequences
	}
	
	// Make HTTP request
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+a.config.APIKey)
	
	resp, err := a.httpClient.Do(httpReq)
	if err != nil {
		a.updateStatus(false)
		return nil, &ProviderError{
			Provider:    "openai",
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
			Provider:   "openai",
			Message:    fmt.Sprintf("API error: %s", string(body)),
			Retryable:  resp.StatusCode >= 500,
			StatusCode: resp.StatusCode,
		}
	}
	
	// Parse response
	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	
	err = json.Unmarshal(body, &openAIResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(openAIResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}
	
	a.updateStatus(true)
	
	response := &GenerateResponse{
		Text:         openAIResp.Choices[0].Message.Content,
		ModelID:      request.ModelID,
		ProviderName: "openai",
		TokensUsed: TokenUsage{
			PromptTokens:     openAIResp.Usage.PromptTokens,
			CompletionTokens: openAIResp.Usage.CompletionTokens,
			TotalTokens:      openAIResp.Usage.TotalTokens,
		},
		FinishReason: openAIResp.Choices[0].FinishReason,
		Latency:      time.Since(startTime),
	}
	
	return response, nil
}

// Stream streams text generation (placeholder)
func (a *OpenAIAdapter) Stream(ctx context.Context, request *GenerateRequest) (<-chan *StreamChunk, <-chan error) {
	chunkChan := make(chan *StreamChunk)
	errChan := make(chan error, 1)
	
	go func() {
		defer close(chunkChan)
		defer close(errChan)
		
		// TODO: Implement streaming using SSE
		errChan <- fmt.Errorf("streaming not yet implemented")
	}()
	
	return chunkChan, errChan
}

// GetProviderName returns the provider name
func (a *OpenAIAdapter) GetProviderName() string {
	return "openai"
}

// GetModelInfo returns information about a model
func (a *OpenAIAdapter) GetModelInfo(modelID string) (*ModelInfo, error) {
	// Static model info (in production, fetch from API)
	models := map[string]*ModelInfo{
		"gpt-4": {
			ModelID:      "gpt-4",
			DisplayName:  "GPT-4",
			Provider:     "openai",
			MaxTokens:    8192,
			InputCost:    0.03,
			OutputCost:   0.06,
			Capabilities: []string{"chat", "completion"},
			Version:      "gpt-4-0613",
		},
		"gpt-3.5-turbo": {
			ModelID:      "gpt-3.5-turbo",
			DisplayName:  "GPT-3.5 Turbo",
			Provider:     "openai",
			MaxTokens:    4096,
			InputCost:    0.0015,
			OutputCost:   0.002,
			Capabilities: []string{"chat", "completion"},
			Version:      "gpt-3.5-turbo-0613",
		},
	}
	
	info, exists := models[modelID]
	if !exists {
		return nil, fmt.Errorf("model not found: %s", modelID)
	}
	
	return info, nil
}

// ListModels lists available models
func (a *OpenAIAdapter) ListModels() ([]*ModelInfo, error) {
	return []*ModelInfo{
		{
			ModelID:      "gpt-4",
			DisplayName:  "GPT-4",
			Provider:     "openai",
			MaxTokens:    8192,
			Capabilities: []string{"chat", "completion"},
		},
		{
			ModelID:      "gpt-3.5-turbo",
			DisplayName:  "GPT-3.5 Turbo",
			Provider:     "openai",
			MaxTokens:    4096,
			Capabilities: []string{"chat", "completion"},
		},
	}, nil
}

// HealthCheck checks provider health
func (a *OpenAIAdapter) HealthCheck(ctx context.Context) error {
	// Simple health check - try to list models
	req, err := http.NewRequestWithContext(ctx, "GET", a.baseURL+"/models", nil)
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Bearer "+a.config.APIKey)
	
	resp, err := a.httpClient.Do(req)
	if err != nil {
		a.updateStatus(false)
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		a.updateStatus(false)
		return fmt.Errorf("health check failed with status: %d", resp.StatusCode)
	}
	
	a.updateStatus(true)
	return nil
}

// GetStatus returns provider status
func (a *OpenAIAdapter) GetStatus() ProviderStatus {
	return a.status
}

// Configure updates provider configuration
func (a *OpenAIAdapter) Configure(config ProviderConfig) error {
	a.config = config
	a.httpClient.Timeout = config.Timeout
	return nil
}

// GetConfig returns provider configuration
func (a *OpenAIAdapter) GetConfig() ProviderConfig {
	return a.config
}

// updateStatus updates provider status
func (a *OpenAIAdapter) updateStatus(success bool) {
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
