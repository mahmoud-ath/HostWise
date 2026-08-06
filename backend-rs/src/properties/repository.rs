//! Property data access, mirroring `backend/app/properties/repository.py`.

use sqlx::SqlitePool;

use crate::properties::models::Property;

const COLS: &str = "id, name, type, status, address, city, state, country, postal_code, latitude, longitude, bedrooms, bathrooms, deleted_at, created_at, updated_at, sync_id";

pub async fn insert(pool: &SqlitePool, p: &Property) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO properties ({COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ))
    .bind(&p.id)
    .bind(&p.name)
    .bind(&p.r#type)
    .bind(&p.status)
    .bind(&p.address)
    .bind(&p.city)
    .bind(&p.state)
    .bind(&p.country)
    .bind(&p.postal_code)
    .bind(p.latitude)
    .bind(p.longitude)
    .bind(p.bedrooms)
    .bind(p.bathrooms)
    .bind(&p.deleted_at)
    .bind(&p.created_at)
    .bind(&p.updated_at)
    .bind(&p.sync_id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn list(pool: &SqlitePool, skip: i64, limit: i64) -> Result<Vec<Property>, sqlx::Error> {
    sqlx::query_as::<_, Property>(&format!(
        "SELECT {COLS} FROM properties WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ))
    .bind(limit)
    .bind(skip)
    .fetch_all(pool)
    .await
}

pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Property>, sqlx::Error> {
    sqlx::query_as::<_, Property>(&format!(
        "SELECT {COLS} FROM properties WHERE id = ? AND deleted_at IS NULL"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn update(pool: &SqlitePool, p: &Property) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE properties SET name=?, type=?, status=?, address=?, city=?, state=?, country=?, \
         postal_code=?, latitude=?, longitude=?, bedrooms=?, bathrooms=?, updated_at=? WHERE id=?",
    )
    .bind(&p.name)
    .bind(&p.r#type)
    .bind(&p.status)
    .bind(&p.address)
    .bind(&p.city)
    .bind(&p.state)
    .bind(&p.country)
    .bind(&p.postal_code)
    .bind(p.latitude)
    .bind(p.longitude)
    .bind(p.bedrooms)
    .bind(p.bathrooms)
    .bind(&p.updated_at)
    .bind(&p.id)
    .execute(pool)
    .await
    .map(|_| ())
}

/// Soft delete; returns the number of rows affected (0 = already gone).
pub async fn soft_delete(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
    let now = crate::core::time::now_iso();
    let res = sqlx::query(
        "UPDATE properties SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&now)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}
