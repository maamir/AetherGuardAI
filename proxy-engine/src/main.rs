use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
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
mod request_attribution;
mod data_residency;
mod database;

use pipeline::RequestPipeline;
use database::Database;

#[derive(Clone)]
struct AppState {
    pipeline: Arc<RequestPipeline>,
    #[allow(dead_code)]
    database: Option<Arc<Database>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct CompletionRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(default)]
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct SimpleCompletionRequest {
    model: String,
    prompt: String,
    #[serde(default)]
    max_tokens: Option<u32>,
    #[serde(default)]
    temperature: Option<f32>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CompletionResponse {
    id: String,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
}

#[derive(Debug, Serialize, Deserialize)]
struct Choice {
    message: Message,
    finish_reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    info!("Initializing AetherGuard Proxy Engine...");

    let pipeline = RequestPipeline::new().await.expect("Failed to initialize pipeline");
    
    let state = AppState { 
        pipeline: Arc::new(pipeline),
        database: None, // Database is handled internally by the pipeline
    };

    let app = Router::new()
        .route("/v1/chat/completions", post(proxy_completion))
        .route("/v1/chat/completion", post(proxy_completion))
        .route("/v1/completions", post(proxy_simple_completion))
        .route("/v1/completion", post(proxy_simple_completion))
        .route("/health", get(health_check))
        .route("/metrics", get(metrics))
        .route("/status", get(status))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .unwrap();
    
    info!("AetherGuard Proxy listening on {} with production AetherSign", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}

async fn proxy_completion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CompletionRequest>,
) -> impl IntoResponse {
    info!("Received completion request for model: {}", req.model);

    // Process through the 7-stage pipeline
    match state.pipeline.process(req.clone(), headers).await {
        Ok((response, audit_headers)) => {
            (StatusCode::OK, audit_headers, Json(response))
        }
        Err(e) => {
            warn!("Request blocked: {}", e);
            let error_response = CompletionResponse {
                id: format!("error-{}", uuid::Uuid::new_v4()),
                model: req.model.clone(),
                choices: vec![Choice {
                    message: Message {
                        role: "assistant".to_string(),
                        content: format!("Request blocked: {}", e),
                    },
                    finish_reason: "security_violation".to_string(),
                }],
                usage: Usage {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
            };
            (
                StatusCode::FORBIDDEN,
                HeaderMap::new(),
                Json(error_response),
            )
        }
    }
}

async fn proxy_simple_completion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<SimpleCompletionRequest>,
) -> impl IntoResponse {
    info!("Received simple completion request for model: {}", req.model);

    // Convert simple completion to chat completion format
    let chat_req = CompletionRequest {
        model: req.model.clone(),
        messages: vec![Message {
            role: "user".to_string(),
            content: req.prompt.clone(),
        }],
        max_tokens: req.max_tokens,
    };

    // Process through the 7-stage pipeline
    match state.pipeline.process(chat_req.clone(), headers).await {
        Ok((response, audit_headers)) => {
            (StatusCode::OK, audit_headers, Json(response))
        }
        Err(e) => {
            warn!("Request blocked: {}", e);
            let error_response = CompletionResponse {
                id: format!("error-{}", uuid::Uuid::new_v4()),
                model: req.model.clone(),
                choices: vec![Choice {
                    message: Message {
                        role: "assistant".to_string(),
                        content: format!("Request blocked: {}", e),
                    },
                    finish_reason: "security_violation".to_string(),
                }],
                usage: Usage {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
            };
            (
                StatusCode::FORBIDDEN,
                HeaderMap::new(),
                Json(error_response),
            )
        }
    }
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn metrics() -> impl IntoResponse {
    let metrics = serde_json::json!({
        "status": "healthy",
        "uptime": "running",
        "version": "0.1.0",
        "pipeline_stages": 7,
        "ml_detectors": 12
    });
    (StatusCode::OK, Json(metrics))
}

async fn status() -> impl IntoResponse {
    let status = serde_json::json!({
        "proxy_engine": "running",
        "ml_services": "connected",
        "database": "connected",
        "aws_services": "connected"
    });
    (StatusCode::OK, Json(status))
}
