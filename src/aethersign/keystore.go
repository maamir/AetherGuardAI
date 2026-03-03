package aethersign

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io"
	"sync"
)

// KeyStore manages cryptographic keys and signatures
type KeyStore interface {
	// Key management
	GetPrivateKey(algorithm SignatureAlgorithm) (interface{}, error)
	GetPublicKey(algorithm SignatureAlgorithm) (interface{}, error)
	StorePrivateKey(algorithm SignatureAlgorithm, key interface{}) error
	StorePublicKey(algorithm SignatureAlgorithm, key interface{}) error
	
	// Signature management
	StoreSignature(modelID, modelVersion string, signature *ModelSignature) error
	GetSignature(modelID, modelVersion string) (*ModelSignature, error)
	ListSignatures(modelID string) ([]*ModelSignature, error)
	
	// Key rotation
	RotateKeys(algorithm SignatureAlgorithm) error
	GetKeyVersion(algorithm SignatureAlgorithm) (int, error)
}

// InMemoryKeyStore is an in-memory implementation of KeyStore
type InMemoryKeyStore struct {
	privateKeys map[SignatureAlgorithm]interface{}
	publicKeys  map[SignatureAlgorithm]interface{}
	signatures  map[string]*ModelSignature // key: modelID:modelVersion
	keyVersions map[SignatureAlgorithm]int
	mu          sync.RWMutex
	encryption  []byte // Encryption key for at-rest encryption
}

// HSMConfig holds HSM configuration
type HSMConfig struct {
	Provider string
	Endpoint string
	KeyID    string
}

// NewInMemoryKeyStore creates a new in-memory key store
func NewInMemoryKeyStore(encryptionKey []byte) *InMemoryKeyStore {
	return &InMemoryKeyStore{
		privateKeys: make(map[SignatureAlgorithm]interface{}),
		publicKeys:  make(map[SignatureAlgorithm]interface{}),
		signatures:  make(map[string]*ModelSignature),
		keyVersions: make(map[SignatureAlgorithm]int),
		encryption:  encryptionKey,
	}
}

// GetPrivateKey retrieves a private key
func (ks *InMemoryKeyStore) GetPrivateKey(algorithm SignatureAlgorithm) (interface{}, error) {
	ks.mu.RLock()
	defer ks.mu.RUnlock()
	
	key, exists := ks.privateKeys[algorithm]
	if !exists {
		return nil, fmt.Errorf("private key not found for algorithm: %s", algorithm)
	}
	
	return key, nil
}

// GetPublicKey retrieves a public key
func (ks *InMemoryKeyStore) GetPublicKey(algorithm SignatureAlgorithm) (interface{}, error) {
	ks.mu.RLock()
	defer ks.mu.RUnlock()
	
	key, exists := ks.publicKeys[algorithm]
	if !exists {
		return nil, fmt.Errorf("public key not found for algorithm: %s", algorithm)
	}
	
	return key, nil
}

// StorePrivateKey stores a private key
func (ks *InMemoryKeyStore) StorePrivateKey(algorithm SignatureAlgorithm, key interface{}) error {
	ks.mu.Lock()
	defer ks.mu.Unlock()
	
	// Encrypt key if encryption is enabled
	if ks.encryption != nil {
		// TODO: Implement key encryption
	}
	
	ks.privateKeys[algorithm] = key
	return nil
}

// StorePublicKey stores a public key
func (ks *InMemoryKeyStore) StorePublicKey(algorithm SignatureAlgorithm, key interface{}) error {
	ks.mu.Lock()
	defer ks.mu.Unlock()
	
	ks.publicKeys[algorithm] = key
	return nil
}

// StoreSignature stores a model signature
func (ks *InMemoryKeyStore) StoreSignature(modelID, modelVersion string, signature *ModelSignature) error {
	ks.mu.Lock()
	defer ks.mu.Unlock()
	
	key := fmt.Sprintf("%s:%s", modelID, modelVersion)
	ks.signatures[key] = signature
	
	return nil
}

// GetSignature retrieves a model signature
func (ks *InMemoryKeyStore) GetSignature(modelID, modelVersion string) (*ModelSignature, error) {
	ks.mu.RLock()
	defer ks.mu.RUnlock()
	
	key := fmt.Sprintf("%s:%s", modelID, modelVersion)
	signature, exists := ks.signatures[key]
	if !exists {
		return nil, fmt.Errorf("signature not found for model: %s version: %s", modelID, modelVersion)
	}
	
	return signature, nil
}

// ListSignatures lists all signatures for a model
func (ks *InMemoryKeyStore) ListSignatures(modelID string) ([]*ModelSignature, error) {
	ks.mu.RLock()
	defer ks.mu.RUnlock()
	
	var signatures []*ModelSignature
	prefix := modelID + ":"
	
	for key, sig := range ks.signatures {
		if len(key) > len(prefix) && key[:len(prefix)] == prefix {
			signatures = append(signatures, sig)
		}
	}
	
	return signatures, nil
}

// RotateKeys rotates keys for an algorithm
func (ks *InMemoryKeyStore) RotateKeys(algorithm SignatureAlgorithm) error {
	ks.mu.Lock()
	defer ks.mu.Unlock()
	
	// Generate new key pair
	privateKey, publicKey, err := GenerateKeyPair(algorithm)
	if err != nil {
		return fmt.Errorf("failed to generate new key pair: %w", err)
	}
	
	// Store new keys
	ks.privateKeys[algorithm] = privateKey
	ks.publicKeys[algorithm] = publicKey
	
	// Increment version
	ks.keyVersions[algorithm]++
	
	return nil
}

// GetKeyVersion retrieves the current key version
func (ks *InMemoryKeyStore) GetKeyVersion(algorithm SignatureAlgorithm) (int, error) {
	ks.mu.RLock()
	defer ks.mu.RUnlock()
	
	version, exists := ks.keyVersions[algorithm]
	if !exists {
		return 0, nil
	}
	
	return version, nil
}

// encryptKey encrypts a key using AES-GCM
func (ks *InMemoryKeyStore) encryptKey(keyData []byte) ([]byte, error) {
	if ks.encryption == nil {
		return keyData, nil
	}
	
	block, err := aes.NewCipher(ks.encryption)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}
	
	ciphertext := gcm.Seal(nonce, nonce, keyData, nil)
	return ciphertext, nil
}

// decryptKey decrypts a key using AES-GCM
func (ks *InMemoryKeyStore) decryptKey(ciphertext []byte) ([]byte, error) {
	if ks.encryption == nil {
		return ciphertext, nil
	}
	
	block, err := aes.NewCipher(ks.encryption)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}
	
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}
	
	return plaintext, nil
}

// ExportPrivateKey exports a private key to PEM format
func ExportPrivateKey(key interface{}) (string, error) {
	keyBytes, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return "", fmt.Errorf("failed to marshal private key: %w", err)
	}
	
	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: keyBytes,
	})
	
	return string(keyPEM), nil
}

// ImportPrivateKey imports a private key from PEM format
func ImportPrivateKey(keyPEM string) (interface{}, error) {
	block, _ := pem.Decode([]byte(keyPEM))
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}
	
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}
	
	return key, nil
}
