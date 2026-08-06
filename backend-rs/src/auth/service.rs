//! Auth business logic, mirroring `backend/app/auth/service.py`.

use std::sync::Arc;
use std::time::Duration;

use argon2::password_hash::{
    rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
};
use argon2::Argon2;
use uuid::Uuid;

use crate::auth::models::User;
use crate::auth::repository as auth_repo;
use crate::auth::schemas::{LoginRequest, RegisterRequest, TokenResponse, UpdateProfileRequest};
use crate::auth::security;
use crate::core::config::Config;
use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::core::time::now_iso;

pub struct AuthService {
    pub pool: sqlx::SqlitePool,
    pub config: Arc<Config>,
}

impl AuthService {
    pub fn new(state: AppState) -> Self {
        Self {
            pool: state.pool,
            config: state.config,
        }
    }

    pub async fn register(&self, req: RegisterRequest) -> Result<TokenResponse, AppError> {
        let email = req.email.trim().to_lowercase();
        if email.is_empty() {
            return Err(AppError::Validation("Email is required".into()));
        }
        if req.password.len() < 8 {
            return Err(AppError::Validation(
                "Password must be at least 8 characters".into(),
            ));
        }
        if auth_repo::find_by_email(&self.pool, &email)
            .await?
            .is_some()
        {
            return Err(AppError::Conflict("Email already registered".into()));
        }

        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(req.password.as_bytes(), &salt)
            .map_err(|e| AppError::Password(e.to_string()))?
            .to_string();

        let now = now_iso();
        let user = User {
            id: Uuid::new_v4().to_string(),
            email,
            password_hash: hash,
            full_name: req.full_name.map(|s| s.trim().to_string()),
            avatar_url: None,
            is_active: true,
            created_at: now.clone(),
            updated_at: now,
            sync_id: None,
        };
        auth_repo::insert(&self.pool, &user).await?;
        self.tokens_for(&user)
    }

    pub async fn login(&self, req: LoginRequest) -> Result<TokenResponse, AppError> {
        let email = req.email.trim().to_lowercase();
        let user = auth_repo::find_by_email(&self.pool, &email)
            .await?
            .ok_or(AppError::Unauthorized)?;

        let parsed = PasswordHash::new(&user.password_hash)
            .map_err(|e| AppError::Password(e.to_string()))?;
        if Argon2::default()
            .verify_password(req.password.as_bytes(), &parsed)
            .is_err()
        {
            return Err(AppError::Unauthorized);
        }
        if !user.is_active {
            return Err(AppError::Forbidden);
        }
        self.tokens_for(&user)
    }

    pub async fn refresh(&self, refresh_token: &str) -> Result<TokenResponse, AppError> {
        let claims = security::decode_token(&self.config.jwt_secret_key, refresh_token)?;
        if claims.typ != "refresh" {
            return Err(AppError::Unauthorized);
        }
        let user = auth_repo::find_by_id(&self.pool, &claims.sub)
            .await?
            .ok_or(AppError::Unauthorized)?;
        if !user.is_active {
            return Err(AppError::Unauthorized);
        }
        self.tokens_for(&user)
    }

    pub async fn update_profile(
        &self,
        user_id: &str,
        req: UpdateProfileRequest,
    ) -> Result<User, AppError> {
        let full_name = req.full_name.map(|s| s.trim().to_string());
        let user = auth_repo::update_profile(&self.pool, user_id, full_name, req.avatar_url)
            .await?
            .ok_or(AppError::NotFound)?;
        Ok(user)
    }

    fn tokens_for(&self, user: &User) -> Result<TokenResponse, AppError> {
        let access_ttl =
            Duration::from_secs((self.config.jwt_access_token_expire_minutes * 60) as u64);
        let refresh_ttl =
            Duration::from_secs((self.config.jwt_refresh_token_expire_days * 24 * 3600) as u64);

        let access =
            security::create_token(&self.config.jwt_secret_key, &user.id, "access", access_ttl)?;
        let refresh = security::create_token(
            &self.config.jwt_secret_key,
            &user.id,
            "refresh",
            refresh_ttl,
        )?;

        Ok(TokenResponse {
            access_token: access,
            refresh_token: refresh,
            token_type: "bearer".into(),
        })
    }
}
