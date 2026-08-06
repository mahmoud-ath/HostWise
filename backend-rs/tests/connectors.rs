//! Smoke test: CSV import (with auto property creation + idempotency) and
//! iCal import (idempotent by UID) against a real SQLite database.

use std::sync::Arc;

use hostwise_backend::connectors::service::{detect_type, import_file, import_ical, read_file};
use hostwise_backend::core::config::Config;
use hostwise_backend::core::db;
use hostwise_backend::core::state::AppState;
use hostwise_backend::properties::models::Property;

#[tokio::test]
async fn connectors_flow() {
    let dir = std::env::temp_dir().join(format!("hostwise-cn-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();

    let mut config = Config::from_env();
    config.sqlite_path = dir.join("test.db");
    let pool = db::init_pool(&config).await.expect("init pool");
    let _state = AppState {
        config: Arc::new(config.clone()),
        pool: pool.clone(),
    };

    // A property for the iCal import.
    let now = hostwise_backend::core::time::now_iso();
    let prop_id = uuid::Uuid::new_v4().to_string();
    let property = Property {
        id: prop_id.clone(),
        name: "Casa Verde".into(),
        r#type: "house".into(),
        status: "active".into(),
        address: None,
        city: None,
        state: None,
        country: None,
        postal_code: None,
        latitude: None,
        longitude: None,
        bedrooms: 2,
        bathrooms: 1.0,
        deleted_at: None,
        created_at: now.clone(),
        updated_at: now.clone(),
        sync_id: None,
    };
    hostwise_backend::properties::repository::insert(&pool, &property)
        .await
        .unwrap();

    // ── CSV preview ──
    let csv_path = dir.join("reservations.csv");
    std::fs::write(
        &csv_path,
        "property_name,check_in,check_out,nights,gross_amount,guest_name,confirmation_code\n\
         Casa Nova,01/08/2026,05/08/2026,4,1000,Alice,CN1\n\
         Casa Nova,02/08/2026,03/08/2026,1,200,Bob,CN2\n",
    )
    .unwrap();

    let (fmt, columns, _rows) = read_file(&csv_path, None, None).unwrap();
    assert_eq!(fmt, "csv");
    assert_eq!(columns, vec!["property_name", "check_in", "check_out", "nights", "gross_amount", "guest_name", "confirmation_code"]);
    assert_eq!(detect_type("auto", &columns), "reservations");

    // ── CSV import (auto-creates the "Casa Nova" property) ──
    let r = import_file(&pool, &csv_path, "auto").await.unwrap();
    assert_eq!(r["imported"], 2);
    assert_eq!(r["properties_created"], 1);
    assert_eq!(r["skipped"], 0);

    // Idempotent re-import by confirmation_code.
    let r2 = import_file(&pool, &csv_path, "auto").await.unwrap();
    assert_eq!(r2["imported"], 0);
    assert_eq!(r2["skipped"], 2);

    // ── iCal import (idempotent by UID) ──
    let ics_path = dir.join("calendar.ics");
    std::fs::write(
        &ics_path,
        "BEGIN:VCALENDAR\n\
         BEGIN:VEVENT\nUID:uid-1\nSUMMARY:Guest One\nDTSTART:20260810\nDTEND:20260812\nEND:VEVENT\n\
         BEGIN:VEVENT\nUID:uid-2\nSUMMARY:Guest Two\nDTSTART:20260815T140000Z\nDTEND:20260816T140000Z\nEND:VEVENT\n\
         END:VCALENDAR\n",
    )
    .unwrap();

    let ical = import_ical(&pool, &ics_path, &prop_id).await.unwrap();
    assert_eq!(ical["imported"], 2, "two VEVENTs imported");
    assert_eq!(ical["skipped"], 0);

    let ical2 = import_ical(&pool, &ics_path, &prop_id).await.unwrap();
    assert_eq!(ical2["imported"], 0, "re-import skips known UIDs");
    assert_eq!(ical2["skipped"], 2);

    // One reservation per UID.
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reservations WHERE source = 'ical'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(total, 2);

    drop(pool);
    let _ = std::fs::remove_dir_all(&dir);
}
