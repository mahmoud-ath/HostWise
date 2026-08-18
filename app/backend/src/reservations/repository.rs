//! Reservation data access, mirroring `backend/app/reservations/repository.py`.

use sqlx::SqlitePool;

use crate::reservations::models::Reservation;

const COLS: &str = "id, property_id, listing_id, external_id, confirmation_code, status, source, \
                    check_in, check_out, booked_at, cancelled_at, nights, guest_name, guest_email, \
                    guest_phone, number_of_guests, gross_revenue, cleaning_fee, platform_fee, \
                    taxes, net_revenue, currency, property_name, property_city, property_country, \
                    notes, deleted_at, is_deleted, created_at, updated_at, sync_id";

pub async fn insert(pool: &SqlitePool, r: &Reservation) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO reservations ({COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ))
    .bind(&r.id)
    .bind(&r.property_id)
    .bind(&r.listing_id)
    .bind(&r.external_id)
    .bind(&r.confirmation_code)
    .bind(&r.status)
    .bind(&r.source)
    .bind(&r.check_in)
    .bind(&r.check_out)
    .bind(&r.booked_at)
    .bind(&r.cancelled_at)
    .bind(r.nights)
    .bind(&r.guest_name)
    .bind(&r.guest_email)
    .bind(&r.guest_phone)
    .bind(r.number_of_guests)
    .bind(r.gross_revenue)
    .bind(r.cleaning_fee)
    .bind(r.platform_fee)
    .bind(r.taxes)
    .bind(r.net_revenue)
    .bind(&r.currency)
    .bind(&r.property_name)
    .bind(&r.property_city)
    .bind(&r.property_country)
    .bind(&r.notes)
    .bind(&r.deleted_at)
    .bind(r.is_deleted)
    .bind(&r.created_at)
    .bind(&r.updated_at)
    .bind(&r.sync_id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Reservation>, sqlx::Error> {
    sqlx::query_as::<_, Reservation>(&format!(
        "SELECT {COLS} FROM reservations WHERE id = ? AND deleted_at IS NULL AND is_deleted = 0"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list(
    pool: &SqlitePool,
    property_id: Option<&str>,
    skip: i64,
    limit: i64,
) -> Result<Vec<Reservation>, sqlx::Error> {
    let mut sql =
        format!("SELECT {COLS} FROM reservations WHERE deleted_at IS NULL AND is_deleted = 0");
    if property_id.is_some() {
        sql.push_str(" AND property_id = ?");
    }
    sql.push_str(" ORDER BY check_in DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query_as::<_, Reservation>(&sql);
    if let Some(pid) = property_id {
        q = q.bind(pid);
    }
    q.bind(limit).bind(skip).fetch_all(pool).await
}
