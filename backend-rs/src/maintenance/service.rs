//! Maintenance service: database status, optimization, logs, and data reset.
//! Mirrors `backend/app/maintenance_router.py`.

use std::fs;
use std::path::PathBuf;

use serde_json::{json, Map, Value};
use sqlx::SqlitePool;

use crate::backup;
use crate::core::config::Config;
use crate::core::error::AppError;

/// Locate the backend log file (HOSTWISE_LOG_FILE env or common locations).
fn find_log_file() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("HOSTWISE_LOG_FILE") {
        let p = PathBuf::from(p);
        if p.exists() {
            return Some(p);
        }
    }
    let data_dir = crate::core::config::default_data_dir();
    for candidate in [
        data_dir.join("hostwise.log"),
        PathBuf::from("hostwise.log"),
        PathBuf::from("logs/hostwise.log"),
    ] {
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

/// Database + storage overview for the Maintenance section.
pub async fn status(pool: &SqlitePool, cfg: &Config) -> Result<Value, AppError> {
    let db_path = &cfg.sqlite_path;
    let db_size = fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);

    let backups = backup::list_backups();
    let backup_count = backups.len();
    let backups_size: u64 = backups.iter().map(|b| b.size).sum();

    let integrity = sqlx::query_scalar::<_, String>("PRAGMA quick_check")
        .fetch_one(pool)
        .await
        .unwrap_or_else(|_| "unavailable".to_string());

    let cors_restricted = !cfg.cors_origins.iter().any(|o| o == "*");
    let default_jwt = cfg.jwt_secret_key.starts_with("change-me");

    let latest_backup_verified = match backups.first() {
        Some(b) => backup::verify_backup(&backup::backups_dir().join(&b.name)).await,
        None => None,
    };

    Ok(json!({
        "database_type": "sqlite",
        "database_path": db_path.to_string_lossy(),
        "database_size": db_size,
        "backup_count": backup_count,
        "backups_size": backups_size,
        "log_file_available": find_log_file().is_some(),
        "integrity": if integrity == "ok" { "ok" } else if integrity == "unavailable" { "unavailable" } else { "error" },
        "security": {
            "environment": cfg.environment,
            "cors_origins": cfg.cors_origins,
            "cors_restricted": cors_restricted,
            "default_jwt_secret": default_jwt,
        },
        "latest_backup_verified": latest_backup_verified,
    }))
}

/// Run VACUUM to reclaim disk space from deleted rows.
pub async fn optimize(pool: &SqlitePool, cfg: &Config) -> Result<Value, AppError> {
    let db_path = &cfg.sqlite_path;
    let before = fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);

    match sqlx::query("VACUUM").execute(pool).await {
        Ok(_) => {
            let after = fs::metadata(db_path).map(|m| m.len()).unwrap_or(before);
            Ok(json!({
                "ok": true,
                "message": "Database optimized",
                "before": before,
                "after": after,
                "freed": before.saturating_sub(after),
            }))
        }
        Err(e) => Ok(json!({
            "ok": false,
            "message": format!("Database is busy — try again when idle. ({e})"),
            "before": before,
            "after": before,
            "freed": 0,
        })),
    }
}

/// Tail of the backend log file.
pub fn get_logs(lines: i64) -> Value {
    let lines = lines.clamp(10, 2000) as usize;
    match find_log_file() {
        Some(path) => match fs::read_to_string(&path) {
            Ok(content) => {
                let all: Vec<&str> = content.lines().collect();
                let start = all.len().saturating_sub(lines);
                let tail = all[start..].join("\n");
                json!({ "available": true, "content": tail, "path": path.to_string_lossy() })
            }
            Err(e) => json!({
                "available": true,
                "content": format!("Error reading log: {e}"),
                "path": path.to_string_lossy(),
            }),
        },
        None => json!({ "available": false, "content": "", "path": Value::Null }),
    }
}

/// Permanently purge soft-deleted rows older than `days` (children first).
pub async fn cleanup(pool: &SqlitePool, days: i64) -> Result<Value, AppError> {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
    let cutoff_str = cutoff.to_rfc3339();

    let tables = [
        "notifications",
        "expenses",
        "revenues",
        "reservations",
        "expense_categories",
        "revenue_categories",
        "properties",
    ];
    let mut purged = Map::new();
    let mut skipped = Map::new();

    for table in tables {
        let count: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {table} WHERE is_deleted = 1 AND deleted_at IS NOT NULL AND deleted_at < ?"
        ))
        .bind(&cutoff_str)
        .fetch_one(pool)
        .await
        .unwrap_or(0);
        if count == 0 {
            continue;
        }
        match sqlx::query(&format!(
            "DELETE FROM {table} WHERE is_deleted = 1 AND deleted_at IS NOT NULL AND deleted_at < ?"
        ))
        .bind(&cutoff_str)
        .execute(pool)
        .await
        {
            Ok(_) => {
                purged.insert(table.to_string(), json!(count));
            }
            Err(e) => {
                let msg: String = e.to_string().chars().take(200).collect();
                skipped.insert(table.to_string(), json!(msg));
            }
        }
    }

    Ok(json!({
        "purged": purged,
        "skipped": skipped,
        "cutoff": cutoff_str,
        "days": days,
    }))
}

/// Delete transactional demo data (revenues, expenses, reservations, notifications).
pub async fn reset_demo(pool: &SqlitePool) -> Result<Value, AppError> {
    let mut deleted = Map::new();
    for table in ["revenues", "expenses", "reservations", "notifications"] {
        let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(pool)
            .await
            .unwrap_or(0);
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(pool)
            .await?;
        deleted.insert(table.to_string(), json!(count));
    }
    Ok(json!({ "deleted": deleted }))
}

/// Delete ALL business data (children before parents), keeping schema/settings/users.
pub async fn reset_all(pool: &SqlitePool) -> Result<Value, AppError> {
    let mut deleted = Map::new();
    for table in [
        "reservations",
        "revenues",
        "expenses",
        "properties",
        "expense_categories",
        "revenue_categories",
        "notifications",
    ] {
        let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(pool)
            .await
            .unwrap_or(0);
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(pool)
            .await?;
        deleted.insert(table.to_string(), json!(count));
    }
    Ok(json!({ "deleted": deleted }))
}
