//! Reservation row model, mirroring `backend/app/reservations/models.py`.

use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Reservation {
    pub id: String,
    pub property_id: String,
    pub listing_id: Option<String>,
    pub external_id: Option<String>,
    pub confirmation_code: Option<String>,
    pub status: String,
    pub source: String,
    pub check_in: String,
    pub check_out: String,
    pub booked_at: Option<String>,
    pub cancelled_at: Option<String>,
    pub nights: i64,
    pub guest_name: Option<String>,
    pub guest_email: Option<String>,
    pub guest_phone: Option<String>,
    pub number_of_guests: i64,
    pub gross_revenue: f64,
    pub cleaning_fee: f64,
    pub platform_fee: f64,
    pub taxes: f64,
    pub net_revenue: f64,
    pub currency: String,
    pub property_name: Option<String>,
    pub property_city: Option<String>,
    pub property_country: Option<String>,
    pub notes: Option<String>,
    pub deleted_at: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub sync_id: Option<String>,
}
