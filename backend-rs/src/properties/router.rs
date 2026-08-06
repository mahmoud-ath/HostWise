//! Property HTTP routes, mirroring `backend/app/properties/router.py`.
//!
//! POST   /api/v1/properties        -> 201 Property
//! GET    /api/v1/properties        -> [Property]  (skip/limit)
//! GET    /api/v1/properties/{id}   -> Property
//! PATCH  /api/v1/properties/{id}   -> Property
//! DELETE /api/v1/properties/{id}   -> 204 (soft delete)

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use uuid::Uuid;

use crate::auth::extractors::AuthUser;
use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::core::time::now_iso;
use crate::properties::models::Property;
use crate::properties::repository as props_repo;
use crate::properties::schemas::{ListParams, PropertyCreateRequest, PropertyUpdateRequest};

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_properties).post(create_property))
        .route(
            "/{id}",
            get(get_property).patch(update_property).delete(delete_property),
        )
}

async fn create_property(
    State(state): State<AppState>,
    _auth: AuthUser,
    Json(req): Json<PropertyCreateRequest>,
) -> Result<(StatusCode, Json<Property>), AppError> {
    if req.name.trim().is_empty() {
        return Err(AppError::Validation("name is required".into()));
    }
    let now = now_iso();
    let property = Property {
        id: Uuid::new_v4().to_string(),
        name: req.name.trim().to_string(),
        r#type: req.r#type,
        status: req.status,
        address: req.address,
        city: req.city,
        state: req.state,
        country: req.country,
        postal_code: req.postal_code,
        latitude: req.latitude,
        longitude: req.longitude,
        bedrooms: req.bedrooms,
        bathrooms: req.bathrooms,
        deleted_at: None,
        created_at: now.clone(),
        updated_at: now,
        sync_id: None,
    };
    props_repo::insert(&state.pool, &property).await?;
    Ok((StatusCode::CREATED, Json(property)))
}

async fn list_properties(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(params): Query<ListParams>,
) -> Result<Json<Vec<Property>>, AppError> {
    let skip = params.skip.unwrap_or(0).max(0);
    let limit = params.limit.unwrap_or(100).clamp(1, 500);
    let items = props_repo::list(&state.pool, skip, limit).await?;
    Ok(Json(items))
}

async fn get_property(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Property>, AppError> {
    let p = props_repo::get_by_id(&state.pool, &id.to_string())
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(p))
}

async fn update_property(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<PropertyUpdateRequest>,
) -> Result<Json<Property>, AppError> {
    let id = id.to_string();
    let mut p = props_repo::get_by_id(&state.pool, &id)
        .await?
        .ok_or(AppError::NotFound)?;

    if let Some(v) = req.name {
        if !v.trim().is_empty() {
            p.name = v.trim().to_string();
        }
    }
    if let Some(v) = req.r#type {
        p.r#type = v;
    }
    if let Some(v) = req.status {
        p.status = v;
    }
    if let Some(v) = req.address {
        p.address = Some(v);
    }
    if let Some(v) = req.city {
        p.city = Some(v);
    }
    if let Some(v) = req.state {
        p.state = Some(v);
    }
    if let Some(v) = req.country {
        p.country = Some(v);
    }
    if let Some(v) = req.postal_code {
        p.postal_code = Some(v);
    }
    if let Some(v) = req.latitude {
        p.latitude = Some(v);
    }
    if let Some(v) = req.longitude {
        p.longitude = Some(v);
    }
    if let Some(v) = req.bedrooms {
        p.bedrooms = v;
    }
    if let Some(v) = req.bathrooms {
        p.bathrooms = v;
    }
    p.updated_at = now_iso();

    props_repo::update(&state.pool, &p).await?;
    Ok(Json(p))
}

async fn delete_property(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let rows = props_repo::soft_delete(&state.pool, &id.to_string()).await?;
    if rows == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
