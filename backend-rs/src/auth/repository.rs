//! Auth data access, mirroring `backend/app/auth/repository.py`.

use sqlx::SqlitePool;

use crate::auth::models::User;

const COLS: &str =
    "id, email, password_hash, full_name, avatar_url, is_active, created_at, updated_at, sync_id";

pub async fn find_by_email(pool: &SqlitePool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(&format!(
        "SELECT {COLS} FROM users WHERE email = ? AND is_deleted = 0 AND deleted_at IS NULL"
    ))
    .bind(email)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(&format!(
        "SELECT {COLS} FROM users WHERE id = ? AND is_deleted = 0 AND deleted_at IS NULL"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn insert(pool: &SqlitePool, user: &User) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO users ({COLS}) VALUES (?,?,?,?,?,?,?,?,?)"
    ))
    .bind(&user.id)
    .bind(&user.email)
    .bind(&user.password_hash)
    .bind(&user.full_name)
    .bind(&user.avatar_url)
    .bind(user.is_active)
    .bind(&user.created_at)
    .bind(&user.updated_at)
    .bind(&user.sync_id)
    .execute(pool)
    .await
    .map(|_| ())
}

/// Update profile fields; returns the refreshed row, or None if not found.
pub async fn update_profile(
    pool: &SqlitePool,
    id: &str,
    full_name: Option<String>,
    avatar_url: Option<String>,
) -> Result<Option<User>, sqlx::Error> {
    sqlx::query("UPDATE users SET full_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?")
        .bind(full_name)
        .bind(avatar_url)
        .bind(crate::core::time::now_iso())
        .bind(id)
        .execute(pool)
        .await?;
    find_by_id(pool, id).await
}
