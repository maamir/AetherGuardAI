package aethersign

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"time"
)

// Signer handles cryptographic signing of AI models
type Signer struct {
	algorithm SignatureAlgorithm
	keyStore  KeyStore
	config    Config
}

// Config holds signer configuration
type Config struct {
	Algorithm       SignatureAlgorithm // RSA2048, RSA4096, ECDSAP256, ECDSAP384
	KeyRotationDays int                // Days before automatic key rotation
	EnableHSM       bool               // Use Hardware Security Module
	HSMConfig       HSMConfig
}

// SignatureAlgorithm represents the signing algorithm
type SignatureAlgorithm string

const (
	RSA2048    SignatureAlgorithm = "RSA-2048"
	RSA4096    SignatureAlgorithm = "RSA-4096"
	ECDSAP256  SignatureAlgorithm = "ECDSA-P256"
	ECDSAP384  SignatureAlgorithm = "ECDSA-P384"
)

// ModelSignature represents a signed model
type ModelSignature struct {
	ModelID       string
	ModelVersion  string
	Signature     string
	Algorithm     SignatureAlgorithm
	PublicKey     string
	Timestamp     int64
	SignerID      string
	ChainOfCustody []CustodyRecord
}

// CustodyRecord represents a chain of custody entry
type CustodyRecord struct {
	Timestamp   int64
	Action      string // "created", "signed", "verified", "deployed"
	Actor       string
	Location    string
	Signature   string
}

// SigningResult represents the result of a signing operation
type SigningResult struct {
	Success       bool
	Signature     *ModelSignature
	SignatureHash string
	Error         error
}

// VerificationResult represents the result of signature verification
type VerificationResult struct {
	Valid         bool
	ModelID       string
	ModelVersion  string
	SignedAt      int64
	SignerID      string
	Algorithm     SignatureAlgorithm
	Error         error
}

// NewSigner creates a new model signer
func NewSigner(cfg Config, keyStore KeyStore) (*Signer, error) {
	if keyStore == nil {
		return nil, fmt.Errorf("key store is required")
	}
	
	// Set defaults
	if cfg.Algorithm == "" {
		cfg.Algorithm = RSA2048
	}
	if cfg.KeyRotationDays == 0 {
		cfg.KeyRotationDays = 90 // Default 90 days
	}
	
	signer := &Signer{
		algorithm: cfg.Algorithm,
		keyStore:  keyStore,
		config:    cfg,
	}
	
	return signer, nil
}

// SignModel signs a model's weights
func (s *Signer) SignModel(modelID, modelVersion string, modelData []byte, signerID string) (*SigningResult, error) {
	result := &SigningResult{
		Success: false,
	}
	
	// 1. Get signing key from key store
	privateKey, err := s.keyStore.GetPrivateKey(s.algorithm)
	if err != nil {
		result.Error = fmt.Errorf("failed to get private key: %w", err)
		return result, result.Error
	}
	
	// 2. Compute hash of model data
	hash := sha256.Sum256(modelData)
	
	// 3. Sign the hash
	var signature []byte
	switch s.algorithm {
	case RSA2048, RSA4096:
		signature, err = s.signRSA(privateKey, hash[:])
	case ECDSAP256, ECDSAP384:
		signature, err = s.signECDSA(privateKey, hash[:])
	default:
		result.Error = fmt.Errorf("unsupported algorithm: %s", s.algorithm)
		return result, result.Error
	}
	
	if err != nil {
		result.Error = fmt.Errorf("signing failed: %w", err)
		return result, result.Error
	}
	
	// 4. Get public key
	publicKey, err := s.keyStore.GetPublicKey(s.algorithm)
	if err != nil {
		result.Error = fmt.Errorf("failed to get public key: %w", err)
		return result, result.Error
	}
	
	publicKeyPEM, err := s.encodePublicKey(publicKey)
	if err != nil {
		result.Error = fmt.Errorf("failed to encode public key: %w", err)
		return result, result.Error
	}
	
	// 5. Create model signature
	modelSig := &ModelSignature{
		ModelID:      modelID,
		ModelVersion: modelVersion,
		Signature:    base64.StdEncoding.EncodeToString(signature),
		Algorithm:    s.algorithm,
		PublicKey:    publicKeyPEM,
		Timestamp:    time.Now().Unix(),
		SignerID:     signerID,
		ChainOfCustody: []CustodyRecord{
			{
				Timestamp: time.Now().Unix(),
				Action:    "signed",
				Actor:     signerID,
				Location:  "signing-service",
				Signature: base64.StdEncoding.EncodeToString(signature[:32]), // First 32 bytes
			},
		},
	}
	
	// 6. Store signature in key store
	err = s.keyStore.StoreSignature(modelID, modelVersion, modelSig)
	if err != nil {
		result.Error = fmt.Errorf("failed to store signature: %w", err)
		return result, result.Error
	}
	
	result.Success = true
	result.Signature = modelSig
	result.SignatureHash = base64.StdEncoding.EncodeToString(hash[:])
	
	return result, nil
}

