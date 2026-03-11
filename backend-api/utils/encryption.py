"""
Encryption utilities for sensitive data
Uses AES-256-GCM for encryption
"""

import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import logging

logger = logging.getLogger(__name__)


class EncryptionService:
    """Handle encryption/decryption of sensitive data"""
    
    def __init__(self):
        # Get encryption key from environment
        encryption_key = os.getenv("ENCRYPTION_KEY")
        
        if not encryption_key:
            logger.warning("ENCRYPTION_KEY not set, generating temporary key")
            # Generate a temporary key (NOT for production!)
            encryption_key = base64.b64encode(os.urandom(32)).decode()
        
        # Derive a 256-bit key from the encryption key
        self.key = self._derive_key(encryption_key)
        self.aesgcm = AESGCM(self.key)
    
    def _derive_key(self, password: str) -> bytes:
        """Derive a 256-bit key from password using PBKDF2"""
        salt = b'aetherguard_salt_v1'  # Fixed salt for consistency
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return kdf.derive(password.encode())
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string
        
        Returns: Base64-encoded encrypted data with nonce
        Format: base64(nonce + ciphertext + tag)
        """
        if not plaintext:
            return ""
        
        try:
            # Generate random nonce (12 bytes for GCM)
            nonce = os.urandom(12)
            
            # Encrypt
            ciphertext = self.aesgcm.encrypt(
                nonce,
                plaintext.encode('utf-8'),
                None  # No associated data
            )
            
            # Combine nonce + ciphertext and encode
            encrypted_data = nonce + ciphertext
            return base64.b64encode(encrypted_data).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise
    
    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypt encrypted string
        
        Args:
            encrypted_data: Base64-encoded encrypted data
        
        Returns: Decrypted plaintext string
        """
        if not encrypted_data:
            return ""
        
        try:
            # Decode from base64
            data = base64.b64decode(encrypted_data)
            
            # Extract nonce and ciphertext
            nonce = data[:12]
            ciphertext = data[12:]
            
            # Decrypt
            plaintext = self.aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise
    
    def get_last_four(self, plaintext: str) -> str:
        """Get last 4 characters for display"""
        if not plaintext or len(plaintext) < 4:
            return "****"
        return plaintext[-4:]


# Global instance
_encryption_service = None

def get_encryption_service() -> EncryptionService:
    """Get or create global encryption service instance"""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
