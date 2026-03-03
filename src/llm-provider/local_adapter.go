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

// LocalAdapter implements the Provider interface for local models (Ollama, vLLM, etc.)
type LocalAdapter struct {
	config     ProviderConfig
	httpClient *http.Client
	status     ProviderStatus
	baseURL    string
	serverType string // "ollama", "vllm", "tgi"
}

// NewLocalAdapter creates a new local model adapter
func NewLocalAdapter(config ProviderConfig, serverType string) (*LocalAdapter, error) {
	if config.Endpoint == "" {
		return nil, fmt.Errorf("endpoint is required for local models")
	}
	
	if config.Timeout == 0 {
		config.Timeout = 120 * time.Second // Longer timeout for local models
	}
	
	if serverType == "" {
		serverType = "ollama" // Default to Ollama
	}
	
	adapter := &LocalAdapter{
		config:     config,
		baseURL:    config.Endpoint,
		serverType: serverType,
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

// Generate generates text using local model
func (l *LocalAdapter) Generate(ctx context.Context, request *GenerateRequest) (*GenerateResponse, error) {
	startTime := time.Now()
	
	var reqBody map[string]interface{}
	var endpoint string
	
	switch l.serverType {
	case "ollama":
		reqBody, endpoint = l.buildOllamaRequest(request)
	case "vllm":
		reqBody, endpoint = l.buildVLLMRequest(request)
	default:
		return nil, fmt.Errorf("unsupported server type: %s", l.serverType)
	}
	
	// Make HTTP request
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", l.baseURL+endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	httpReq.Header.Set("Content-Type", "application/json")
	
	resp, err := l.httpClient.Do(httpReq)
	if err != nil {
		l.updateStatus(false)
		return nil, &ProviderError{
			Provider:    "local",
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
		l.updateStatus(false)
		return nil, &ProviderError{
			Provider:   "local",
			Message:    fmt.Sprintf("API error: %s", string(body)),
			Retryable:  resp.StatusCode >= 500,
			StatusCode: resp.StatusCode,
		}
	}
	
	// Parse response based on server type
	var response *GenerateResponse
	switch l.serverType {
	case "ollama":
		response, err = l.parseOllamaResponse(body, request.ModelID, time.Since(startTime))
	case "vllm":
		response, err = l.parseVLLMResponse(body, request.ModelID, time.Since(startTime))
	default:
		return nil, fmt.Errorf("unsupported server type: %s", l.serverType)
	}
	
	if err != nil {
		return nil, err
	}
	
	l.updateStatus(true)
	return response, nil
}

// buildOllamaRequest builds request for Ollama
func (l *LocalAdapter) buildOllamaRequest(request *GenerateRequest) (map[string]interface{}, string) {
	reqBody := map[string]interface{}{
		"model":  request.ModelID,
		"prompt": request.Prompt,
		"stream": false,
		"options": map[string]interface{}{
			"temperature": request.Temperature,
			"num_predict": request.MaxTokens,
		},
	}
	
	if request.SystemPrompt != "" {
		reqBody["system"] = request.SystemPrompt
	}
	
	if request.TopP > 0 {
		reqBody["options"].(map[string]interface{})["top_p"] = request.TopP
	}
	
	if request.TopK > 0 {
		reqBody["options"].(map[string]interface{})["top_k"] = request.TopK
	}
	
	if len(request.StopSequences) > 0 {
		reqBody["options"].(map[string]interface{})["stop"] = request.StopSequences
	}
	
	return reqBody, "/api/generate"
}

// buildVLLMRequest builds request for vLLM
func (l *LocalAdapter) buildVLLMRequest(request *GenerateRequest) (map[string]interface{}, string) {
	reqBody := map[string]interface{}{
		"model":       request.ModelID,
		"prompt":      request.Prompt,
		"max_tokens":  request.MaxTokens,
		"temperature": request.Temperature,
	}
	
	if request.TopP > 0 {
		reqBody["top_p"] = request.TopP
	}
	
	if len(request.StopSequences) > 0 {
		reqBody["stop"] = request.StopSequences
	}
	
	return reqBody, "/v1/completions"
}

// parseOllamaResponse parses Ollama response
func (l *LocalAdapter) parseOllamaResponse(body []byte, modelID string, latency time.Duration) (*GenerateResponse, error) {
	var ollamaResp struct {
		Response string `json:"response"`
		Done     bool   `json:"done"`
		Context  []int  `json:"context"`
	}
	
	err := json.Unmarshal(body, &ollamaResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	return &GenerateResponse{
		Text:         ollamaResp.Response,
		ModelID:      modelID,
		ProviderName: "local",
		TokensUsed: TokenUsage{
			TotalTokens: len(ollamaResp.Context),
		},
		FinishReason: "stop",
		Latency:      latency,
	}, nil
}

// parseVLLMResponse parses vLLM response
func (l *LocalAdapter) parseVLLMResponse(body []byte, modelID string, latency time.Duration) (*GenerateResponse, error) {
	var vllmResp struct {
		Choices []struct {
			Text         string `json:"text"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	
	err := json.Unmarshal(body, &vllmResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(vllmResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}
	
	return &GenerateResponse{
		Text:         vllmResp.Choices[0].Text,
		ModelID:      modelID,
		ProviderName: "local",
		TokensUsed: TokenUsage{
			PromptTokens:     vllmResp.Usage.PromptTokens,
			CompletionTokens: vllmResp.Usage.CompletionTokens,
			TotalTokens:      vllmResp.Usage.TotalTokens,
		},
		FinishReason: vllmResp.Choices[0].FinishReason,
		Latency:      latency,
	}, nil
}

// Stream streams text generation (placeholder)
func (l *LocalAdapter) Stream(ctx context.Context, request *GenerateRequest) (<-chan *StreamChunk, <-chan error) {
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
func (l *LocalAdapter) GetProviderName() string {
	return "local"
}

// GetModelInfo returns information about a model
func (l *LocalAdapter) GetModelInfo(modelID string) (*ModelInfo, error) {
	return &ModelInfo{
		ModelID:      modelID,
		DisplayName:  modelID,
		Provider:     "local",
		MaxTokens:    4096,
		InputCost:    0.0,
		OutputCost:   0.0,
		Capabilities: []string{"chat", "completion"},
		Version:      "local",
	}, nil
}

// ListModels lists available models
func (l *LocalAdapter) ListModels() ([]*ModelInfo, error) {
	// For Ollama, we can query the /api/tags endpoint
	if l.serverType == "ollama" {
		return l.listOllamaModels()
	}
	
	// For other local servers, return empty list
	return []*ModelInfo{}, nil
}

// listOllamaModels lists models from Ollama
func (l *LocalAdapter) listOllamaModels() ([]*ModelInfo, error) {
	req, err := http.NewRequest("GET", l.baseURL+"/api/tags", nil)
	if err != nil {
		return nil, err
	}
	
	resp, err := l.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to list models: status %d", resp.StatusCode)
	}
	
	var ollamaResp struct {
		Models []struct {
			Name string `json:"name"`
			Size int64  `json:"size"`
		} `json:"models"`
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	err = json.Unmarshal(body, &ollamaResp)
	if err != nil {
		return nil, err
	}
	
	models := make([]*ModelInfo, len(ollamaResp.Models))
	for i, m := range ollamaResp.Models {
		models[i] = &ModelInfo{
			ModelID:      m.Name,
			DisplayName:  m.Name,
			Provider:     "local",
			MaxTokens:    4096,
			InputCost:    0.0,
			OutputCost:   0.0,
			Capabilities: []string{"chat", "completion"},
		}
	}
	
	return models, nil
}

// HealthCheck checks provider health
func (l *LocalAdapter) HealthCheck(ctx context.Context) error {
	var endpoint string
	switch l.serverType {
	case "ollama":
		endpoint = "/api/tags"
	case "vllm":
		endpoint = "/health"
	default:
		endpoint = "/health"
	}
	
	req, err := http.NewRequestWithContext(ctx, "GET", l.baseURL+endpoint, nil)
	if err != nil {
		return err
	}
	
	resp, err := l.httpClient.Do(req)
	if err != nil {
		l.updateStatus(false)
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		l.updateStatus(false)
		return fmt.Errorf("health check failed with status: %d", resp.StatusCode)
	}
	
	l.updateStatus(true)
	return nil
}

// GetStatus returns provider status
func (l *LocalAdapter) GetStatus() ProviderStatus {
	return l.status
}

// Configure updates provider configuration
func (l *LocalAdapter) Configure(config ProviderConfig) error {
	l.config = config
	l.httpClient.Timeout = config.Timeout
	return nil
}

// GetConfig returns provider configuration
func (l *LocalAdapter) GetConfig() ProviderConfig {
	return l.config
}

// updateStatus updates provider status
func (l *LocalAdapter) updateStatus(success bool) {
	l.status.LastCheck = time.Now()
	l.status.RequestCount++
	
	if success {
		l.status.Healthy = true
		l.status.Available = true
		l.status.ErrorCount = 0
	} else {
		l.status.ErrorCount++
		if l.status.ErrorCount > 5 {
			l.status.Healthy = false
		}
	}
	
	if l.status.RequestCount > 0 {
		l.status.FailureRate = float64(l.status.ErrorCount) / float64(l.status.RequestCount)
	}
}
