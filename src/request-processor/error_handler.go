package request_processor

import (
	"fmt"
)

// ErrorHandler handles errors and provides clear explanations
type ErrorHandler struct {
	config ErrorHandlerConfig
}

// ErrorHandlerConfig holds error handler configuration
type ErrorHandlerConfig struct {
	IncludeDetails    bool
	IncludeSuggestions bool
	SanitizeErrors    bool
}

// ErrorResponse represents a user-friendly error response
type ErrorResponse struct {
	ErrorCode   string
	Message     string
	Details     string
	Suggestions []string
	Retryable   bool
	StatusCode  int
}

// NewErrorHandler creates a new error handler
func NewErrorHandler(config ErrorHandlerConfig) *ErrorHandler {
	return &ErrorHandler{
		config: config,
	}
}

// HandleInputBlocked handles input blocking errors
func (eh *ErrorHandler) HandleInputBlocked(blockReason string, detectionType string) *ErrorResponse {
	response := &ErrorResponse{
		ErrorCode:  "INPUT_BLOCKED",
		Message:    "Your request was blocked due to security concerns",
		Retryable:  false,
		StatusCode: 400,
	}
	
	if eh.config.IncludeDetails {
		response.Details = fmt.Sprintf("Detection type: %s. Reason: %s", detectionType, blockReason)
	}
	
	if eh.config.IncludeSuggestions {
		response.Suggestions = []string{
			"Review your input for potentially harmful content",
			"Remove any sensitive information (PII, credentials)",
			"Avoid injection patterns or malicious instructions",
			"Contact support if you believe this is an error",
		}
	}
	
	return response
}

// HandleOutputBlocked handles output blocking errors
func (eh *ErrorHandler) HandleOutputBlocked(blockReason string) *ErrorResponse {
	response := &ErrorResponse{
		ErrorCode:  "OUTPUT_BLOCKED",
		Message:    "The AI response was blocked due to content policy violations",
		Retryable:  true,
		StatusCode: 200, // Request succeeded, but output was filtered
	}
	
	if eh.config.IncludeDetails {
		response.Details = fmt.Sprintf("Reason: %s", blockReason)
	}
	
	if eh.config.IncludeSuggestions {
		response.Suggestions = []string{
			"Try rephrasing your request",
			"Adjust the temperature or other parameters",
			"Use a different model",
			"Contact support if this persists",
		}
	}
	
	return response
}

// HandleLLMError handles LLM provider errors
func (eh *ErrorHandler) HandleLLMError(err error, provider string) *ErrorResponse {
	response := &ErrorResponse{
		ErrorCode:  "LLM_ERROR",
		Message:    "The AI service encountered an error",
		Retryable:  true,
		StatusCode: 503,
	}
	
	if eh.config.IncludeDetails && !eh.config.SanitizeErrors {
		response.Details = fmt.Sprintf("Provider: %s. Error: %v", provider, err)
	} else if eh.config.IncludeDetails {
		response.Details = fmt.Sprintf("Provider: %s. The service is temporarily unavailable", provider)
	}
	
	if eh.config.IncludeSuggestions {
		response.Suggestions = []string{
			"Retry your request in a few moments",
			"Try a different model or provider",
			"Check the service status page",
			"Contact support if the issue persists",
		}
	}
	
	return response
}

// HandleProcessingError handles general processing errors
func (eh *ErrorHandler) HandleProcessingError(err error, stage string) *ErrorResponse {
	response := &ErrorResponse{
		ErrorCode:  "PROCESSING_ERROR",
		Message:    "An error occurred while processing your request",
		Retryable:  true,
		StatusCode: 500,
	}
	
	if eh.config.IncludeDetails && !eh.config.SanitizeErrors {
		response.Details = fmt.Sprintf("Stage: %s. Error: %v", stage, err)
	} else if eh.config.IncludeDetails {
		response.Details = fmt.Sprintf("Stage: %s. Processing failed", stage)
	}
	
	if eh.config.IncludeSuggestions {
		response.Suggestions = []string{
			"Retry your request",
			"Simplify your input",
			"Contact support with your request ID",
		}
	}
	
	return response
}

// HandleValidationError handles validation errors
func (eh *ErrorHandler) HandleValidationError(err error) *ErrorResponse {
	response := &ErrorResponse{
		ErrorCode:  "VALIDATION_ERROR",
		Message:    "Your request contains invalid parameters",
		Retryable:  false,
		StatusCode: 400,
	}
	
	if eh.config.IncludeDetails {
		response.Details = err.Error()
	}
	
	if eh.config.IncludeSuggestions {
		response.Suggestions = []string{
			"Check your request parameters",
			"Ensure all required fields are provided",
			"Verify parameter values are within valid ranges",
			"Refer to the API documentation",
		}
	}
	
	return response
}

// HandleTimeout handles timeout errors
func (eh *ErrorHandler) HandleTimeout() *ErrorResponse {
	response := &ErrorResponse{
		ErrorCode:  "TIMEOUT",
		Message:    "Your request timed out",
		Retryable:  true,
		StatusCode: 504,
	}
	
	if eh.config.IncludeDetails {
		response.Details = "The request exceeded the maximum processing time"
	}
	
	if eh.config.IncludeSuggestions {
		response.Suggestions = []string{
			"Retry with a shorter prompt",
			"Reduce max_tokens parameter",
			"Try again later when the service is less busy",
		}
	}
	
	return response
}

// FormatErrorResponse formats an error response for the user
func (eh *ErrorHandler) FormatErrorResponse(errResp *ErrorResponse) map[string]interface{} {
	response := map[string]interface{}{
		"error": map[string]interface{}{
			"code":    errResp.ErrorCode,
			"message": errResp.Message,
		},
		"retryable": errResp.Retryable,
	}
	
	if errResp.Details != "" {
		response["error"].(map[string]interface{})["details"] = errResp.Details
	}
	
	if len(errResp.Suggestions) > 0 {
		response["suggestions"] = errResp.Suggestions
	}
	
	return response
}
