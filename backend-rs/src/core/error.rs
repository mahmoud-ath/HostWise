//! Application error type, mirroring `backend/app/shared/exceptions.py`.
//! Implements `IntoResponse` so handlers can return `Result<_, AppError>`.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found")]
    NotFound,

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("{0}")]
    Validation(String),

    #[error(transparent)]
    Db(#[from] sqlx::Error),

    #[error(transparent)]
    Auth(#[from] jsonwebtoken::errors::Error),

    // `argon2::password_hash::Error` is not `'static`, so it cannot be a
    // transparent source — store the message instead.
    #[error("Password error: {0}")]
    Password(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "Invalid or missing credentials".to_string(),
            ),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::Conflict(m) => (StatusCode::CONFLICT, m.clone()),
            AppError::Validation(m) => (StatusCode::UNPROCESSABLE_ENTITY, m.clone()),
            AppError::Db(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string()),
            AppError::Auth(_) => (
                StatusCode::UNAUTHORIZED,
                "Invalid or missing credentials".to_string(),
            ),
            AppError::Password(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not hash or verify password".to_string(),
            ),
            AppError::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, "I/O error".to_string()),
            AppError::Json(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "Serialization error".to_string())
            }
            AppError::Internal(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
        };
        (status, Json(ErrorBody { error: message })).into_response()
    }
}