// VerifyModel verifies a model's signature
func (s *Signer) VerifyModel(modelID, modelVersion string, modelData []byte) (*VerificationResult, error) {
	result := &VerificationResult{
		Valid:        false,
		ModelID:      modelID,
		ModelVersion: modelVersion,
	}
	
	// 1. Retrieve signature from key store
	modelSig, err := s.keyStore.GetSignature(modelID, modelVersion)
	if err != nil {
		result.Error = fmt.Errorf("failed to get signature: %w", err)
		return result, result.Error
	}
	
	result.SignedAt = modelSig.Timestamp
	result.SignerID = modelSig.SignerID
	result.Algorithm = modelSig.Algorithm
	
	// 2. Decode signature
	signature, err := base64.StdEncoding.DecodeString(modelSig.Signature)
	if err != nil {
		result.Error = fmt.Errorf("failed to decode signature: %w", err)
		return result, result.Error
	}
	
	// 3. Decode public key
	publicKey, err := s.decodePublicKey(modelSig.PublicKey, modelSig.Algorithm)
	if err != nil {
		result.Error = fmt.Errorf("failed to decode public key: %w", err)
		return result, result.Error
	}
	
	// 4. Compute hash of model data
	hash := sha256.Sum256(modelData)
	
	// 5. Verify signature
	var valid bool
	switch modelSig.Algorithm {
	case RSA2048, RSA4096:
		valid, err = s.verifyRSA(publicKey, hash[:], signature)
	case ECDSAP256, ECDSAP384:
		valid, err = s.verifyECDSA(publicKey, hash[:], signature)
	default:
		result.Error = fmt.Errorf("unsupported algorithm: %s", modelSig.Algorithm)
		return result, result.Error
	}
	
	if err != nil {
		result.Error = fmt.Errorf("verification failed: %w", err)
		return result, result.Error
	}
	
	result.Valid = valid
	
	return result, nil
}

// signRSA signs data using RSA
func (s *Signer) signRSA(privateKey interface{}, hash []byte) ([]byte, error) {
	rsaKey, ok := privateKey.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("invalid RSA private key")
	}
	
	signature, err := rsa.SignPKCS1v15(rand.Reader, rsaKey, crypto.SHA256, hash)
	if err != nil {
		return nil, fmt.Errorf("RSA signing failed: %w", err)
	}
	
	return signature, nil
}

// verifyRSA verifies RSA signature
func (s *Signer) verifyRSA(publicKey interface{}, hash, signature []byte) (bool, error) {
	rsaKey, ok := publicKey.(*rsa.PublicKey)
	if !ok {
		return false, fmt.Errorf("invalid RSA public key")
	}
	
	err := rsa.VerifyPKCS1v15(rsaKey, crypto.SHA256, hash, signature)
	if err != nil {
		return false, nil // Signature invalid, but not an error
	}
	
	return true, nil
}

