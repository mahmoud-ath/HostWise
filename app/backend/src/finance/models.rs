//! Finance row models, mirroring `backend/app/finance/models.py` and
//! `backend/app/finance/category_models.py`.

use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Revenue {
    pub id: String,
    pub property_id: String,
    pub reservation_id: Option<String>,
    pub category_id: Option<String>,
    pub date: String,
    pub gross_amount: f64,
    pub commission_amount: f64,
    pub net_amount: f64,
    pub source: String,
    pub currency: String,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub deleted_at: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub sync_id: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Expense {
    pub id: String,
    pub property_id: String,
    pub category_id: Option<String>,
    pub date: String,
    pub amount: f64,
    pub currency: String,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub is_recurring: bool,
    pub receipt_url: Option<String>,
    pub deleted_at: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub sync_id: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct RevenueCategory {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub sync_id: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct ExpenseCategory {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub sync_id: Option<String>,
}
