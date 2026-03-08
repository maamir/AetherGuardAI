"""
Enhanced Toxicity Detection

Uses IBM Granite Guardian (granite-guardian-hap-38m) for HAP detection
with keyword-based fallback for 5 toxicity categories.
"""

import logging
from typing import Dict, List
import re

logger = logging.getLogger(__name__)


class ToxicityDetector:
    """HAP (Hate, Abuse, Profanity) detection using Granite Guardian"""
    
    def __init__(self, model_loader=None):
        self.model_loader = model_loader
        self.use_ml_model = model_loader is not None
        
        # 5 toxicity categories with keywords
        self.categories = {
            'hate_speech': {
                'weight': 1.0,
                'keywords': [
                    'hate', 'racist', 'sexist', 'homophobic', 'transphobic',
                    'xenophobic', 'bigot', 'supremacist', 'nazi', 'fascist',
                    'slur', 'derogatory', 'discriminate', 'prejudice',
                ]
            },
            'harassment': {
                'weight': 0.9,
                'keywords': [
                    'harass', 'bully', 'threaten', 'intimidate', 'stalk',
                    'abuse', 'attack', 'assault', 'violence', 'harm',
                    'hurt', 'kill', 'die', 'death threat',
                ]
            },
            'profanity': {
                'weight': 0.7,
                'keywords': [
                    'fuck', 'shit', 'damn', 'hell', 'ass', 'bitch',
                    'bastard', 'crap', 'piss', 'cock', 'dick', 'pussy',
                    # Add more as needed
                ]
            },
            'sexual_content': {
                'weight': 0.8,
                'keywords': [
                    'sexual', 'explicit', 'pornographic', 'nsfw', 'nude',
                    'naked', 'sex', 'rape', 'molest', 'pedophile',
                    'inappropriate', 'obscene', 'vulgar',
                ]
            },
            'self_harm': {
                'weight': 1.0,
                'keywords': [
                    'suicide', 'self-harm', 'cut myself', 'kill myself',
                    'end my life', 'want to die', 'hurt myself',
                    'self-destruct', 'self-injury',
                ]
            },
        }
        
        logger.info(f"ToxicityDetector initialized ({'ML model' if self.use_ml_model else 'keyword-based'})")
    
    def detect(self, text: str) -> Dict:
        """
        Detect toxic content
        
        Returns:
            {
                'score': float (0.0-1.0),
                'detected': bool,
                'method': 'ml_model' or 'keyword',
                'categories': dict of category scores,
                'details': additional information
            }
        """
        # Try ML model first
        if self.use_ml_model:
            ml_result = self._detect_with_model(text)
            if ml_result['score'] > 0:  # Model returned valid result
                return ml_result
        
        # Fallback to keyword-based detection
        return self._detect_keyword(text)
    
    def _detect_with_model(self, text: str) -> Dict:
        """Use Granite Guardian ML model for detection"""
        try:
            result = self.model_loader.predict_granite_guardian(text)
            
            # Map model output to our format
            is_toxic = result['label'] in ['HATE', 'ABUSE', 'PROFANITY']
            score = result['score'] if is_toxic else 1.0 - result['score']
            
            # Map model categories to our categories
            category_mapping = {
                'HATE': 'hate_speech',
                'ABUSE': 'harassment',
                'PROFANITY': 'profanity',
            }
            
            categories = {}
            for model_cat, our_cat in category_mapping.items():
                if model_cat in result['categories']:
                    categories[our_cat] = result['categories'][model_cat]
            
            return {
                'score': score,
                'detected': is_toxic,
                'method': 'ml_model',
                'model_label': result['label'],
                'model_confidence': result['score'],
                'categories': categories,
                'details': {
                    'model': 'ibm-granite/granite-guardian-hap-38m',
                    'raw_output': result,
                }
            }
            
        except Exception as e:
            logger.error(f"ML model detection failed: {e}")
            return {'score': 0.0}  # Signal to use keyword fallback
    
    def _detect_keyword(self, text: str) -> Dict:
        """Keyword-based detection with context awareness"""
        text_lower = text.lower()
        
        # Score each category
        category_scores = {}
        all_matches = []
        
        for category, config in self.categories.items():
            keywords = config['keywords']
            weight = config['weight']
            
            matches = []
            for keyword in keywords:
                # Use word boundaries for better matching
                pattern = r'\b' + re.escape(keyword) + r'\b'
                if re.search(pattern, text_lower, re.IGNORECASE):
                    matches.append(keyword)
            
            if matches:
                # Score is (matches / total_keywords) * weight
                category_score = (len(matches) / len(keywords)) * weight
                category_scores[category] = category_score
                all_matches.extend(matches)
        
        # Calculate weighted overall score
        if category_scores:
            total_score = sum(category_scores.values())
            # Normalize by max possible score
            max_score = sum(config['weight'] for config in self.categories.values())
            normalized_score = min(total_score / max_score, 1.0)
        else:
            normalized_score = 0.0
        
        # Context-aware adjustments
        context_flags = []
        
        # Check for negation (reduces toxicity score)
        negation_patterns = [
            r'\bnot\b', r'\bno\b', r'\bnever\b', r'\bneither\b',
            r'\bnor\b', r'\bwithout\b', r'\brefuse\b', r'\bdenounce\b'
        ]
        
        has_negation = any(re.search(p, text_lower) for p in negation_patterns)
        if has_negation and normalized_score > 0:
            context_flags.append("negation_detected")
            normalized_score *= 0.7  # Reduce score by 30%
        
        # Check for educational/reporting context
        educational_patterns = [
            r'\bexample of\b', r'\bquoting\b', r'\breporting\b',
            r'\bdiscussing\b', r'\bexplaining\b', r'\bhistorical\b'
        ]
        
        is_educational = any(re.search(p, text_lower) for p in educational_patterns)
        if is_educational and normalized_score > 0:
            context_flags.append("educational_context")
            normalized_score *= 0.5  # Reduce score by 50%
        
        # Check for excessive caps (increases score)
        caps_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
        if caps_ratio > 0.5 and len(text) > 10:
            context_flags.append("excessive_caps")
            normalized_score = min(normalized_score * 1.2, 1.0)
        
        # Determine detection threshold
        detected = normalized_score > 0.4
        
        return {
            'score': float(normalized_score),
            'detected': detected,
            'method': 'keyword',
            'categories': category_scores,
            'matched_keywords': all_matches[:10],  # Limit to first 10
            'total_matches': len(all_matches),
            'context_flags': context_flags,
            'details': {
                'categories_triggered': list(category_scores.keys()),
                'threshold': 0.4,
            }
        }
    
    def classify_multi_label(self, text: str, threshold: float = 0.3) -> Dict:
        """
        Multi-label classification for all toxicity categories
        
        Args:
            text: Text to classify
            threshold: Minimum score to consider a category positive
        
        Returns:
            {
                'labels': list of detected categories,
                'scores': dict of all category scores,
                'overall_score': maximum category score
            }
        """
        result = self.detect(text)
        
        # Get all category scores
        category_scores = result.get('categories', {})
        
        # Filter categories above threshold
        detected_labels = [
            cat for cat, score in category_scores.items()
            if score >= threshold
        ]
        
        # Overall score is the maximum category score
        overall_score = max(category_scores.values()) if category_scores else 0.0
        
        return {
            'labels': detected_labels,
            'scores': category_scores,
            'overall_score': overall_score,
            'method': result['method'],
        }


# Example usage
if __name__ == '__main__':
    from models.model_loader import get_model_loader
    
    print("=" * 60)
    print("Toxicity Detector Test")
    print("=" * 60)
    print()
    
    loader = get_model_loader()
    detector = ToxicityDetector(model_loader=loader)
    
    test_cases = [
        "Hello, how are you today?",
        "You are a stupid idiot and I hate you",
        "This is fucking terrible",
        "I want to hurt myself",
        "That's a great example of hate speech to avoid",
    ]
    
    for i, text in enumerate(test_cases, 1):
        print(f"Test {i}: {text[:50]}...")
        result = detector.detect(text)
        print(f"  Detected: {result['detected']}")
        print(f"  Score: {result['score']:.4f}")
        print(f"  Method: {result['method']}")
        if result.get('categories'):
            print(f"  Categories: {list(result['categories'].keys())}")
        print()
        
        # Multi-label classification
        multi_result = detector.classify_multi_label(text)
        if multi_result['labels']:
            print(f"  Multi-label: {multi_result['labels']}")
            print()
