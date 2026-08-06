//! Notifications service, mirroring `backend/app/notifications/service.py`.
//!
//! `refresh()` is the lightweight "scheduler tick" for the local-first desktop
//! app: it recomputes events from current data + enabled `notify_*` settings
//! and inserts new notifications, deduplicated by fingerprint.

use chrono::{Datelike, NaiveDate};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::backup;
use crate::core::error::AppError;
use crate::core::time::now_iso;
use crate::notifications::models::Notification;
use crate::settings::service as settings;

const MAX_AGE_DAYS: i64 = 90;

const COLS: &str = "id, type, title, message, severity, fingerprint, is_read, deleted_at, \
                    is_deleted, created_at, updated_at, sync_id";

// ── Reading ───────────────────────────────────────────────

pub async fn list(pool: &SqlitePool, limit: i64) -> Result<Vec<Notification>, AppError> {
    let items = sqlx::query_as::<_, Notification>(&format!(
        "SELECT {COLS} FROM notifications WHERE is_deleted = 0 \
         ORDER BY is_read ASC, created_at DESC LIMIT ?"
    ))
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(items)
}

pub async fn unread_count(pool: &SqlitePool) -> Result<i64, AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE is_deleted = 0 AND is_read = 0",
    )
    .fetch_one(pool)
    .await?;
    Ok(n)
}

pub async fn total_count(pool: &SqlitePool) -> Result<i64, AppError> {
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE is_deleted = 0")
        .fetch_one(pool)
        .await?;
    Ok(n)
}

pub async fn mark_read(pool: &SqlitePool, id: &str) -> Result<bool, AppError> {
    let res = sqlx::query(
        "UPDATE notifications SET is_read = 1, updated_at = ? WHERE id = ? AND is_deleted = 0",
    )
    .bind(now_iso())
    .bind(id)
    .execute(pool)
    .await?;
    Ok(res.rows_affected() > 0)
}

pub async fn mark_all_read(pool: &SqlitePool) -> Result<i64, AppError> {
    let res = sqlx::query(
        "UPDATE notifications SET is_read = 1, updated_at = ? WHERE is_deleted = 0 AND is_read = 0",
    )
    .bind(now_iso())
    .execute(pool)
    .await?;
    Ok(res.rows_affected() as i64)
}

/// Archive all notifications (soft delete).
pub async fn clear_all(pool: &SqlitePool) -> Result<i64, AppError> {
    let res = sqlx::query(
        "UPDATE notifications SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE is_deleted = 0",
    )
    .bind(now_iso())
    .bind(now_iso())
    .execute(pool)
    .await?;
    Ok(res.rows_affected() as i64)
}

// ── Generation (the "scheduler tick") ─────────────────────

async fn add(
    pool: &SqlitePool,
    created: &mut Vec<String>,
    type_: &str,
    title: &str,
    message: &str,
    severity: &str,
    fingerprint: &str,
) -> Result<(), AppError> {
    let exists: Option<String> = sqlx::query_scalar(
        "SELECT id FROM notifications WHERE fingerprint = ? AND is_deleted = 0",
    )
    .bind(fingerprint)
    .fetch_optional(pool)
    .await?;
    if exists.is_some() {
        return Ok(());
    }
    let now = now_iso();
    let id = Uuid::new_v4().to_string();
    let inserted = sqlx::query(&format!(
        "INSERT INTO notifications ({COLS}) VALUES (?,?,?,?,?,?,0,NULL,0,?,?,NULL)"
    ))
    .bind(&id)
    .bind(type_)
    .bind(title)
    .bind(message)
    .bind(severity)
    .bind(fingerprint)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await;
    // The unique partial index may reject a concurrent duplicate — that's fine.
    if inserted.is_ok() {
        created.push(fingerprint.to_string());
    }
    Ok(())
}

fn month_bounds(year: i32, month: u32) -> (String, String) {
    let start = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let end = if month == 12 {
        NaiveDate::from_ymd_opt(year, 12, 31).unwrap()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
            .unwrap()
            .pred_opt()
            .unwrap()
    };
    (
        start.format("%Y-%m-%d").to_string(),
        end.format("%Y-%m-%d").to_string(),
    )
}

fn days_in_month(year: i32, month: u32) -> i64 {
    if month == 12 {
        31
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
            .and_then(|d| d.pred_opt())
            .map(|d| d.day() as i64)
            .unwrap_or(31)
    }
}

fn money(amount: f64, currency: &str) -> String {
    format!("{currency} {amount:.2}")
}

/// Net revenue + expenses + profit for a given month.
async fn month_financials(
    pool: &SqlitePool,
    year: i32,
    month: u32,
) -> Result<(f64, f64, f64), AppError> {
    let (start, end) = month_bounds(year, month);
    let net_rev: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(net_amount),0.0) FROM revenues WHERE is_deleted = 0 \
         AND date >= ? AND date <= ?",
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;
    let expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount),0.0) FROM expenses WHERE is_deleted = 0 \
         AND date >= ? AND date <= ?",
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;
    Ok((net_rev, expenses, net_rev - expenses))
}

