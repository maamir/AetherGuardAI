"""
Adversarial Robustness - Detect and normalize adversarial inputs

Handles:
- Character substitution attacks
- Homoglyph attacks
- Invisible Unicode characters
- Zero-width characters
- Confusable characters
"""

import logging
from typing import Dict
import unicodedata
import re

logger = logging.getLogger(__name__)

class AdversarialDefense:
    """Adversarial input detection and normalization"""
    
    def __init__(self):
        # Homoglyph mappings (common confusable characters)
        self.homoglyph_map = {
            # Cyrillic to Latin
            'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
            'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
            'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X',
            # Greek to Latin
            'α': 'a', 'β': 'b', 'γ': 'y', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'n',
            'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'u', 'ν': 'v', 'ξ': 'x',
            'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'τ': 't', 'υ': 'u', 'φ': 'f',
            'χ': 'ch', 'ψ': 'ps', 'ω': 'w',
            # Special characters
            '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
            '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
        }
        
        logger.info("AdversarialDefense initialized")
    
    def detect_and_normalize(self, text: str) -> Dict:
        """
        Detect adversarial patterns and return normalized text
        
        Returns: {
            adversarial_detected: bool,
            normalized_text: str,
            attacks_found: list,
            confidence: float
        }
        """
        attacks_found = []
        normalized_text = text
        
        # Check for invisible characters
        invisible_result = self._detect_invisible_chars(text)
        if invisible_result['detected']:
            attacks_found.append('invisible_characters')
            normalized_text = invisible_result['cleaned_text']
        
        # Check for homoglyphs
        homoglyph_result = self._detect_homoglyphs(normalized_text)
        if homoglyph_result['detected']:
            attacks_found.append('homoglyphs')
            normalized_text = homoglyph_result['normalized_text']
        
        # Check for zero-width characters
        zero_width_result = self._detect_zero_width(normalized_text)
        if zero_width_result['detected']:
            attacks_found.append('zero_width_characters')
            normalized_text = zero_width_result['cleaned_text']
        
        # Check for character substitution
        substitution_result = self._detect_substitution(normalized_text)
        if substitution_result['detected']:
            attacks_found.append('character_substitution')
        
        # Check for Unicode normalization attacks
        unicode_result = self._detect_unicode_attacks(normalized_text)
        if unicode_result['detected']:
            attacks_found.append('unicode_normalization')
            normalized_text = unicode_result['normalized_text']
        
        adversarial_detected = len(attacks_found) > 0
        confidence = len(attacks_found) / 5.0  # 5 attack types checked
        
        return {
            "adversarial_detected": adversarial_detected,
            "normalized_text": normalized_text,
            "attacks_found": attacks_found,
            "confidence": confidence,
            "original_length": len(text),
            "normalized_length": len(normalized_text)
        }
    
    def _detect_invisible_chars(self, text: str) -> Dict:
        """Detect and remove invisible Unicode characters"""
        invisible_chars = [
            '\u200B',  # Zero-width space
            '\u200C',  # Zero-width non-joiner
            '\u200D',  # Zero-width joiner
            '\u2060',  # Word joiner
            '\uFEFF',  # Zero-width no-break space
            '\u180E',  # Mongolian vowel separator
        ]
        
        detected = any(char in text for char in invisible_chars)
        
        # Remove invisible characters
        cleaned_text = text
        for char in invisible_chars:
            cleaned_text = cleaned_text.replace(char, '')
        
        return {
            "detected": detected,
            "cleaned_text": cleaned_text,
            "chars_removed": len(text) - len(cleaned_text)
        }
    
    def _detect_homoglyphs(self, text: str) -> Dict:
        """Detect and normalize homoglyph characters"""
        homoglyphs_found = []
        normalized_text = text
        
        for homoglyph, replacement in self.homoglyph_map.items():
            if homoglyph in text:
                homoglyphs_found.append(homoglyph)
                normalized_text = normalized_text.replace(homoglyph, replacement)
        
        return {
            "detected": len(homoglyphs_found) > 0,
            "normalized_text": normalized_text,
            "homoglyphs_found": homoglyphs_found
        }
    
    def _detect_zero_width(self, text: str) -> Dict:
        """Detect zero-width characters"""
        zero_width_pattern = r'[\u200B-\u200D\u2060\uFEFF]'
        matches = re.findall(zero_width_pattern, text)
        
        cleaned_text = re.sub(zero_width_pattern, '', text)
        
        return {
            "detected": len(matches) > 0,
            "cleaned_text": cleaned_text,
            "count": len(matches)
        }
    
    def _detect_substitution(self, text: str) -> Dict:
        """Detect character substitution patterns (e.g., l33t speak)"""
        substitution_patterns = {
            r'[4@]': 'a',
            r'[8]': 'b',
            r'[(<\[]': 'c',
            r'[3]': 'e',
            r'[1!|]': 'i',
            r'[0]': 'o',
            r'[5$]': 's',
            r'[7+]': 't',
        }
        
        detected = False
        for pattern in substitution_patterns.keys():
            if re.search(pattern, text):
                detected = True
                break
        
        return {
            "detected": detected,
            "confidence": 0.7 if detected else 0.0
        }
    
    def _detect_unicode_attacks(self, text: str) -> Dict:
        """Detect Unicode normalization attacks"""
        # Normalize to NFC (Canonical Decomposition, followed by Canonical Composition)
        normalized_nfc = unicodedata.normalize('NFC', text)
        
        # Normalize to NFKC (Compatibility Decomposition, followed by Canonical Composition)
        normalized_nfkc = unicodedata.normalize('NFKC', text)
        
        # If normalization changes the text significantly, it might be an attack
        detected = (normalized_nfc != text) or (normalized_nfkc != text)
        
        return {
            "detected": detected,
            "normalized_text": normalized_nfkc,
            "nfc_different": normalized_nfc != text,
            "nfkc_different": normalized_nfkc != text
        }
    
    def detect_markdown_injection(self, text: str) -> Dict:
        """Detect markdown injection attempts"""
        markdown_patterns = [
            r'!\[.*\]\(.*\)',  # Image injection
            r'\[.*\]\(javascript:.*\)',  # JavaScript links
            r'<script.*?>.*?</script>',  # Script tags
            r'<iframe.*?>.*?</iframe>',  # Iframe injection
            r'on\w+\s*=',  # Event handlers
        ]
        
        matches = []
        for pattern in markdown_patterns:
            if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
                matches.append(pattern)
        
        return {
            "detected": len(matches) > 0,
            "confidence": min(len(matches) / len(markdown_patterns), 1.0),
            "matched_patterns": matches
        }
    
    def sanitize_input(self, text: str) -> str:
        """
        Comprehensive input sanitization
        
        Applies all normalizations and removes dangerous patterns
        """
        # Step 1: Remove invisible characters
        result = self._detect_invisible_chars(text)
        sanitized = result['cleaned_text']
        
        # Step 2: Normalize homoglyphs
        result = self._detect_homoglyphs(sanitized)
        sanitized = result['normalized_text']
        
        # Step 3: Remove zero-width characters
        result = self._detect_zero_width(sanitized)
        sanitized = result['cleaned_text']
        
        # Step 4: Unicode normalization
        sanitized = unicodedata.normalize('NFKC', sanitized)
        
        # Step 5: Remove null bytes
        sanitized = sanitized.replace('\x00', '')
        
        # Step 6: Normalize whitespace
        sanitized = ' '.join(sanitized.split())
        
        return sanitized
