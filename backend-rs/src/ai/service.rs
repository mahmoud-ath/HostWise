//! AI advisor orchestrator — composes the rules engine with an optional
//! external LLM (BYOK). Mirrors `backend/app/ai/service.py`.

use chrono::Datelike;
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::ai::llm::LlmProvider;
use crate::ai::rules;
use crate::analytics::service as analytics;
use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::finance::service::FinanceService;
use crate::settings::service as settings;

pub struct AiAdvisorService {
    pub pool: SqlitePool,
}

impl AiAdvisorService {
    pub fn new(state: AppState) -> Self {
        Self { pool: state.pool }
    }

    pub async fn analyze_financial_performance(&self) -> Result<Value, AppError> {
        let year = chrono::Local::now().year();
        let (s, e) = year_bounds(year);
        rules::analyze_financial_performance(&self.pool, &s, &e, year).await
    }

    pub async fn generate_advisor_report(
        &self,
        year: Option<i32>,
        start: Option<&str>,
        end: Option<&str>,
    ) -> Result<Value, AppError> {
        let (y, s, e) = period(year, start, end);
        let mut report = rules::generate_advisor_report(&self.pool, &s, &e, y).await?;

        let all = settings::get_all(&self.pool).await?;
        let provider = all["ai_provider"].as_str().unwrap_or("hostwise");
        if provider != "hostwise" {
            let input = self.llm_input(&s, &e).await?;
            let lang = all["ai_language"].as_str().unwrap_or("English");
            let lang_line = if lang != "English" {
                format!(" Respond in {lang}.")
            } else {
                String::new()
            };
            let system = format!(
                "You are HostWise, a vacation-rental financial advisor. You receive a JSON \
                 object with the host's REAL financial data. Reply with a SINGLE JSON object \
                 (no markdown, no code fences) with only these optional keys: executive_summary, \
                 health_score, priority_actions, opportunities, lost_revenue, risks, \
                 property_reviews, forecast, achievements, recommended_goals, trend_explanations. \
                 Base every figure strictly on the provided data.{lang_line}"
            );
            let user = format!("Here is the real portfolio data as JSON:\n{}", input.to_string());
            if let Some(reply) = LlmProvider::call(&all, &system, &user).await {
                if let Some(parsed) = LlmProvider::extract_json(&reply) {
                    if let Value::Object(mut obj) = parsed {
                        obj.insert("provider".into(), Value::String(provider.to_string()));
                        obj.insert("metrics".into(), report["metrics"].clone());
                        report = Value::Object(obj);
                    }
                }
            }
        }
        Ok(report)
    }

    async fn llm_input(&self, s: &str, e: &str) -> Result<Value, AppError> {
        let finance = FinanceService::from_pool(self.pool.clone());
        let summary = finance.get_summary(Some(s), Some(e)).await?;
        let portfolio =
            analytics::get_portfolio_analytics(&self.pool, None, Some(s), Some(e)).await?;
        Ok(json!({
            "summary": {
                "net_revenue": summary.total_revenue,
                "total_expenses": summary.total_expenses,
                "net_cashflow": summary.net_cashflow,
                "revenue_count": summary.revenue_count,
                "expense_count": summary.expense_count,
            },
            "portfolio": portfolio,
        }))
    }

    pub async fn answer_question(&self, question: &str, year: i32) -> Result<Value, AppError> {
        let (s, e) = year_bounds(year);
        let all = settings::get_all(&self.pool).await?;
        let provider = all["ai_provider"].as_str().unwrap_or("hostwise");

        if provider != "hostwise" {
            if let Some(reply) = LlmProvider::call(
                &all,
                "You are HostWise, a vacation-rental financial advisor. Answer concisely and use the portfolio data if relevant.",
                question,
            )
            .await
            {
                return Ok(json!({ "provider": provider, "answer": reply, "year": year }));
            }
        }

        let analysis = rules::analyze_financial_performance(&self.pool, &s, &e, year).await?;
        let answer = format!(
            "{} Here is a quick summary: {}",
            question,
            analysis["summary_text"].as_str().unwrap_or("")
        );
        Ok(json!({ "provider": "hostwise", "answer": answer, "year": year }))
    }

