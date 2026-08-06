//! Router assembly + health endpoint.

use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::auth;
use crate::core::state::AppState;
use crate::properties;

pub fn build_api_router() -> Router<AppState> {
    Router::new()
        .route("/api/health", get(health))
        .nest("/api/v1/auth", auth::router::build_router())
        .nest("/api/v1/properties", properties::router::build_router())
}

async fn health(State(state): State<AppState>) -> Json<serde_json::Value> {
    let db_up = sqlx::query_scalar::<_, i64>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .is_ok();

    Json(json!({
        "status": if db_up { "ok" } else { "degraded" },
        "version": state.config.app_version,
        "database": if db_up { "up" } else { "down" },
    }))
}
