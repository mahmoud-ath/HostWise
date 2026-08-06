//! Analytics HTTP routes, mirroring `backend/app/analytics/router.py`.
//!
//! GET /api/v1/analytics/property/{id}?year=YYYY
//! GET /api/v1/analytics/property/{id}/health
//! GET /api/v1/analytics/portfolio?year=YYYY | start_date&end_date

use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::analytics::service;
use crate::core::error::AppError;
use crate::core::state::AppState;

#[derive(Debug, Deserialize)]
struct PropertyQuery {
    year: i32,
}

#[derive(Debug, Default, Deserialize)]
struct PortfolioQuery {
    year: Option<i32>,
    start_date: Option<String>,
    end_date: Option<String>,
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/property/{id}", get(property_analytics))
        .route("/property/{id}/health", get(property_health))
        .route("/portfolio", get(portfolio_analytics))
}

async fn property_analytics(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<PropertyQuery>,
) -> Result<Json<Value>, AppError> {
    let property_id = id.to_string();
    let fp = service::data_fingerprint(&state.pool).await?;
    let key = format!("prop:{property_id}:{}:{fp}", q.year);
    if let Some(cached) = service::cache_get(&key) {
        return Ok(Json(cached));
    }
    let result = service::get_property_analytics(&state.pool, &property_id, q.year).await?;
    service::cache_set(&key, result.clone());
    Ok(Json(result))
}

async fn property_health(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let result = service::get_property_health_score(&state.pool, &id.to_string()).await?;
    Ok(Json(result))
}

async fn portfolio_analytics(
    State(state): State<AppState>,
    Query(q): Query<PortfolioQuery>,
) -> Result<Json<Value>, AppError> {
    if (q.start_date.is_some()) != (q.end_date.is_some()) {
        return Err(AppError::Validation(
            "start_date and end_date must be provided together".into(),
        ));
    }
    if let (Some(s), Some(e)) = (q.start_date.as_deref(), q.end_date.as_deref()) {
        if s > e {
            return Err(AppError::Validation(
                "start_date must not be after end_date".into(),
            ));
        }
    }

    let fp = service::data_fingerprint(&state.pool).await?;
    let key = format!(
        "portfolio:{:?}:{:?}:{:?}:{fp}",
        q.year, q.start_date, q.end_date
    );
    if let Some(cached) = service::cache_get(&key) {
        return Ok(Json(cached));
    }
    let result = service::get_portfolio_analytics(
        &state.pool,
        q.year,
        q.start_date.as_deref(),
        q.end_date.as_deref(),
    )
    .await?;
    service::cache_set(&key, result.clone());
    Ok(Json(result))
}
