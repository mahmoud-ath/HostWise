//! Property request schemas, mirroring `backend/app/properties/schemas.py`.

use serde::Deserialize;

fn default_type() -> String {
    "other".into()
}
fn default_status() -> String {
    "active".into()
}
fn default_bedrooms() -> i64 {
    1
}
fn default_bathrooms() -> f64 {
    1.0
}
fn default_max_guests() -> i64 {
    2
}

#[derive(Debug, Deserialize)]
pub struct PropertyCreateRequest {
    pub name: String,
    #[serde(default = "default_type", rename = "type")]
    pub r#type: String,
    #[serde(default = "default_status")]
    pub status: String,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub postal_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    #[serde(default = "default_bedrooms")]
    pub bedrooms: i64,
    #[serde(default = "default_bathrooms")]
    pub bathrooms: f64,
    #[serde(default = "default_max_guests")]
    pub max_guests: i64,
    pub square_meters: Option<f64>,
    pub acquisition_cost: Option<f64>,
    pub monthly_mortgage: Option<f64>,
    pub target_occupancy: Option<f64>,
    pub target_annual_revenue: Option<f64>,
    pub notes: Option<String>,
}

/// PATCH semantics: only fields present in the JSON are updated.
#[derive(Debug, Default, Deserialize)]
pub struct PropertyUpdateRequest {
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub r#type: Option<String>,
    pub status: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub postal_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub bedrooms: Option<i64>,
    pub bathrooms: Option<f64>,
    pub max_guests: Option<i64>,
    pub square_meters: Option<f64>,
    pub acquisition_cost: Option<f64>,
    pub monthly_mortgage: Option<f64>,
    pub target_occupancy: Option<f64>,
    pub target_annual_revenue: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct ListParams {
    pub skip: Option<i64>,
    pub limit: Option<i64>,
}
