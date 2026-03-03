package auth

import (
	"crypto/subtle"
	"fmt"
	"net/http"
)

// APIKeyAuthenticator handles API key authentication
type APIKeyAuthenticator struct {
	keys map[string]*Context // API key -> auth context mapping
}

// NewAPIKeyAuthenticator creates a new API key authenticator
func NewAPIKeyAuthenticator() *APIKeyAuthenticator {
	return &APIKeyAuthenticator{
		keys: make(map[string]*Context),
	}
}

// RegisterKey registers an API key with its context
func (a *APIKeyAuthenticator) RegisterKey(apiKey string, ctx *Context) {
	a.keys[apiKey] = ctx
}

// Authenticate validates an API key and returns the auth context
func (a *APIKeyAuthenticator) Authenticate(r *http.Request) (*Context, error) {
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		return nil, fmt.Errorf("missing API key")
	}
	
	// Constant-time comparison to prevent timing attacks
	for key, ctx := range a.keys {
		if subtle.ConstantTimeCompare([]byte(key), []byte(apiKey)) == 1 {
			authCtx := *ctx
			authCtx.AuthMethod = "api_key"
			return &authCtx, nil
		}
	}
	
	return nil, fmt.Errorf("invalid API key")
}
