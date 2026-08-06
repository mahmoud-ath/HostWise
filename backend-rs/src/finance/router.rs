//! Finance HTTP routes, mirroring `backend/app/finance/router.py`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use chrono::Datelike;
use serde::Deserialize;
use uuid::Uuid;

use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::finance::models::{Expense, ExpenseCategory, Revenue, RevenueCategory};
use crate::finance::schemas::{
    AnnualReport, CategoryCreateRequest, CategoryMergeRequest, CategoryUpdateRequest,
    ExpenseCategoryWithCount, ExpenseCreateRequest, ExpenseUpdateRequest, FinanceListParams,
    FinancialSummary, MonthlyReport, RevenueCategoryWithCount, RevenueCreateRequest,
    RevenueUpdateRequest,
};
use crate::finance::service::FinanceService;

#[derive(Debug, Deserialize)]
struct MonthlyQuery {
    year: i32,
    month: u32,
}

#[derive(Debug, Default, Deserialize)]
struct AnnualQuery {
    year: Option<i32>,
    start_date: Option<String>,
    end_date: Option<String>,
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/revenue", get(list_revenue).post(create_revenue))
        .route(
            "/revenue/{id}",
            get(get_revenue)
                .patch(update_revenue)
                .delete(delete_revenue),
        )
        .route("/expense", get(list_expense).post(create_expense))
        .route(
            "/expense/{id}",
            get(get_expense)
                .patch(update_expense)
                .delete(delete_expense),
        )
        .route("/summary", get(get_summary))
        .route("/report/monthly", get(get_monthly_report))
        .route("/report/annual", get(get_annual_report))
        .route(
            "/expense-categories",
            get(list_expense_categories).post(create_expense_category),
        )
        .route(
            "/expense-categories/{id}",
            patch(update_expense_category).delete(delete_expense_category),
        )
        .route(
            "/expense-categories/{id}/merge",
            post(merge_expense_category),
        )
        .route(
            "/revenue-categories",
            get(list_revenue_categories).post(create_revenue_category),
        )
        .route(
            "/revenue-categories/{id}",
            patch(update_revenue_category).delete(delete_revenue_category),
        )
}

fn svc(state: AppState) -> FinanceService {
    FinanceService::new(state)
}

// ── Revenue handlers ────────────────────────────────────────

async fn create_revenue(
    State(state): State<AppState>,
    Json(req): Json<RevenueCreateRequest>,
) -> Result<(StatusCode, Json<Revenue>), AppError> {
    let r = svc(state).create_revenue(req).await?;
    Ok((StatusCode::CREATED, Json(r)))
}

async fn list_revenue(
    State(state): State<AppState>,
    Query(p): Query<FinanceListParams>,
) -> Result<Json<Vec<Revenue>>, AppError> {
    let skip = p.skip.unwrap_or(0).max(0);
    let limit = p.limit.unwrap_or(100).clamp(1, 500);
    let items = svc(state)
        .list_revenues(
            p.property_id.as_deref(),
            p.category_id.as_deref(),
            p.start_date.as_deref(),
            p.end_date.as_deref(),
            skip,
            limit,
        )
        .await?;
    Ok(Json(items))
}

