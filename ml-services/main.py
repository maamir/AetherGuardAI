from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import logging

app = FastAPI(title="AetherGuard ML Services")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import model loader
from models.model_loader import get_model_loader, initialize_models

# Import detection modules
from detectors.injection import InjectionDetector
from detectors.toxicity import ToxicityDetector
from detectors.pii import PIIDetector
from detectors.bias import BiasDetector
from detectors.hallucination import HallucinationDetector
from detectors.brand_safety import BrandSafetyChecker
from detectors.secrets import SecretsDetector
from detectors.watermark import WatermarkEngine
from detectors.model_integrity import ModelIntegrityChecker
from detectors.dos_protection import DoSProtector
from detectors.adversarial import AdversarialDefense

# Initialize model loader
model_loader = get_model_loader()

# Initialize detectors (will be set after models load)
injection_detector = None
toxicity_detector = None
pii_detector = None
bias_detector = BiasDetector()
hallucination_detector = None
brand_safety_checker = BrandSafetyChecker()
secrets_detector = SecretsDetector()
watermark_engine = WatermarkEngine()
model_integrity_checker = ModelIntegrityChecker()
dos_protector = DoSProtector()
adversarial_defense = AdversarialDefense()

@app.on_event("startup")
async def startup_event():
    """Load all ML models at startup"""
    global injection_detector, toxicity_detector, pii_detector, hallucination_detector
    
    logger.info("Starting AetherGuard ML Services...")
    
    # Load all models
    results = initialize_models()
    
    # Initialize detectors with loaded models
    injection_detector = InjectionDetector(model_loader)
    toxicity_detector = ToxicityDetector(model_loader)
    pii_detector = PIIDetector(model_loader)
    hallucination_detector = HallucinationDetector(model_loader)
    
    logger.info("✅ AetherGuard ML Services ready!")

class TextRequest(BaseModel):
    text: str

class InjectionResponse(BaseModel):
    score: float
    detected: bool
    details: Dict

class ToxicityResponse(BaseModel):
    score: float
    labels: Dict[str, float]

class PIIResponse(BaseModel):
    entities: List[Dict]
    redacted_text: str

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/detect/injection", response_model=InjectionResponse)
async def detect_injection(request: TextRequest):
    """Detect prompt injection using Llama Guard"""
    try:
        result = injection_detector.detect(request.text)
        return result
    except Exception as e:
        logger.error(f"Injection detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/toxicity", response_model=ToxicityResponse)
async def detect_toxicity(request: TextRequest):
    """Detect HAP/toxicity using Granite Guardian"""
    try:
        result = toxicity_detector.detect(request.text)
        return result
    except Exception as e:
        logger.error(f"Toxicity detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/pii", response_model=PIIResponse)
