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
    pub path: String,
}

pub fn backups_dir() -> PathBuf {
    let data_dir = std::env::var("HOSTWISE_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| crate::core::config::default_data_dir());
    data_dir.join("backups")
}

/// List `hostwise_*.db` backups, newest first (mirrors backup_service.list_backups).
pub fn list_backups() -> Vec<BackupInfo> {
    let dir = backups_dir();
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };

    let mut backups = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        if !name.starts_with("hostwise_") || !name.ends_with(".db") {
            continue;
        }
        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        let created = fs::metadata(&path)
            .and_then(|m| m.modified())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Local> = t.into();
                dt.to_rfc3339()
            })
            .unwrap_or_default();
        backups.push(BackupInfo {
            name: name.clone(),
            size,
            created,
            path: path.to_string_lossy().into_owned(),
        });
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

/// Create an on-demand backup of the current database (copy + VACUUM).
pub async fn create_backup(db_path: &Path, label: &str) -> Option<PathBuf> {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

    if !db_path.exists() {
        return None;
    }
    let dir = backups_dir();
    if fs::create_dir_all(&dir).is_err() {
        return None;
    }
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let name = format!("hostwise_{label}_{timestamp}.db");
    let backup_path = dir.join(&name);

    if fs::copy(db_path, &backup_path).is_err() {
        return None;
    }
    // Vacuum the backup so it is a clean, compact copy.
    if let Ok(pool) = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(SqliteConnectOptions::new().filename(&backup_path))
        .await
    {
        let _ = sqlx::query("VACUUM").execute(&pool).await;
    }
    Some(backup_path)
}

/// Restore a backup by name (creates a pre-restore safety backup first).
pub async fn restore_backup(db_path: &Path, backup_name: &str) -> bool {
    let backup_path = backups_dir().join(backup_name);
    if !backup_path.exists() || !db_path.exists() {
        return false;
    }
    let _ = create_backup(db_path, "pre_restore").await;
    if !fs::copy(&backup_path, db_path).is_ok() {
        return false;
    }
    // Remove stale WAL/SHM sidecars from the previous session so the next pool
    // open (after the app restarts the backend) reads the *restored* database
    // instead of replaying the old journal. Without this the restore looks
    // like a no-op because SQLite merges the pre-restore WAL over the new file.
    let db_str = db_path.to_string_lossy();
    let _ = fs::remove_file(format!("{db_str}-wal"));
    let _ = fs::remove_file(format!("{db_str}-shm"));
    true
}

/// Verify a backup by name (quick_check), mirroring the router response.
pub async fn verify_backup_by_name(backup_name: &str) -> serde_json::Value {
    let backup_path = backups_dir().join(backup_name);
    if !backup_path.exists() {
        return serde_json::json!({ "ok": false, "name": backup_name, "error": "Backup not found" });
    }
    match verify_backup(&backup_path).await {
        Some(mut v) => {
            v["name"] = serde_json::json!(backup_name);
            if let Ok(md) = fs::metadata(&backup_path) {
                v["size"] = serde_json::json!(md.len());
            }
            v["verified"] = v["ok"].clone();
            v
        }
        None => {
            serde_json::json!({ "ok": false, "name": backup_name, "error": "Could not open backup" })
        }
    }
}
