//! JWT token creation/decoding, mirroring `backend/app/auth/security.py`.

use std::time::Duration;

use chrono::Utc;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::core::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    #[serde(rename = "type")]
    pub typ: String,
}

/// Create a signed HS256 JWT with the given subject, token type and TTL.
pub fn create_token(secret: &str, sub: &str, typ: &str, ttl: Duration) -> Result<String, AppError> {
    let now = Utc::now().timestamp();
    let claims = Claims {
        sub: sub.to_string(),
        exp: (now + ttl.as_secs() as i64) as usize,
        iat: now as usize,
        typ: typ.to_string(),
    };
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(AppError::Auth)
}

/// Decode and validate (including expiry) an HS256 JWT.
pub fn decode_token(secret: &str, token: &str) -> Result<Claims, AppError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(AppError::Auth)?;
    Ok(data.claims)
}
