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

    // Migration 5 (`0005_property_columns.sql`) was retired: the property
    // columns are now ensured idempotently in Rust below (pre-existing
    // Python-era databases already have them, so ALTER TABLE ADD COLUMN would
    // fail). Drop any stale migration record so databases that already applied
    // it don't fail with "migration missing on disk".
    let _ = sqlx::query("DELETE FROM _sqlx_migrations WHERE version = 5")
        .execute(&pool)
        .await;

    // Apply embedded migrations (replaces Alembic).
    sqlx::migrate!().run(&pool).await?;

    // Idempotently ensure the extended property columns exist.
    ensure_extra_columns(&pool).await?;

    Ok(pool)
}

/// Ensure the extended `properties` columns exist. Safe to run on every start:
/// SQLite's `ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS`, so we check
/// `PRAGMA table_info` first and only add what is missing.
async fn ensure_extra_columns(pool: &SqlitePool) -> anyhow::Result<()> {
    let existing: Vec<String> =
        sqlx::query_scalar("SELECT name FROM pragma_table_info('properties')")
            .fetch_all(pool)
            .await?;

    let desired: &[(&str, &str)] = &[
        ("max_guests", "INTEGER NOT NULL DEFAULT 2"),
        ("square_meters", "REAL"),
        ("acquisition_cost", "REAL"),
        ("monthly_mortgage", "REAL"),
        ("target_occupancy", "REAL"),
        ("target_annual_revenue", "REAL"),
        ("notes", "TEXT"),
    ];

    for (col, ddl) in desired {
        if !existing.iter().any(|c| c == col) {
            let sql = format!("ALTER TABLE properties ADD COLUMN {col} {ddl}");
            sqlx::query(&sql).execute(pool).await?;
        }
    }
    Ok(())
}
