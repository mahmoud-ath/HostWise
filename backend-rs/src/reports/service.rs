//! Reports service: generates weekly/monthly/annual/executive/portfolio report
//! JSON, reusing the finance + analytics + AI services. Mirrors
//! `backend/app/reports/service.py`.

use chrono::{Datelike, Duration as ChronoDuration, Local};
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::ai::service::{AiAdvisorService, flatten_actions};
use crate::analytics::service as analytics;
use crate::core::error::AppError;
use crate::finance::service::FinanceService;
use crate::settings::service as settings;

pub struct ReportGenerationService {
    pub pool: SqlitePool,
}

impl ReportGenerationService {
    pub fn from_pool(pool: SqlitePool) -> Self {
        Self { pool }
    }

    fn advisor(&self) -> AiAdvisorService {
        AiAdvisorService {
            pool: self.pool.clone(),
        }
    }

    pub async fn generate_weekly_report(&self) -> Result<Value, AppError> {
        let today = Local::now().date_naive();
        let start = today - ChronoDuration::days(today.weekday().num_days_from_monday() as i64);
        let end = start + ChronoDuration::days(6);
        let s = start.format("%Y-%m-%d").to_string();
        let e = end.format("%Y-%m-%d").to_string();
        let summary = FinanceService::from_pool(self.pool.clone())
            .get_summary(Some(&s), Some(&e))
            .await?;
        Ok(json!({
            "report_type": "weekly",
            "period_start": s,
            "period_end": e,
            "generated_at": today.format("%Y-%m-%d").to_string(),
            "summary": serde_json::to_value(&summary)?,
        }))
    }

    pub async fn generate_monthly_report(&self, year: i32, month: i64) -> Result<Value, AppError> {
        let finance = FinanceService::from_pool(self.pool.clone());
        let report = finance.get_monthly_report(year, month as u32).await?;
        let ai = self.advisor().generate_advisor_report(Some(year), None, None).await?;
        let recs: Vec<Value> = flatten_actions(&ai).into_iter().take(3).collect();
        Ok(json!({
            "report_type": "monthly",
            "year": year,
            "month": month,
            "financial_data": serde_json::to_value(&report)?,
            "ai_insights": ai["executive_summary"],
            "provider": ai["provider"],
            "recommendations": recs,
        }))
    }

    pub async fn generate_annual_report(&self, year: i32) -> Result<Value, AppError> {
        let finance = FinanceService::from_pool(self.pool.clone());
        let report = finance.get_annual_report(year).await?;
        let ai = self.advisor().generate_advisor_report(Some(year), None, None).await?;
        Ok(json!({
            "report_type": "annual",
            "year": year,
            "financial_data": serde_json::to_value(&report)?,
            "ai_insights": ai["executive_summary"],
            "provider": ai["provider"],
            "recommendations": flatten_actions(&ai),
        }))
    }

    pub async fn generate_executive_summary(&self) -> Result<Value, AppError> {
        let today = Local::now().date_naive();
        let year = today.year();
        let finance = FinanceService::from_pool(self.pool.clone());
        let annual = finance.get_annual_report(year).await?;
        let ai = self.advisor().generate_advisor_report(Some(year), None, None).await?;

        let property_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM properties WHERE is_deleted = 0")
                .fetch_one(&self.pool)
                .await?;
        let profit_margin = if annual.total_revenue > 0.0 {
            (annual.net / annual.total_revenue) * 100.0
        } else {
            0.0
        };
        let best = annual.months.iter().max_by(|a, b| a.net.total_cmp(&b.net));
        let worst = annual.months.iter().min_by(|a, b| a.net.total_cmp(&b.net));

        let recs = flatten_actions(&ai);
        let top: Vec<Value> = recs
            .into_iter()
            .filter(|r| matches!(r["type"].as_str(), Some("critical") | Some("warning")))
            .take(5)
            .collect();

        Ok(json!({
            "report_type": "executive_summary",
            "generated_at": today.format("%Y-%m-%d").to_string(),
            "highlights": {
                "annual_revenue": annual.total_revenue,
                "annual_expenses": annual.total_expenses,
                "annual_profit": annual.net,
                "profit_margin": profit_margin,
                "property_count": property_count,
                "best_month": best.map(|m| serde_json::to_value(m).unwrap_or(Value::Null)),
                "worst_month": worst.map(|m| serde_json::to_value(m).unwrap_or(Value::Null)),
            },
            "ai_summary": ai["executive_summary"],
            "provider": ai["provider"],
            "top_recommendations": top,
        }))
    }

    pub async fn generate_portfolio_report(
        &self,
        start: Option<&str>,
        end: Option<&str>,
        currency: Option<&str>,
    ) -> Result<Value, AppError> {
        let today = Local::now().date_naive();
        let (s, e) = match (start, end) {
            (Some(a), Some(b)) => (a.to_string(), b.to_string()),
            _ => {
                let y = today.year();
                (format!("{y:04}-01-01"), format!("{y:04}-12-31"))
            }
        };

        let all = settings::get_all(&self.pool).await?;
        let cur = currency
            .filter(|c| c.len() == 3)
            .map(|c| c.to_string())
            .unwrap_or_else(|| all["default_currency"].as_str().unwrap_or("EUR").to_string());
        let tax_rate = all["tax_rate"].as_f64().unwrap_or(0.0);

        let finance = FinanceService::from_pool(self.pool.clone());
        let summary = finance.get_summary(Some(&s), Some(&e)).await?;
        let portfolio =
            analytics::get_portfolio_analytics(&self.pool, None, Some(&s), Some(&e)).await?;
        let ai = self.advisor().generate_advisor_report(None, Some(&s), Some(&e)).await?;

        let net = summary.total_revenue;
        let expenses = summary.total_expenses;
        let profit = net - expenses;
        let profit_margin = if net > 0.0 { profit / net * 100.0 } else { 0.0 };

        Ok(json!({
            "report_type": "portfolio",
            "period_start": s,
            "period_end": e,
            "generated_at": today.format("%Y-%m-%d").to_string(),
            "currency": cur,
            "executive_summary": ai["executive_summary"],
            "provider": ai["provider"],
            "health": ai["health_score"],
            "kpis": {
                "gross_revenue": portfolio["total_gross_revenue"],
                "net_revenue": net,
                "total_expenses": expenses,
                "profit": profit,
                "profit_margin": profit_margin,
                "reservation_count": portfolio["reservation_count"],
                "nights": portfolio["nights"],
                "cancellation_rate": portfolio["cancellation_rate"],
                "revenue_count": summary.revenue_count,
                "expense_count": summary.expense_count,
            },
            "property_table": portfolio["properties"],
            "expense_analysis": {},
            "risks": ai["risks"],
            "opportunities": ai["opportunities"],
            "forecast": ai["forecast"],
            "goals": ai["recommended_goals"],
            "tax_summary": {
                "tax_rate": tax_rate,
                "estimated_tax": (profit * tax_rate / 100.0).max(0.0),
            },
            "recommendations": flatten_actions(&ai),
        }))
    }
}
