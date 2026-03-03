package llm_provider

import (
	"context"
	"time"
)

// Provider defines the unified interface for all LLM providers
type Provider interface {
	// Core operations
	Generate(ctx context.Context, request *GenerateRequest) (*GenerateResponse, error)
	Stream(ctx context.Context, request *GenerateRequest) (<-chan *StreamChunk, <-chan error)
	
	// Provider info
	GetProviderName() string
	GetModelInfo(modelID string) (*ModelInfo, error)
	ListModels() ([]*ModelInfo, error)
	
	// Health and status
	HealthCheck(ctx context.Context) error
	GetStatus() ProviderStatus
	
	// Configuration
	Configure(config ProviderConfig) error
	GetConfig() ProviderConfig
}

// GenerateRequest represents a request to generate text
type GenerateRequest struct {
	ModelID       string
	Prompt        string
	SystemPrompt  string
	MaxTokens     int
	Temperature   float64
	TopP          float64
	TopK          int
	StopSequences []string
	Stream        bool
	Metadata      map[string]string
}

// GenerateResponse represents a response from text generation
type GenerateResponse struct {
	Text          string
	ModelID       string
	ProviderName  string
	TokensUsed    TokenUsage
	FinishReason  string
	Latency       time.Duration
	Metadata      map[string]string
}

// StreamChunk represents a chunk in a streaming response
type StreamChunk struct {
	Text         string
	Delta        string
	FinishReason string
	TokensUsed   TokenUsage
	Index        int
}

// TokenUsage represents token usage statistics
type TokenUsage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// ModelInfo represents information about a model
type ModelInfo struct {
	ModelID      string
	DisplayName  string
	Provider     string
	MaxTokens    int
	InputCost    float64  // Cost per 1K tokens
	OutputCost   float64  // Cost per 1K tokens
	Capabilities []string // "chat", "completion", "embedding", etc.
	Version      string
	Deprecated   bool
}

// ProviderStatus represents the status of a provider
type ProviderStatus struct {
	Available     bool
	Healthy       bool
	LastCheck     time.Time
	ErrorCount    int
	Latency       time.Duration
	RequestCount  int64
	FailureRate   float64
}

// ProviderConfig holds provider configuration
type ProviderConfig struct {
	APIKey          string
	Endpoint        string
	Timeout         time.Duration
	MaxRetries      int
	RetryDelay      time.Duration
	RateLimitRPS    int
	EnableCaching   bool
	CustomHeaders   map[string]string
}

// ProviderType represents the type of LLM provider
type ProviderType string

const (
	ProviderOpenAI    ProviderType = "openai"
	ProviderAnthropic ProviderType = "anthropic"
	ProviderGemini    ProviderType = "gemini"
	ProviderLocal     ProviderType = "local"
)

// ProviderError represents a provider-specific error
type ProviderError struct {
	Provider     string
	ErrorCode    string
	Message      string
	Retryable    bool
	StatusCode   int
	OriginalErr  error
}

func (e *ProviderError) Error() string {
	return e.Message
}

// IsRetryable returns whether the error is retryable
func (e *ProviderError) IsRetryable() bool {
	return e.Retryable
}
