//! Notifications HTTP routes, mirroring `backend/app/notifications/router.py`.
//!
//! GET    /api/v1/notifications          -> { notifications, unread }
//! DELETE /api/v1/notifications          -> archive all
//! GET    /api/v1/notifications/summary  -> { unread }
//! POST   /api/v1/notifications/refresh  -> recompute (idempotent)
//! POST   /api/v1/notifications/read-all -> mark all read
//! POST   /api/v1/notifications/{id}/read

use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::extractors::AuthUser;
use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::notifications::models::Notification;
use crate::notifications::service;

#[derive(Debug, Default, Deserialize)]
struct ListQuery {
    limit: Option<i64>,
}

fn serialize(n: &Notification) -> Value {
    json!({
        "id": n.id,
        "type": n.r#type,
        "title": n.title,
        "message": n.message,
        "severity": n.severity,
        "is_read": n.is_read,
        "created_at": n.created_at,
    })
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_notifications).delete(clear_notifications))
        .route("/summary", get(summary))
        .route("/refresh", post(refresh))
        .route("/read-all", post(read_all))
        .route("/{id}/read", post(mark_read))
}

async fn list_notifications(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let items = service::list(&state.pool, limit).await?;
    let notifications: Vec<Value> = items.iter().map(serialize).collect();
    Ok(Json(json!({
        "notifications": notifications,
        "unread": service::unread_count(&state.pool).await?,
    })))
}

async fn summary(State(state): State<AppState>, _auth: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({ "unread": service::unread_count(&state.pool).await? })))
}

async fn refresh(State(state): State<AppState>, _auth: AuthUser) -> Result<Json<Value>, AppError> {
    let result = service::refresh(&state.pool).await?;
    Ok(Json(result))
}

async fn read_all(State(state): State<AppState>, _auth: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({ "updated": service::mark_all_read(&state.pool).await? })))
}

async fn clear_notifications(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({ "deleted": service::clear_all(&state.pool).await? })))
}

async fn mark_read(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({ "updated": service::mark_read(&state.pool, &id.to_string()).await? })))
}
