import logging
from typing import Dict, List
import re

logger = logging.getLogger(__name__)

class PIIDetector:
    """PII/PHI detection using Microsoft Presidio"""
    
    def __init__(self, model_loader=None):
        self.analyzer = None
        self.anonymizer = None
        self.custom_recognizers = []
        self.redaction_strategy = "mask"  # Options: mask, substitute, synthetic, hash
        
        if model_loader and model_loader.is_loaded('presidio'):
            presidio_data = model_loader.get_model('presidio')
            self.analyzer = presidio_data['analyzer']
            self.anonymizer = presidio_data['anonymizer']
            logger.info("PIIDetector initialized with Microsoft Presidio")
        else:
            logger.info("PIIDetector initialized (regex fallback mode)")
        
        # Load custom recognizers for domain-specific identifiers
        self._load_custom_recognizers()
    
    def set_redaction_strategy(self, strategy: str):
        """
        Set redaction strategy
        
        Options:
        - mask: Character-level masking (default)
        - substitute: Entity-type substitution
        - synthetic: Synthetic data replacement
        - hash: Cryptographic hashing
        """
        valid_strategies = ["mask", "substitute", "synthetic", "hash"]
        if strategy not in valid_strategies:
            raise ValueError(f"Invalid strategy. Must be one of: {valid_strategies}")
        self.redaction_strategy = strategy
        logger.info(f"Redaction strategy set to: {strategy}")
    
    def _load_custom_recognizers(self):
        """
        Load custom recognizers for domain-specific identifiers
        Examples: employee IDs, case numbers, patient IDs, etc.
        """
        self.custom_recognizers = [
            {
                "name": "EMPLOYEE_ID",
                "pattern": r'\bEMP-\d{6}\b',
                "description": "Employee ID (format: EMP-123456)"
            },
            {
                "name": "CASE_NUMBER",
                "pattern": r'\bCASE-\d{8}\b',
                "description": "Case number (format: CASE-12345678)"
            },
            {
                "name": "PATIENT_ID",
                "pattern": r'\bPT-\d{7}\b',
                "description": "Patient ID (format: PT-1234567)"
            },
            {
                "name": "ACCOUNT_NUMBER",
                "pattern": r'\bACC-\d{10}\b',
                "description": "Account number (format: ACC-1234567890)"
            },
            {
                "name": "MEDICAL_RECORD_NUMBER",
                "pattern": r'\bMRN-\d{8}\b',
                "description": "Medical record number (format: MRN-12345678)"
            },
            {
                "name": "INSURANCE_ID",
                "pattern": r'\bINS-[A-Z0-9]{10}\b',
                "description": "Insurance ID (format: INS-ABC1234567)"
            },
        ]
        logger.info(f"Loaded {len(self.custom_recognizers)} custom PII recognizers")
    
    def add_custom_recognizer(self, name: str, pattern: str, description: str = ""):
        """
        Add a custom PII recognizer at runtime
        
        Args:
            name: Entity type name (e.g., "EMPLOYEE_ID")
            pattern: Regex pattern to match
            description: Human-readable description
        """
        self.custom_recognizers.append({
            "name": name,
            "pattern": pattern,
            "description": description
        })
        logger.info(f"Added custom recognizer: {name}")
    
    def get_custom_recognizers(self) -> List[Dict]:
        """Return list of all custom recognizers"""
        return self.custom_recognizers
    
    def _apply_redaction(self, text: str, entity_type: str, original_value: str) -> str:
        """
        Apply redaction based on configured strategy
        
        Strategies:
        - mask: [EMAIL_REDACTED]
        - substitute: john.doe@example.com
        - synthetic: fake_email_123@example.com
        - hash: sha256:abc123...
        """
        import hashlib
        import random
        
        if self.redaction_strategy == "mask":
            return f"[{entity_type}_REDACTED]"
        
        elif self.redaction_strategy == "substitute":
            # Entity-type substitution with realistic placeholders
            substitutions = {
                "EMAIL_ADDRESS": "user@example.com",
                "PHONE_NUMBER": "555-0100",
                "US_SSN": "000-00-0000",
                "CREDIT_CARD": "0000-0000-0000-0000",
                "IP_ADDRESS": "192.0.2.1",
                "URL": "https://example.com",
                "DATE_OF_BIRTH": "01/01/2000",
                "ZIP_CODE": "00000",
                "EMPLOYEE_ID": "EMP-000000",
                "PATIENT_ID": "PT-0000000",
            }
            return substitutions.get(entity_type, f"<{entity_type}>")
        
        elif self.redaction_strategy == "synthetic":
            # Generate synthetic data that looks real
            synthetic_data = {
                "EMAIL_ADDRESS": f"user{random.randint(1000,9999)}@example.com",
                "PHONE_NUMBER": f"555-{random.randint(1000,9999)}",
                "US_SSN": f"{random.randint(100,999)}-{random.randint(10,99)}-{random.randint(1000,9999)}",
                "CREDIT_CARD": f"4{random.randint(100,999)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}",
                "IP_ADDRESS": f"192.168.{random.randint(1,254)}.{random.randint(1,254)}",
                "ZIP_CODE": f"{random.randint(10000,99999)}",
            }
            return synthetic_data.get(entity_type, f"synthetic_{entity_type}_{random.randint(1000,9999)}")
        
        elif self.redaction_strategy == "hash":
            # Cryptographic hash of original value
            hash_obj = hashlib.sha256(original_value.encode())
            hash_hex = hash_obj.hexdigest()[:16]
            return f"sha256:{hash_hex}"
        
        return f"[{entity_type}_REDACTED]"
        
    def detect_and_redact(self, text: str) -> Dict:
        """
        Detect PII entities and return redacted text
        Returns: {entities: list, redacted_text: str}
        """
        if self.analyzer and self.anonymizer:
            return self._detect_with_presidio(text)
        
        return self._detect_with_regex(text)
    
    def _detect_with_presidio(self, text: str) -> Dict:
        """Use Microsoft Presidio for comprehensive PII detection"""
        try:
            # Analyze text for PII
            results = self.analyzer.analyze(
                text=text,
                language='en',
                entities=None  # Detect all entity types
            )
            
            # Convert to our format
            entities = []
            for result in results:
                entities.append({
                    "type": result.entity_type,
                    "start": result.start,
                    "end": result.end,
                    "text": text[result.start:result.end],
                    "score": result.score
                })
            
            # Anonymize text
            anonymized_result = self.anonymizer.anonymize(
                text=text,
                analyzer_results=results
            )
            
            return {
                "entities": entities,
                "redacted_text": anonymized_result.text,
                "method": "presidio"
            }
            
        except Exception as e:
            logger.error(f"Presidio error: {e}")
            return self._detect_with_regex(text)
    
    def _detect_with_regex(self, text: str) -> Dict:
        """Regex-based PII detection (fallback)"""
        entities = []
        redacted_text = text
        
        # Standard PII patterns
        pii_patterns = {
            # Contact Information
            "EMAIL_ADDRESS": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "PHONE_NUMBER": r'\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b',
            "US_SSN": r'\b\d{3}-\d{2}-\d{4}\b',
            
            # Financial
            "CREDIT_CARD": r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b',
            "IBAN": r'\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b',
            "ROUTING_NUMBER": r'\b[0-9]{9}\b',
            "BANK_ACCOUNT": r'\b\d{8,17}\b',
            
            # Government IDs (more specific)
            "US_PASSPORT": r'\b[0-9]{9}\b(?=.*passport)',  # Only if "passport" is mentioned
            "US_DRIVER_LICENSE": r'\b(?:DL|CDL)[-\s]?[A-Z0-9]{5,12}\b',  # More specific format
            "UK_NHS_NUMBER": r'\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b',
            "CANADA_SIN": r'\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b',
            
            # Healthcare
            "MEDICAL_LICENSE": r'\b[A-Z]{2}\d{6,8}\b',
            "DEA_NUMBER": r'\b[A-Z]{2}\d{7}\b',
            "NPI_NUMBER": r'\b\d{10}\b',
            
            # Network/Technical
            "IP_ADDRESS": r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b',
            "IPV6_ADDRESS": r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b',
            "MAC_ADDRESS": r'\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b',
            "URL": r'https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&/=]*)',
            
            # Personal Information
            "DATE_OF_BIRTH": r'\b(?:0[1-9]|1[0-2])[/-](?:0[1-9]|[12][0-9]|3[01])[/-](?:19|20)\d{2}\b',
            "AGE": r'\b(?:age|aged)[\s:]+(\d{1,3})\b',
            "ZIP_CODE": r'\b\d{5}(?:-\d{4})?\b',
            
            # Biometric
            "FINGERPRINT_ID": r'\bFP-[0-9A-F]{16}\b',
            "RETINA_SCAN_ID": r'\bRS-[0-9A-F]{16}\b',
            
            # Vehicle (more specific patterns)
            "VIN": r'\b[A-HJ-NPR-Z0-9]{17}\b',
            "LICENSE_PLATE": r'\b[A-Z]{1,3}[-\s]?[0-9]{1,4}[-\s]?[A-Z]{0,3}\b',  # More specific format
            
            # Education
            "STUDENT_ID": r'\bSTU-\d{6,10}\b',
            "TRANSCRIPT_ID": r'\bTR-\d{8}\b',
            
            # Employment
            "TAX_ID": r'\b\d{2}-\d{7}\b',
            "EMPLOYEE_NUMBER": r'\bE\d{6,8}\b',
            
            # Legal
            "COURT_CASE_NUMBER": r'\b\d{2}-[A-Z]{2}-\d{6}\b',
            "DOCKET_NUMBER": r'\bDKT-\d{8}\b',
            
            # International IDs
            "PASSPORT_GENERIC": r'\b[A-Z]{1,2}\d{6,9}\b',
            "NATIONAL_ID": r'\b[A-Z]{2}\d{6,12}\b',
            
            # Crypto
            "BITCOIN_ADDRESS": r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b',
            "ETHEREUM_ADDRESS": r'\b0x[a-fA-F0-9]{40}\b',
            
            # Coordinates
            "GPS_COORDINATES": r'\b[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)\b',
            
            # Usernames/Handles (more specific)
            "SOCIAL_MEDIA_HANDLE": r'@[a-zA-Z0-9_]{3,15}\b',  # Renamed for clarity
            "SLACK_USER_ID": r'\bU[A-Z0-9]{8,10}\b',
            
            # Device IDs
            "IMEI": r'\b\d{15}\b',
            "SERIAL_NUMBER": r'\bSN[A-Z0-9]{10,15}\b',
            
            # Insurance
            "POLICY_NUMBER": r'\bPOL-\d{8,12}\b',
            "CLAIM_NUMBER": r'\bCLM-\d{8,12}\b',
            
            # Membership
            "MEMBERSHIP_ID": r'\bMEM-\d{6,10}\b',
            "LOYALTY_NUMBER": r'\bLOY-\d{8,12}\b',
        }
        
        # Detect all patterns
        for entity_type, pattern in pii_patterns.items():
            for match in re.finditer(pattern, text, re.IGNORECASE):
                original_value = match.group()
                entities.append({
                    "type": entity_type,
                    "start": match.start(),
                    "end": match.end(),
                    "text": original_value
                })
                redacted_value = self._apply_redaction(text, entity_type, original_value)
                redacted_text = redacted_text.replace(original_value, redacted_value)
        
        # Custom recognizers (domain-specific)
        for recognizer in self.custom_recognizers:
            pattern = recognizer["pattern"]
            entity_type = recognizer["name"]
            
            for match in re.finditer(pattern, text):
                original_value = match.group()
                entities.append({
                    "type": entity_type,
                    "start": match.start(),
                    "end": match.end(),
                    "text": original_value
                })
                redacted_value = self._apply_redaction(text, entity_type, original_value)
                redacted_text = redacted_text.replace(original_value, redacted_value)
        
        return {
            "entities": entities,
            "redacted_text": redacted_text,
            "method": "regex",
            "total_types_checked": len(pii_patterns) + len(self.custom_recognizers)
        }
