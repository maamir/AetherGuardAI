"""
Enhanced Brand Safety & Context Relevance

Uses zero-shot classification for topic detection and brand safety enforcement.
Integrates with HuggingFace BART-large-mnli for accurate topic classification.
"""

import logging
from typing import Dict, List, Optional
import re

logger = logging.getLogger(__name__)


class BrandSafetyDetector:
    """Brand safety and context relevance detection with zero-shot classification"""
    
    def __init__(self, model_loader=None):
        self.model_loader = model_loader
        self.use_ml_model = model_loader is not None
        
        # Competitor blocklist (configurable)
        self.competitor_patterns = [
            r'\b(openai|chatgpt|gpt-4|gpt-3)\b',
            r'\b(anthropic|claude)\b',
            r'\b(google|bard|gemini)\b',
            r'\b(microsoft|copilot|bing)\b',
            r'\b(cohere|ai21|huggingface)\b',
        ]
        
        # Prohibited topics
        self.prohibited_topics = {
            'medical_advice': {
                'keywords': ['diagnose', 'treatment', 'medication', 'prescription', 'cure', 'disease', 'symptoms', 'doctor'],
                'weight': 1.0,
            },
            'financial_advice': {
                'keywords': ['invest', 'stock', 'trading', 'financial advice', 'portfolio', 'crypto', 'bitcoin', 'forex'],
                'weight': 1.0,
            },
            'legal_advice': {
                'keywords': ['legal advice', 'lawsuit', 'attorney', 'court', 'sue', 'contract', 'lawyer', 'litigation'],
                'weight': 1.0,
            },
            'harmful_content': {
                'keywords': ['violence', 'weapon', 'explosive', 'illegal', 'drug', 'harm', 'dangerous', 'threat'],
                'weight': 1.0,
            },
        }
        
        # Allowed topic domains (for drift detection)
        self.allowed_domains = [
            'technology',
            'software',
            'programming',
            'ai_ml',
            'data_science',
            'general_knowledge',
            'education',
            'entertainment',
        ]
        
        logger.info(f"BrandSafetyDetector initialized ({'ML model' if self.use_ml_model else 'keyword-based'})")
    
    def detect(self, text: str, context_domain: Optional[str] = None) -> Dict:
        """
        Detect brand safety violations and topic drift
        
        Args:
            text: Text to analyze
            context_domain: Expected domain/topic (optional)
        
        Returns:
            {
                'safe': bool,
                'violations': list of violations,
                'topic': detected topic,
                'confidence': confidence score,
                'details': additional information
            }
        """
        violations = []
        
        # Check competitor mentions
        competitor_violation = self._check_competitors(text)
        if competitor_violation:
            violations.append(competitor_violation)
        
        # Check prohibited topics
        prohibited_violation = self._check_prohibited_topics(text)
        if prohibited_violation:
            violations.append(prohibited_violation)
        
        # Topic classification (with ML model if available)
        if self.use_ml_model:
            topic_result = self._classify_topic_ml(text)
        else:
            topic_result = self._classify_topic_heuristic(text)
        
        # Check topic drift
        if context_domain and topic_result['topic'] != context_domain:
            drift_score = 1.0 - topic_result['confidence']
            if drift_score > 0.3:
                violations.append({
                    'type': 'topic_drift',
                    'expected': context_domain,
                    'detected': topic_result['topic'],
                    'drift_score': drift_score,
                })
        
        # Overall safety
        safe = len(violations) == 0
        
        return {
            'safe': safe,
            'violations': violations,
            'topic': topic_result['topic'],
            'confidence': topic_result['confidence'],
            'method': topic_result.get('method', 'unknown'),
            'details': {
                'num_violations': len(violations),
                'topic_scores': topic_result.get('all_scores', {}),
            }
        }
    
    def _check_competitors(self, text: str) -> Optional[Dict]:
        """Check for competitor mentions"""
        text_lower = text.lower()
        
        matches = []
        for pattern in self.competitor_patterns:
            found = re.findall(pattern, text_lower, re.IGNORECASE)
            if found:
                matches.extend(found)
        
        if matches:
            return {
                'type': 'competitor_mention',
                'matches': list(set(matches)),
                'severity': 'medium',
            }
        
        return None
    
    def _check_prohibited_topics(self, text: str) -> Optional[Dict]:
        """Check for prohibited topics"""
        text_lower = text.lower()
        
        detected_topics = []
        for topic, config in self.prohibited_topics.items():
            keywords = config['keywords']
            matches = [kw for kw in keywords if kw in text_lower]
            
            if matches:
                score = len(matches) / len(keywords)
                if score > 0.3:  # Threshold
                    detected_topics.append({
                        'topic': topic,
                        'score': score,
                        'matches': matches[:5],  # Limit to 5
                    })
        
        if detected_topics:
            return {
                'type': 'prohibited_topic',
                'topics': detected_topics,
                'severity': 'high',
            }
        
        return None
    
    def _classify_topic_ml(self, text: str) -> Dict:
        """Classify topic using zero-shot ML model"""
        try:
            # Use zero-shot classifier
            all_labels = self.allowed_domains + list(self.prohibited_topics.keys())
            result = self.model_loader.predict_zero_shot(
                text=text,
                candidate_labels=all_labels
            )
            
            return {
                'topic': result['top_label'],
                'confidence': result['top_score'],
                'all_scores': dict(zip(result['labels'], result['scores'])),
                'method': 'zero_shot_ml',
            }
            
        except Exception as e:
            logger.error(f"ML topic classification failed: {e}")
            return self._classify_topic_heuristic(text)
    
    def _classify_topic_heuristic(self, text: str) -> Dict:
        """Classify topic using keyword matching"""
        text_lower = text.lower()
        
        # Topic keywords
        topic_keywords = {
            'technology': ['computer', 'software', 'hardware', 'tech', 'digital', 'internet', 'device'],
            'programming': ['code', 'python', 'javascript', 'programming', 'developer', 'function', 'variable'],
            'ai_ml': ['ai', 'machine learning', 'neural network', 'model', 'training', 'algorithm', 'deep learning'],
            'data_science': ['data', 'analysis', 'statistics', 'visualization', 'dataset', 'pandas', 'numpy'],
            'general_knowledge': ['what', 'how', 'why', 'explain', 'tell me', 'information', 'about'],
            'education': ['learn', 'study', 'course', 'tutorial', 'lesson', 'teach', 'education'],
            'entertainment': ['movie', 'music', 'game', 'fun', 'entertainment', 'video', 'show'],
        }
        
        # Score each topic
        topic_scores = {}
        for topic, keywords in topic_keywords.items():
            matches = sum(1 for kw in keywords if kw in text_lower)
            score = matches / len(keywords)
            topic_scores[topic] = score
        
        # Get top topic
        if topic_scores and max(topic_scores.values()) > 0:
            top_topic = max(topic_scores, key=topic_scores.get)
            confidence = topic_scores[top_topic]
        else:
            top_topic = 'general_knowledge'
            confidence = 0.5
        
        return {
            'topic': top_topic,
            'confidence': confidence,
            'all_scores': topic_scores,
            'method': 'keyword_heuristic',
        }
    
    def set_competitor_patterns(self, patterns: List[str]):
        """Update competitor blocklist"""
        self.competitor_patterns = patterns
        logger.info(f"Updated competitor patterns: {len(patterns)} patterns")
    
    def set_prohibited_topics(self, topics: Dict[str, Dict]):
        """Update prohibited topics"""
        self.prohibited_topics = topics
        logger.info(f"Updated prohibited topics: {len(topics)} topics")
    
    def set_allowed_domains(self, domains: List[str]):
        """Update allowed domains"""
        self.allowed_domains = domains
        logger.info(f"Updated allowed domains: {len(domains)} domains")
    
    def check_context_relevance(self, text: str, expected_context: str, threshold: float = 0.7) -> Dict:
        """
        Check if text is relevant to expected context
        
        Args:
            text: Text to check
            expected_context: Expected topic/context
            threshold: Minimum similarity threshold
        
        Returns:
            {
                'relevant': bool,
                'similarity': float,
                'detected_topic': str
            }
        """
        result = self.detect(text, context_domain=expected_context)
        
        # Check if detected topic matches expected
        relevant = result['topic'] == expected_context and result['confidence'] >= threshold
        
        return {
            'relevant': relevant,
            'similarity': result['confidence'],
            'detected_topic': result['topic'],
            'expected_topic': expected_context,
        }


