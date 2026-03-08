import logging
from typing import Dict, List, Optional
import numpy as np
import torch

logger = logging.getLogger(__name__)

class HallucinationDetector:
    """Three-tier hallucination detection: NLI, RAG grounding, self-consistency"""
    
    def __init__(self, model_loader=None):
        self.model = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        if model_loader and model_loader.is_loaded('deberta_nli'):
            model_data = model_loader.get_model('deberta_nli')
            self.model = model_data['model'].to(self.device)
            self.tokenizer = model_data['tokenizer']
            self.is_fallback = model_data.get('fallback', False)
            logger.info(f"HallucinationDetector initialized with {'fallback' if self.is_fallback else 'DeBERTa'} NLI model on {self.device}")
        else:
            logger.info("HallucinationDetector initialized (heuristic mode)")
        
        # TODO: Initialize Pinecone for RAG grounding
        # import pinecone
        # pinecone.init(api_key=os.getenv("PINECONE_API_KEY"))
        # self.index = pinecone.Index("aetherguard-rag")
        
    def detect(
        self, 
        output: str, 
        context_docs: Optional[List[str]] = None,
        rag_enabled: bool = False
    ) -> Dict:
        """
        Three-tier hallucination detection
        Returns: {hallucination_detected: bool, confidence: float, method: str, details: dict}
        """
        results = {
            "hallucination_detected": False,
            "confidence": 0.0,
            "methods_used": [],
            "details": {}
        }
        
        # Tier 1: NLI Contradiction Detection
        if context_docs:
            nli_result = self._nli_contradiction_check(output, context_docs)
            results["methods_used"].append("nli")
            results["details"]["nli"] = nli_result
            if nli_result["contradiction_detected"]:
                results["hallucination_detected"] = True
                results["confidence"] = max(results["confidence"], nli_result["confidence"])
        
        # Tier 2: RAG Grounding Validation
        if rag_enabled:
            rag_result = self._rag_grounding_check(output)
            results["methods_used"].append("rag")
            results["details"]["rag"] = rag_result
            if rag_result["similarity"] < 0.85:
                results["hallucination_detected"] = True
                results["confidence"] = max(results["confidence"], 1.0 - rag_result["similarity"])
        
        # Tier 3: Self-Consistency Check (for high-stakes outputs)
        # TODO: Implement multi-sample consistency verification
        
        return results
    
    def _nli_contradiction_check(self, output: str, context_docs: List[str]) -> Dict:
        """
        Use NLI model to detect contradictions between output and context
        """
        if self.model and self.tokenizer:
            return self._nli_with_model(output, context_docs)
        
        return self._nli_heuristic(output, context_docs)
    
    def _nli_with_model(self, output: str, context_docs: List[str]) -> Dict:
        """Use DeBERTa NLI model for contradiction detection"""
        try:
            contradiction_scores = []
            
            for doc in context_docs:
                # Format as NLI pair: premise (doc) and hypothesis (output)
                inputs = self.tokenizer(
                    doc,
                    output,
                    return_tensors="pt",
                    truncation=True,
                    max_length=512,
                    padding=True
                ).to(self.device)
                
                with torch.no_grad():
                    outputs = self.model(**inputs)
                    logits = outputs.logits
                    probs = torch.softmax(logits, dim=-1)
                    
                    # DeBERTa NLI: [contradiction, neutral, entailment]
                    # Index 0 is contradiction
                    contradiction_score = float(probs[0][0].item())
                    contradiction_scores.append(contradiction_score)
            
            max_contradiction = max(contradiction_scores) if contradiction_scores else 0.0
            
            return {
                "contradiction_detected": max_contradiction > 0.7,
                "confidence": max_contradiction,
                "num_docs_checked": len(context_docs),
                "method": "deberta_nli" if not self.is_fallback else "fallback_nli"
            }
            
        except Exception as e:
            logger.error(f"NLI model error: {e}")
            return self._nli_heuristic(output, context_docs)
    
    def _nli_heuristic(self, output: str, context_docs: List[str]) -> Dict:
        """Heuristic contradiction detection (fallback)"""
        # Simple keyword overlap check
        output_words = set(output.lower().split())
        
        contradiction_scores = []
        for doc in context_docs:
            doc_words = set(doc.lower().split())
            overlap = len(output_words & doc_words) / len(output_words) if output_words else 0
            # Low overlap might indicate contradiction
            contradiction_score = 1.0 - overlap
            contradiction_scores.append(contradiction_score)
        
        max_contradiction = max(contradiction_scores) if contradiction_scores else 0.0
        
        return {
            "contradiction_detected": max_contradiction > 0.7,
            "confidence": max_contradiction,
            "num_docs_checked": len(context_docs),
            "method": "heuristic"
        }
    
    def _rag_grounding_check(self, output: str) -> Dict:
        """
        Validate RAG grounding via cosine similarity with retrieved chunks
        Threshold: >0.85 for grounded outputs
        """
        # TODO: Implement actual Pinecone vector search
        # 1. Embed the output
        # 2. Query Pinecone for similar chunks
        # 3. Compute cosine similarity
        
        # Mock implementation
        similarity_score = 0.92  # Replace with actual similarity computation
        
        return {
            "similarity": similarity_score,
            "grounded": similarity_score > 0.85,
            "top_k_sources": [],  # TODO: Return actual source chunks
            "method": "rag_grounding"
        }
    
    def self_consistency_check(self, outputs: List[str]) -> Dict:
        """
        Cross-verify multiple outputs for consistency (high-stakes scenarios)
        """
        # TODO: Implement consistency scoring across multiple generations
        # Compare semantic similarity between outputs
        
        return {
            "consistent": True,
            "consistency_score": 0.95,
            "num_samples": len(outputs)
        }
