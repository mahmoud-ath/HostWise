//! Smoke test: first-run setup (profile settings) and backup
//! (create/list/verify/restore/delete) against a real SQLite database.

use std::sync::Arc;

use hostwise_backend::backup::{create_backup, list_backups, restore_backup, verify_backup_by_name};
use hostwise_backend::core::config::Config;
use hostwise_backend::core::db;
use hostwise_backend::core::state::AppState;
use hostwise_backend::settings::service as settings;

#[tokio::test]
async fn setup_and_backup_flow() {
    let dir = std::env::temp_dir().join(format!("hostwise-sb-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let data_dir = dir.join("data");
    std::fs::create_dir_all(&data_dir).unwrap();
    // Backups land in HOSTWISE_DATA_DIR/backups (isolated for the test).
    std::env::set_var("HOSTWISE_DATA_DIR", &data_dir);

    let mut config = Config::from_env();
    config.sqlite_path = dir.join("test.db");
    let pool = db::init_pool(&config).await.expect("init pool");
    let _state = AppState {
        config: Arc::new(config.clone()),
        pool: pool.clone(),
    };

    // ── Setup: store the owner profile ──
    let mut p = serde_json::Map::new();
    p.insert("profile_name".into(), serde_json::json!("Owner"));
    p.insert("profile_email".into(), serde_json::json!("owner@host.com"));
    let all = settings::update(&pool, p).await.unwrap();
    assert_eq!(all["profile_name"], "Owner");
    assert_eq!(all["profile_email"], "owner@host.com");

    // ── Backup: create / list / verify / restore / delete ──
    let b1 = create_backup(&config.sqlite_path, "manual")
        .await
        .expect("create backup");
    assert!(b1.exists());

    let backups = list_backups();
    assert_eq!(backups.len(), 1);
    assert!(backups[0].name.starts_with("hostwise_manual_"));
    let name = backups[0].name.clone();

    let v = verify_backup_by_name(&name).await;
    assert_eq!(v["ok"], true, "backup should verify clean");

    let restored = restore_backup(&config.sqlite_path, &name).await;
    assert!(restored, "restore should succeed");

    // restore created a pre_restore safety backup — clear all and re-check.
    for b in list_backups() {
        let _ = std::fs::remove_file(hostwise_backend::backup::backups_dir().join(&b.name));
    }
    assert_eq!(list_backups().len(), 0);

    let v2 = verify_backup_by_name("does_not_exist.db").await;
    assert_eq!(v2["error"], "Backup not found");

    std::env::remove_var("HOSTWISE_DATA_DIR");
    drop(pool);
    let _ = std::fs::remove_dir_all(&dir);
}
