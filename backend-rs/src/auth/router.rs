//! Auth HTTP routes, mirroring `backend/app/auth/router.py`.
//!
//! POST   /register  -> 201 TokenResponse
//! POST   /login     -> TokenResponse
//! POST   /refresh   -> TokenResponse
//! GET    /me        -> UserResponse
//! PATCH  /me        -> UserResponse

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;

use crate::auth::extractors::AuthUser;
use crate::auth::schemas::{
    LoginRequest, RegisterRequest, TokenResponse, UpdateProfileRequest, UserResponse,
};
use crate::auth::service::AuthService;
use crate::core::error::AppError;
use crate::core::state::AppState;

#[derive(Debug, Deserialize)]
struct RefreshRequest {
    refresh_token: String,
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/me", get(get_me).patch(update_me))
}

async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<TokenResponse>), AppError> {
    let svc = AuthService::new(state);
    let tokens = svc.register(req).await?;
    Ok((StatusCode::CREATED, Json(tokens)))
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<TokenResponse>, AppError> {
    let svc = AuthService::new(state);
    let tokens = svc.login(req).await?;
    Ok(Json(tokens))
}

async fn refresh(
    State(state): State<AppState>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<TokenResponse>, AppError> {
    let svc = AuthService::new(state);
    let tokens = svc.refresh(&req.refresh_token).await?;
    Ok(Json(tokens))
}

async fn get_me(AuthUser(user): AuthUser) -> Json<UserResponse> {
    Json(UserResponse::from(user))
}

async fn update_me(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>, AppError> {
    let svc = AuthService::new(state);
    let updated = svc.update_profile(&user.id, req).await?;
    Ok(Json(UserResponse::from(updated)))
}
