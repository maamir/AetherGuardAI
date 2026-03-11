import logging
from typing import Dict, List
import re
import hashlib
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class SecretsDetector:
    """Secrets detection using TruffleHog entropy-based scanning and Gitleaks patterns"""
    
    def __init__(self):
        """Initialize secrets detector with detect-secrets and enhanced patterns"""
        try:
            # Try to import detect-secrets for advanced detection
            from detect_secrets import SecretsCollection
            from detect_secrets.settings import default_settings
            self.secrets_collection = SecretsCollection()
            self.has_detect_secrets = True
            logger.info("SecretsDetector initialized with detect-secrets support")
        except ImportError:
            self.secrets_collection = None
            self.has_detect_secrets = False
            logger.info("detect-secrets not available, using pattern-based detection only")
        
        # Enhanced secret patterns (comprehensive list from Gitleaks + custom)
        self.patterns = {
            # AWS
            "aws_access_key": r"AKIA[0-9A-Z]{16}",
            "aws_secret_key": r"aws(.{0,20})?['\"][0-9a-zA-Z/+]{40}['\"]",
            "aws_session_token": r"AQoEXAMPLEH4aoAH0gNCAPyJxz4BlCFFxWNE1OPTgk5TthT\+FvwqnKwRcOIfrRh3c0nKwv\+9KGKhNeEDtCddNfarisA\+",
            
            # GitHub
            "github_token": r"gh[pousr]_[0-9a-zA-Z]{36}",
            "github_fine_grained": r"github_pat_[0-9a-zA-Z_]{82}",
            "github_oauth": r"gho_[0-9a-zA-Z]{36}",
            "github_app": r"(ghu|ghs)_[0-9a-zA-Z]{36}",
            
            # Google
            "google_api_key": r"AIza[0-9A-Za-z\\-_]{35}",
            "google_oauth": r"ya29\\.[0-9A-Za-z\\-_]+",
            "google_service_account": r"\"type\": \"service_account\"",
            
            # Slack
            "slack_token": r"xox[baprs]-[0-9]{10,12}-[0-9]{10,12}-[0-9a-zA-Z]{24,32}",
            "slack_webhook": r"https://hooks\\.slack\\.com/services/T[a-zA-Z0-9_]{8}/B[a-zA-Z0-9_]{8}/[a-zA-Z0-9_]{24}",
            
            # Microsoft
            "azure_client_secret": r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            "microsoft_teams_webhook": r"https://[a-z0-9]+\\.webhook\\.office\\.com/",
            
            # Database connections
            "mongodb_connection": r"mongodb(\+srv)?://[^\s]+",
            "mysql_connection": r"mysql://[^\s]+",
            "postgres_connection": r"postgres(ql)?://[^\s]+",
            "redis_connection": r"redis://[^\s]+",
            
            # Private keys
            "private_key_rsa": r"-----BEGIN (RSA )?PRIVATE KEY-----",
            "private_key_dsa": r"-----BEGIN DSA PRIVATE KEY-----",
            "private_key_ec": r"-----BEGIN EC PRIVATE KEY-----",
            "private_key_openssh": r"-----BEGIN OPENSSH PRIVATE KEY-----",
            "private_key_pgp": r"-----BEGIN PGP PRIVATE KEY BLOCK-----",
            
            # SSH keys
            "ssh_rsa": r"ssh-rsa [A-Za-z0-9+/=]+",
            "ssh_ed25519": r"ssh-ed25519 [A-Za-z0-9+/=]+",
            "ssh_ecdsa": r"ssh-ecdsa [A-Za-z0-9+/=]+",
            
            # JWT tokens
            "jwt": r"eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*",
            
            # API keys (generic patterns)
            "api_key_generic": r"api[_-]?key['\"]?\s*[:=]\s*['\"]?[0-9a-zA-Z]{32,}['\"]?",
            "bearer_token": r"Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*",
            "basic_auth": r"Basic\s+[A-Za-z0-9+/=]+",
            
            # Passwords in code and text
            "password_assignment": r"password\s*[:=]\s*['\"]?([^\s'\"]{3,})['\"]?",
            "password_in_text": r"(?:password|passwd|pwd|pass)\s+(?:is|:)?\s*['\"]?([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]{3,})['\"]?",
            "my_password": r"(?:my|the|your)\s+password\s+(?:is|:)?\s*['\"]?([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]{3,})['\"]?",
            "secret_assignment": r"secret['\"]?\s*[:=]\s*['\"]?[^\s'\"]{16,}['\"]?",
            "credentials_in_text": r"(?:credentials?|login|auth)\s+(?:is|are|:)?\s*['\"]?([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]{3,})['\"]?",
            
            # Cryptocurrency
            "bitcoin_address": r"[13][a-km-zA-HJ-NP-Z1-9]{25,34}",
            "ethereum_address": r"0x[a-fA-F0-9]{40}",
            
            # Cloud providers
            "heroku_api_key": r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            "stripe_key": r"sk_live_[0-9a-zA-Z]{24}",
            "mailgun_api_key": r"key-[0-9a-zA-Z]{32}",
            "twilio_api_key": r"SK[0-9a-fA-F]{32}",
            
            # Generic high-entropy strings
            "high_entropy_base64": r"[A-Za-z0-9+/]{40,}={0,2}",
            "high_entropy_hex": r"[a-fA-F0-9]{32,}",
        }
        
        # Pattern update tracking
        self.last_update = datetime.now()
        self.update_interval_days = 14  # Bi-weekly updates
        self.pattern_version = "2.0.0"
        
    def detect(self, text: str) -> Dict:
        """
        Scan text for secrets using detect-secrets and pattern matching
        Returns: {secrets_found: bool, secrets: list, high_entropy_strings: list}
        """
        secrets = []
        
        # Method 1: detect-secrets (if available)
        if self.has_detect_secrets:
            detect_secrets_results = self._detect_with_detect_secrets(text)
            secrets.extend(detect_secrets_results)
        
        # Method 2: Pattern-based detection (Gitleaks-style)
        pattern_secrets = self._detect_with_patterns(text)
        secrets.extend(pattern_secrets)
        
        # Method 3: Custom entropy analysis
        entropy_secrets = self._detect_high_entropy(text)
        secrets.extend(entropy_secrets)
        
        # Remove duplicates based on value
        unique_secrets = []
        seen_values = set()
        for secret in secrets:
            secret_value = secret.get("value", "")
            if secret_value not in seen_values:
                unique_secrets.append(secret)
                seen_values.add(secret_value)
        
        return {
            "secrets_found": len(unique_secrets) > 0,
            "count": len(unique_secrets),
            "secrets": unique_secrets,
            "enforcement_action": "block" if unique_secrets else "allow",
            "detection_methods": self._get_detection_methods()
        }
    
    def _detect_with_detect_secrets(self, text: str) -> List[Dict]:
        """Use detect-secrets library for advanced detection"""
        secrets = []
        
        try:
            from detect_secrets.core.scan import scan_line
            from detect_secrets.settings import default_settings
            
            # Scan each line
            for line_num, line in enumerate(text.split('\n'), 1):
                findings = scan_line(line, line_num=line_num)
                
                for finding in findings:
                    secrets.append({
                        "type": finding.type,
                        "value": self._mask_secret(finding.secret_value),
                        "line": line_num,
                        "detection_method": "detect_secrets",
                        "confidence": 0.9
                    })
                    
        except Exception as e:
            logger.error(f"detect-secrets detection failed: {e}")
        
        return secrets
    
    def _detect_with_patterns(self, text: str) -> List[Dict]:
        """Pattern-based secret detection"""
        secrets = []
        
        for secret_type, pattern in self.patterns.items():
            try:
                matches = re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE)
                for match in matches:
                    secret_value = match.group()
                    
                    # Additional validation for some patterns
                    if self._validate_secret(secret_type, secret_value):
                        secrets.append({
                            "type": secret_type,
                            "value": self._mask_secret(secret_value),
                            "start": match.start(),
                            "end": match.end(),
                            "detection_method": "pattern_matching",
                            "confidence": self._calculate_confidence(secret_type, secret_value)
                        })
            except re.error as e:
                logger.error(f"Regex error for pattern {secret_type}: {e}")
        
        return secrets
    
    def _validate_secret(self, secret_type: str, value: str) -> bool:
        """Additional validation for detected secrets"""
        # Skip common false positives
        false_positives = [
            "example", "test", "demo", "placeholder", "your_key_here",
            "insert_key_here", "replace_with", "TODO", "FIXME",
            "qwerty", "letmein", "welcome", "changeme", "default", "sample"
        ]
        
        value_lower = value.lower()
        
        # Skip if it's a common false positive
        if any(fp in value_lower for fp in false_positives):
            return False
        
        # Skip very short values (likely not real secrets) - but allow for password patterns
        if secret_type not in ["password_assignment", "password_in_text", "my_password", "credentials_in_text"]:
            if len(value) < 6:
                return False
        else:
            # For password patterns, allow shorter values (minimum 3 characters)
            if len(value) < 3:
                return False
        
        # Type-specific validation
        if secret_type == "aws_access_key":
            # AWS access keys should be exactly 20 characters after AKIA
            return len(value) == 20 and value.startswith("AKIA")
        
        elif secret_type == "github_token":
            # GitHub tokens have specific prefixes and lengths
            prefixes = ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"]
            return any(value.startswith(prefix) for prefix in prefixes) and len(value) == 40
        
        elif secret_type == "jwt":
            # JWT should have exactly 3 parts separated by dots
            parts = value.split('.')
            return len(parts) == 3 and all(len(part) > 0 for part in parts)
        
        elif secret_type.endswith("_connection"):
            # Connection strings should have valid schemes
            return "://" in value and not value.startswith("http://example")
        
        elif secret_type in ["password_in_text", "my_password", "credentials_in_text", "password_assignment"]:
            # For password in text, validate it looks like a real password
            # Must have at least 3 characters
            if len(value) < 3:
                return False
            
            # Don't require complexity for simple passwords like "123"
            # Just ensure it's not a common placeholder
            return True
        
        return True
    
    def _calculate_confidence(self, secret_type: str, value: str) -> float:
        """Calculate confidence score for detected secret"""
        base_confidence = 0.8
        
        # Higher confidence for well-structured secrets
        if secret_type in ["aws_access_key", "github_token", "jwt"]:
            base_confidence = 0.95
        
        # Medium confidence for password patterns in text
        elif secret_type in ["password_in_text", "my_password", "credentials_in_text"]:
            base_confidence = 0.85
        
        # Lower confidence for generic patterns
        elif secret_type in ["api_key_generic", "password_assignment"]:
            base_confidence = 0.6
        
        # Adjust based on entropy
        entropy = self._calculate_entropy(value)
        if entropy > 5.0:
            base_confidence += 0.1
        elif entropy < 3.0:
            base_confidence -= 0.2
        
        return min(1.0, max(0.1, base_confidence))
    
    def _get_detection_methods(self) -> List[str]:
        """Get list of available detection methods"""
        methods = ["pattern_matching", "entropy_analysis"]
        
        if self.has_detect_secrets:
            methods.append("detect_secrets")
        
        return methods
    
    def _mask_secret(self, secret: str) -> str:
        """Mask secret value for logging"""
        if len(secret) <= 8:
            return "***"
        return secret[:4] + "***" + secret[-4:]
    
    def _detect_high_entropy(self, text: str, threshold: float = 4.5) -> List[Dict]:
        """
        Detect high-entropy strings that may be secrets
        Shannon entropy threshold: 4.5 (TruffleHog default)
        """
        high_entropy = []
        
        # Split text into words/tokens
        tokens = re.findall(r'\b[A-Za-z0-9+/=]{20,}\b', text)
        
        for token in tokens:
            entropy = self._calculate_entropy(token)
            if entropy > threshold:
                high_entropy.append({
                    "value": token,
                    "entropy": entropy
                })
        
        return high_entropy
    
    def _calculate_entropy(self, string: str) -> float:
        """Calculate Shannon entropy of a string"""
        if not string:
            return 0.0
        
        # Count character frequencies
        freq = {}
        for char in string:
            freq[char] = freq.get(char, 0) + 1
        
        # Calculate entropy
        import math
        entropy = 0.0
        length = len(string)
        for count in freq.values():
            probability = count / length
            if probability > 0:
                entropy -= probability * math.log2(probability)
        
        return entropy
    
    def update_patterns(self, new_patterns: Dict[str, str], version: str = None):
        """
        Update pattern library (bi-weekly updates from security intelligence)
        
        Args:
            new_patterns: Dictionary of pattern_name -> regex_pattern
            version: Optional version string for tracking
        """
        self.patterns.update(new_patterns)
        self.last_update = datetime.now()
        
        if version:
            self.pattern_version = version
        
        logger.info(
            f"Updated secrets patterns. Total patterns: {len(self.patterns)}, "
            f"Version: {self.pattern_version}, Last update: {self.last_update}"
        )
    
    def check_update_needed(self) -> bool:
        """
        Check if pattern update is needed (bi-weekly schedule)
        """
        days_since_update = (datetime.now() - self.last_update).days
        return days_since_update >= self.update_interval_days
    
    def get_pattern_info(self) -> Dict:
        """
        Get information about current pattern library
        """
        return {
            "pattern_count": len(self.patterns),
            "pattern_version": self.pattern_version,
            "last_update": self.last_update.isoformat(),
            "update_interval_days": self.update_interval_days,
            "update_needed": self.check_update_needed(),
            "days_since_update": (datetime.now() - self.last_update).days
        }
    
    def load_patterns_from_feed(self, feed_url: str = None) -> bool:
        """
        Load patterns from automated security intelligence feed
        
        This would typically fetch from:
        - Gitleaks community patterns
        - TruffleHog pattern updates
        - Custom security intelligence feeds
        
        Args:
            feed_url: URL to fetch patterns from (optional)
        
        Returns:
            bool: True if patterns were successfully loaded
        """
        # TODO: Implement actual feed fetching
        # For now, this is a placeholder for the automated update mechanism
        
        logger.info(f"Pattern feed update scheduled. Feed URL: {feed_url or 'default'}")
        
        # Example of what this would do:
        # 1. Fetch patterns from feed_url
        # 2. Validate pattern format
        # 3. Update self.patterns
        # 4. Update version and timestamp
        
        return False  # Not implemented yet
    
    def export_patterns(self, filepath: str = None) -> str:
        """
        Export current patterns to JSON file for backup/versioning
        """
        pattern_data = {
            "version": self.pattern_version,
            "last_update": self.last_update.isoformat(),
            "patterns": self.patterns
        }
        
        if filepath:
            with open(filepath, 'w') as f:
                json.dump(pattern_data, f, indent=2)
            logger.info(f"Patterns exported to {filepath}")
        
        return json.dumps(pattern_data, indent=2)
    
    def import_patterns(self, filepath: str = None, pattern_json: str = None) -> bool:
        """
        Import patterns from JSON file or string
        """
        try:
            if filepath:
                with open(filepath, 'r') as f:
                    pattern_data = json.load(f)
            elif pattern_json:
                pattern_data = json.loads(pattern_json)
            else:
                return False
            
            self.update_patterns(
                pattern_data.get("patterns", {}),
                pattern_data.get("version")
            )
            
            logger.info(f"Patterns imported successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to import patterns: {e}")
            return False
