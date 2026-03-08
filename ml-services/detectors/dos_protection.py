"""
DoS Protection - Complexity scoring and token budget enforcement

Detects and throttles prompts engineered to exhaust model compute
or trigger runaway generation loops.
"""

import logging
from typing import Dict
import re

logger = logging.getLogger(__name__)

class DoSProtector:
    """DoS protection via complexity scoring and token budget enforcement"""
    
    def __init__(self, max_tokens: int = 4096, max_complexity_score: float = 0.8):
        self.max_tokens = max_tokens
        self.max_complexity_score = max_complexity_score
        logger.info(f"DoSProtector initialized (max_tokens={max_tokens}, max_complexity={max_complexity_score})")
    
    def check_request(self, text: str, requested_tokens: int = None) -> Dict:
        """
        Check request for DoS indicators
        
        Returns: {allowed: bool, reason: str, complexity_score: float, token_budget_ok: bool}
        """
        # Calculate complexity score
        complexity_score = self._calculate_complexity(text)
        
        # Check token budget
        token_budget_ok = True
        if requested_tokens and requested_tokens > self.max_tokens:
            token_budget_ok = False
        
        # Determine if request should be allowed
        allowed = complexity_score <= self.max_complexity_score and token_budget_ok
        
        reason = ""
        if not allowed:
            if complexity_score > self.max_complexity_score:
                reason = f"Complexity score too high: {complexity_score:.2f} > {self.max_complexity_score}"
            elif not token_budget_ok:
                reason = f"Token budget exceeded: {requested_tokens} > {self.max_tokens}"
        
        return {
            "allowed": allowed,
            "reason": reason if not allowed else "OK",
            "complexity_score": complexity_score,
            "token_budget_ok": token_budget_ok,
            "details": {
                "text_length": len(text),
                "requested_tokens": requested_tokens,
                "max_tokens": self.max_tokens
            }
        }
    
    def _calculate_complexity(self, text: str) -> float:
        """
        Calculate complexity score based on multiple factors
        
        Factors:
        - Repetition patterns
        - Nested structures
        - Special characters
        - Length
        - Recursive patterns
        """
        score = 0.0
        
        # Factor 1: Repetition detection (0-0.3)
        repetition_score = self._detect_repetition(text)
        score += repetition_score * 0.3
        
        # Factor 2: Nested structures (0-0.3)
        nesting_score = self._detect_nesting(text)
        score += nesting_score * 0.3
        
        # Factor 3: Special character density (0-0.2)
        special_char_score = self._calculate_special_char_density(text)
        score += special_char_score * 0.2
        
        # Factor 4: Length-based complexity (0-0.2)
        length_score = min(len(text) / 10000, 1.0)  # Normalize to 10k chars
        score += length_score * 0.2
        
        return min(score, 1.0)
    
    def _detect_repetition(self, text: str) -> float:
        """Detect repetitive patterns that could cause runaway generation"""
        if len(text) < 10:
            return 0.0
        
        # Check for repeated substrings
        max_repetition = 0
        
        # Check for repeated words
        words = text.split()
        if len(words) > 1:
            word_counts = {}
            for word in words:
                word_counts[word] = word_counts.get(word, 0) + 1
            
            max_word_count = max(word_counts.values())
            word_repetition = max_word_count / len(words)
            max_repetition = max(max_repetition, word_repetition)
        
        # Check for repeated character sequences
        for length in [3, 5, 10]:
            if len(text) >= length:
                sequences = {}
                for i in range(len(text) - length + 1):
                    seq = text[i:i+length]
                    sequences[seq] = sequences.get(seq, 0) + 1
                
                if sequences:
                    max_seq_count = max(sequences.values())
                    seq_repetition = max_seq_count / (len(text) - length + 1)
                    max_repetition = max(max_repetition, seq_repetition)
        
        return min(max_repetition, 1.0)
    
    def _detect_nesting(self, text: str) -> float:
        """Detect deeply nested structures (brackets, quotes, etc.)"""
        max_depth = 0
        current_depth = 0
        
        opening = ['(', '[', '{', '<']
        closing = [')', ']', '}', '>']
        
        for char in text:
            if char in opening:
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif char in closing:
                current_depth = max(0, current_depth - 1)
        
        # Normalize: depth > 10 is considered highly complex
        return min(max_depth / 10.0, 1.0)
    
    def _calculate_special_char_density(self, text: str) -> float:
        """Calculate density of special characters"""
        if not text:
            return 0.0
        
        special_chars = sum(1 for c in text if not c.isalnum() and not c.isspace())
        density = special_chars / len(text)
        
        # Normalize: >50% special chars is highly suspicious
        return min(density / 0.5, 1.0)
    
    def detect_runaway_patterns(self, text: str) -> Dict:
        """
        Detect patterns that could trigger runaway generation
        
        Examples:
        - "Repeat the following 1000 times..."
        - "Generate an infinite list..."
        - "Continue forever..."
        """
        runaway_patterns = [
            r'\b(repeat|generate|continue|list|enumerate)\s+(forever|infinitely|endlessly|continuously)',
            r'\b(repeat|generate)\s+.*\s+(\d{3,}|\d+k|\d+m)\s+(times|iterations)',
            r'\binfinite\s+(loop|list|sequence|series)',
            r'\buntil\s+(infinity|forever|never)',
            r'\bkeep\s+(going|generating|repeating)\s+(forever|endlessly)',
        ]
        
        matches = []
        for pattern in runaway_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                matches.append(pattern)
        
        detected = len(matches) > 0
        
        return {
            "detected": detected,
            "confidence": min(len(matches) / len(runaway_patterns), 1.0),
            "matched_patterns": matches
        }
