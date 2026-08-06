//! HostWise built-in rules engine — deterministic, rule-based financial
//! analysis for the AI advisor. Mirrors `backend/app/ai/rules.py`.

use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::analytics::service as analytics;
use crate::core::error::AppError;
use crate::finance::service::FinanceService;
use crate::settings::service as settings;

const CURRENCY_SYMBOL: &[(&str, &str)] = &[
    ("USD", "$"),
    ("EUR", "€"),
    ("GBP", "£"),
    ("MAD", "MAD "),
    ("AED", "AED "),
    ("CAD", "C$"),
    ("AUD", "A$"),
    ("CHF", "CHF "),
];

fn symbol(cur: &str) -> String {
    CURRENCY_SYMBOL
        .iter()
        .find(|(k, _)| *k == cur)
        .map(|(_, s)| s.to_string())
        .unwrap_or_else(|| format!("{cur} "))
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// Prior-year net revenue for YoY comparison.
async fn prev_year_net(pool: &SqlitePool, year: i32) -> Result<Option<f64>, AppError> {
    let start = format!("{}-01-01", year - 1);
    let end = format!("{}-12-31", year - 1);
    let net: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(net_amount),0.0) FROM revenues WHERE is_deleted = 0 AND date >= ? AND date <= ?",
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;
    Ok((net > 0.0).then_some(net))
}

/// Rule-based financial performance analysis for a period.
pub async fn analyze_financial_performance(
    pool: &SqlitePool,
    start: &str,
    end: &str,
    year: i32,
) -> Result<Value, AppError> {
    let all = settings::get_all(pool).await?;
    let cur = all["default_currency"].as_str().unwrap_or("EUR").to_string();
    let sym = symbol(&cur);

    let portfolio = analytics::get_portfolio_analytics(pool, None, Some(start), Some(end)).await?;
    let finance = FinanceService::from_pool(pool.clone());
    let summary = finance.get_summary(Some(start), Some(end)).await?;

    let net_rev = summary.total_revenue;
    let expenses = summary.total_expenses;
    let gross = portfolio["total_gross_revenue"].as_f64().unwrap_or(net_rev);
    let profit = net_rev - expenses;
    let profit_margin = if net_rev > 0.0 { (profit / net_rev) * 100.0 } else { 0.0 };
    let expense_ratio = if gross > 0.0 { (expenses / gross) * 100.0 } else { 0.0 };
    let cancellation_rate = portfolio["cancellation_rate"].as_f64().unwrap_or(0.0);

    let mut recommendations: Vec<Value> = Vec::new();

    // 1. Profit margin.
    if profit_margin < 0.0 {
        recommendations.push(json!({
            "type": "critical",
            "title": "Negative Profit Margin Detected",
            "cause": format!("Profit margin is {profit_margin:.2}%. Expenses exceed net revenue."),
            "business_impact": "Portfolio is losing money. Unsustainable trajectory.",
            "suggested_action": "Immediately review top expense categories. Consider reducing non-essential spending and adjusting pricing.",
            "expected_improvement": "Target: Return to positive margin within 2 months.",
            "confidence_score": 0.95,
            "supporting_metrics": { "profit_margin": round2(profit_margin), "total_expenses": round2(expenses), "net_revenue": round2(net_rev) },
        }));
    } else if profit_margin < 15.0 {
        recommendations.push(json!({
            "type": "warning",
            "title": "Low Profit Margin",
            "cause": format!("Profit margin is only {profit_margin:.2}%."),
            "business_impact": "Limited profitability reduces ability to reinvest and handle unexpected costs.",
            "suggested_action": "Analyze expense categories for savings. Consider a 3-5% price adjustment on low-occupancy days.",
            "expected_improvement": "Potential margin improvement of 5-8%.",
            "confidence_score": 0.82,
            "supporting_metrics": { "profit_margin": round2(profit_margin), "net_revenue": round2(net_rev) },
        }));
    }

    // 2. Revenue growth (YoY).
    if let Some(prev_net) = prev_year_net(pool, year).await? {
        let growth = ((net_rev - prev_net) / prev_net) * 100.0;
        if growth < -10.0 {
            recommendations.push(json!({
                "type": "critical",
                "title": "Revenue Declining Significantly",
                "cause": format!("Year-over-year revenue decreased by {:.0}%.", growth.abs()),
                "business_impact": format!("At current trajectory, annual revenue could drop by ~{sym}{:.0}.", (net_rev * growth / 100.0).abs()),
                "suggested_action": "Investigate: has occupancy dropped? Are competitors lowering prices? Review listing quality and pricing.",
                "expected_improvement": format!("Reversing the trend could recover {:.0}% of lost revenue.", growth.abs()),
                "confidence_score": 0.88,
                "supporting_metrics": { "revenue_growth_yoy": round2(growth), "current_net_revenue": round2(net_rev) },
            }));
        } else if growth < 0.0 {
            recommendations.push(json!({
                "type": "warning",
                "title": "Revenue Growth Slowing",
                "cause": format!("Year-over-year revenue decreased by {:.0}%.", growth.abs()),
                "business_impact": "Portfolio is underperforming compared to the previous year.",
                "suggested_action": "Check seasonal trends. Consider promotional pricing for shoulder seasons.",
                "expected_improvement": "Small adjustments could bring growth back to flat or positive.",
                "confidence_score": 0.75,
                "supporting_metrics": { "revenue_growth_yoy": round2(growth) },
            }));
        } else if growth > 10.0 {
            recommendations.push(json!({
                "type": "positive",
                "title": "Strong Revenue Growth",
                "cause": format!("Revenue grew {growth:.0}% year-over-year."),
                "business_impact": "Portfolio is performing well. Opportunity to reinvest or expand.",
                "suggested_action": "Consider adding properties. Reinvest profits into property upgrades.",
                "expected_improvement": "Sustained growth could compound significantly.",
                "confidence_score": 0.90,
                "supporting_metrics": { "revenue_growth_yoy": round2(growth) },
            }));
        }
    }

    // 3. Expense ratio.
    if expense_ratio > 55.0 {
        recommendations.push(json!({
            "type": "warning",
            "title": "High Expense Ratio",
            "cause": format!("Expenses consume {expense_ratio:.1}% of gross revenue."),
            "business_impact": "High operating costs erode profitability.",
            "suggested_action": "Benchmark each expense category; negotiate with vendors and clean up recurring costs.",
            "expected_improvement": "Lowering the ratio to ~40% could improve profit meaningfully.",
            "confidence_score": 0.78,
            "supporting_metrics": { "expense_ratio": round2(expense_ratio), "total_expenses": round2(expenses) },
        }));
    }

    // 4. Cancellation rate.
    if cancellation_rate > 12.0 {
        recommendations.push(json!({
            "type": "warning",
            "title": "High Cancellation Rate",
            "cause": format!("{cancellation_rate:.1}% of reservations were cancelled."),
            "business_impact": "Lost revenue and unpredictable occupancy.",
            "suggested_action": "Review cancellation policies and listing accuracy (photos, amenities, location).",
            "expected_improvement": "Tighter policies can reduce cancellations by a few points.",
            "confidence_score": 0.7,
            "supporting_metrics": { "cancellation_rate": round2(cancellation_rate) },
        }));
    }

    // 5. Positive signal.
    if profit_margin >= 20.0 && cancellation_rate <= 5.0 {
        recommendations.push(json!({
            "type": "positive",
            "title": "Healthy Portfolio Performance",
            "cause": "Strong profit margin with a low cancellation rate.",
            "business_impact": "Good foundation to reinvest and grow.",
            "suggested_action": "Consider expanding capacity or raising rates on high-demand dates.",
            "expected_improvement": "Incremental revenue with minimal added cost.",
            "confidence_score": 0.85,
            "supporting_metrics": { "profit_margin": round2(profit_margin), "cancellation_rate": round2(cancellation_rate) },
        }));
    }

    Ok(json!({
        "summary_text": format!(
            "Net revenue {sym}{net_rev:.2}, expenses {sym}{expenses:.2}, profit {sym}{profit:.2} \
             ({profit_margin:.1}% margin, {expense_ratio:.1}% expense ratio, \
             {cancellation_rate:.1}% cancellation)."
        ),
        "recommendations": recommendations,
        "metrics": {
            "net_revenue": round2(net_rev),
            "total_expenses": round2(expenses),
            "profit": round2(profit),
            "profit_margin": round2(profit_margin),
            "expense_ratio": round2(expense_ratio),
            "cancellation_rate": round2(cancellation_rate),
            "reservation_count": portfolio["reservation_count"],
            "nights": portfolio["nights"],
            "property_count": portfolio["properties"].as_array().map(|a| a.len() as i64).unwrap_or(0),
        },
    }))
}

