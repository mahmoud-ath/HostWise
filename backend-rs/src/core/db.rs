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

    // Rebuild legacy Python-era tables (which carry `organization_id`) into the
    // Rust-compatible shape, preserving data.
    reconcile_legacy_schema(&pool).await?;

    Ok(pool)
}

/// Legacy Python-era databases (v0.6.x and earlier) created the core tables with
/// an unused `organization_id CHAR(32) NOT NULL` column (plus an index + FK) that
/// the Rust backend never writes, and `is_deleted`/`sync_id` nullability that
/// differs from the Rust schema. Every insert fails with
/// `NOT NULL constraint failed: <table>.organization_id` → HTTP 500.
///
/// This rebuilds each affected table to be insert-compatible:
///   - drops `organization_id` entirely,
///   - gives `is_deleted` a `DEFAULT 0` (Rust finance sets it; Rust properties
///     doesn't, but the default covers it),
///   - makes `sync_id` nullable (Rust treats it as `Option`),
///   - preserves every other column, the primary key, the data, and any
///     non-`organization_id` indexes.
///
/// Idempotent: tables without `organization_id` (fresh Rust-created ones) are
/// skipped.
async fn reconcile_legacy_schema(pool: &SqlitePool) -> anyhow::Result<()> {
    const TABLES: &[&str] = &[
        "properties",
        "revenues",
        "expenses",
        "reservations",
        "revenue_categories",
        "expense_categories",
    ];

    for table in TABLES {
        #[derive(sqlx::FromRow)]
        struct Col {
            name: String,
            ctype: String,
            notnull: i64,
            dflt: Option<String>,
            pk: i64,
        }
        let cols: Vec<Col> = sqlx::query_as(&format!(
            "SELECT name, type AS ctype, \"notnull\" AS \"notnull\", dflt_value AS dflt, \
             pk AS pk FROM pragma_table_info('{table}')"
        ))
        .fetch_all(pool)
        .await?;

        if !cols.iter().any(|c| c.name == "organization_id") {
            continue; // already Rust-shaped
        }

        tracing::info!("reconciling legacy schema for `{table}`");
        let _ = sqlx::query(&format!("DROP INDEX IF EXISTS ix_{table}_organization_id"))
            .execute(pool)
            .await;

        // Preserve any non-organization_id indexes so they can be recreated.
        let other_indexes: Vec<String> = sqlx::query_scalar(&format!(
            "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='{table}' \
             AND sql IS NOT NULL AND name != 'ix_{table}_organization_id'"
        ))
        .fetch_all(pool)
        .await?;

        let mut defs: Vec<String> = Vec::new();
        let mut col_list: Vec<String> = Vec::new();
        for c in &cols {
            if c.name == "organization_id" {
                continue;
            }
            col_list.push(format!("\"{}\"", c.name));
            let def = if c.name == "is_deleted" {
                "\"is_deleted\" INTEGER NOT NULL DEFAULT 0".to_string()
            } else if c.name == "sync_id" {
                "\"sync_id\" TEXT".to_string()
            } else {
                let mut d = format!("\"{}\" {}", c.name, c.ctype);
                if c.notnull != 0 {
                    d.push_str(" NOT NULL");
                }
                if let Some(def) = &c.dflt {
                    d.push_str(&format!(" DEFAULT {def}"));
                }
                d
            };
            defs.push(def);
        }
        let pk: Vec<&str> = cols
            .iter()
            .filter(|c| c.pk != 0)
            .map(|c| c.name.as_str())
            .collect();
        if !pk.is_empty() {
            defs.push(format!("PRIMARY KEY ({})", pk.join(", ")));
        }
        let ddl = format!("CREATE TABLE {table}_new ({})", defs.join(", "));
        let copy = format!(
            "INSERT INTO {table}_new ({}) SELECT {} FROM {table}",
            col_list.join(", "),
            col_list.join(", ")
        );

        let mut conn = pool.acquire().await?;
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(&mut *conn)
            .await?;
        let r1 = sqlx::query(&ddl).execute(&mut *conn).await;
        let r2 = sqlx::query(&copy).execute(&mut *conn).await;
        let r3 = sqlx::query(&format!("DROP TABLE {table}")).execute(&mut *conn).await;
        let r4 = sqlx::query(&format!("ALTER TABLE {table}_new RENAME TO {table}"))
            .execute(&mut *conn)
            .await;
        let _ = sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&mut *conn)
            .await;
        r1?;
        r2?;
        r3?;
        r4?;

        for idx in other_indexes {
            let _ = sqlx::query(&idx).execute(pool).await;
        }
    }
    Ok(())
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
