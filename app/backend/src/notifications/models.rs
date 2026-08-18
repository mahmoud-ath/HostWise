//! Notification row model, mirroring `backend/app/notifications/models.py`.

use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Notification {
    pub id: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub title: String,
    pub message: String,
    pub severity: String,
    pub fingerprint: String,
    pub is_read: bool,
    pub deleted_at: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub sync_id: Option<String>,
}
