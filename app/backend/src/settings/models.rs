//! Settings row model, mirroring `backend/app/settings/models.py`.

use sqlx::FromRow;

#[derive(Debug, Clone, FromRow)]
pub struct SettingRow {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}
