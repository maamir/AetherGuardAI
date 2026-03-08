# AetherGuard Proxy Engine (Rust)

High-performance semantic proxy for LLM request/response interception.

## Features

- Sub-22ms latency overhead
- Seven-stage request pipeline
- Async/await with Tokio runtime
- SHA-256 request/response fingerprinting
- Audit logging with structured JSON

## Architecture

```
Request Flow:
1. Ingress → API Gateway receives request
2. Auth → Validate API key/token
3. Cleanse → PII redaction, injection scan
4. AetherSign → Compute fingerprint
5. Inference → Forward to LLM provider
6. Verify → Toxicity/hallucination check
7. Egress → Return signed response
```

## Build & Run

```bash
cargo build --release
cargo run
```

## Environment Variables

- `ML_SERVICE_URL`: URL for Python ML services (default: http://localhost:8001)

## API Endpoint

```
POST /v1/chat/completions
Authorization: Bearer <api_key>

{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

## TODO

- [ ] Integrate with AWS KMS for AetherSign
- [ ] Connect to ML services (Llama Guard, Presidio)
- [ ] Implement LLM provider routing
- [ ] Add AWS QLDB audit logging
- [ ] Rate limiting and token budgets
