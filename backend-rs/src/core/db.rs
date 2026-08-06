//! Database pool + migrations, mirroring `backend/app/core/database.py`.
//!
//! Desktop mode uses SQLite (bundled, WAL mode). PostgreSQL is a future
//! enhancement behind a `postgres` sqlx feature.

use std::fs;
use std::path::Path;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;

use crate::core::config::Config;

pub async fn init_pool(cfg: &Config) -> anyhow::Result<SqlitePool> {
    if let Some(parent) = Path::new(&cfg.sqlite_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    let options = SqliteConnectOptions::new()
        .filename(&cfg.sqlite_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Apply embedded migrations (replaces Alembic).
    sqlx::migrate!().run(&pool).await?;

    Ok(pool)
}