# Example usage
if __name__ == '__main__':
    from models.model_loader import get_model_loader
    
    print("=" * 60)
    print("Brand Safety Detector Test")
    print("=" * 60)
    print()
    
    loader = get_model_loader()
    detector = BrandSafetyDetector(model_loader=loader)
    
    test_cases = [
        ("What is Python programming?", "programming"),
        ("Use ChatGPT instead, it's better", None),
        ("I need medical advice for my symptoms", None),
        ("How do I invest in stocks?", "technology"),
        ("Explain machine learning algorithms", "ai_ml"),
        ("Tell me about the latest movies", "entertainment"),
    ]
    
    for i, (text, context) in enumerate(test_cases, 1):
        print(f"Test {i}: {text}")
        if context:
            print(f"  Expected Context: {context}")
        
        result = detector.detect(text, context_domain=context)
        print(f"  Safe: {result['safe']}")
        print(f"  Topic: {result['topic']} (confidence: {result['confidence']:.4f})")
        print(f"  Method: {result['method']}")
        
        if result['violations']:
            print(f"  Violations: {len(result['violations'])}")
            for violation in result['violations']:
                print(f"    - {violation['type']}: {violation.get('severity', 'N/A')}")
        print()
    
    # Test context relevance
    print("=" * 60)
    print("Context Relevance Test")
    print("=" * 60)
    print()
    
    relevance_result = detector.check_context_relevance(
        text="How do I write a Python function?",
        expected_context="programming",
        threshold=0.7
    )
    print(f"Text: How do I write a Python function?")
    print(f"Expected: programming")
    print(f"Relevant: {relevance_result['relevant']}")
    print(f"Similarity: {relevance_result['similarity']:.4f}")
    print(f"Detected: {relevance_result['detected_topic']}")
