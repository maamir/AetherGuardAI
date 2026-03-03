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

// GeminiAdapter implements the Provider interface for Google Gemini
type GeminiAdapter struct {
	config     ProviderConfig
	httpClient *http.Client
	status     ProviderStatus
	baseURL    string
}

// NewGeminiAdapter creates a new Gemini adapter
func NewGeminiAdapter(config ProviderConfig) (*GeminiAdapter, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("API key is required")
	}
	
	if config.Endpoint == "" {
		config.Endpoint = "https://generativelanguage.googleapis.com/v1"
	}
	
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}
	
	adapter := &GeminiAdapter{
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

// Generate generates text using Gemini API
func (g *GeminiAdapter) Generate(ctx context.Context, request *GenerateRequest) (*GenerateResponse, error) {
	startTime := time.Now()
	
	// Build Gemini request
	contents := []map[string]interface{}{
		{
			"parts": []map[string]string{
				{"text": request.Prompt},
			},
		},
	}
	
	reqBody := map[string]interface{}{
		"contents": contents,
		"generationConfig": map[string]interface{}{
			"maxOutputTokens": request.MaxTokens,
			"temperature":     request.Temperature,
		},
	}
	
	if request.TopP > 0 {
		reqBody["generationConfig"].(map[string]interface{})["topP"] = request.TopP
	}
	
	if request.TopK > 0 {
		reqBody["generationConfig"].(map[string]interface{})["topK"] = request.TopK
	}
	
	if len(request.StopSequences) > 0 {
		reqBody["generationConfig"].(map[string]interface{})["stopSequences"] = request.StopSequences
	}
	
	// Make HTTP request
	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", g.baseURL, request.ModelID, g.config.APIKey)
	
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	httpReq.Header.Set("Content-Type", "application/json")
	
	resp, err := g.httpClient.Do(httpReq)
	if err != nil {
		g.updateStatus(false)
		return nil, &ProviderError{
			Provider:    "gemini",
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
		g.updateStatus(false)
		return nil, &ProviderError{
			Provider:   "gemini",
			Message:    fmt.Sprintf("API error: %s", string(body)),
			Retryable:  resp.StatusCode >= 500,
			StatusCode: resp.StatusCode,
		}
	}
	
	// Parse response
	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
			FinishReason string `json:"finishReason"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}
	
	err = json.Unmarshal(body, &geminiResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("no content in response")
	}
	
	g.updateStatus(true)
	
	response := &GenerateResponse{
		Text:         geminiResp.Candidates[0].Content.Parts[0].Text,
		ModelID:      request.ModelID,
		ProviderName: "gemini",
		TokensUsed: TokenUsage{
			PromptTokens:     geminiResp.UsageMetadata.PromptTokenCount,
			CompletionTokens: geminiResp.UsageMetadata.CandidatesTokenCount,
			TotalTokens:      geminiResp.UsageMetadata.TotalTokenCount,
		},
		FinishReason: geminiResp.Candidates[0].FinishReason,
		Latency:      time.Since(startTime),
	}
	
	return response, nil
}

// Stream streams text generation (placeholder)
func (g *GeminiAdapter) Stream(ctx context.Context, request *GenerateRequest) (<-chan *StreamChunk, <-chan error) {
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
func (g *GeminiAdapter) GetProviderName() string {
	return "gemini"
}

// GetModelInfo returns information about a model
func (g *GeminiAdapter) GetModelInfo(modelID string) (*ModelInfo, error) {
	models := map[string]*ModelInfo{
		"gemini-pro": {
			ModelID:      "gemini-pro",
			DisplayName:  "Gemini Pro",
			Provider:     "gemini",
			MaxTokens:    32768,
			InputCost:    0.00025,
			OutputCost:   0.0005,
			Capabilities: []string{"chat", "completion"},
			Version:      "1.0",
		},
		"gemini-pro-vision": {
			ModelID:      "gemini-pro-vision",
			DisplayName:  "Gemini Pro Vision",
			Provider:     "gemini",
			MaxTokens:    16384,
			InputCost:    0.00025,
			OutputCost:   0.0005,
			Capabilities: []string{"chat", "completion", "vision"},
			Version:      "1.0",
		},
	}
	
	info, exists := models[modelID]
	if !exists {
		return nil, fmt.Errorf("model not found: %s", modelID)
	}
	
	return info, nil
}

// ListModels lists available models
func (g *GeminiAdapter) ListModels() ([]*ModelInfo, error) {
	return []*ModelInfo{
		{
			ModelID:      "gemini-pro",
			DisplayName:  "Gemini Pro",
			Provider:     "gemini",
			MaxTokens:    32768,
			Capabilities: []string{"chat", "completion"},
		},
		{
			ModelID:      "gemini-pro-vision",
			DisplayName:  "Gemini Pro Vision",
			Provider:     "gemini",
			MaxTokens:    16384,
			Capabilities: []string{"chat", "completion", "vision"},
		},
	}, nil
}

// HealthCheck checks provider health
func (g *GeminiAdapter) HealthCheck(ctx context.Context) error {
	// Simple health check - list models
	url := fmt.Sprintf("%s/models?key=%s", g.baseURL, g.config.APIKey)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	
	resp, err := g.httpClient.Do(req)
	if err != nil {
		g.updateStatus(false)
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		g.updateStatus(false)
		return fmt.Errorf("health check failed with status: %d", resp.StatusCode)
	}
	
	g.updateStatus(true)
	return nil
}

// GetStatus returns provider status
func (g *GeminiAdapter) GetStatus() ProviderStatus {
	return g.status
}

// Configure updates provider configuration
func (g *GeminiAdapter) Configure(config ProviderConfig) error {
	g.config = config
	g.httpClient.Timeout = config.Timeout
	return nil
}

// GetConfig returns provider configuration
func (g *GeminiAdapter) GetConfig() ProviderConfig {
	return g.config
}

// updateStatus updates provider status
func (g *GeminiAdapter) updateStatus(success bool) {
	g.status.LastCheck = time.Now()
	g.status.RequestCount++
	
	if success {
		g.status.Healthy = true
		g.status.Available = true
		g.status.ErrorCount = 0
	} else {
		g.status.ErrorCount++
		if g.status.ErrorCount > 5 {
			g.status.Healthy = false
		}
	}
	
	if g.status.RequestCount > 0 {
		g.status.FailureRate = float64(g.status.ErrorCount) / float64(g.status.RequestCount)
	}
}
