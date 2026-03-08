use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, warn};

mod pipeline;
mod security;
mod audit;
mod crypto;
mod shadow_ai;
mod policy;
mod rate_limiter;
mod gdpr_compliance;
mod qldb_integration;

use pipeline::RequestPipeline;

#[derive(Clone)]
struct AppState {
    pipeline: Arc<RequestPipeline>,
}

#[derive(Debug, Deserialize)]
struct CompletionRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(default)]
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct CompletionResponse {
    id: String,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
}

#[derive(Debug, Serialize)]
struct Choice {
    message: Message,
    finish_reason: String,
}

#[derive(Debug, Serialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let pipeline = Arc::new(RequestPipeline::new());
    let state = AppState { pipeline };

    let app = Router::new()
        .route("/v1/chat/completions", post(proxy_completion))
        .route("/health", axum::routing::get(health_check))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .unwrap();
    
    info!("AetherGuard Proxy listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}

async fn proxy_completion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CompletionRequest>,
) -> impl IntoResponse {
    info!("Received completion request for model: {}", req.model);

    // Process through the 7-stage pipeline
    match state.pipeline.process(req, headers).await {
        Ok((response, audit_headers)) => {
            (StatusCode::OK, audit_headers, Json(response))
        }
        Err(e) => {
            warn!("Request blocked: {}", e);
            (
                StatusCode::FORBIDDEN,
                HeaderMap::new(),
                Json(serde_json::json!({
                    "error": {
                        "message": e.to_string(),
                        "type": "security_violation"
                    }
                })),
            )
        }
    }
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}
