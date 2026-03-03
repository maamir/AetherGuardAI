package aethersign

import (
	"fmt"
	"time"
)

// AetherSign is the main service for model signing and response attribution
type AetherSign struct {
	signer     *Signer
	attributor *Attributor
	keyStore   KeyStore
	config     AetherSignConfig
}

// AetherSignConfig holds AetherSign configuration
type AetherSignConfig struct {
	SignerConfig     Config
	AttributorConfig AttributorConfig
	AutoRotateKeys   bool
	RotationInterval time.Duration
}

// NewAetherSign creates a new AetherSign service
func NewAetherSign(cfg AetherSignConfig, keyStore KeyStore, attributorKey []byte) (*AetherSign, error) {
	// Create signer
	signer, err := NewSigner(cfg.SignerConfig, keyStore)
	if err != nil {
		return nil, fmt.Errorf("failed to create signer: %w", err)
	}
	
	// Create attributor
	attributor, err := NewAttributor(attributorKey, cfg.AttributorConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create attributor: %w", err)
	}
	
	service := &AetherSign{
		signer:     signer,
		attributor: attributor,
		keyStore:   keyStore,
		config:     cfg,
	}
	
	// Start automatic key rotation if enabled
	if cfg.AutoRotateKeys {
		go service.autoRotateKeys()
	}
	
	return service, nil
}

// SignModel signs a model
func (as *AetherSign) SignModel(modelID, modelVersion string, modelData []byte, signerID string) (*SigningResult, error) {
	return as.signer.SignModel(modelID, modelVersion, modelData, signerID)
}

// VerifyModel verifies a model signature
func (as *AetherSign) VerifyModel(modelID, modelVersion string, modelData []byte) (*VerificationResult, error) {
	return as.signer.VerifyModel(modelID, modelVersion, modelData)
}

// AttributeResponse creates attribution for a response
func (as *AetherSign) AttributeResponse(responseText string, metadata ResponseMetadata) (*AttributionResult, error) {
	return as.attributor.AttributeResponse(responseText, metadata)
}

// VerifyAttribution verifies response attribution
func (as *AetherSign) VerifyAttribution(responseText string, attribution *Attribution) (*VerifyAttributionResult, error) {
	return as.attributor.VerifyAttribution(responseText, attribution)
}

// AddCustodyRecord adds a chain of custody record
func (as *AetherSign) AddCustodyRecord(modelID, modelVersion, action, actor, location string) error {
	return as.signer.AddCustodyRecord(modelID, modelVersion, action, actor, location)
}

// GetChainOfCustody retrieves the chain of custody
func (as *AetherSign) GetChainOfCustody(modelID, modelVersion string) ([]CustodyRecord, error) {
	return as.signer.GetChainOfCustody(modelID, modelVersion)
}

// AddProvenanceRecord adds a provenance record
func (as *AetherSign) AddProvenanceRecord(attribution *Attribution, stage, component, action string, metadata map[string]string) {
	as.attributor.AddProvenanceRecord(attribution, stage, component, action, metadata)
}

// GetProvenanceChain retrieves the provenance chain
func (as *AetherSign) GetProvenanceChain(attribution *Attribution) []ProvenanceRecord {
	return as.attributor.GetProvenanceChain(attribution)
}

// RotateKeys manually rotates keys
func (as *AetherSign) RotateKeys(algorithm SignatureAlgorithm) error {
	return as.keyStore.RotateKeys(algorithm)
}

// autoRotateKeys automatically rotates keys on schedule
func (as *AetherSign) autoRotateKeys() {
	ticker := time.NewTicker(as.config.RotationInterval)
	defer ticker.Stop()
	
	for range ticker.C {
		// Rotate keys for all configured algorithms
		algorithms := []SignatureAlgorithm{
			as.config.SignerConfig.Algorithm,
		}
		
		for _, algo := range algorithms {
			err := as.keyStore.RotateKeys(algo)
			if err != nil {
				// Log error but continue
				fmt.Printf("Failed to rotate keys for %s: %v\n", algo, err)
			}
		}
	}
}

// GetStats returns service statistics
func (as *AetherSign) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"algorithm":         as.config.SignerConfig.Algorithm,
		"auto_rotate_keys":  as.config.AutoRotateKeys,
		"rotation_interval": as.config.RotationInterval.String(),
		"hsm_enabled":       as.config.SignerConfig.EnableHSM,
	}
}

// InitializeKeys initializes keys for all algorithms
func (as *AetherSign) InitializeKeys() error {
	algorithm := as.config.SignerConfig.Algorithm
	
	// Check if keys already exist
	_, err := as.keyStore.GetPrivateKey(algorithm)
	if err == nil {
		// Keys already exist
		return nil
	}
	
	// Generate new key pair
	privateKey, publicKey, err := GenerateKeyPair(algorithm)
	if err != nil {
		return fmt.Errorf("failed to generate key pair: %w", err)
	}
	
	// Store keys
	err = as.keyStore.StorePrivateKey(algorithm, privateKey)
	if err != nil {
		return fmt.Errorf("failed to store private key: %w", err)
	}
	
	err = as.keyStore.StorePublicKey(algorithm, publicKey)
	if err != nil {
		return fmt.Errorf("failed to store public key: %w", err)
	}
	
	return nil
}
