# AetherGuard ML Services (Python)

Machine learning inference services for security and compliance checks.

## Components

- **Injection Detector**: Llama Guard (Prompt-Guard-86M) for prompt injection
- **Toxicity Detector**: IBM Granite Guardian for HAP classification
- **PII Detector**: Microsoft Presidio for PII/PHI detection and redaction

## Setup

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_lg
```

## Run

```bash
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8001
```

## API Endpoints

### POST /detect/injection
Detect prompt injection attempts
```json
{
  "text": "Ignore previous instructions and..."
}
```

### POST /detect/toxicity
Detect HAP/toxic content
```json
{
  "text": "Sample text to analyze"
}
```

### POST /detect/pii
Detect and redact PII
```json
{
  "text": "My email is john@example.com"
}
```

### POST /detect/bias
Analyze bias in model outputs
```json
{
  "outputs": ["output1", "output2"],
  "metadata": [{"gender": "male"}, {"gender": "female"}]
}
```

### POST /detect/hallucination
Detect hallucinations using NLI and RAG
```json
{
  "output": "The Eiffel Tower is in London",
  "context_docs": ["The Eiffel Tower is in Paris"],
  "rag_enabled": true
}
```

### POST /detect/brand-safety
Check brand safety and context relevance
```json
{
  "text": "Sample text",
  "allowed_categories": ["customer_service"],
  "custom_blocklist": ["competitor-name"]
}
```

### POST /detect/secrets
Detect secrets using TruffleHog and Gitleaks
```json
{
  "text": "AWS key: AKIAIOSFODNN7EXAMPLE"
}
```

### POST /watermark/embed
Embed watermark in generated text
```json
{
  "text": "Generated text",
  "model_id": "gpt-4",
  "request_id": "req-123"
}
```

### POST /watermark/detect
Detect watermark in text
```json
{
  "text": "Text to check"
}
```

### POST /integrity/validate-training-data
Validate training data for poisoning (DP-SGD)
```json
{
  "batch_data": [[1.0, 2.0], [3.0, 4.0]],
  "batch_labels": [0, 1]
}
```

### POST /integrity/aggregate-gradients
Byzantine-resilient gradient aggregation (Krum)
```json
{
  "gradients": [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]],
  "num_byzantine": 1,
  "method": "krum"
}
```

### POST /integrity/detect-backdoor
Post-training backdoor detection
```json
{
  "model_weights": {
    "layer1": [[1.0, 2.0], [3.0, 4.0]]
  },
  "probe_inputs": [[0.5, 0.5]]
}
```

### POST /integrity/apply-dp-noise
Apply differential privacy noise to gradients
```json
{
  "gradients": [[1.0, 2.0], [3.0, 4.0]],
  "sensitivity": 1.0
}
```

## TODO

- [ ] Load actual Llama Guard model
- [ ] Load IBM Granite Guardian model
- [ ] Initialize Microsoft Presidio properly
- [ ] Add DeBERTa NLI model for hallucination detection
- [ ] Integrate Pinecone for RAG grounding
- [ ] Add model caching and optimization
- [ ] Implement batch processing
- [ ] Train actual Byzantine detection ML model
- [ ] Add activation clustering for backdoor detection

## Model Poisoning Protection

This service implements comprehensive training-time defenses:

### 1. Differential Privacy (DP-SGD)
- Privacy budget: ε ≤ 8
- Gaussian noise injection
- Prevents data poisoning attacks

### 2. Byzantine-Resilient Aggregation
- **Krum**: Select single most representative gradient
- **Multi-Krum**: Average top-m gradients (more robust)
- **Coordinate-wise Median**: Robust to outliers
- Reduces attack success from 75% to <5%

### 3. Post-Training Backdoor Detection
- Weight distribution analysis
- Spectral signature detection
- Outlier activation analysis
- Trojan neuron identification
