//! Router assembly + health endpoint.

use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::analytics;
use crate::auth;
use crate::backup;
use crate::connectors;
use crate::core::state::AppState;
use crate::finance;
use crate::maintenance;
use crate::notifications;
use crate::properties;
use crate::reservations;
use crate::settings;
use crate::setup;

pub fn build_api_router() -> Router<AppState> {
    Router::new()
        .route("/api/health", get(health))
        .nest("/api/v1/auth", auth::router::build_router())
        .nest("/api/v1/properties", properties::router::build_router())
        .nest("/api/v1/reservations", reservations::router::build_router())
        .nest("/api/v1/finance", finance::router::build_router())
        .nest("/api/v1/settings", settings::router::build_router())
        .nest("/api/v1/analytics", analytics::router::build_router())
        .nest("/api/v1/notifications", notifications::router::build_router())
        .nest("/api/v1/maintenance", maintenance::router::build_router())
        .nest("/api/v1/backups", backup::router::build_router())
        .nest("/api/v1/setup", setup::router::build_router())
        .nest("/api/v1/connectors", connectors::router::build_router())
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
