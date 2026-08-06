//! Reservation HTTP routes, mirroring `backend/app/reservations/router.py`.
//!
//! POST /api/v1/reservations               -> 201 Reservation
//! GET  /api/v1/reservations               -> [Reservation] (property_id/skip/limit)
//! GET  /api/v1/reservations/detail/{id}   -> Reservation

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use uuid::Uuid;

use crate::auth::extractors::AuthUser;
use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::core::time::now_iso;
use crate::reservations::models::Reservation;
use crate::reservations::repository as res_repo;
use crate::reservations::schemas::{ListParams, ReservationCreateRequest};

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_reservations).post(create_reservation))
        .route("/detail/{id}", get(get_reservation))
}

async fn create_reservation(
    State(state): State<AppState>,
    _auth: AuthUser,
    Json(req): Json<ReservationCreateRequest>,
) -> Result<(StatusCode, Json<Reservation>), AppError> {
    if req.nights < 0 {
        return Err(AppError::Validation("nights must be >= 0".into()));
    }
    // net_revenue mirrors ReservationService.create: gross - platform - taxes.
    let net = req.gross_revenue - req.platform_fee - req.taxes;
    let now = now_iso();

    let reservation = Reservation {
        id: Uuid::new_v4().to_string(),
        property_id: req.property_id,
        listing_id: req.listing_id,
        external_id: None,
        confirmation_code: req.confirmation_code,
        status: req.status,
        source: req.source,
        check_in: req.check_in,
        check_out: req.check_out,
        booked_at: None,
        cancelled_at: None,
        nights: req.nights,
        guest_name: req.guest_name,
        guest_email: req.guest_email,
        guest_phone: req.guest_phone,
        number_of_guests: req.number_of_guests,
        gross_revenue: req.gross_revenue,
        cleaning_fee: req.cleaning_fee,
        platform_fee: req.platform_fee,
        taxes: req.taxes,
        net_revenue: net,
        currency: req.currency,
        property_name: None,
        property_city: None,
        property_country: None,
        notes: req.notes,
        deleted_at: None,
        is_deleted: false,
        created_at: now.clone(),
        updated_at: now,
        sync_id: None,
    };

    res_repo::insert(&state.pool, &reservation).await?;
    Ok((StatusCode::CREATED, Json(reservation)))
}

async fn list_reservations(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(params): Query<ListParams>,
) -> Result<Json<Vec<Reservation>>, AppError> {
    let skip = params.skip.unwrap_or(0).max(0);
    let limit = params.limit.unwrap_or(100).clamp(1, 500);
    let items = res_repo::list(&state.pool, params.property_id.as_deref(), skip, limit).await?;
    Ok(Json(items))
}

async fn get_reservation(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Reservation>, AppError> {
    let r = res_repo::get_by_id(&state.pool, &id.to_string())
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(r))
}