/// Rough occupancy = booked nights ÷ (properties × days in month).
async fn occupancy_pct(pool: &SqlitePool, year: i32, month: u32) -> Result<f64, AppError> {
    let (start, end) = month_bounds(year, month);
    let nights: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(nights),0) FROM reservations WHERE is_deleted = 0 \
         AND status IN ('confirmed','completed') AND check_in >= ? AND check_in <= ?",
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;
    let props: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM properties WHERE is_deleted = 0")
        .fetch_one(pool)
        .await?;
    let capacity = props * days_in_month(year, month);
    Ok(if capacity > 0 {
        nights as f64 / capacity as f64 * 100.0
    } else {
        0.0
    })
}

/// Recompute notifications from current data + enabled settings. Idempotent.
pub async fn refresh(pool: &SqlitePool) -> Result<Value, AppError> {
    let all = settings::get_all(pool).await?;
    let currency = all
        .get("default_currency")
        .and_then(|v| v.as_str())
        .unwrap_or("EUR")
        .to_string();
    let mut created: Vec<String> = Vec::new();

    let now = chrono::Local::now();
    let cur_year = now.year();
    let cur_month = now.month();
    let (prev_year, prev_month) = if cur_month == 1 {
        (cur_year - 1, 12)
    } else {
        (cur_year, cur_month - 1)
    };

    // Profit / revenue month-over-month trends.
    let (prev_net, _prev_exp, prev_profit) = month_financials(pool, prev_year, prev_month).await?;
    let (cur_net, _cur_exp, cur_profit) = month_financials(pool, cur_year, cur_month).await?;
    let key = format!("{cur_year}-{cur_month:02}");

    if all["notify_profit_drops"].as_bool().unwrap_or(true) {
        if prev_profit > 0.0 && cur_profit < prev_profit {
            let drop = prev_profit - cur_profit;
            add(
                pool,
                &mut created,
                "profit_drop",
                "Profit dropped",
                &format!(
                    "Profit fell {} month-over-month ({} → {}).",
                    money(drop, &currency),
                    money(prev_profit, &currency),
                    money(cur_profit, &currency),
                ),
                "warning",
                &format!("profit:{key}"),
            )
            .await?;
        }
    }

    if all["notify_revenue_increase"].as_bool().unwrap_or(true) {
        if prev_net > 0.0 && cur_net > prev_net {
            let gain = cur_net - prev_net;
            add(
                pool,
                &mut created,
                "revenue_increase",
                "Revenue up",
                &format!(
                    "Net revenue grew {} month-over-month ({} → {}).",
                    money(gain, &currency),
                    money(prev_net, &currency),
                    money(cur_net, &currency),
                ),
                "success",
                &format!("revenue:{key}"),
            )
            .await?;
        }
    }

    if all["notify_occupancy_falls"].as_bool().unwrap_or(true) {
        let prev_occ = occupancy_pct(pool, prev_year, prev_month).await?;
        let cur_occ = occupancy_pct(pool, cur_year, cur_month).await?;
        if prev_occ > 0.0 && cur_occ < prev_occ {
            add(
                pool,
                &mut created,
                "occupancy_fall",
                "Occupancy fell",
                &format!(
                    "Occupancy dropped from {:.0}% to {:.0}% month-over-month.",
                    prev_occ, cur_occ
                ),
                "warning",
                &format!("occupancy:{cur_year}-{cur_month:02}"),
            )
            .await?;
        }
    }

    if all["notify_backup_completed"].as_bool().unwrap_or(true) {
        let backups = backup::list_backups();
        if let Some(latest) = backups.first() {
            if let Ok(created_at) = chrono::DateTime::parse_from_rfc3339(&latest.created) {
                let created_at = created_at.with_timezone(&chrono::Utc);
                if chrono::Utc::now() - created_at <= chrono::Duration::hours(24) {
                    add(
                        pool,
                        &mut created,
                        "backup_completed",
                        "Backup completed",
                        &format!("Your data was backed up successfully ({}).", latest.name),
                        "success",
                        &format!("backup:{}", latest.name),
                    )
                    .await?;
                }
            }
        }
    }

    if all["notify_monthly_report"].as_bool().unwrap_or(true) {
        let frequency = all["report_auto_generate"].as_str().unwrap_or("monthly");
        if !matches!(frequency, "off" | "none") {
            let has_data: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM reservations WHERE is_deleted = 0")
                    .fetch_one(pool)
                    .await?;
            if has_data > 0 {
                let label = format!("{}-{:02}", cur_year, cur_month);
                add(
                    pool,
                    &mut created,
                    "monthly_report",
                    &format!("{label} report ready"),
                    &format!("Your {frequency} report for {label} is ready to view in Reports."),
                    "info",
                    &format!("report:{}", cur_year * 100 + cur_month as i32),
                )
                .await?;
            }
        }
    }

    // Housekeeping — archive notifications older than MAX_AGE_DAYS.
    let cutoff = chrono::Utc::now() - chrono::Duration::days(MAX_AGE_DAYS);
    let cutoff_str = cutoff.to_rfc3339();
    sqlx::query(
        "UPDATE notifications SET is_deleted = 1, deleted_at = ?, updated_at = ? \
         WHERE is_deleted = 0 AND created_at < ?",
    )
    .bind(&cutoff_str)
    .bind(&cutoff_str)
    .bind(&cutoff_str)
    .execute(pool)
    .await?;

    Ok(json!({
        "created": created.len(),
        "unread": unread_count(pool).await?,
        "total": total_count(pool).await?,
    }))
}