// signECDSA signs data using ECDSA
func (s *Signer) signECDSA(privateKey interface{}, hash []byte) ([]byte, error) {
	ecdsaKey, ok := privateKey.(*ecdsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("invalid ECDSA private key")
	}
	
	signature, err := ecdsa.SignASN1(rand.Reader, ecdsaKey, hash)
	if err != nil {
		return nil, fmt.Errorf("ECDSA signing failed: %w", err)
	}
	
	return signature, nil
}

// verifyECDSA verifies ECDSA signature
func (s *Signer) verifyECDSA(publicKey interface{}, hash, signature []byte) (bool, error) {
	ecdsaKey, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return false, fmt.Errorf("invalid ECDSA public key")
	}
	
	valid := ecdsa.VerifyASN1(ecdsaKey, hash, signature)
	return valid, nil
}

// encodePublicKey encodes public key to PEM format
func (s *Signer) encodePublicKey(publicKey interface{}) (string, error) {
	pubKeyBytes, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return "", fmt.Errorf("failed to marshal public key: %w", err)
	}
	
	pubKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubKeyBytes,
	})
	
	return string(pubKeyPEM), nil
}

// decodePublicKey decodes public key from PEM format
func (s *Signer) decodePublicKey(publicKeyPEM string, algorithm SignatureAlgorithm) (interface{}, error) {
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}
	
	publicKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}
	
	return publicKey, nil
}

// AddCustodyRecord adds a chain of custody record to a model signature
func (s *Signer) AddCustodyRecord(modelID, modelVersion, action, actor, location string) error {
	// Retrieve signature
	modelSig, err := s.keyStore.GetSignature(modelID, modelVersion)
	if err != nil {
		return fmt.Errorf("failed to get signature: %w", err)
	}
	
	// Add custody record
	record := CustodyRecord{
		Timestamp: time.Now().Unix(),
		Action:    action,
		Actor:     actor,
		Location:  location,
	}
	
	modelSig.ChainOfCustody = append(modelSig.ChainOfCustody, record)
	
	// Update signature
	err = s.keyStore.StoreSignature(modelID, modelVersion, modelSig)
	if err != nil {
		return fmt.Errorf("failed to update signature: %w", err)
	}
	
	return nil
}

// GetChainOfCustody retrieves the chain of custody for a model
func (s *Signer) GetChainOfCustody(modelID, modelVersion string) ([]CustodyRecord, error) {
	modelSig, err := s.keyStore.GetSignature(modelID, modelVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to get signature: %w", err)
	}
	
	return modelSig.ChainOfCustody, nil
}

// GenerateKeyPair generates a new key pair for signing
func GenerateKeyPair(algorithm SignatureAlgorithm) (privateKey, publicKey interface{}, err error) {
	switch algorithm {
	case RSA2048:
		return generateRSAKeyPair(2048)
	case RSA4096:
		return generateRSAKeyPair(4096)
	case ECDSAP256:
		return generateECDSAKeyPair(elliptic.P256())
	case ECDSAP384:
		return generateECDSAKeyPair(elliptic.P384())
	default:
		return nil, nil, fmt.Errorf("unsupported algorithm: %s", algorithm)
	}
}

// generateRSAKeyPair generates an RSA key pair
func generateRSAKeyPair(bits int) (*rsa.PrivateKey, *rsa.PublicKey, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate RSA key: %w", err)
	}
	
	return privateKey, &privateKey.PublicKey, nil
}

// generateECDSAKeyPair generates an ECDSA key pair
func generateECDSAKeyPair(curve elliptic.Curve) (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	privateKey, err := ecdsa.GenerateKey(curve, rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate ECDSA key: %w", err)
	}
	
	return privateKey, &privateKey.PublicKey, nil
}
