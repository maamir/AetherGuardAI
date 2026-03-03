package model_integrity

import (
	"context"
	"fmt"
	
	"github.com/aetherguard/aetherguard-ai/src/aethersign"
)

// VerificationService handles model integrity verification
type VerificationService struct {
	aethersign *aethersign.AetherSign
	config     VerificationConfig
}

// VerificationConfig holds verification service configuration
type VerificationConfig struct {
	RequireSignature bool
	AutoVerify       bool
	FailOnInvalid    bool
}

// NewVerificationService creates a new verification service
func NewVerificationService(aethersign *aethersign.AetherSign, config VerificationConfig) *VerificationService {
	return &VerificationService{
		aethersign: aethersign,
		config:     config,
	}
}

// VerifyModel verifies a model's signature before use
func (vs *VerificationService) VerifyModel(ctx context.Context, modelID, modelVersion string, modelData []byte) error {
	if !vs.config.RequireSignature {
		return nil
	}
	
	result, err := vs.aethersign.VerifyModel(modelID, modelVersion, modelData)
	if err != nil {
		if vs.config.FailOnInvalid {
			return fmt.Errorf("model verification failed: %w", err)
		}
		return nil
	}
	
	if !result.Valid && vs.config.FailOnInvalid {
		return fmt.Errorf("model signature invalid")
	}
	
	return nil
}

// SignModel signs a model during deployment
func (vs *VerificationService) SignModel(ctx context.Context, modelID, modelVersion string, modelData []byte, signerID string) error {
	_, err := vs.aethersign.SignModel(modelID, modelVersion, modelData, signerID)
	return err
}
