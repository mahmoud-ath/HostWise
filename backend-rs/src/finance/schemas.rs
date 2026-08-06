//! Finance request/response schemas + report shapes.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

fn default_currency() -> String {
    "USD".into()
}
fn default_source() -> String {
    "manual".into()
}

// ── Requests ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RevenueCreateRequest {
    pub property_id: String,
    pub reservation_id: Option<String>,
    pub category_id: Option<String>,
    pub date: String,
    #[serde(default)]
    pub gross_amount: f64,
    #[serde(default)]
    pub commission_amount: f64,
    #[serde(default = "default_source")]
    pub source: String,
    #[serde(default = "default_currency")]
    pub currency: String,
    pub description: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct RevenueUpdateRequest {
    pub category_id: Option<String>,
    pub gross_amount: Option<f64>,
    pub commission_amount: Option<f64>,
    pub currency: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExpenseCreateRequest {
    pub property_id: String,
    pub category_id: Option<String>,
    pub date: String,
    #[serde(default)]
    pub amount: f64,
    #[serde(default = "default_currency")]
    pub currency: String,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub is_recurring: bool,
    pub receipt_url: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct ExpenseUpdateRequest {
    pub category_id: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub is_recurring: Option<bool>,
    pub receipt_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CategoryCreateRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct CategoryUpdateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CategoryMergeRequest {
    pub target_id: String,
}

#[derive(Debug, Default, Deserialize)]
pub struct FinanceListParams {
    pub property_id: Option<String>,
    pub category_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub skip: Option<i64>,
    pub limit: Option<i64>,
}

// ── Report shapes (aligned with the frontend) ─────────────

#[derive(Debug, Serialize)]
pub struct FinancialSummary {
    pub gross_revenue: f64,
    pub net_revenue: f64,
    pub total_expenses: f64,
    pub cashflow: f64,
    pub profit: f64,
    pub profit_margin: f64,
    pub property_count: i64,
    pub avg_revenue_per_property: f64,
    pub revenue_count: i64,
    pub expense_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct CategoryBreakdown {
    pub category_name: String,
    pub total: f64,
    pub percentage: f64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MonthlyBreakdown {
    pub month: i32,
    pub year: i32,
    pub gross_revenue: f64,
    pub net_revenue: f64,
    pub total_expenses: f64,
    pub cashflow: f64,
    pub profit: f64,
    pub reservation_count: i64,
}

#[derive(Debug, Serialize)]
pub struct MonthlyReport {
    pub month: i32,
    pub year: i32,
    pub summary: FinancialSummary,
    pub monthly_trend: Vec<MonthlyBreakdown>,
    pub revenue_by_category: Vec<CategoryBreakdown>,
    pub expense_by_category: Vec<CategoryBreakdown>,
    pub revenue_by_property: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct AnnualReport {
    pub year: i32,
    pub summary: FinancialSummary,
    pub monthly_breakdown: Vec<MonthlyBreakdown>,
    pub revenue_by_category: Vec<CategoryBreakdown>,
    pub expense_by_category: Vec<CategoryBreakdown>,
    pub revenue_by_property: Vec<serde_json::Value>,
    pub yoy_growth: Option<f64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ExpenseCategoryWithCount {
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
    pub expense_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RevenueCategoryWithCount {
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
    pub revenue_count: i64,
}