async fn get_revenue(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Revenue>, AppError> {
    let r = svc(state).get_revenue(&id.to_string()).await?;
    Ok(Json(r))
}

async fn update_revenue(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<RevenueUpdateRequest>,
) -> Result<Json<Revenue>, AppError> {
    let r = svc(state).update_revenue(&id.to_string(), req).await?;
    Ok(Json(r))
}

async fn delete_revenue(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    svc(state).delete_revenue(&id.to_string()).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Expense handlers ────────────────────────────────────────

async fn create_expense(
    State(state): State<AppState>,
    Json(req): Json<ExpenseCreateRequest>,
) -> Result<(StatusCode, Json<Expense>), AppError> {
    let e = svc(state).create_expense(req).await?;
    Ok((StatusCode::CREATED, Json(e)))
}

async fn list_expense(
    State(state): State<AppState>,
    Query(p): Query<FinanceListParams>,
) -> Result<Json<Vec<Expense>>, AppError> {
    let skip = p.skip.unwrap_or(0).max(0);
    let limit = p.limit.unwrap_or(100).clamp(1, 500);
    let items = svc(state)
        .list_expenses(
            p.property_id.as_deref(),
            p.category_id.as_deref(),
            p.start_date.as_deref(),
            p.end_date.as_deref(),
            skip,
            limit,
        )
        .await?;
    Ok(Json(items))
}

async fn get_expense(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Expense>, AppError> {
    let e = svc(state).get_expense(&id.to_string()).await?;
    Ok(Json(e))
}

async fn update_expense(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<ExpenseUpdateRequest>,
) -> Result<Json<Expense>, AppError> {
    let e = svc(state).update_expense(&id.to_string(), req).await?;
    Ok(Json(e))
}

async fn delete_expense(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    svc(state).delete_expense(&id.to_string()).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Reports ─────────────────────────────────────────────────

async fn get_summary(
    State(state): State<AppState>,
    Query(p): Query<FinanceListParams>,
) -> Result<Json<FinancialSummary>, AppError> {
    let s = svc(state)
        .get_summary(p.start_date.as_deref(), p.end_date.as_deref())
        .await?;
    Ok(Json(s))
}

async fn get_monthly_report(
    State(state): State<AppState>,
    Query(q): Query<MonthlyQuery>,
) -> Result<Json<MonthlyReport>, AppError> {
    let r = svc(state).get_monthly_report(q.year, q.month).await?;
    Ok(Json(r))
}

async fn get_annual_report(
    State(state): State<AppState>,
    Query(q): Query<AnnualQuery>,
) -> Result<Json<AnnualReport>, AppError> {
    // start_date/end_date must be provided together (mirrors Python router).
    if (q.start_date.is_some()) != (q.end_date.is_some()) {
        return Err(AppError::Validation(
            "start_date and end_date must be provided together".into(),
        ));
    }
    let service = svc(state);
    if let (Some(_s), Some(_e)) = (q.start_date.as_deref(), q.end_date.as_deref()) {
        // Range-based annual report is currently derived from the calendar-year
        // report; a dedicated range aggregation can be added if needed.
    }
    let year = q.year.unwrap_or_else(|| chrono::Local::now().year());
    let r = service.get_annual_report(year).await?;
    Ok(Json(r))
}

// ── Expense category handlers ───────────────────────────────

async fn list_expense_categories(
    State(state): State<AppState>,
) -> Result<Json<Vec<ExpenseCategoryWithCount>>, AppError> {
    let items = svc(state).list_expense_categories().await?;
    Ok(Json(items))
}

async fn create_expense_category(
    State(state): State<AppState>,
    Json(req): Json<CategoryCreateRequest>,
) -> Result<(StatusCode, Json<ExpenseCategory>), AppError> {
    let c = svc(state).create_expense_category(req).await?;
    Ok((StatusCode::CREATED, Json(c)))
}

async fn update_expense_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<CategoryUpdateRequest>,
) -> Result<Json<ExpenseCategory>, AppError> {
    let c = svc(state)
        .update_expense_category(&id.to_string(), req)
        .await?;
    Ok(Json(c))
}

async fn delete_expense_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    svc(state).delete_expense_category(&id.to_string()).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn merge_expense_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<CategoryMergeRequest>,
) -> Result<Json<ExpenseCategory>, AppError> {
    let c = svc(state)
        .merge_expense_category(&id.to_string(), &req.target_id)
        .await?;
    Ok(Json(c))
}

// ── Revenue category handlers ───────────────────────────────

async fn list_revenue_categories(
    State(state): State<AppState>,
) -> Result<Json<Vec<RevenueCategoryWithCount>>, AppError> {
    let items = svc(state).list_revenue_categories().await?;
    Ok(Json(items))
}

async fn create_revenue_category(
    State(state): State<AppState>,
    Json(req): Json<CategoryCreateRequest>,
) -> Result<(StatusCode, Json<RevenueCategory>), AppError> {
    let c = svc(state).create_revenue_category(req).await?;
    Ok((StatusCode::CREATED, Json(c)))
}

async fn update_revenue_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<CategoryUpdateRequest>,
) -> Result<Json<RevenueCategory>, AppError> {
    let c = svc(state)
        .update_revenue_category(&id.to_string(), req)
        .await?;
    Ok(Json(c))
}

async fn delete_revenue_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    svc(state).delete_revenue_category(&id.to_string()).await?;
    Ok(StatusCode::NO_CONTENT)
}
