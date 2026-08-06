//! Reservation request schemas, mirroring `backend/app/reservations/schemas.py`.

use serde::Deserialize;

fn default_status() -> String {
    "confirmed".into()
}
fn default_source() -> String {
    "manual".into()
}
fn default_guests() -> i64 {
    1
}
fn default_currency() -> String {
    "USD".into()
}

#[derive(Debug, Deserialize)]
pub struct ReservationCreateRequest {
    pub property_id: String,
    pub listing_id: Option<String>,
    pub confirmation_code: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_source")]
    pub source: String,
    pub check_in: String,
    pub check_out: String,
    pub nights: i64,
    pub guest_name: Option<String>,
    pub guest_email: Option<String>,
    pub guest_phone: Option<String>,
    #[serde(default = "default_guests")]
    pub number_of_guests: i64,
    #[serde(default)]
    pub gross_revenue: f64,
    #[serde(default)]
    pub cleaning_fee: f64,
    #[serde(default)]
    pub platform_fee: f64,
    #[serde(default)]
    pub taxes: f64,
    #[serde(default = "default_currency")]
    pub currency: String,
    pub notes: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct ListParams {
    pub property_id: Option<String>,
    pub skip: Option<i64>,
    pub limit: Option<i64>,
}
