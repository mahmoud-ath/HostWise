//! First-run setup, mirroring `backend/app/setup_router.py`.
//!
//! POST /api/v1/setup/initialize — store the owner's profile (name/email).
//! No authentication: this is a local, single-user app.

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Map, Value};

use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::settings::service as settings;

#[derive(Debug, Deserialize)]
struct ProfileRequest {
    name: Option<String>,
    email: Option<String>,
}

pub fn build_router() -> Router<AppState> {
    Router::new().route("/initialize", post(initialize))
}

async fn initialize(
    State(state): State<AppState>,
    payload: Option<Json<ProfileRequest>>,
) -> Result<Json<Value>, AppError> {
    let mut updates: Map<String, Value> = Map::new();
    if let Some(Json(data)) = payload {
        if let Some(name) = data.name {
            let trimmed = name.trim();
            if !trimmed.is_empty() {
                updates.insert("profile_name".into(), json!(trimmed));
            }
        }
        if let Some(email) = data.email {
            let trimmed = email.trim();
            if !trimmed.is_empty() {
                updates.insert("profile_email".into(), json!(trimmed));
            }
        }
    }
    if !updates.is_empty() {
        settings::update(&state.pool, updates).await?;
    }

    let all = settings::get_all(&state.pool).await?;
    Ok(Json(json!({
        "status": "initialized",
        "profile": {
            "name": all.get("profile_name").and_then(|v| v.as_str()).unwrap_or(""),
            "email": all.get("profile_email").and_then(|v| v.as_str()).unwrap_or(""),
        }
    })))
}
