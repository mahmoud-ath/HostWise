//! Maintenance HTTP routes, mirroring `backend/app/maintenance_router.py`.
//!
//! GET  /api/v1/maintenance/status
//! POST /api/v1/maintenance/optimize
//! GET  /api/v1/maintenance/logs?lines=N
//! POST /api/v1/maintenance/cleanup?days=N
//! POST /api/v1/maintenance/reset-demo-data
//! POST /api/v1/maintenance/reset-all-data

use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::Value;

use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::maintenance::service;

#[derive(Debug, Default, Deserialize)]
struct LinesQuery {
    lines: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
struct DaysQuery {
    days: Option<i64>,
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/status", get(status))
        .route("/optimize", post(optimize))
        .route("/logs", get(logs))
        .route("/cleanup", post(cleanup))
        .route("/reset-demo-data", post(reset_demo))
        .route("/reset-all-data", post(reset_all))
}

async fn status(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let result = service::status(&state.pool, &state.config).await?;
    Ok(Json(result))
}

async fn optimize(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let result = service::optimize(&state.pool, &state.config).await?;
    Ok(Json(result))
}

async fn logs(State(_state): State<AppState>, Query(q): Query<LinesQuery>) -> Json<Value> {
    Json(service::get_logs(q.lines.unwrap_or(200)))
}

async fn cleanup(
    State(state): State<AppState>,
    Query(q): Query<DaysQuery>,
) -> Result<Json<Value>, AppError> {
    let result = service::cleanup(&state.pool, q.days.unwrap_or(30).clamp(0, 3650)).await?;
    Ok(Json(result))
}

async fn reset_demo(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let result = service::reset_demo(&state.pool).await?;
    Ok(Json(result))
}

async fn reset_all(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let result = service::reset_all(&state.pool).await?;
    Ok(Json(result))
}
