//! Backup helpers: list/verify SQLite backups in the app-data backups dir.
//! Mirrors the parts of `backend/app/backup_service.py` that maintenance and
//! notifications depend on.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub size: u64,
    pub created: String,
}

pub fn backups_dir() -> PathBuf {
    crate::core::config::default_data_dir().join("backups")
}

/// List `.db` backups, newest first.
pub fn list_backups() -> Vec<BackupInfo> {
    let dir = backups_dir();
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };

    let mut backups = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("db") {
            continue;
        }
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        let created = fs::metadata(&path)
            .and_then(|m| m.modified())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                dt.to_rfc3339()
            })
            .unwrap_or_default();
        backups.push(BackupInfo { name, size, created });
    }
    backups.sort_by(|a, b| b.created.cmp(&a.created));
    backups
}

/// Integrity-check a backup file with a fresh read-only SQLite connection.
pub async fn verify_backup(path: &Path) -> Option<serde_json::Value> {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

    let opts = SqliteConnectOptions::new().filename(path).read_only(true);
    let Ok(pool) = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
    else {
        return None;
    };

    match sqlx::query_scalar::<_, String>("PRAGMA quick_check")
        .fetch_one(&pool)
        .await
    {
        Ok(s) => Some(serde_json::json!({
            "ok": s == "ok",
            "error": if s == "ok" { serde_json::Value::Null } else { serde_json::Value::String(s) },
        })),
        Err(e) => Some(serde_json::json!({ "ok": false, "error": e.to_string() })),
    }
}
