//! Analytics service: computes KPIs dynamically from normalized data.
//! Never stores calculated metrics — generates them on demand (CID).
//! Mirrors `backend/app/analytics/service.py` + the analytics_cache in
//! `backend/app/ai/cache.py`.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use chrono::Datelike;
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::core::error::AppError;

// ── In-process analytics cache (60s TTL, keyed by data fingerprint) ──

struct CacheEntry {
    at: Instant,
    value: Value,
}

fn cache() -> &'static Mutex<HashMap<String, CacheEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<String, CacheEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

const CACHE_TTL: Duration = Duration::from_secs(60);

/// Coarse data fingerprint so cached analytics invalidate when data changes.
pub async fn data_fingerprint(pool: &SqlitePool) -> Result<String, AppError> {
    let (r, re, e, p): (i64, i64, i64, i64) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM reservations WHERE is_deleted = 0), \
                (SELECT COUNT(*) FROM revenues WHERE is_deleted = 0), \
                (SELECT COUNT(*) FROM expenses WHERE is_deleted = 0), \
                (SELECT COUNT(*) FROM properties WHERE is_deleted = 0)",
    )
    .fetch_one(pool)
    .await?;
    let max_rev: String = sqlx::query_scalar(
        "SELECT COALESCE(MAX(updated_at),'') FROM revenues WHERE is_deleted = 0",
    )
    .fetch_one(pool)
    .await?;
    let max_exp: String = sqlx::query_scalar(
        "SELECT COALESCE(MAX(updated_at),'') FROM expenses WHERE is_deleted = 0",
    )
    .fetch_one(pool)
    .await?;
    Ok(format!("{r}:{re}:{e}:{p}:{max_rev}:{max_exp}"))
}

pub fn cache_get(key: &str) -> Option<Value> {
    let mut guard = cache().lock().unwrap_or_else(|e| e.into_inner());
    guard.retain(|_, e| e.at.elapsed() < CACHE_TTL);
    guard.get(key).map(|e| e.value.clone())
}

pub fn cache_set(key: &str, value: Value) {
    let mut guard = cache().lock().unwrap_or_else(|e| e.into_inner());
    guard.insert(
        key.to_string(),
        CacheEntry {
            at: Instant::now(),
            value,
        },
    );
}

// ── KPI helpers ───────────────────────────────────────────

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}
fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

