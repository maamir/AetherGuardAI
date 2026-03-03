package gateway

import (
	"context"
	"fmt"
	"net/http"
	"time"
	
	"github.com/aetherguard/aetherguard-ai/src/gateway/auth"
	"github.com/aetherguard/aetherguard-ai/src/gateway/routing"
	"github.com/aetherguard/aetherguard-ai/src/gateway/rate_limiting"
	"github.com/aetherguard/aetherguard-ai/src/policy"
)

// Gateway represents the API Gateway component
type Gateway struct {
	authenticator auth.Authenticator
	router        *routing.Router
	rateLimiter   *rate_limiting.RateLimiter
	policyEngine  *policy.Engine
	server        *http.Server
}

// Config holds gateway configuration
type Config struct {
	Port            int
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	MaxHeaderBytes  int
	EnableAuth      bool
	EnableRateLimit bool
}

// NewGateway creates a new API Gateway instance
func NewGateway(cfg Config, authenticator auth.Authenticator, router *routing.Router, 
	rateLimiter *rate_limiting.RateLimiter, policyEngine *policy.Engine) *Gateway {
	
	gateway := &Gateway{
		authenticator: authenticator,
		router:        router,
		rateLimiter:   rateLimiter,
		policyEngine:  policyEngine,
	}
	
	mux := http.NewServeMux()
	mux.HandleFunc("/", gateway.handleRequest)
	mux.HandleFunc("/health", gateway.handleHealth)
	
	gateway.server = &http.Server{
		Addr:           fmt.Sprintf(":%d", cfg.Port),
		Handler:        gateway.middleware(mux),
		ReadTimeout:    cfg.ReadTimeout,
		WriteTimeout:   cfg.WriteTimeout,
		MaxHeaderBytes: cfg.MaxHeaderBytes,
	}
	
	return gateway
}

// Start starts the gateway server
func (g *Gateway) Start() error {
	return g.server.ListenAndServe()
}

// Shutdown gracefully shuts down the gateway
func (g *Gateway) Shutdown(ctx context.Context) error {
	return g.server.Shutdown(ctx)
}

// middleware applies authentication, rate limiting, and policy checks
func (g *Gateway) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Authentication
		authCtx, err := g.authenticator.Authenticate(r)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		
		// 2. Rate Limiting
		if !g.rateLimiter.Allow(authCtx.TenantID) {
			http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		
		// 3. Policy Evaluation
		allowed, reason := g.policyEngine.Evaluate(authCtx, r)
		if !allowed {
			http.Error(w, fmt.Sprintf("Policy violation: %s", reason), http.StatusForbidden)
			return
		}
		
		// Add auth context to request
		ctx := context.WithValue(r.Context(), "auth", authCtx)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// handleRequest handles incoming API requests
func (g *Gateway) handleRequest(w http.ResponseWriter, r *http.Request) {
	// Extract auth context
	authCtx := r.Context().Value("auth").(*auth.Context)
	
	// Route request to appropriate LLM provider
	response, err := g.router.Route(r.Context(), authCtx, r)
	if err != nil {
		http.Error(w, fmt.Sprintf("Routing failed: %v", err), http.StatusInternalServerError)
		return
	}
	
	// Write response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(response)
}

// handleHealth handles health check requests
func (g *Gateway) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"healthy"}`))
}
