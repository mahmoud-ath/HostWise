//! HostWise built-in rules engine — deterministic, rule-based financial
//! analysis for the AI advisor. Mirrors `backend/app/ai/rules.py`.

use chrono::Datelike;
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
fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}
fn money(v: f64, sym: &str) -> String {
    format!("{sym}{:.0}", v)
}

/// Number of days in an inclusive [start, end] date range.
fn days_between(start: &str, end: &str) -> f64 {
    match (
        chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d"),
        chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d"),
    ) {
        (Ok(s), Ok(e)) => ((e - s).num_days() + 1).max(1) as f64,
        _ => 365.0,
    }
}

/// The same-length window immediately before [start, end] (period-over-period).
fn prev_window(start: &str, end: &str) -> (String, String) {
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
    let cur = all["default_currency"]
        .as_str()
        .unwrap_or("EUR")
        .to_string();
    let sym = symbol(&cur);

    let portfolio = analytics::get_portfolio_analytics(pool, None, Some(start), Some(end)).await?;
    let finance = FinanceService::from_pool(pool.clone());
    let summary = finance.get_summary(Some(start), Some(end)).await?;

    let net_rev = summary.net_revenue;
    let expenses = summary.total_expenses;
    let gross = portfolio["total_gross_revenue"].as_f64().unwrap_or(net_rev);
    let profit = net_rev - expenses;
    let profit_margin = if net_rev > 0.0 {
        (profit / net_rev) * 100.0
    } else {
        0.0
    };
    let expense_ratio = if gross > 0.0 {
        (expenses / gross) * 100.0
    } else {
        0.0
    };
    let cancellation_rate = portfolio["cancellation_rate"].as_f64().unwrap_or(0.0);
    let prev_net_opt = prev_year_net(pool, year).await?;
    let growth = match prev_net_opt {
        Some(prev_net) if prev_net > 0.0 => round2(((net_rev - prev_net) / prev_net) * 100.0),
        _ => 0.0,
    };

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
    if let Some(_prev_net) = prev_net_opt {
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

    let exec_text = format!(
        "Net revenue {sym}{net_rev:.2}, expenses {sym}{expenses:.2}, profit {sym}{profit:.2} \
         ({profit_margin:.1}% margin, {expense_ratio:.1}% expense ratio, \
         {cancellation_rate:.1}% cancellation)."
    );
    let key_metrics = json!({
        "gross_revenue": round2(gross),
        "net_revenue": round2(net_rev),
        "total_expenses": round2(expenses),
        "profit": round2(profit),
        "profit_margin": round2(profit_margin),
        "expense_ratio": round2(expense_ratio),
        "cancellation_rate": round2(cancellation_rate),
        "revenue_growth_yoy": growth,
        "reservation_count": portfolio["reservation_count"],
        "nights": portfolio["nights"],
        "property_count": portfolio["properties"].as_array().map(|a| a.len() as i64).unwrap_or(0),
    });
    let critical_count = recommendations
        .iter()
        .filter(|r| r["type"] == "critical")
        .count() as i64;
    let warning_count = recommendations
        .iter()
        .filter(|r| r["type"] == "warning")
        .count() as i64;

    Ok(json!({
        "executive_summary": exec_text,
        "key_metrics": key_metrics,
        "recommendations": recommendations,
        "critical_count": critical_count,
        "warning_count": warning_count,
        // Legacy aliases.
        "summary_text": exec_text,
        "metrics": key_metrics.clone(),
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

    let all = settings::get_all(pool).await?;
    let cur = all["default_currency"]
        .as_str()
        .unwrap_or("EUR")
        .to_string();
    let sym = symbol(&cur);

    let pm = metrics["profit_margin"].as_f64().unwrap_or(0.0);
    let cr = metrics["cancellation_rate"].as_f64().unwrap_or(0.0);
    let expense_ratio = metrics["expense_ratio"].as_f64().unwrap_or(0.0);
    let net_rev = metrics["net_revenue"].as_f64().unwrap_or(0.0);
    let gross_rev = metrics["gross_revenue"].as_f64().unwrap_or(net_rev);
    let profit = metrics["profit"].as_f64().unwrap_or(0.0);
    let growth = metrics["revenue_growth_yoy"].as_f64().unwrap_or(0.0);
    let total_expenses = metrics["total_expenses"].as_f64().unwrap_or(0.0);
    let property_count = metrics["property_count"].as_i64().unwrap_or(0) as f64;
    let nights = metrics["nights"].as_i64().unwrap_or(0) as f64;
    let total_reservations = metrics["reservation_count"].as_i64().unwrap_or(0);
    let days = days_between(start, end);

    // Portfolio occupancy proxy: nights vs 60% of the window's nights per property.
    let occupancy = if days > 0.0 && property_count > 0.0 {
        (nights / (days * 0.6 * property_count)).clamp(0.0, 1.0)
    } else {
        0.0
    };

    // Four self-explanatory pillars (0-100) that drive the score:
    //   profit = profitability (profit margin), growth = revenue trend (YoY),
    //   expenses = share of revenue not consumed by costs, risk = cancellations.
    let profit_c = (pm.clamp(0.0, 40.0) * 2.5).round();
    let growth_c = (50.0 + growth.clamp(-50.0, 50.0)).round();
    let expenses_c = (100.0 - expense_ratio.clamp(0.0, 100.0)).round();
    let risk_c = (100.0 - cr * 2.0).clamp(0.0, 100.0).round();
    let mut score = (profit_c * 30.0 + growth_c * 30.0 + expenses_c * 20.0 + risk_c * 20.0) / 100.0;
    score = score.clamp(0.0, 100.0).round();
    let status = if score >= 80.0 {
        "excellent"
    } else if score >= 60.0 {
        "good"
    } else if score >= 40.0 {
        "average"
    } else {
        "poor"
    };

    let (mut critical, mut medium, mut low) = (Vec::new(), Vec::new(), Vec::new());
    let mut risks: Vec<Value> = Vec::new();
    for r in &recs {
        match r["type"].as_str() {
            Some("critical") => critical.push(r.clone()),
            Some("warning") => medium.push(r.clone()),
            _ => low.push(r.clone()),
        }
    }

    let exec = format!(
        "Your portfolio generated {} in net revenue against {} in expenses, leaving a profit of {} — a {:.1}% margin, a {:.1}% expense ratio and a {:.1}% cancellation rate. Overall health is {} at {:.0}/100. {} {}",
        money(net_rev, &sym),
        money(total_expenses, &sym),
        money(profit, &sym),
        pm,
        expense_ratio,
        cr,
        status,
        score,
        if growth < -1.0 {
            format!(
                "Revenue fell {:.1}% year over year, driven by fewer reservations and higher costs.",
                growth.abs()
            )
        } else if growth > 5.0 {
            format!("Revenue grew {growth:.1}% year over year.")
        } else {
            "Revenue was broadly flat year over year.".to_string()
        },
        if recs.is_empty() {
            String::new()
        } else {
            format!("{} recommendation(s) follow below.", recs.len())
        }
    );

    let components = json!({
        "profit": profit_c as i64,
        "growth": growth_c as i64,
        "expenses": expenses_c as i64,
        "risk": risk_c as i64,
    });
    let current_metrics = json!({
        "net_revenue": net_rev,
        "gross_revenue": gross_rev,
        "total_expenses": metrics["total_expenses"],
        "profit": metrics["profit"],
        "profit_margin": pm,
        "cancellation_rate": cr,
        "revenue_growth_yoy": growth,
        "property_count": metrics["property_count"],
    });

    // Per-property ranking (drives risk detection, reviews, forecast best property).
    let portfolio = analytics::get_portfolio_analytics(pool, None, Some(start), Some(end)).await?;
    let ranking = portfolio["property_ranking"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    // Prior-period analytics (same window one year back) for trend explanations.
    let (ps, pe) = prev_window(start, end);
    let prev_portfolio =
        analytics::get_portfolio_analytics(pool, None, Some(&ps), Some(&pe)).await?;
    let prev_net = prev_portfolio["total_net_revenue"].as_f64().unwrap_or(0.0);
    let prev_exp = prev_portfolio["total_expenses"].as_f64().unwrap_or(0.0);
    let prev_profit = prev_net - prev_exp;
    let prev_cr = prev_portfolio["cancellation_rate"].as_f64().unwrap_or(0.0);
    let prev_res = prev_portfolio["reservation_count"].as_i64().unwrap_or(0);

    // Risks: underperforming properties (negative margin, poor health, low occupancy).
    for p in ranking.iter() {
        let p_pm = p["profit_margin"].as_f64().unwrap_or(0.0);
        let p_hs = p["health_score"].as_i64().unwrap_or(0);
        let p_occ = p["occupancy"].as_f64().unwrap_or(0.0);
        let p_res = p["reservation_count"].as_i64().unwrap_or(0);
        let high = p_pm < 0.0;
        let medium_risk = !high && (p_hs < 40 || (p_occ < 0.3 && p_res > 0));
        if high || medium_risk {
            risks.push(json!({
                "level": if high { "high" } else { "medium" },
                "property_name": p["property_name"].as_str().unwrap_or("Property"),
                "revenue_trend_pct": Value::Null,
                "profit_margin": round2(p_pm),
                "health_score": p_hs,
                "recommendation": if high {
                    "Negative profit margin — review expenses and pricing urgently."
                } else if p_hs < 40 {
                    "Below-average health score — improve occupancy or reduce costs."
                } else {
                    "Low occupancy — review pricing, listings, and demand drivers."
                },
            }));
        }
    }

    // Opportunities: concrete levers tied to the actual performance gaps.
    let cancellation_loss = net_rev * cr / 100.0;
    let decline_loss = if growth < 0.0 {
        net_rev * growth.abs() / 100.0
    } else {
        0.0
    };
    let occupancy_gap = if occupancy < 0.6 && occupancy > 0.0 {
        ((0.6 - occupancy) / 0.6) * 0.5
    } else if occupancy == 0.0 && property_count > 0.0 {
        0.5
    } else {
        0.0
    };

    let mut opp_actions: Vec<Value> = Vec::new();
    if decline_loss > 1.0 {
        opp_actions.push(json!({
            "title": "Recover revenue decline",
            "detail": format!(
                "Revenue fell {:.1}% year over year — review pricing, listings and demand drivers.",
                growth.abs()
            ),
            "gain": round2(decline_loss),
        }));
    }
    if cr > 12.0 {
        opp_actions.push(json!({
            "title": "Reduce cancellations",
            "detail": format!(
                "Cancellation rate is {cr:.1}% — tighten the policy and improve listing accuracy."
            ),
            "gain": round2(cancellation_loss),
        }));
    }
    if occupancy_gap > 0.0 {
        opp_actions.push(json!({
            "title": "Improve occupancy",
            "detail": format!(
                "Occupancy is around {:.0}% — fill low-demand periods with promotional pricing.",
                round1(occupancy * 100.0)
            ),
            "gain": round2(net_rev * occupancy_gap),
        }));
    }
    if growth > 5.0 {
        opp_actions.push(json!({
            "title": "Capture growth momentum",
            "detail": format!(
                "Revenue grew {growth:.1}% year over year — reinvest into high-demand properties."
            ),
            "gain": round2(net_rev * growth / 100.0),
        }));
    }
    if opp_actions.is_empty() && net_rev > 0.0 {
        opp_actions.push(json!({
            "title": "Reinvest in top performer",
            "detail": "Portfolio is healthy — reinvest profits into the best-performing properties.",
            "gain": round2(net_rev * 0.02),
        }));
    }
    let potential_revenue = round2(
        opp_actions
            .iter()
            .map(|a| a["gain"].as_f64().unwrap_or(0.0))
            .sum(),
    );
    let opp_confidence = round2((70.0 + (property_count * 5.0).min(15.0)).clamp(40.0, 90.0));

    // Lost revenue: itemized, summed reasons behind the estimate.
    let estimated_lost_revenue = round2(cancellation_loss + decline_loss);
    let mut lost_reasons: Vec<Value> = Vec::new();
    if cancellation_loss > 0.0 {
        lost_reasons.push(json!({
            "reason": "Cancellations",
            "detail": format!(
                "{cr:.1}% of reservations were cancelled, reducing occupancy and net revenue."
            ),
            "amount": round2(cancellation_loss),
        }));
    }
    if decline_loss > 0.0 {
        lost_reasons.push(json!({
            "reason": "Revenue decline",
            "detail": format!(
                "Year-over-year revenue fell {:.1}% versus the prior period.",
                growth.abs()
            ),
            "amount": round2(decline_loss),
        }));
    }

    // Forecast for the next month.
    let risk_level = match status {
        "excellent" | "good" => "low",
        "average" => "medium",
        _ => "high",
    };
    let best_property = ranking
        .first()
        .and_then(|p| p["property_name"].as_str())
        .unwrap_or("");
    let expected_revenue = round2(net_rev / 12.0);
    let forecast_confidence = round2(
        (60.0 + (property_count * 5.0).min(15.0) + (total_reservations as f64).min(15.0))
            .clamp(35.0, 90.0),
    );

    // Trend explanations: why key KPIs changed vs the prior period.
    let mut trend_explanations: Vec<Value> = Vec::new();
    let res_delta = total_reservations - prev_res;
    if prev_net > 0.0 && net_rev > 0.0 {
        let chg = round1((net_rev - prev_net) / prev_net * 100.0);
        if chg.abs() >= 0.1 {
            let up = chg >= 0.0;
            let mut reasons = vec![format!(
                "Reservation volume {} ({} vs {} in the prior period).",
                if res_delta >= 0 {
                    "increased"
                } else {
                    "decreased"
                },
                total_reservations,
                prev_res
            )];
            if (cr - prev_cr).abs() >= 0.1 {
                reasons.push(format!(
                    "Cancellations {} to {cr:.1}% (from {prev_cr:.1}%).",
                    if cr > prev_cr { "rose" } else { "fell" }
                ));
            }
            trend_explanations.push(json!({
                "metric": "Net Revenue",
                "direction": if up { "up" } else { "down" },
                "change_pct": chg.abs(),
                "reasons": reasons,
            }));
        }
    }
    if prev_exp > 0.0 && total_expenses > 0.0 {
        let chg = round1((total_expenses - prev_exp) / prev_exp * 100.0);
        if chg.abs() >= 0.1 {
            trend_explanations.push(json!({
                "metric": "Total Expenses",
                "direction": if chg >= 0.0 { "up" } else { "down" },
                "change_pct": chg.abs(),
                "reasons": vec![format!(
                    "Spending {} by {:.1}% compared to the prior period (now {:.0} total).",
                    if chg >= 0.0 { "grew" } else { "fell" },
                    chg.abs(),
                    total_expenses
                )],
            }));
        }
    }
    if prev_profit != 0.0 && profit != 0.0 {
        let chg = round1((profit - prev_profit) / prev_profit.abs() * 100.0);
        if chg.abs() >= 0.1 {
            trend_explanations.push(json!({
                "metric": "Profit",
                "direction": if chg >= 0.0 { "up" } else { "down" },
                "change_pct": chg.abs(),
                "reasons": vec![format!(
                    "Profit {} by {:.1}% as revenue {} relative to expenses.",
                    if chg >= 0.0 { "grew" } else { "shrank" },
                    chg.abs(),
                    if (net_rev - prev_net) >= 0.0 { "outpaced" } else { "lagged" }
                )],
            }));
        }
    }

    // Recommended goals: concrete, measurable targets.
    let mut recommended_goals: Vec<Value> = Vec::new();
    if expense_ratio > 40.0 {
        recommended_goals.push(json!({
            "label": "Reduce expense ratio",
            "current": format!("{:.1}%", expense_ratio),
            "target": "40%",
            "progress": round2((40.0 / expense_ratio) * 100.0).clamp(5.0, 95.0),
        }));
    }
    if occupancy < 0.6 {
        recommended_goals.push(json!({
            "label": "Improve occupancy",
            "current": format!("{:.0}%", round1(occupancy * 100.0)),
            "target": "60%",
            "progress": round2(occupancy / 0.6 * 100.0).clamp(5.0, 95.0),
        }));
    }
    if pm < 20.0 {
        recommended_goals.push(json!({
            "label": "Raise profit margin",
            "current": format!("{:.1}%", pm),
            "target": "20%",
            "progress": round2((pm / 20.0) * 100.0).clamp(0.0, 100.0),
        }));
    }
    if cr > 12.0 {
        recommended_goals.push(json!({
            "label": "Reduce cancellations",
            "current": format!("{:.1}%", cr),
            "target": "10%",
            "progress": round2((10.0 / cr) * 100.0).clamp(0.0, 100.0),
        }));
    }
    if growth < 0.0 {
        recommended_goals.push(json!({
            "label": "Restore revenue growth",
            "current": format!("{:.1}%", growth),
            "target": "0%",
            "progress": round2((100.0 + growth * 2.0).clamp(0.0, 100.0)),
        }));
    }

    // Achievements: wins based on positive signals.
    let mut achievements: Vec<Value> = Vec::new();
    if pm >= 20.0 {
        achievements.push(json!({
            "icon": "trophy",
            "title": "Healthy Profit Margin",
            "detail": format!("{pm:.1}% margin — comfortably above the 20% benchmark."),
        }));
    }
    if cr <= 5.0 {
        achievements.push(json!({
            "icon": "piggy-bank",
            "title": "Low Cancellations",
            "detail": format!("Only {cr:.1}% of reservations were cancelled."),
        }));
    }
    if growth >= 5.0 {
        achievements.push(json!({
            "icon": "trending-up",
            "title": "Revenue Growth",
            "detail": format!("Year-over-year revenue up {growth:.1}%."),
        }));
    }
    if expense_ratio <= 40.0 {
        achievements.push(json!({
            "icon": "sparkles",
            "title": "Cost Efficiency",
            "detail": format!("Expenses are just {expense_ratio:.1}% of gross revenue."),
        }));
    }
    if total_reservations > 0 {
        achievements.push(json!({
            "icon": "rocket",
            "title": "Active Portfolio",
            "detail": format!(
                "{total_reservations} confirmed reservations this period across {:.0} properties.",
                property_count
            ),
        }));
    }
    if achievements.is_empty() && net_rev > 0.0 {
        achievements.push(json!({
            "icon": "sparkles",
            "title": "Generating Revenue",
            "detail": format!("Portfolio produced {:.0} in net revenue this period.", net_rev),
        }));
    }

    // Property reviews: an AI-style summary for every property.
    let mut property_reviews: Vec<Value> = Vec::new();
    for p in ranking.iter() {
        let p_name = p["property_name"].as_str().unwrap_or("Property");
        let p_net = p["net_revenue"].as_f64().unwrap_or(0.0);
        let p_pm = p["profit_margin"].as_f64().unwrap_or(0.0);
        let p_hs = p["health_score"].as_i64().unwrap_or(0);
        let p_status = p["status"].as_str().unwrap_or("average");
        let p_exp = p["expense_ratio"].as_f64().unwrap_or(0.0);
        let p_occ = p["occupancy"].as_f64().unwrap_or(0.0);
        let p_res = p["reservation_count"].as_i64().unwrap_or(0);

        let mut strengths: Vec<String> = Vec::new();
        if p_pm >= 20.0 {
            strengths.push("Strong profit margin".to_string());
        }
        if p_exp > 0.0 && p_exp <= 40.0 {
            strengths.push("Efficient cost structure".to_string());
        }
        if p_occ >= 0.6 {
            strengths.push("Healthy occupancy".to_string());
        }
        if p_res >= 5 {
            strengths.push("Consistent booking volume".to_string());
        }

        let mut weaknesses: Vec<String> = Vec::new();
        if p_pm < 0.0 {
            weaknesses.push("Negative profit margin".to_string());
        } else if p_pm < 15.0 {
            weaknesses.push("Thin profit margin".to_string());
        }
        if p_exp > 55.0 {
            weaknesses.push("High expense ratio".to_string());
        }
        if p_occ < 0.4 && p_res > 0 {
            weaknesses.push("Low occupancy".to_string());
        }
        if p_res == 0 {
            weaknesses.push("No reservations in this period".to_string());
        }
        if weaknesses.is_empty() {
            weaknesses.push("No major concerns".to_string());
        }

        let has_concerns = weaknesses.iter().any(|w| w != "No major concerns");
        let ai_summary = format!(
            "{} earned {:.0} in net revenue at a {:.1}% margin with a health score of {:.0}/100. {}",
            p_name,
            p_net,
            p_pm,
            p_hs,
            if has_concerns {
                "Focus areas are occupancy and cost control."
            } else {
                "Performance looks healthy this period."
            }
        );
        let suggested_action = if p_pm < 0.0 {
            "Review expenses and pricing immediately to restore profitability."
        } else if p_occ < 0.4 && p_res > 0 {
            "Improve occupancy with pricing and listing optimisation."
        } else if p_exp > 55.0 {
            "Benchmark and reduce operating costs."
        } else if p_res == 0 {
            "Boost demand — review listings and visibility."
        } else {
            "Maintain current performance and consider reinvestment."
        };

        property_reviews.push(json!({
            "property_id": p["property_id"],
            "property_name": p_name,
            "health_score": p_hs,
            "status": p_status,
            "net_revenue": round2(p_net),
            "profit_margin": round2(p_pm),
            "expense_ratio": round2(p_exp),
            "ai_summary": ai_summary,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "suggested_action": suggested_action,
        }));
    }

    Ok(json!({
        "year": year,
        "generated_at": chrono::Local::now().format("%Y-%m-%d").to_string(),
        "executive_summary": exec,
        "provider": "hostwise",
        "key_metrics": metrics.clone(),
        "current_metrics": current_metrics,
        "health_score": {
            "score": score as i64,
            "status": status,
            "components": components,
        },
        "priority_actions": { "critical": critical, "medium": medium, "low": low },
        "opportunities": {
            "potential_revenue": potential_revenue,
            "confidence": opp_confidence,
            "actions": opp_actions,
        },
        "lost_revenue": {
            "estimated_lost_revenue": estimated_lost_revenue,
            "reasons": lost_reasons,
        },
        "risks": risks,
        "property_reviews": property_reviews,
        "forecast": {
            "expected_revenue": expected_revenue,
            "risk_level": risk_level,
            "best_property": best_property,
            "confidence": forecast_confidence,
        },
        "achievements": achievements,
        "recommended_goals": recommended_goals,
        "trend_explanations": trend_explanations,
        "metrics": metrics,
    }))
}
