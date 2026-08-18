//! AI advisor orchestrator — the **decision** layer.
//!
//! It uses the HostWise **rules engine** (`rules.rs`) by default and delegates
//! to the external **LLM API** (`llm.rs`) only when the user has configured an
//! external provider. Rules logic and provider/API logic stay in their own
//! files so each responsibility is isolated: `rules.rs` owns the built-in
//! engine, `llm.rs` owns everything that talks to an outside model.

use chrono::Datelike;
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::ai::{llm, rules};
use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::finance::service::FinanceService;

pub struct AiAdvisorService {
    pub pool: SqlitePool,
}

impl AiAdvisorService {
    pub fn new(state: AppState) -> Self {
        Self { pool: state.pool }
    }

    /// Rules-engine-only analysis (no external LLM involved).
    pub async fn analyze_financial_performance(&self) -> Result<Value, AppError> {
        let year = chrono::Local::now().year();
        let (s, e) = year_bounds(year);
        rules::analyze_financial_performance(&self.pool, &s, &e, year).await
    }

    /// Advisor report: rules engine first; then, when an external provider is
    /// configured, let the LLM API enhance/replace it.
    pub async fn generate_advisor_report(
        &self,
        year: Option<i32>,
        start: Option<&str>,
        end: Option<&str>,
    ) -> Result<Value, AppError> {
        let (y, s, e) = period(year, start, end);
        let report = rules::generate_advisor_report(&self.pool, &s, &e, y).await?;
        let all = llm::llm_settings(&self.pool).await?;
        if all["ai_provider"].as_str().unwrap_or("hostwise") != "hostwise" {
            return llm::enhance_report(&self.pool, &all, &s, &e, report).await;
        }
        Ok(report)
    }

    /// Q&A: external LLM when configured, otherwise a rules-engine summary.
    pub async fn answer_question(&self, question: &str, year: i32) -> Result<Value, AppError> {
        let all = llm::llm_settings(&self.pool).await?;
        let provider = all["ai_provider"]
            .as_str()
            .unwrap_or("hostwise")
            .to_string();
        if provider != "hostwise" {
            if let Some(answer) = llm::answer(&all, question).await {
                return Ok(json!({ "provider": provider, "answer": answer, "year": year }));
            }
        }

        let (s, e) = year_bounds(year);
        let analysis = rules::analyze_financial_performance(&self.pool, &s, &e, year).await?;
        let answer = format!(
            "{} Here is a quick summary: {}",
            question,
            analysis["summary_text"].as_str().unwrap_or("")
        );
        Ok(json!({ "provider": "hostwise", "answer": answer, "year": year }))
    }

    /// Probe the configured external provider (rules engine always "succeeds").
    pub async fn test_llm_connection(&self) -> Result<Value, AppError> {
        llm::test_connection(&self.pool).await
    }

    /// What-if scenario (rules engine, no external LLM). Returns the exact
    /// `ScenarioResult` contract the frontend simulator expects: a baseline
    /// (current revenue/expenses/profit), impact deltas, projected values and a
    /// confidence — previously the backend returned flat fields the UI didn't
    /// understand (crashed: 'result.baseline.revenue').
    pub async fn simulate_scenario(
        &self,
        scenario: &str,
        params: &Value,
        year: i32,
    ) -> Result<Value, AppError> {
        let (s, e) = year_bounds(year);
        let finance = FinanceService::from_pool(self.pool.clone());
        let summary = finance.get_summary(Some(&s), Some(&e)).await?;
        let revenue = summary.net_revenue;
        let expenses = summary.total_expenses;
        let profit = revenue - expenses;

        // Read the param the frontend sends (pct / cost / nights), keeping the
        // old key names as a fallback.
        let get_f64 = |keys: &[&str], fallback: f64| -> f64 {
            for k in keys {
                if let Some(v) = params.get(*k).and_then(|v| v.as_f64()) {
                    return v;
                }
            }
            fallback
        };

        let (label, revenue_delta, expenses_delta, profit_delta, confidence): (
            String,
            f64,
            f64,
            f64,
            f64,
        ) = match scenario {
            "price_increase" => {
                let pct = get_f64(&["pct", "increase_pct"], 10.0);
                let gain = revenue * pct / 100.0;
                (format!("Increase prices {pct:.0}%"), gain, 0.0, gain, 85.0)
            }
            "hire_cleaner" => {
                let monthly = get_f64(&["cost", "monthly_cost"], 300.0);
                let cost = monthly * 12.0;
                (
                    format!("Hire a cleaner ({monthly:.0}/month)"),
                    0.0,
                    cost,
                    -cost,
                    80.0,
                )
            }
            "expense_reduction" => {
                let pct = get_f64(&["pct", "reduction_pct"], 10.0);
                let saved = expenses * pct / 100.0;
                (format!("Cut expenses {pct:.0}%"), 0.0, -saved, saved, 85.0)
            }
            "minimum_stay" => {
                let nights = get_f64(&["nights"], 2.0);
                (
                    format!("Increase minimum stay to {nights:.0} nights"),
                    0.0,
                    0.0,
                    0.0,
                    55.0,
                )
            }
            _ => return Err(AppError::Validation("Unknown scenario".into())),
        };

        Ok(json!({
            "scenario": scenario,
            "year": year,
            "label": label,
            "baseline": {
                "revenue": revenue,
                "expenses": expenses,
                "profit": profit,
            },
            "impact": {
                "revenue_delta": revenue_delta,
                "expenses_delta": expenses_delta,
                "profit_delta": profit_delta,
            },
            "projected": {
                "revenue": revenue + revenue_delta,
                "expenses": expenses + expenses_delta,
                "profit": profit + profit_delta,
            },
            "confidence": confidence,
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
            let y = s[..4]
                .parse()
                .unwrap_or_else(|_| chrono::Local::now().year());
            (y, s.to_string(), e.to_string())
        }
        _ => {
            let y = year.unwrap_or_else(|| chrono::Local::now().year());
            (y, format!("{y:04}-01-01"), format!("{y:04}-12-31"))
        }
    }
}
