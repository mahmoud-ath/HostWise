//! Reports service: generates weekly/monthly/annual/executive/portfolio report
//! JSON, reusing the finance + analytics + AI services. Mirrors
//! `backend/app/reports/service.py`.

use chrono::{Datelike, Duration as ChronoDuration, Local};
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::ai::service::{flatten_actions, AiAdvisorService};
use crate::analytics::service as analytics;
use crate::core::error::AppError;
use crate::finance::service::FinanceService;
use crate::settings::service as settings;

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// Shift an inclusive [start, end] window one year back (YoY comparison).
fn shift_window_back(start: &str, end: &str) -> (String, String) {
    let parse = |s: &str| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok();
    match (parse(start), parse(end)) {
        (Some(sd), Some(ed)) => {
            let ps = sd.checked_sub_months(chrono::Months::new(12)).unwrap_or(sd);
            let pe = ed.checked_sub_months(chrono::Months::new(12)).unwrap_or(ed);
            (
                ps.format("%Y-%m-%d").to_string(),
                pe.format("%Y-%m-%d").to_string(),
            )
        }
        _ => {
            let y = chrono::Local::now().year() - 1;
            (format!("{y:04}-01-01"), format!("{y:04}-12-31"))
        }
    }
}

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
        let ai = self
            .advisor()
            .generate_advisor_report(Some(year), None, None)
            .await?;
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
        let ai = self
            .advisor()
            .generate_advisor_report(Some(year), None, None)
            .await?;
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
        let ai = self
            .advisor()
            .generate_advisor_report(Some(year), None, None)
            .await?;

        let property_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM properties WHERE is_deleted = 0")
                .fetch_one(&self.pool)
                .await?;
        let profit_margin = if annual.summary.net_revenue > 0.0 {
            (annual.summary.profit / annual.summary.net_revenue) * 100.0
        } else {
            0.0
        };
        let best = annual
            .monthly_breakdown
            .iter()
            .max_by(|a, b| a.profit.total_cmp(&b.profit));
        let worst = annual
            .monthly_breakdown
            .iter()
            .min_by(|a, b| a.profit.total_cmp(&b.profit));

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
                "annual_revenue": annual.summary.net_revenue,
                "annual_expenses": annual.summary.total_expenses,
                "annual_profit": annual.summary.profit,
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
            .unwrap_or_else(|| {
                all["default_currency"]
                    .as_str()
                    .unwrap_or("EUR")
                    .to_string()
            });
        let tax_rate = all["tax_rate"].as_f64().unwrap_or(0.0);

        let finance = FinanceService::from_pool(self.pool.clone());
        let summary = finance.get_summary(Some(&s), Some(&e)).await?;
        let portfolio =
            analytics::get_portfolio_analytics(&self.pool, None, Some(&s), Some(&e)).await?;
        let ai = self
            .advisor()
            .generate_advisor_report(None, Some(&s), Some(&e))
            .await?;

        let net = summary.net_revenue;
        let expenses = summary.total_expenses;
        let profit = net - expenses;
        let profit_margin = if net > 0.0 { profit / net * 100.0 } else { 0.0 };

        let year = s[0..4].parse::<i32>().unwrap_or_else(|_| today.year());
        let annual = finance.get_annual_report(year).await?;
        let (prev_s, prev_e) = shift_window_back(&s, &e);
        let prev_summary = finance.get_summary(Some(&prev_s), Some(&prev_e)).await?;

        let pct_change = |prev: f64, cur: f64| -> Option<f64> {
            if prev > 0.0 {
                Some(((cur - prev) / prev) * 100.0)
            } else {
                None
            }
        };
        let kpi_comparison = json!({
            "revenue": {
                "previous": prev_summary.net_revenue,
                "current": net,
                "change_pct": pct_change(prev_summary.net_revenue, net),
            },
            "profit": {
                "previous": prev_summary.profit,
                "current": profit,
                "change_pct": pct_change(prev_summary.profit, profit),
            },
            "expenses": {
                "previous": prev_summary.total_expenses,
                "current": expenses,
                "change_pct": pct_change(prev_summary.total_expenses, expenses),
            },
        });

        let property_performance: Vec<Value> = portfolio["properties"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|p| {
                json!({
                    "property_id": p["property_id"],
                    "property_name": p["name"],
                    "net_revenue": p["net_revenue"],
                    "total_expenses": p["expenses"],
                    "profit": p["profit"],
                    "profit_margin": p["profit_margin"],
                    "reservation_count": p["reservations"],
                })
            })
            .collect();

        let exp_categories = portfolio["expense_categories"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let expense_analysis = json!({
            "categories": exp_categories,
            "biggest": exp_categories.first().cloned(),
            "smallest": exp_categories.last().cloned(),
            "fastest_growing": null,
        });

        let ranking = portfolio["property_ranking"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let best_worst_properties = json!({
            "best": ranking.first().cloned(),
            "worst": ranking.last().cloned(),
        });

        let health = ai["health_score"].clone();
        let portfolio_health = json!({
            "score": health["score"],
            "status": health["status"],
            "components": health["components"],
            "distribution": portfolio["health_distribution"],
        });

        let forecast_next = portfolio["forecast_next_month"].as_f64().unwrap_or(0.0);
        let forecast = json!({
            "next_quarter_revenue": round2(forecast_next * 3.0),
            "confidence": 0.6,
        });

        let revenue_goal = all["annual_revenue_goal"].as_f64().unwrap_or(0.0);
        let goals = json!({
            "revenue": {
                "goal": revenue_goal,
                "current": net,
                "progress": if revenue_goal > 0.0 {
                    round2(net / revenue_goal * 100.0)
                } else {
                    0.0
                },
            }
        });

        let tax_summary = json!({
            "rental_income": portfolio["total_gross_revenue"],
            "deductible_expenses": expenses,
            "estimated_taxable_income": profit.max(0.0),
            "tax_rate": tax_rate,
            "estimated_tax": (profit * tax_rate / 100.0).max(0.0),
        });

        let org = all["organization_name"]
            .as_str()
            .unwrap_or("HostWise")
            .to_string();

        Ok(json!({
            "report_type": "portfolio",
            "year": year,
            "period": format!("{s} to {e}"),
            "previous_period": format!("{prev_s} to {prev_e}"),
            "period_start": s,
            "period_end": e,
            "generated_at": today.format("%Y-%m-%d").to_string(),
            "organization": org,
            "currency": cur,
            "executive_summary": {
                "summary": ai["executive_summary"],
                "provider": ai["provider"],
                "health_status": health["status"],
            },
            "ai_insights": {
                "recommendations": flatten_actions(&ai),
                "opportunities": ai["opportunities"],
                "risks": ai["risks"],
                "forecast": forecast,
            },
            "kpi_comparison": kpi_comparison,
            "property_performance": property_performance,
            "monthly_breakdown": serde_json::to_value(&annual.monthly_breakdown)?,
            "expense_analysis": expense_analysis,
            "best_worst_properties": best_worst_properties,
            "risks": ai["risks"],
            "opportunities": ai["opportunities"],
            "goals": goals,
            "forecast": forecast,
            "portfolio_health": portfolio_health,
            "tax_summary": tax_summary,
            // Legacy keys used by older consumers.
            "provider": ai["provider"],
            "health": health,
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
            "recommendations": flatten_actions(&ai),
        }))
    }
}
