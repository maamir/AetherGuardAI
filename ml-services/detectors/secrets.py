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
        # TODO: Integrate actual TruffleHog and Gitleaks
        # from truffleHogRegexes.regexChecks import regexes
        logger.info("SecretsDetector initialized (mock mode)")
        
        # Common secret patterns (subset - full list should be loaded from Gitleaks)
        self.patterns = {
            "aws_access_key": r"AKIA[0-9A-Z]{16}",
            "aws_secret_key": r"aws(.{0,20})?['\"][0-9a-zA-Z/+]{40}['\"]",
            "github_token": r"gh[pousr]_[0-9a-zA-Z]{36}",
            "slack_token": r"xox[baprs]-[0-9]{10,12}-[0-9]{10,12}-[0-9a-zA-Z]{24,32}",
            "private_key": r"-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----",
            "jwt": r"eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*",
            "api_key": r"api[_-]?key['\"]?\s*[:=]\s*['\"]?[0-9a-zA-Z]{32,}",
            "password": r"password['\"]?\s*[:=]\s*['\"]?[^\s'\"]{8,}",
            "connection_string": r"(mongodb|mysql|postgres|redis)://[^\s]+",
            "ssh_key": r"ssh-rsa [A-Za-z0-9+/=]+",
        }
        
        # Pattern update tracking
        self.last_update = datetime.now()
        self.update_interval_days = 14  # Bi-weekly updates
        self.pattern_version = "1.0.0"
        
    def detect(self, text: str) -> Dict:
        """
        Scan text for secrets using pattern matching and entropy analysis
        Returns: {secrets_found: bool, secrets: list, high_entropy_strings: list}
        """
        secrets = []
        
        # Pattern-based detection
        for secret_type, pattern in self.patterns.items():
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                secrets.append({
                    "type": secret_type,
                    "value": self._mask_secret(match.group()),
                    "start": match.start(),
                    "end": match.end(),
                    "detection_method": "pattern"
                })
        
        # Entropy-based detection (TruffleHog approach)
        high_entropy_strings = self._detect_high_entropy(text)
        for entropy_string in high_entropy_strings:
            secrets.append({
                "type": "high_entropy_string",
                "value": self._mask_secret(entropy_string["value"]),
                "entropy": entropy_string["entropy"],
                "detection_method": "entropy"
            })
        
        return {
            "secrets_found": len(secrets) > 0,
            "count": len(secrets),
            "secrets": secrets,
            "enforcement_action": "block" if secrets else "allow"
        }
    
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
