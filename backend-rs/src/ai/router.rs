//! AI HTTP routes, mirroring `backend/app/ai/router.py`.
//!
//! GET  /api/v1/ai/analyze
//! GET  /api/v1/ai/advisor?year=|start_date=&end_date=
//! POST /api/v1/ai/chat  { question, year? }
//! POST /api/v1/ai/test-connection
//! POST /api/v1/ai/scenario { scenario, params?, year? }

use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Datelike;
use serde::Deserialize;
use serde_json::Value;

use crate::ai::service::AiAdvisorService;
use crate::core::error::AppError;
use crate::core::state::AppState;

const ALLOWED_SCENARIOS: &[&str] = &[
    "price_increase",
    "hire_cleaner",
    "expense_reduction",
    "minimum_stay",
];

#[derive(Debug, Deserialize)]
struct AdvisorQuery {
    year: Option<i32>,
    start_date: Option<String>,
    end_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatRequest {
    question: String,
    year: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct ScenarioRequest {
    scenario: String,
    #[serde(default)]
    params: Value,
    year: Option<i32>,
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/analyze", get(analyze))
        .route("/advisor", get(advisor))
        .route("/chat", post(chat))
        .route("/test-connection", post(test_connection))
        .route("/scenario", post(scenario))
}

fn svc(state: AppState) -> AiAdvisorService {
    AiAdvisorService::new(state)
}

async fn analyze(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let result = svc(state).analyze_financial_performance().await?;
    Ok(Json(result))
}

async fn advisor(
    State(state): State<AppState>,
    Query(q): Query<AdvisorQuery>,
) -> Result<Json<Value>, AppError> {
    if (q.start_date.is_some()) != (q.end_date.is_some()) {
        return Err(AppError::Validation(
            "start_date and end_date must be provided together".into(),
        ));
    }
    let result = svc(state)
        .generate_advisor_report(q.year, q.start_date.as_deref(), q.end_date.as_deref())
        .await?;
    Ok(Json(result))
}

async fn chat(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<Value>, AppError> {
    if req.question.trim().is_empty() || req.question.len() > 500 {
        return Err(AppError::Validation(
            "question must be 1-500 characters".into(),
        ));
    }
    let year = req.year.unwrap_or_else(|| chrono::Local::now().year());
    let result = svc(state)
        .answer_question(req.question.trim(), year)
        .await?;
    Ok(Json(result))
}

async fn test_connection(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let result = svc(state).test_llm_connection().await?;
    Ok(Json(result))
}

async fn scenario(
    State(state): State<AppState>,
    Json(req): Json<ScenarioRequest>,
) -> Result<Json<Value>, AppError> {
    if !ALLOWED_SCENARIOS.contains(&req.scenario.as_str()) {
        return Err(AppError::Validation(format!(
            "Unknown scenario. Allowed: {}",
            ALLOWED_SCENARIOS.join(", ")
        )));
    }
    let year = req.year.unwrap_or_else(|| chrono::Local::now().year());
    let result = svc(state)
        .simulate_scenario(&req.scenario, &req.params, year)
        .await?;
    Ok(Json(result))
}
