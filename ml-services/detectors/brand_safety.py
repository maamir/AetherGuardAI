import logging
from typing import Dict, List
import re

logger = logging.getLogger(__name__)

class BrandSafetyChecker:
    """Brand Safety & Context Relevance using zero-shot classification"""
    
    def __init__(self):
        # TODO: Load HuggingFace cross-encoder for zero-shot classification
        # from transformers import pipeline
        # self.classifier = pipeline("zero-shot-classification", 
        #                           model="facebook/bart-large-mnli")
        
        logger.info("BrandSafetyChecker initialized (mock mode)")
        
        # Default blocklists (should be configurable via policy-as-code)
        self.competitor_blocklist = [
            "competitor-name-1",
            "competitor-name-2"
        ]
        
        self.prohibited_topics = [
            "illegal activities",
            "medical advice",
            "financial advice",
            "legal advice"
        ]
        
    def check(
        self, 
        text: str, 
        allowed_categories: List[str],
        custom_blocklist: List[str] = None
    ) -> Dict:
        """
        Check brand safety and context relevance
        Returns: {safe: bool, violations: list, topic_drift: bool}
        """
        violations = []
        
        # Check competitor mentions
        competitor_violations = self._check_competitors(text, custom_blocklist)
        violations.extend(competitor_violations)
        
        # Check prohibited topics
        topic_violations = self._check_prohibited_topics(text)
        violations.extend(topic_violations)
        
        # Check topic drift (zero-shot classification)
        topic_drift = self._check_topic_drift(text, allowed_categories)
        
        return {
            "safe": len(violations) == 0 and not topic_drift["drifted"],
            "violations": violations,
            "topic_drift": topic_drift,
            "enforcement_action": "block" if violations else "allow"
        }
    
    def _check_competitors(self, text: str, custom_blocklist: List[str] = None) -> List[Dict]:
        """Check for competitor mentions"""
        blocklist = self.competitor_blocklist + (custom_blocklist or [])
        violations = []
        
        text_lower = text.lower()
        for competitor in blocklist:
            if competitor.lower() in text_lower:
                violations.append({
                    "type": "competitor_mention",
                    "entity": competitor,
                    "severity": "high"
                })
        
        return violations
    
    def _check_prohibited_topics(self, text: str) -> List[Dict]:
        """Check for prohibited topic keywords"""
        violations = []
        
        # TODO: Use more sophisticated topic detection
        text_lower = text.lower()
        
        topic_keywords = {
            "medical_advice": ["diagnose", "prescribe", "medical treatment"],
            "financial_advice": ["invest in", "buy stocks", "financial recommendation"],
            "legal_advice": ["legal opinion", "sue", "legal action"]
        }
        
        for topic, keywords in topic_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    violations.append({
                        "type": "prohibited_topic",
                        "topic": topic,
                        "keyword": keyword,
                        "severity": "medium"
                    })
        
        return violations
    
    def _check_topic_drift(self, text: str, allowed_categories: List[str]) -> Dict:
        """
        Detect topic drift using zero-shot classification
        Prevents domain boundary violations
        """
        # TODO: Implement actual zero-shot classification
        # predicted_category = self.classifier(text, allowed_categories)
        
        # Mock implementation
        predicted_category = allowed_categories[0] if allowed_categories else "general"
        confidence = 0.85
        
        drifted = confidence < 0.7  # Low confidence indicates drift
        
        return {
            "drifted": drifted,
            "predicted_category": predicted_category,
            "confidence": confidence,
            "allowed_categories": allowed_categories
        }