pub(crate) fn year_bounds(year: i32) -> (String, String) {
    (format!("{year:04}-01-01"), format!("{year:04}-12-31"))
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

/// Shift an inclusive [start, end] window one year back (YoY comparison).
fn shift_year_back(start: &str, end: &str) -> (String, String) {
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

/// Comprehensive property performance analytics for a date range.
pub async fn get_property_analytics(
    pool: &SqlitePool,
    property_id: &str,
    start: &str,
    end: &str,
) -> Result<Value, AppError> {
    let start = start.to_string();
    let end = end.to_string();
    let year = start[0..4]
        .parse::<i32>()
        .unwrap_or_else(|_| chrono::Local::now().year());

    // Revenue
    let (gross, net): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(gross_amount),0.0), COALESCE(SUM(net_amount),0.0) FROM revenues \
         WHERE property_id = ? AND is_deleted = 0 AND date >= ? AND date <= ?",
    )
    .bind(property_id)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;

    // Reservations (confirmed + completed)
    let (total, nights, avg_rev, avg_nights): (i64, i64, f64, f64) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(nights),0), COALESCE(AVG(gross_revenue),0.0), \
                COALESCE(AVG(nights),0.0) \
         FROM reservations WHERE property_id = ? AND is_deleted = 0 \
         AND status IN ('confirmed','completed') AND check_in >= ? AND check_in <= ?",
    )
    .bind(property_id)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;

    let cancelled: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reservations WHERE property_id = ? AND is_deleted = 0 \
         AND status = 'cancelled' AND check_in >= ? AND check_in <= ?",
    )
    .bind(property_id)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;

    let cancellation_rate = if total + cancelled > 0 {
        round2((cancelled as f64 / (total + cancelled) as f64) * 100.0)
    } else {
        0.0
    };

    // Booking window (avg days between booked_at and check_in)
    let avg_booking_window: f64 = sqlx::query_scalar(
        "SELECT COALESCE(AVG(julianday(check_in) - julianday(booked_at)), 0.0) FROM reservations \
         WHERE property_id = ? AND is_deleted = 0 AND booked_at IS NOT NULL \
         AND check_in >= ? AND check_in <= ?",
    )
    .bind(property_id)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;
    let avg_booking_window = round1(avg_booking_window);

    // Monthly breakdown (revenue from reservations + expenses)
    let monthly: Vec<(i64, f64, f64, i64, i64)> = sqlx::query_as(
        "SELECT CAST(substr(check_in,6,2) AS INTEGER) AS month, \
                COALESCE(SUM(gross_revenue),0.0), COALESCE(SUM(net_revenue),0.0), \
                COUNT(*), COALESCE(SUM(nights),0) \
         FROM reservations WHERE property_id = ? AND is_deleted = 0 \
         AND status IN ('confirmed','completed') AND check_in >= ? AND check_in <= ? \
         GROUP BY month ORDER BY month",
    )
    .bind(property_id)
    .bind(&start)
    .bind(&end)
    .fetch_all(pool)
    .await?;

    let monthly_exp: Vec<(i64, f64)> = sqlx::query_as(
        "SELECT CAST(substr(date,6,2) AS INTEGER) AS month, COALESCE(SUM(amount),0.0) \
         FROM expenses WHERE property_id = ? AND is_deleted = 0 AND date >= ? AND date <= ? \
         GROUP BY month ORDER BY month",
    )
    .bind(property_id)
    .bind(&start)
    .bind(&end)
    .fetch_all(pool)
    .await?;

    let mut exp_by_month: HashMap<i64, f64> = HashMap::new();
    for (m, t) in monthly_exp {
        exp_by_month.insert(m, t);
    }
    let mut months: Vec<i64> = monthly.iter().map(|m| m.0).collect();
    for m in exp_by_month.keys() {
        if !months.contains(m) {
            months.push(*m);
        }
    }
    months.sort_unstable();

    let mut breakdown = Vec::with_capacity(months.len());
    for m in months {
        let (_, mgross, mnet, mcount, mnights) = monthly
            .iter()
            .find(|x| x.0 == m)
            .copied()
            .unwrap_or((m, 0.0, 0.0, 0, 0));
        breakdown.push(json!({
            "month": m,
            "gross_revenue": round2(mgross),
            "net_revenue": round2(mnet),
            "reservation_count": mcount,
            "nights": mnights,
            "total_expenses": round2(exp_by_month.get(&m).copied().unwrap_or(0.0)),
        }));
    }

    let total_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount),0.0) FROM expenses WHERE property_id = ? \
         AND is_deleted = 0 AND date >= ? AND date <= ?",
    )
    .bind(property_id)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;

    let expense_ratio = if gross > 0.0 {
        round2((total_expenses / gross) * 100.0)
    } else {
        0.0
    };
    let profit = round2(net - total_expenses);
    let profit_margin = if net > 0.0 {
        round2(((net - total_expenses) / net) * 100.0)
    } else {
        0.0
    };

    Ok(json!({
        "property_id": property_id,
        "year": year,
        "start_date": start,
        "end_date": end,
        "gross_revenue": round2(gross),
        "net_revenue": round2(net),
        "total_expenses": round2(total_expenses),
        "profit": profit,
        "profit_margin": profit_margin,
        "reservation_count": total,
        "nights": nights,
        "cancellation_rate": cancellation_rate,
        "cancelled_reservations": cancelled,
        "avg_booking_window_days": avg_booking_window,
        "avg_booking_value": round2(avg_rev),
        "avg_stay_nights": round2(avg_nights),
        "expense_ratio": expense_ratio,
        "monthly_breakdown": breakdown,
    }))
}

