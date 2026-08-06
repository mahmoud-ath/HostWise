//! Auth extractor: resolves the current user from the `Authorization` header.
//! Mirrors `get_current_user` in `backend/app/auth/dependencies.py`.

use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;

use crate::auth::models::User;
use crate::auth::repository as auth_repo;
use crate::auth::security;
use crate::core::error::AppError;
use crate::core::state::AppState;

/// Request guard carrying the authenticated `User`.
pub struct AuthUser(pub User);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(AppError::Unauthorized)?;

        let claims = security::decode_token(&state.config.jwt_secret_key, token)?;
        if claims.typ != "access" {
            return Err(AppError::Unauthorized);
        }

        let user = auth_repo::find_by_id(&state.pool, &claims.sub)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if !user.is_active {
            return Err(AppError::Unauthorized);
        }
        Ok(AuthUser(user))
    }
}
