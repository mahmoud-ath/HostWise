//! Reports HTTP routes, mirroring `backend/app/reports/router.py`.
//!
//! GET /api/v1/reports/weekly
//! GET /api/v1/reports/monthly?year=&month=
//! GET /api/v1/reports/annual?year=
//! GET /api/v1/reports/executive
//! GET /api/v1/reports/portfolio?year=|start_date=&end_date=&currency=
//! GET /api/v1/reports/export?format=pdf&...

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use chrono::Datelike;
use serde::Deserialize;
use serde_json::Value;

use crate::auth::extractors::AuthUser;
use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::reports::pdf_service;
use crate::reports::service::ReportGenerationService;

#[derive(Debug, Deserialize)]
struct MonthQuery {
    year: i32,
    month: i64,
}

#[derive(Debug, Deserialize)]
struct YearQuery {
    year: i32,
}

#[derive(Debug, Default, Deserialize)]
struct PeriodQuery {
    year: Option<i32>,
    start_date: Option<String>,
    end_date: Option<String>,
    currency: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct ExportQuery {
    #[serde(default = "default_format")]
    format: String,
    year: Option<i32>,
    start_date: Option<String>,
    end_date: Option<String>,
    currency: Option<String>,
}

fn default_format() -> String {
    "pdf".into()
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/weekly", get(weekly))
        .route("/monthly", get(monthly))
        .route("/annual", get(annual))
        .route("/executive", get(executive))
        .route("/portfolio", get(portfolio))
        .route("/export", get(export))
}

fn svc(state: AppState) -> ReportGenerationService {
    ReportGenerationService::from_pool(state.pool)
}

fn validate_period(start: Option<&str>, end: Option<&str>) -> Result<(), AppError> {
    if start.is_some() != end.is_some() {
        return Err(AppError::Validation(
            "start_date and end_date must be provided together".into(),
        ));
    }
    if let (Some(s), Some(e)) = (start, end) {
        if s > e {
            return Err(AppError::Validation("start_date must not be after end_date".into()));
        }
    }
    Ok(())
}

/// Resolve the reporting period: explicit dates win, else `year` (defaults to
/// the current year) — mirrors the Python router.
fn resolve_period(year: Option<i32>, start: Option<&str>, end: Option<&str>) -> (String, String) {
    if let (Some(s), Some(e)) = (start, end) {
        return (s.to_string(), e.to_string());
    }
    let y = year.unwrap_or_else(|| chrono::Local::now().year());
    (format!("{y:04}-01-01"), format!("{y:04}-12-31"))
}

async fn weekly(State(state): State<AppState>, _auth: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(svc(state).generate_weekly_report().await?))
}

async fn monthly(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<MonthQuery>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(svc(state).generate_monthly_report(q.year, q.month).await?))
}

async fn annual(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<YearQuery>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(svc(state).generate_annual_report(q.year).await?))
}

async fn executive(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(svc(state).generate_executive_summary().await?))
}

async fn portfolio(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<PeriodQuery>,
) -> Result<Json<Value>, AppError> {
    validate_period(q.start_date.as_deref(), q.end_date.as_deref())?;
    let (s, e) = resolve_period(q.year, q.start_date.as_deref(), q.end_date.as_deref());
    let report = svc(state)
        .generate_portfolio_report(Some(&s), Some(&e), q.currency.as_deref())
        .await?;
    Ok(Json(report))
}

async fn export(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ExportQuery>,
) -> Result<Response, AppError> {
    if q.format != "pdf" {
        return Err(AppError::Validation("Only 'pdf' format is supported".into()));
    }
    validate_period(q.start_date.as_deref(), q.end_date.as_deref())?;
    let (s, e) = resolve_period(q.year, q.start_date.as_deref(), q.end_date.as_deref());
    let report = svc(state)
        .generate_portfolio_report(Some(&s), Some(&e), q.currency.as_deref())
        .await?;
    let pdf = pdf_service::render_portfolio_pdf(&report).map_err(AppError::Validation)?;

    let mut response = (StatusCode::OK, pdf).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, "application/pdf".parse().unwrap());
    response.headers_mut().insert(
        CONTENT_DISPOSITION,
        "attachment; filename=\"hostwise-report.pdf\""
            .parse()
            .map_err(|_| AppError::Internal(anyhow::anyhow!("bad header")))?,
    );
    Ok(response)
}