/// Portfolio-wide analytics (all properties) for a year or date range.
pub async fn get_portfolio_analytics(
    pool: &SqlitePool,
    year: Option<i32>,
    start: Option<&str>,
    end: Option<&str>,
) -> Result<Value, AppError> {
    let (start_s, end_s) = match (start, end) {
        (Some(s), Some(e)) => (s.to_string(), e.to_string()),
        _ => {
            let y = year.unwrap_or_else(|| chrono::Local::now().year());
            year_bounds(y)
        }
    };

    let (gross, net): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(gross_amount),0.0), COALESCE(SUM(net_amount),0.0) FROM revenues \
         WHERE is_deleted = 0 AND date >= ? AND date <= ?",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_one(pool)
    .await?;

    let (total, nights): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(nights),0) FROM reservations WHERE is_deleted = 0 \
         AND status IN ('confirmed','completed') AND check_in >= ? AND check_in <= ?",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_one(pool)
    .await?;

    let cancelled: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reservations WHERE is_deleted = 0 AND status = 'cancelled' \
         AND check_in >= ? AND check_in <= ?",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_one(pool)
    .await?;
    let cancellation_rate = if total + cancelled > 0 {
        round2((cancelled as f64 / (total + cancelled) as f64) * 100.0)
    } else {
        0.0
    };

    let total_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount),0.0) FROM expenses WHERE is_deleted = 0 AND date >= ? AND date <= ?",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_one(pool)
    .await?;

    let per_prop: Vec<(String, String, f64, f64, i64)> = sqlx::query_as(
        "SELECT p.id, p.name, \
                COALESCE((SELECT SUM(net_amount) FROM revenues r WHERE r.property_id = p.id \
                          AND r.is_deleted = 0 AND r.date BETWEEN ? AND ?), 0.0) AS net, \
                COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.property_id = p.id \
                          AND e.is_deleted = 0 AND e.date BETWEEN ? AND ?), 0.0) AS expenses, \
                (SELECT COUNT(*) FROM reservations rs WHERE rs.property_id = p.id \
                 AND rs.is_deleted = 0 AND rs.status IN ('confirmed','completed') \
                 AND rs.check_in BETWEEN ? AND ?) AS reservations \
         FROM properties p WHERE p.is_deleted = 0 ORDER BY net DESC",
    )
    .bind(&start_s)
    .bind(&end_s)
    .bind(&start_s)
    .bind(&end_s)
    .bind(&start_s)
    .bind(&end_s)
    .fetch_all(pool)
    .await?;

    let properties: Vec<Value> = per_prop
        .iter()
        .map(|(id, name, net, exp, count)| {
            let profit = round2(net - exp);
            let margin = if *net > 0.0 {
                round2(((net - exp) / net) * 100.0)
            } else {
                0.0
            };
            json!({
                "property_id": id,
                "name": name,
                "net_revenue": round2(*net),
                "expenses": round2(*exp),
                "profit": profit,
                "profit_margin": margin,
                "reservations": count,
            })
        })
        .collect();

    let profit = round2(net - total_expenses);
    let profit_margin = if net > 0.0 {
        round2(((net - total_expenses) / net) * 100.0)
    } else {
        0.0
    };

    // ── Frontend-aligned KPIs ───────────────────────────────
    let property_count = per_prop.len() as i64;
    let avg_revenue_per_property = if property_count > 0 {
        round2(net / property_count as f64)
    } else {
        0.0
    };
    let avg_stay = if total > 0 {
        round2(nights as f64 / total as f64)
    } else {
        0.0
    };

    let avg_booking_window: f64 = sqlx::query_scalar(
        "SELECT COALESCE(AVG(julianday(check_in) - julianday(booked_at)), 0.0) \
         FROM reservations WHERE is_deleted = 0 AND booked_at IS NOT NULL \
         AND check_in >= ? AND check_in <= ?",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_one(pool)
    .await?;
    let avg_booking_window = round1(avg_booking_window);

    // YoY growth vs the same window one year earlier.
    let (prev_start, prev_end) = shift_year_back(&start_s, &end_s);
    let prev_net: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(net_amount),0.0) FROM revenues \
         WHERE is_deleted = 0 AND date >= ? AND date <= ?",
    )
    .bind(&prev_start)
    .bind(&prev_end)
    .fetch_one(pool)
    .await?;
    let revenue_growth_yoy = if prev_net > 0.0 {
        round2(((net - prev_net) / prev_net) * 100.0)
    } else {
        0.0
    };

    // Category splits.
    let rev_cats: Vec<(String, f64, i64)> = sqlx::query_as(
        "SELECT COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(r.description), ''), 'Uncategorized'), COALESCE(SUM(r.net_amount),0.0), COUNT(*) \
         FROM revenues r LEFT JOIN revenue_categories c ON c.id = r.category_id \
         WHERE r.is_deleted = 0 AND r.date >= ? AND r.date <= ? \
         GROUP BY COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(r.description), ''), 'Uncategorized') ORDER BY 2 DESC",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_all(pool)
    .await?;
    let revenue_categories: Vec<Value> = rev_cats
        .into_iter()
        .map(|(category_name, total, count)| {
            let pct = if net > 0.0 {
                round2(total / net * 100.0)
            } else {
                0.0
            };
            json!({
                "category_name": category_name,
                "total": round2(total),
                "percentage": pct,
                "count": count,
            })
        })
        .collect();
    let exp_cats: Vec<(String, f64, i64)> = sqlx::query_as(
        "SELECT COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(e.description), ''), 'Uncategorized'), COALESCE(SUM(e.amount),0.0), COUNT(*) \
         FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id \
         WHERE e.is_deleted = 0 AND e.date >= ? AND e.date <= ? \
         GROUP BY COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(e.description), ''), 'Uncategorized') ORDER BY 2 DESC",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_all(pool)
    .await?;
    let expense_categories: Vec<Value> = exp_cats
        .into_iter()
        .map(|(category_name, total, count)| {
            let pct = if total_expenses > 0.0 {
                round2(total / total_expenses * 100.0)
            } else {
                0.0
            };
            json!({
                "category_name": category_name,
                "total": round2(total),
                "percentage": pct,
                "count": count,
            })
        })
        .collect();

    // Seasonality: net/gross revenue and expenses by month.
    let monthly_net: Vec<(i64, f64)> = sqlx::query_as(
        "SELECT CAST(substr(date,6,2) AS INTEGER), COALESCE(SUM(net_amount),0.0) \
         FROM revenues WHERE is_deleted = 0 AND date >= ? AND date <= ? GROUP BY 1 ORDER BY 1",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_all(pool)
    .await?;
    let monthly_gross: Vec<(i64, f64)> = sqlx::query_as(
        "SELECT CAST(substr(date,6,2) AS INTEGER), COALESCE(SUM(gross_amount),0.0) \
         FROM revenues WHERE is_deleted = 0 AND date >= ? AND date <= ? GROUP BY 1 ORDER BY 1",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_all(pool)
    .await?;
    let monthly_exp: Vec<(i64, f64)> = sqlx::query_as(
        "SELECT CAST(substr(date,6,2) AS INTEGER), COALESCE(SUM(amount),0.0) \
         FROM expenses WHERE is_deleted = 0 AND date >= ? AND date <= ? GROUP BY 1 ORDER BY 1",
    )
    .bind(&start_s)
    .bind(&end_s)
    .fetch_all(pool)
    .await?;
    let month_map: HashMap<i64, f64> = monthly_net.into_iter().collect();
    let gross_map: HashMap<i64, f64> = monthly_gross.into_iter().collect();
    let exp_map: HashMap<i64, f64> = monthly_exp.into_iter().collect();
    let seasonality: Vec<Value> = (1..=12)
        .map(|m| {
            json!({
                "month": m,
                "net_revenue": round2(month_map.get(&m).copied().unwrap_or(0.0)),
                "gross_revenue": round2(gross_map.get(&m).copied().unwrap_or(0.0)),
                "total_expenses": round2(exp_map.get(&m).copied().unwrap_or(0.0)),
            })
        })
        .collect();

    // Per-property health ranking + distribution.
    let mut ranking: Vec<Value> = Vec::new();
    let mut dist: HashMap<String, i64> = HashMap::new();
    for (id, name, pnet, pexp, pres) in &per_prop {
        let h = get_property_health_score(pool, id, &start_s, &end_s).await?;
        let score = h["health_score"]
            .as_i64()
            .unwrap_or_else(|| h["score"].as_i64().unwrap_or(0));
        let label = h["status"]
            .as_str()
            .map(|s| s.to_string())
            .unwrap_or_else(|| h["label"].as_str().unwrap_or("fair").to_string());
        *dist.entry(label.clone()).or_insert(0) += 1;
        let pprofit = round2(pnet - pexp);
        let pm = if *pnet > 0.0 {
            round2((pnet - pexp) / pnet * 100.0)
        } else {
            0.0
        };
        ranking.push(json!({
            "property_id": id,
            "property_name": name,
            "health_score": score,
            "status": label,
            "profit_margin": pm,
            "net_revenue": round2(*pnet),
            "profit": pprofit,
            "reservation_count": *pres,
            "expense_ratio": h["expense_ratio"].as_f64().unwrap_or(0.0),
            "occupancy": h["occupancy"].as_f64().unwrap_or(0.0),
        }));
    }
    ranking.sort_by(|a, b| {
        b["health_score"]
            .as_i64()
            .unwrap_or(0)
            .cmp(&a["health_score"].as_i64().unwrap_or(0))
    });
    let health_distribution: Vec<Value> = ["excellent", "good", "fair", "poor"]
        .iter()
        .map(|s| json!({ "status": s, "count": dist.get(*s).copied().unwrap_or(0) }))
        .collect();

    // Simple next-month forecast: average monthly net revenue.
    let forecast_next_month = if month_map.is_empty() {
        0.0
    } else {
        let sum: f64 = month_map.values().sum();
        round2(sum / month_map.len() as f64)
    };

    let year = start_s[0..4]
        .parse::<i32>()
        .unwrap_or_else(|_| chrono::Local::now().year());

    Ok(json!({
        "year": year,
        "start_date": start_s,
        "end_date": end_s,
        "property_count": property_count,
        "gross_revenue": round2(gross),
        "net_revenue": round2(net),
        "total_expenses": round2(total_expenses),
        "profit": profit,
        "profit_margin": profit_margin,
        "avg_revenue_per_property": avg_revenue_per_property,
        "revenue_growth_yoy": revenue_growth_yoy,
        "total_reservations": total,
        "avg_stay": avg_stay,
        "cancellation_rate": cancellation_rate,
        "avg_booking_window": avg_booking_window,
        "forecast_next_month": forecast_next_month,
        "health_distribution": health_distribution,
        "property_ranking": ranking,
        "expense_categories": expense_categories,
        "revenue_categories": revenue_categories,
        "seasonality": seasonality,
        // Legacy keys used by the reports + AI consumers.
        "total_gross_revenue": round2(gross),
        "total_net_revenue": round2(net),
        "reservation_count": total,
        "nights": nights,
        "properties": properties,
    }))
}

/// Property health score (0-100), mirroring the spirit of the Python heuristic.
/// Weighted composite health score (0-100) for a property over a date range.
///
/// Transparent weights so the score is easy to explain:
///   profit margin 30 pts (up to 30% margin),
///   occupancy     20 pts (nights vs 60% of the window's nights),
///   expense ratio 20 pts (lower is better, up to 50% ratio),
///   cancellations 15 pts (lower is better, up to 40% rate),
///   booking value 15 pts (up to 300 per booking).
pub async fn get_property_health_score(
    pool: &SqlitePool,
    property_id: &str,
    start: &str,
    end: &str,
) -> Result<Value, AppError> {
    let pa = get_property_analytics(pool, property_id, start, end).await?;

    let pm = pa["profit_margin"].as_f64().unwrap_or(0.0);
    let cr = pa["cancellation_rate"].as_f64().unwrap_or(0.0);
    let expense_ratio = pa["expense_ratio"].as_f64().unwrap_or(0.0);
    let net_revenue = pa["net_revenue"].as_f64().unwrap_or(0.0);
    let gross_revenue = pa["gross_revenue"].as_f64().unwrap_or(0.0);
    let avg_booking_value = pa["avg_booking_value"].as_f64().unwrap_or(0.0);
    let reservations = pa["reservation_count"].as_i64().unwrap_or(0);
    let nights = pa["nights"].as_i64().unwrap_or(0) as f64;

    // Occupancy proxy: nights booked vs 60% of the window's nights.
    let days = days_between(start, end);
    let occupancy = if days > 0.0 {
        (nights / (days * 0.6)).clamp(0.0, 1.0)
    } else {
        0.0
    };

    let pm_pts = (pm.clamp(0.0, 30.0) / 30.0) * 30.0;
    let occ_pts = occupancy * 20.0;
    let exp_pts = (1.0 - (expense_ratio.clamp(0.0, 50.0) / 50.0)) * 20.0;
    let cr_pts = (1.0 - (cr.clamp(0.0, 40.0) / 40.0)) * 15.0;
    let value_pts = (avg_booking_value.clamp(0.0, 300.0) / 300.0) * 15.0;

    let mut score = pm_pts + occ_pts + exp_pts + cr_pts + value_pts;
    score = score.clamp(0.0, 100.0).round();

    let label = if score >= 80.0 {
        "excellent"
    } else if score >= 60.0 {
        "good"
    } else if score >= 40.0 {
        "fair"
    } else {
        "poor"
    };

    let year = start[0..4]
        .parse::<i32>()
        .unwrap_or_else(|_| chrono::Local::now().year());
    let property_name: Option<String> =
        sqlx::query_scalar("SELECT name FROM properties WHERE id = ? AND is_deleted = 0")
            .bind(property_id)
            .fetch_optional(pool)
            .await?;
    let property_name = property_name.unwrap_or_else(|| property_id.to_string());

    Ok(json!({
        "property_id": property_id,
        "property_name": property_name,
        "year": year,
        "start_date": start,
        "end_date": end,
        "health_score": score as i64,
        "status": label,
        "profit_margin": pm,
        "cancellation_rate": cr,
        "expense_ratio": expense_ratio,
        "gross_revenue": round2(gross_revenue),
        "net_revenue": round2(net_revenue),
        "reservation_count": reservations,
        "nights": nights as i64,
        "occupancy": round1(occupancy * 100.0),
        // Legacy aliases.
        "score": score as i64,
        "label": label,
    }))
}