/// Build the full advisor report structure (rules engine output).
pub async fn generate_advisor_report(
    pool: &SqlitePool,
    start: &str,
    end: &str,
    year: i32,
) -> Result<Value, AppError> {
    let analysis = analyze_financial_performance(pool, start, end, year).await?;
    let metrics = analysis["metrics"].clone();
    let recs = analysis["recommendations"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let pm = metrics["profit_margin"].as_f64().unwrap_or(0.0);
    let cr = metrics["cancellation_rate"].as_f64().unwrap_or(0.0);
    let mut score = 55.0 + (pm.clamp(0.0, 25.0) / 25.0) * 35.0 - (cr / 100.0) * 30.0;
    score = score.clamp(0.0, 100.0).round();
    let status = if score >= 75.0 {
        "excellent"
    } else if score >= 50.0 {
        "good"
    } else if score >= 25.0 {
        "average"
    } else {
        "poor"
    };

    let (mut critical, mut medium, mut low) = (Vec::new(), Vec::new(), Vec::new());
    let (mut opportunities, mut risks) = (Vec::new(), Vec::new());
    for r in &recs {
        match r["type"].as_str() {
            Some("critical") => critical.push(r.clone()),
            Some("warning") => medium.push(r.clone()),
            Some("positive") => {
                opportunities.push(r.clone());
                low.push(r.clone());
            }
            _ => low.push(r.clone()),
        }
        if r["type"] == "critical" || r["type"] == "warning" {
            risks.push(json!({
                "risk": r["title"],
                "impact": r["business_impact"],
                "confidence": r["confidence_score"],
            }));
        }
    }

    let exec = format!(
        "{} Portfolio health is {}. Net revenue {} with a profit margin of {:.1}%. {}",
        analysis["summary_text"],
        status,
        metrics["net_revenue"].as_f64().unwrap_or(0.0),
        pm,
        if recs.is_empty() {
            "No critical issues detected.".to_string()
        } else {
            format!("{} recommendation(s) to review.", recs.len())
        }
    );

    Ok(json!({
        "executive_summary": exec,
        "provider": "hostwise",
        "health_score": { "score": score as i64, "status": status },
        "priority_actions": { "critical": critical, "medium": medium, "low": low },
        "opportunities": opportunities,
        "lost_revenue": null,
        "risks": risks,
        "property_reviews": [],
        "forecast": null,
        "achievements": [],
        "recommended_goals": [],
        "trend_explanations": [],
        "metrics": metrics,
    }))
}
