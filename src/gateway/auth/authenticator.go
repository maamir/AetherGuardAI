package auth

import (
	"fmt"
	"net/http"
	"strings"
)

// Context holds authentication context
type Context struct {
	TenantID   string
	UserID     string
	Roles      []string
	AuthMethod string
}

// Authenticator interface for authentication mechanisms
type Authenticator interface {
	Authenticate(r *http.Request) (*Context, error)
}

// MultiAuthenticator supports multiple authentication methods
type MultiAuthenticator struct {
	apiKeyAuth  *APIKeyAuthenticator
	oauthAuth   *OAuthAuthenticator
	mtlsAuth    *MTLSAuthenticator
}

// NewMultiAuthenticator creates a new multi-method authenticator
func NewMultiAuthenticator(apiKey *APIKeyAuthenticator, oauth *OAuthAuthenticator, mtls *MTLSAuthenticator) *MultiAuthenticator {
	return &MultiAuthenticator{
		apiKeyAuth: apiKey,
		oauthAuth:  oauth,
		mtlsAuth:   mtls,
	}
}

// Authenticate tries multiple authentication methods
func (m *MultiAuthenticator) Authenticate(r *http.Request) (*Context, error) {
	// Try API Key authentication
	if apiKey := r.Header.Get("X-API-Key"); apiKey != "" {
		return m.apiKeyAuth.Authenticate(r)
	}
	
	// Try OAuth authentication
	if authHeader := r.Header.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
		return m.oauthAuth.Authenticate(r)
	}
	
	// Try mTLS authentication
	if r.TLS != nil && len(r.TLS.PeerCertificates) > 0 {
		return m.mtlsAuth.Authenticate(r)
	}
	
	return nil, fmt.Errorf("no valid authentication method found")
}