    pub async fn test_llm_connection(&self) -> Result<Value, AppError> {
        let all = settings::get_all(&self.pool).await?;
        let provider = all["ai_provider"].as_str().unwrap_or("hostwise");
        if provider == "hostwise" {
            return Ok(json!({
                "ok": true,
                "provider": "hostwise",
                "message": "Using the built-in rules engine — no external connection needed.",
            }));
        }
        match LlmProvider::call(&all, "You are a connectivity check.", "Reply with exactly: ok").await {
            Some(_) => Ok(json!({
                "ok": true,
                "provider": provider,
                "message": "Connection successful.",
            })),
            None => Ok(json!({
                "ok": false,
                "provider": provider,
                "message": "Could not reach the LLM provider. Check your API key, base URL, and model.",
            })),
        }
    }

    pub async fn simulate_scenario(
        &self,
        scenario: &str,
        params: &Value,
        year: i32,
    ) -> Result<Value, AppError> {
        let (s, e) = year_bounds(year);
        let finance = FinanceService::from_pool(self.pool.clone());
        let summary = finance.get_summary(Some(&s), Some(&e)).await?;
        let net = summary.total_revenue;
        let expenses = summary.total_expenses;
        let profit = net - expenses;

        let (impact, explanation): (f64, String) = match scenario {
            "price_increase" => {
                let pct = params.get("increase_pct").and_then(|v| v.as_f64()).unwrap_or(5.0);
                let gain = net * pct / 100.0;
                (
                    gain,
                    format!("Raising prices by {pct:.0}% could add ~{gain:.0} in net revenue."),
                )
            }
            "hire_cleaner" => {
                let monthly = params.get("monthly_cost").and_then(|v| v.as_f64()).unwrap_or(300.0);
                let cost = -monthly * 12.0;
                (
                    cost,
                    format!("Hiring a cleaner at {monthly:.0}/month costs ~{:.0} per year.", cost.abs()),
                )
            }
            "expense_reduction" => {
                let pct = params.get("reduction_pct").and_then(|v| v.as_f64()).unwrap_or(10.0);
                let saved = expenses * pct / 100.0;
                (
                    saved,
                    format!("Cutting expenses by {pct:.0}% saves ~{saved:.0} per period."),
                )
            }
            "minimum_stay" => {
                let nights = params.get("nights").and_then(|v| v.as_f64()).unwrap_or(2.0);
                (
                    0.0,
                    format!(
                        "A {nights:.0}-night minimum stay reduces turnover; the impact depends on demand."
                    ),
                )
            }
            _ => return Err(AppError::Validation("Unknown scenario".into())),
        };

        Ok(json!({
            "scenario": scenario,
            "year": year,
            "current_profit": profit,
            "estimated_impact": impact,
            "projected_profit": profit + impact,
            "explanation": explanation,
        }))
    }
}

/// Flatten `priority_actions` into a single recommendations list.
pub fn flatten_actions(ai: &Value) -> Vec<Value> {
    let mut out = Vec::new();
    if let Some(obj) = ai.get("priority_actions").and_then(|v| v.as_object()) {
        for k in ["critical", "medium", "low"] {
            if let Some(arr) = obj.get(k).and_then(|v| v.as_array()) {
                out.extend(arr.iter().cloned());
            }
        }
    }
    out
}

fn year_bounds(year: i32) -> (String, String) {
    (format!("{year:04}-01-01"), format!("{year:04}-12-31"))
}

fn period(year: Option<i32>, start: Option<&str>, end: Option<&str>) -> (i32, String, String) {
    match (start, end) {
        (Some(s), Some(e)) => {
            let y = s[..4].parse().unwrap_or_else(|_| chrono::Local::now().year());
            (y, s.to_string(), e.to_string())
        }
        _ => {
            let y = year.unwrap_or_else(|| chrono::Local::now().year());
            (y, format!("{y:04}-01-01"), format!("{y:04}-12-31"))
        }
    }
}
