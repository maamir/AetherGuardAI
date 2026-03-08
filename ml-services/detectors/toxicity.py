import logging
from typing import Dict
import torch

logger = logging.getLogger(__name__)

class ToxicityDetector:
    """HAP & Toxicity detection using IBM Granite Guardian"""
    
    def __init__(self, model_loader=None):
        self.model_loader = model_loader
        self.model = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        self.categories = [
            "hate",
            "harassment", 
            "violence",
            "sexual",
            "self_harm"
        ]
        
        if model_loader and model_loader.is_loaded('granite_guardian'):
            model_data = model_loader.get_model('granite_guardian')
            self.model = model_data['model'].to(self.device)
            self.tokenizer = model_data['tokenizer']
            self.is_fallback = model_data.get('fallback', False)
            logger.info(f"ToxicityDetector initialized with {'fallback' if self.is_fallback else 'Granite Guardian'} model on {self.device}")
        else:
            logger.info("ToxicityDetector initialized (heuristic mode)")
        
    def detect(self, text: str) -> Dict:
        """
        Multi-label HAP classification
        Returns: {score: float, labels: dict}
        """
        if self.model and self.tokenizer:
            return self._detect_with_model(text)
        
        return self._detect_heuristic(text)
    
    def _detect_with_model(self, text: str) -> Dict:
        """Use actual ML model for detection"""
        try:
            # Tokenize input
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=512,
                padding=True
            ).to(self.device)
            
            # Get model prediction
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.sigmoid(logits)  # Multi-label classification
                
                # Map to categories (adjust based on actual model output)
                scores = {}
                if probs.shape[1] >= len(self.categories):
                    for i, category in enumerate(self.categories):
                        scores[category] = float(probs[0][i].item())
                else:
                    # Fallback: use single score for all categories
                    overall_score = float(probs[0][0].item())
                    scores = {cat: overall_score for cat in self.categories}
            
            max_score = max(scores.values()) if scores else 0.0
            
            return {
                "score": max_score,
                "labels": scores,
                "method": "granite_guardian" if not self.is_fallback else "fallback_model",
                "device": self.device
            }
            
        except Exception as e:
            logger.error(f"Model inference error: {e}")
            return self._detect_heuristic(text)
    
    def _detect_heuristic(self, text: str) -> Dict:
        """Enhanced keyword-based heuristic with comprehensive patterns"""
        text_lower = text.lower()
        
        # Comprehensive keyword lists for each category
        toxic_keywords = {
            "hate": [
                # Slurs and hate speech
                "hate", "racist", "bigot", "nazi", "supremacist",
                "xenophob", "antisemit", "islamophob",
                # Derogatory terms (general patterns)
                "inferior", "subhuman", "vermin", "scum",
                "degenerate", "filth", "trash",
                # Discriminatory language
                "discriminat", "prejudice", "intoleran",
                # Group-based hatred
                "ethnic cleansing", "genocide", "purge",
                "exterminate", "eradicate"
            ],
            
            "harassment": [
                # Direct harassment
                "harass", "bully", "intimidat", "threaten",
                "stalk", "doxx", "dox", "swat",
                # Verbal abuse
                "insult", "mock", "ridicule", "humiliat",
                "degrad", "belittle", "demean",
                # Threats
                "i'll find you", "watch your back", "you're dead",
                "i know where you live", "i'll get you",
                # Cyberbullying
                "kill yourself", "kys", "end yourself",
                "nobody likes you", "everyone hates you",
                # Persistent unwanted contact
                "won't leave you alone", "keep bothering",
                "won't stop until"
            ],
            
            "violence": [
                # Physical violence
                "kill", "murder", "assassinat", "slaughter",
                "massacre", "butcher", "execute",
                # Harm and injury
                "hurt", "harm", "injure", "wound", "maim",
                "torture", "beat", "assault", "attack",
                # Weapons
                "shoot", "stab", "bomb", "explode",
                "gun", "knife", "weapon", "firearm",
                # Violent acts
                "punch", "kick", "strangle", "choke",
                "rape", "molest", "abuse",
                # Threats of violence
                "i'll kill", "i'll hurt", "i'll attack",
                "violence", "violent", "brutal",
                # War/conflict
                "war crime", "genocide", "ethnic cleansing",
                "terrorism", "terrorist attack"
            ],
            
            "sexual": [
                # Explicit content
                "explicit", "nsfw", "xxx", "porn",
                "pornograph", "obscene", "lewd",
                # Sexual acts (clinical terms for detection)
                "sexual content", "sexual act", "intercourse",
                "masturbat", "orgasm", "ejaculat",
                # Inappropriate requests
                "send nudes", "show me", "take off",
                "strip", "undress",
                # Sexual harassment
                "sexual harass", "unwanted advance",
                "inappropriate touch", "grope", "fondle",
                # Exploitation
                "sexual exploit", "sex traffick",
                "child abuse", "pedophil", "minor"
            ],
            
            "self_harm": [
                # Suicide
                "suicide", "suicidal", "kill myself",
                "end my life", "take my life", "die",
                "want to die", "wish i was dead",
                # Self-injury
                "self-harm", "self harm", "cut myself",
                "hurt myself", "injure myself",
                "self-injur", "self-destruct",
                # Methods
                "overdose", "hang myself", "jump off",
                "slit my wrists", "pills",
                # Ideation
                "better off dead", "no reason to live",
                "can't go on", "end it all",
                # Eating disorders
                "starve myself", "purge", "anorex",
                "bulimi", "eating disorder"
            ]
        }
        
        # Calculate scores for each category
        scores = {}
        matched_keywords = {}
        
        for category, keywords in toxic_keywords.items():
            matches = [kw for kw in keywords if kw in text_lower]
            matched_keywords[category] = matches
            
            if matches:
                # Score based on number of matches and keyword strength
                base_score = len(matches) / len(keywords)
                
                # Boost score if multiple different keywords match
                unique_match_bonus = min(len(set(matches)) * 0.1, 0.3)
                
                # Boost score for exact phrase matches
                exact_match_bonus = 0.0
                for match in matches:
                    if f" {match} " in f" {text_lower} ":
                        exact_match_bonus += 0.05
                
                final_score = min(base_score + unique_match_bonus + exact_match_bonus, 1.0)
                scores[category] = final_score
            else:
                scores[category] = 0.0
        
        # Additional context-based scoring
        context_modifiers = {
            "negation": ["not", "don't", "doesn't", "never", "no"],
            "hypothetical": ["if", "would", "could", "might", "imagine"],
            "educational": ["learn about", "understand", "explain", "definition"],
            "reporting": ["reported", "news", "article", "according to"]
        }
        
        # Check for context that might reduce toxicity score
        context_flags = []
        for context_type, keywords in context_modifiers.items():
            if any(kw in text_lower for kw in keywords):
                context_flags.append(context_type)
        
        # Reduce scores if educational or reporting context
        if "educational" in context_flags or "reporting" in context_flags:
            scores = {k: v * 0.7 for k, v in scores.items()}
        
        # Calculate overall toxicity score
        max_score = max(scores.values()) if scores else 0.0
        
        # Calculate weighted average for overall score
        weights = {
            "hate": 1.5,
            "harassment": 1.3,
            "violence": 1.5,
            "sexual": 1.2,
            "self_harm": 1.8  # Highest weight for self-harm
        }
        
        weighted_sum = sum(scores[cat] * weights.get(cat, 1.0) for cat in scores)
        weighted_avg = weighted_sum / sum(weights.values())
        
        return {
            "score": float(max(max_score, weighted_avg)),
            "labels": scores,
            "method": "enhanced_heuristic",
            "details": {
                "matched_keywords": {k: v[:5] for k, v in matched_keywords.items() if v},  # Limit to 5 per category
                "context_flags": context_flags,
                "weighted_average": float(weighted_avg),
                "max_category": max(scores.items(), key=lambda x: x[1])[0] if scores else None
            }
        }
