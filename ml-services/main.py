from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Optional
import logging
import time
import uuid

app = FastAPI(title="AetherGuard ML Services")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import async database functions
from async_database import (
    get_database_manager, 
    log_detection_event, 
    log_model_integrity_event, 
    log_watermark_event
)

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
    """Load all ML models and initialize database at startup"""
    global injection_detector, toxicity_detector, pii_detector, hallucination_detector
    
    logger.info("Starting AetherGuard ML Services...")
    
    # Initialize database connection
    db = await get_database_manager()
    if db.is_connected:
        logger.info("✅ Database connection established")
    else:
        logger.warning("⚠️ Database connection failed - running without logging")
    
    # Load all models
    results = initialize_models()
    
    # Initialize detectors with loaded models
    injection_detector = InjectionDetector(model_loader)
    toxicity_detector = ToxicityDetector(model_loader)
    pii_detector = PIIDetector(model_loader)
    hallucination_detector = HallucinationDetector(model_loader)
    
    logger.info("✅ AetherGuard ML Services ready!")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up database connections on shutdown"""
    db = await get_database_manager()
    await db.close()
    logger.info("ML Services shutdown complete")

class TextRequest(BaseModel):
    text: str
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

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
async def detect_injection(request: TextRequest, http_request: Request):
    """Detect prompt injection using Llama Guard"""
    start_time = time.time()
    
    try:
        result = injection_detector.detect(request.text)
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Log detection event to database
        if request.tenant_id:
            await log_detection_event(
                tenant_id=request.tenant_id,
                detection_type="injection",
                detected=result["detected"],
                confidence=result["score"],
                text_length=len(request.text),
                method=result.get("method", "unknown"),
                model_name=result.get("details", {}).get("model"),
                processing_time_ms=processing_time_ms,
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4()),
                source_ip=http_request.client.host if http_request.client else None,
                user_agent=http_request.headers.get("user-agent")
            )
        
        return result
    except Exception as e:
        logger.error(f"Injection detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/toxicity", response_model=ToxicityResponse)
async def detect_toxicity(request: TextRequest, http_request: Request):
    """Detect HAP/toxicity using Granite Guardian"""
    start_time = time.time()
    
    try:
        result = toxicity_detector.detect(request.text)
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Determine if toxic content was detected
        detected = result["score"] > 0.5  # Threshold for toxicity
        
        # Log detection event to database
        if request.tenant_id:
            await log_detection_event(
                tenant_id=request.tenant_id,
                detection_type="toxicity",
                detected=detected,
                confidence=result["score"],
                text_length=len(request.text),
                method=result.get("method", "unknown"),
                model_name="granite_guardian" if result.get("method") == "granite_guardian" else None,
                processing_time_ms=processing_time_ms,
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4()),
                source_ip=http_request.client.host if http_request.client else None,
                user_agent=http_request.headers.get("user-agent")
            )
        
        return result
    except Exception as e:
        logger.error(f"Toxicity detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/pii", response_model=PIIResponse)
async def detect_pii(request: TextRequest, http_request: Request):
    """Detect and redact PII using Microsoft Presidio"""
    start_time = time.time()
    
    try:
        result = pii_detector.detect_and_redact(request.text)
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Determine if PII was detected
        detected = len(result["entities"]) > 0
        
        # Calculate confidence based on entity scores
        confidence = 0.0
        if detected:
            scores = [entity.get("score", 1.0) for entity in result["entities"]]
            confidence = sum(scores) / len(scores) if scores else 0.0
        
        # Log detection event to database
        if request.tenant_id:
            await log_detection_event(
                tenant_id=request.tenant_id,
                detection_type="pii",
                detected=detected,
                confidence=confidence,
                text_length=len(request.text),
                method=result.get("method", "unknown"),
                model_name="presidio" if result.get("method") == "presidio" else None,
                processing_time_ms=processing_time_ms,
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4()),
                source_ip=http_request.client.host if http_request.client else None,
                user_agent=http_request.headers.get("user-agent")
            )
        
        return result
    except Exception as e:
        logger.error(f"PII detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BiasRequest(BaseModel):
    outputs: List[str]
    metadata: List[Dict]
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

class HallucinationRequest(BaseModel):
    output: str
    context_docs: List[str] = []
    rag_enabled: bool = False
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

class BrandSafetyRequest(BaseModel):
    text: str
    allowed_categories: List[str]
    custom_blocklist: List[str] = []
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

class WatermarkRequest(BaseModel):
    text: str
    model_id: str
    request_id: str
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None

class WatermarkDetectRequest(BaseModel):
    text: str
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

@app.post("/detect/bias")
async def detect_bias(request: BiasRequest):
    """Detect bias using IBM AIF360 or language-based detection"""
    try:
        # If only one output and no meaningful metadata, use language-based detection
        has_meaningful_metadata = (
            request.metadata and 
            len(request.metadata) > 0 and 
            any(bool(meta) and any(v for v in meta.values() if v) for meta in request.metadata)
        )
        
        if len(request.outputs) == 1 and not has_meaningful_metadata:
            # Single text bias detection using pattern matching
            language_result = bias_detector.detect_biased_language(request.outputs[0])
            
            # Convert to format expected by proxy-engine
            return {
                "bias_detected": language_result.get("biased_language_detected", False),
                "overall_bias_score": language_result.get("bias_score", 0.0),
                "method": "language_pattern_matching",
                "details": {
                    "categories": language_result.get("categories", {}),
                    "patterns_detected": language_result.get("patterns_detected", {}),
                    "total_terms": language_result.get("total_terms", 0),
                    "total_patterns": language_result.get("total_patterns", 0),
                    "suggestions": language_result.get("suggestions", {})
                },
                "flagged_for_review": language_result.get("bias_score", 0.0) > 0.4
            }
        else:
            # Multi-output analysis with demographic metadata
            result = bias_detector.analyze_bias(request.outputs, request.metadata)
            return result
    except Exception as e:
        logger.error(f"Bias detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/hallucination")
async def detect_hallucination(request: HallucinationRequest, http_request: Request):
    """Detect hallucination using NLI and RAG grounding"""
    start_time = time.time()
    
    try:
        result = hallucination_detector.detect(
            request.output,
            request.context_docs if request.context_docs else None,
            request.rag_enabled
        )
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Log detection event to database
        if request.tenant_id:
            await log_detection_event(
                tenant_id=request.tenant_id,
                detection_type="hallucination",
                detected=result.get("hallucination_detected", False),
                confidence=result.get("confidence", 0.0),
                text_length=len(request.output),
                method=result.get("method", "nli"),
                model_name="deberta-large-mnli",
                processing_time_ms=processing_time_ms,
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4()),
                source_ip=http_request.client.host if http_request.client else None,
                user_agent=http_request.headers.get("user-agent")
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
async def detect_secrets(request: TextRequest, http_request: Request):
    """Detect secrets using TruffleHog and Gitleaks patterns"""
    start_time = time.time()
    
    try:
        result = secrets_detector.detect(request.text)
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Determine if secrets were detected
        detected = result.get("detected", False)
        confidence = result.get("confidence", 0.0)
        
        # Log detection event to database
        if request.tenant_id:
            await log_detection_event(
                tenant_id=request.tenant_id,
                detection_type="secrets",
                detected=detected,
                confidence=confidence,
                text_length=len(request.text),
                method="pattern_matching",
                model_name="trufflehog_patterns",
                processing_time_ms=processing_time_ms,
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4()),
                source_ip=http_request.client.host if http_request.client else None,
                user_agent=http_request.headers.get("user-agent")
            )
        
        return result
    except Exception as e:
        logger.error(f"Secrets detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/watermark/embed")
async def embed_watermark(request: WatermarkRequest, http_request: Request):
    """Embed watermark in generated text"""
    try:
        result = watermark_engine.embed_watermark(
            request.text,
            request.model_id,
            request.request_id
        )
        
        # Log watermark embedding event
        if request.tenant_id:
            await log_watermark_event(
                tenant_id=request.tenant_id,
                action="embed",
                detected=False,  # Not applicable for embedding
                watermark_type="text",
                api_key_id=request.api_key_id,
                request_id=request.request_id
            )
        
        return result
    except Exception as e:
        logger.error(f"Watermark embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/watermark/detect")
async def detect_watermark(request: WatermarkDetectRequest, http_request: Request):
    """Detect watermark in text"""
    try:
        result = watermark_engine.detect_watermark(request.text)
        
        # Log watermark detection event
        if request.tenant_id:
            detected = result.get("detected", False)
            confidence = result.get("confidence", 0.0)
            
            await log_watermark_event(
                tenant_id=request.tenant_id,
                action="detect",
                detected=detected,
                confidence=confidence,
                watermark_type="text",
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4())
            )
        
        return result
    except Exception as e:
        logger.error(f"Watermark detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class TrainingDataRequest(BaseModel):
    batch_data: List[List[float]]
    batch_labels: List[int]
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

class GradientAggregationRequest(BaseModel):
    gradients: List[List[float]]
    num_byzantine: int = None
    method: str = "krum"
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

class BackdoorDetectionRequest(BaseModel):
    model_weights: Dict[str, List]
    probe_inputs: List[List[float]] = None
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

class DPNoiseRequest(BaseModel):
    gradients: List[List[float]]
    sensitivity: float = 1.0
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

@app.post("/integrity/validate-training-data")
async def validate_training_data(request: TrainingDataRequest, http_request: Request):
    """
    Validate training data for poisoning attacks
    Uses differential privacy and anomaly detection
    """
    try:
        import numpy as np
        batch_data = np.array(request.batch_data)
        batch_labels = np.array(request.batch_labels)
        
        result = model_integrity_checker.validate_training_data(batch_data, batch_labels)
        
        # Log model integrity event
        if request.tenant_id:
            poisoning_detected = result.get("poisoning_detected", False)
            severity = "high" if poisoning_detected else "low"
            
            await log_model_integrity_event(
                tenant_id=request.tenant_id,
                event_type="training_data_validation",
                severity=severity,
                description=f"Training data validation completed - {'poisoning detected' if poisoning_detected else 'no issues found'}",
                metadata={
                    "batch_size": len(request.batch_data),
                    "poisoning_detected": poisoning_detected,
                    "anomaly_score": result.get("anomaly_score", 0.0),
                    "method": "differential_privacy"
                },
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4())
            )
        
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
async def detect_backdoor(request: BackdoorDetectionRequest, http_request: Request):
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
        
        # Log model integrity event
        if request.tenant_id:
            backdoor_detected = result.get("backdoor_detected", False)
            severity = "critical" if backdoor_detected else "low"
            
            await log_model_integrity_event(
                tenant_id=request.tenant_id,
                event_type="backdoor_detection",
                severity=severity,
                description=f"Backdoor detection completed - {'backdoor detected' if backdoor_detected else 'no backdoors found'}",
                metadata={
                    "backdoor_detected": backdoor_detected,
                    "confidence": result.get("confidence", 0.0),
                    "suspicious_neurons": result.get("suspicious_neurons", 0),
                    "method": "activation_analysis"
                },
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4())
            )
        
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
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

class AdversarialCheckRequest(BaseModel):
    text: str
    tenant_id: Optional[str] = None
    api_key_id: Optional[str] = None
    request_id: Optional[str] = None

@app.post("/detect/dos")
async def check_dos(request: DoSCheckRequest, http_request: Request):
    """
    Check for DoS attack patterns
    Detects complexity and runaway generation attempts
    """
    start_time = time.time()
    
    try:
        # Check complexity and token budget
        result = dos_protector.check_request(request.text, request.requested_tokens)
        
        # Check for runaway patterns
        runaway_result = dos_protector.detect_runaway_patterns(request.text)
        result["runaway_patterns"] = runaway_result
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Determine if DoS attack detected
        dos_detected = result.get("dos_risk", False) or runaway_result.get("detected", False)
        confidence = max(result.get("risk_score", 0.0), runaway_result.get("confidence", 0.0))
        
        # Log detection event
        if request.tenant_id:
            await log_detection_event(
                tenant_id=request.tenant_id,
                detection_type="dos_attack",
                detected=dos_detected,
                confidence=confidence,
                text_length=len(request.text),
                method="complexity_analysis",
                processing_time_ms=processing_time_ms,
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4()),
                source_ip=http_request.client.host if http_request.client else None,
                user_agent=http_request.headers.get("user-agent")
            )
        
        return result
    except Exception as e:
        logger.error(f"DoS check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/adversarial")
async def check_adversarial(request: AdversarialCheckRequest, http_request: Request):
    """
    Detect and normalize adversarial inputs
    Handles homoglyphs, invisible characters, etc.
    """
    start_time = time.time()
    
    try:
        result = adversarial_defense.detect_and_normalize(request.text)
        
        # Also check for markdown injection
        markdown_result = adversarial_defense.detect_markdown_injection(request.text)
        result["markdown_injection"] = markdown_result
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Determine if adversarial input detected
        adversarial_detected = result.get("adversarial_detected", False) or markdown_result.get("detected", False)
        confidence = max(result.get("confidence", 0.0), markdown_result.get("confidence", 0.0))
        
        # Log detection event
        if request.tenant_id:
            await log_detection_event(
                tenant_id=request.tenant_id,
                detection_type="adversarial_input",
                detected=adversarial_detected,
                confidence=confidence,
                text_length=len(request.text),
                method="pattern_analysis",
                processing_time_ms=processing_time_ms,
                api_key_id=request.api_key_id,
                request_id=request.request_id or str(uuid.uuid4()),
                source_ip=http_request.client.host if http_request.client else None,
                user_agent=http_request.headers.get("user-agent")
            )
        
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
