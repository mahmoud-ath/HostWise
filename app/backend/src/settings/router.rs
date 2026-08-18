//! Settings HTTP routes, mirroring `backend/app/settings/router.py`.
//!
//! GET  /api/v1/settings         -> all settings (defaults merged)
//! PUT  /api/v1/settings         -> upsert, returns full map
//! GET  /api/v1/settings/export  -> multi-sheet Excel (.xls) download
//! POST /api/v1/settings/wipe    -> delete all business data

use axum::extract::State;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Map, Value};

use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::settings::service;

#[derive(Debug, Deserialize)]
struct SettingsUpdateRequest {
    settings: Map<String, Value>,
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_settings).put(update_settings))
        .route("/export", get(export_all_data))
        .route("/wipe", post(wipe_all_data))
}

async fn get_settings(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let all = service::get_all(&state.pool).await?;
    Ok(Json(all))
}

async fn update_settings(
    State(state): State<AppState>,
    Json(req): Json<SettingsUpdateRequest>,
) -> Result<Json<Value>, AppError> {
    let all = service::update(&state.pool, req.settings).await?;
    Ok(Json(all))
}

async fn export_all_data(State(state): State<AppState>) -> Result<Response, AppError> {
    let html = service::export_data(&state.pool).await?;
    Ok((
        StatusCode::OK,
        [
            (CONTENT_TYPE, "application/vnd.ms-excel"),
            (
                CONTENT_DISPOSITION,
                r#"attachment; filename="hostwise-export.xls""#,
            ),
        ],
        html,
    )
        .into_response())
}

async fn wipe_all_data(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    service::wipe(&state.pool).await?;
    Ok(Json(json!({ "status": "ok" })))
}