async def detect_pii(request: TextRequest):
    """Detect and redact PII using Microsoft Presidio"""
    try:
        result = pii_detector.detect_and_redact(request.text)
        return result
    except Exception as e:
        logger.error(f"PII detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BiasRequest(BaseModel):
    outputs: List[str]
    metadata: List[Dict]

class HallucinationRequest(BaseModel):
    output: str
    context_docs: List[str] = []
    rag_enabled: bool = False

class BrandSafetyRequest(BaseModel):
    text: str
    allowed_categories: List[str]
    custom_blocklist: List[str] = []

class WatermarkRequest(BaseModel):
    text: str
    model_id: str
    request_id: str

class WatermarkDetectRequest(BaseModel):
    text: str

@app.post("/detect/bias")
async def detect_bias(request: BiasRequest):
    """Detect bias using IBM AIF360"""
    try:
        result = bias_detector.analyze_bias(request.outputs, request.metadata)
        return result
    except Exception as e:
        logger.error(f"Bias detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/hallucination")
async def detect_hallucination(request: HallucinationRequest):
    """Detect hallucination using NLI and RAG grounding"""
    try:
        result = hallucination_detector.detect(
            request.output,
            request.context_docs if request.context_docs else None,
            request.rag_enabled
        )
        return result
    except Exception as e:
        logger.error(f"Hallucination detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/brand-safety")
async def check_brand_safety(request: BrandSafetyRequest):
    """Check brand safety and context relevance"""
    try:
        result = brand_safety_checker.check(
            request.text,
            request.allowed_categories,
            request.custom_blocklist if request.custom_blocklist else None
        )
        return result
    except Exception as e:
        logger.error(f"Brand safety check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/secrets")
async def detect_secrets(request: TextRequest):
    """Detect secrets using TruffleHog and Gitleaks patterns"""
    try:
        result = secrets_detector.detect(request.text)
        return result
    except Exception as e:
        logger.error(f"Secrets detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/watermark/embed")
async def embed_watermark(request: WatermarkRequest):
    """Embed watermark in generated text"""
    try:
        result = watermark_engine.embed_watermark(
            request.text,
            request.model_id,
            request.request_id
        )
        return result
    except Exception as e:
        logger.error(f"Watermark embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/watermark/detect")
async def detect_watermark(request: WatermarkDetectRequest):
    """Detect watermark in text"""
    try:
        result = watermark_engine.detect_watermark(request.text)
        return result
    except Exception as e:
        logger.error(f"Watermark detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class TrainingDataRequest(BaseModel):
    batch_data: List[List[float]]
    batch_labels: List[int]

class GradientAggregationRequest(BaseModel):
    gradients: List[List[float]]
    num_byzantine: int = None
    method: str = "krum"

class BackdoorDetectionRequest(BaseModel):
    model_weights: Dict[str, List]
    probe_inputs: List[List[float]] = None

class DPNoiseRequest(BaseModel):
    gradients: List[List[float]]
    sensitivity: float = 1.0

@app.post("/integrity/validate-training-data")
async def validate_training_data(request: TrainingDataRequest):
    """
    Validate training data for poisoning attacks
    Uses differential privacy and anomaly detection
    """
    try:
        import numpy as np
        batch_data = np.array(request.batch_data)
        batch_labels = np.array(request.batch_labels)
        
        result = model_integrity_checker.validate_training_data(batch_data, batch_labels)
        return result
    except Exception as e:
        logger.error(f"Training data validation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/integrity/aggregate-gradients")
async def aggregate_gradients(request: GradientAggregationRequest):
    """
    Byzantine-resilient gradient aggregation using Krum algorithm
    Reduces attack success from 75% to <5%
    """
    try:
        import numpy as np
        gradients = [np.array(g) for g in request.gradients]
        
        result = model_integrity_checker.byzantine_resilient_aggregation(
            gradients,
            num_byzantine=request.num_byzantine,
            method=request.method
        )
        return result
    except Exception as e:
        logger.error(f"Gradient aggregation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/integrity/detect-backdoor")
async def detect_backdoor(request: BackdoorDetectionRequest):
    """
    Post-training backdoor detection via outlier activation analysis
    Detects trojan neurons with high precision
    """
    try:
        import numpy as np
        
        # Convert model weights to numpy arrays
        model_weights = {
            layer: np.array(weights) 
            for layer, weights in request.model_weights.items()
        }
        
        probe_inputs = np.array(request.probe_inputs) if request.probe_inputs else None
        
        result = model_integrity_checker.detect_backdoor(model_weights, probe_inputs)
        return result
    except Exception as e:
        logger.error(f"Backdoor detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/integrity/apply-dp-noise")
async def apply_dp_noise(request: DPNoiseRequest):
    """
    Apply differential privacy noise to gradients (DP-SGD)
    Privacy guarantee: (ε, δ)-DP with ε ≤ 8
    """
    try:
        import numpy as np
        gradients = np.array(request.gradients)
        
        noisy_gradients = model_integrity_checker.apply_dp_noise(
            gradients,
            sensitivity=request.sensitivity
        )
        
        return {
            "noisy_gradients": noisy_gradients.tolist(),
            "dp_epsilon": model_integrity_checker.dp_epsilon,
            "dp_delta": model_integrity_checker.dp_delta,
            "noise_applied": True
        }
    except Exception as e:
        logger.error(f"DP noise application error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class DoSCheckRequest(BaseModel):
    text: str
    requested_tokens: int = None

class AdversarialCheckRequest(BaseModel):
    text: str

@app.post("/detect/dos")
async def check_dos(request: DoSCheckRequest):
    """
    Check for DoS attack patterns
    Detects complexity and runaway generation attempts
    """
    try:
        # Check complexity and token budget
        result = dos_protector.check_request(request.text, request.requested_tokens)
        
        # Check for runaway patterns
        runaway_result = dos_protector.detect_runaway_patterns(request.text)
        result["runaway_patterns"] = runaway_result
        
        return result
    except Exception as e:
        logger.error(f"DoS check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/adversarial")
async def check_adversarial(request: AdversarialCheckRequest):
    """
    Detect and normalize adversarial inputs
    Handles homoglyphs, invisible characters, etc.
    """
    try:
        result = adversarial_defense.detect_and_normalize(request.text)
        
        # Also check for markdown injection
        markdown_result = adversarial_defense.detect_markdown_injection(request.text)
        result["markdown_injection"] = markdown_result
        
        return result
    except Exception as e:
        logger.error(f"Adversarial check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sanitize/input")
async def sanitize_input(request: TextRequest):
    """
    Comprehensive input sanitization
    Removes all adversarial patterns
    """
    try:
        sanitized_text = adversarial_defense.sanitize_input(request.text)
        
        return {
            "original_text": request.text,
            "sanitized_text": sanitized_text,
            "changes_made": request.text != sanitized_text,
            "original_length": len(request.text),
            "sanitized_length": len(sanitized_text)
        }
    except Exception as e:
        logger.error(f"Input sanitization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CustomRecognizerRequest(BaseModel):
    name: str
    pattern: str
    description: str = ""

@app.post("/pii/add-recognizer")
async def add_custom_pii_recognizer(request: CustomRecognizerRequest):
    """
    Add a custom PII recognizer for domain-specific identifiers
    """
    try:
        pii_detector.add_custom_recognizer(
            request.name,
            request.pattern,
            request.description
        )
        
        return {
            "success": True,
            "message": f"Custom recognizer '{request.name}' added",
            "recognizer": {
                "name": request.name,
                "pattern": request.pattern,
                "description": request.description
            }
        }
    except Exception as e:
        logger.error(f"Add custom recognizer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pii/recognizers")
async def get_custom_recognizers():
    """
    Get list of all custom PII recognizers
    """
    try:
        recognizers = pii_detector.get_custom_recognizers()
        return {
            "recognizers": recognizers,
            "count": len(recognizers)
        }
    except Exception as e:
        logger.error(f"Get recognizers error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdatePatternsRequest(BaseModel):
    patterns: Dict[str, str]
    version: str = None

@app.post("/secrets/update-patterns")
async def update_secrets_patterns(request: UpdatePatternsRequest):
    """
    Update secrets detection patterns (bi-weekly updates)
    """
    try:
        secrets_detector.update_patterns(request.patterns, request.version)
        
        return {
            "success": True,
            "message": "Secrets patterns updated",
            "info": secrets_detector.get_pattern_info()
        }
    except Exception as e:
        logger.error(f"Update patterns error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/secrets/pattern-info")
async def get_pattern_info():
    """
    Get information about current secrets pattern library
    """
    try:
        return secrets_detector.get_pattern_info()
    except Exception as e:
        logger.error(f"Get pattern info error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/secrets/check-update")
async def check_pattern_update():
    """
    Check if pattern update is needed (bi-weekly schedule)
    """
    try:
        update_needed = secrets_detector.check_update_needed()
        info = secrets_detector.get_pattern_info()
        
        return {
            "update_needed": update_needed,
            "info": info,
            "recommendation": "Update patterns from security intelligence feed" if update_needed else "Patterns are up to date"
        }
    except Exception as e:
        logger.error(f"Check update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
