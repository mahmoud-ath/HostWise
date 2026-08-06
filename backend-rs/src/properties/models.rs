//! Property row model, mirroring `backend/app/properties/models.py`.
//! `type`/`status` are stored as strings to match the SQLAlchemy Enum text.

use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Property {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub status: String,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub postal_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub bedrooms: i64,
    pub bathrooms: f64,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub sync_id: Option<String>,
}
