//! User row model, mirroring `backend/app/auth/models.py`.

use sqlx::FromRow;

#[derive(Debug, Clone, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub password_hash: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    pub sync_id: Option<String>,
}
