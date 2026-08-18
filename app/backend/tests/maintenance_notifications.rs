//! Smoke test: notifications (refresh/dedupe/read/archive) and maintenance
//! (status/cleanup/reset) against a real SQLite database.

use std::sync::Arc;

use hostwise_backend::core::config::Config;
use hostwise_backend::core::db;
use hostwise_backend::core::state::AppState;
use hostwise_backend::finance::schemas::RevenueCreateRequest;
use hostwise_backend::finance::service::FinanceService;
use hostwise_backend::maintenance::service as maintenance;
use hostwise_backend::notifications::service as notifications;
use hostwise_backend::properties::models::Property;
use hostwise_backend::reservations::models::Reservation;

#[tokio::test]
async fn maintenance_and_notifications_flow() {
    let dir = std::env::temp_dir().join(format!("hostwise-mn-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();

    let mut config = Config::from_env();
    config.sqlite_path = dir.join("test.db");
    let pool = db::init_pool(&config).await.expect("init pool");
    let state = AppState {
        config: Arc::new(config.clone()),
        pool: pool.clone(),
    };
    let now = hostwise_backend::core::time::now_iso();

    // Seed a property + reservation + revenue.
    let prop_id = uuid::Uuid::new_v4().to_string();
    let property = Property {
        id: prop_id.clone(),
        name: "Casa".into(),
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
        max_guests: 2,
        square_meters: None,
        acquisition_cost: None,
        monthly_mortgage: None,
        target_occupancy: None,
        target_annual_revenue: None,
        notes: None,
        deleted_at: None,
        created_at: now.clone(),
        updated_at: now.clone(),
        sync_id: None,
    };
    hostwise_backend::properties::repository::insert(&pool, &property)
        .await
        .unwrap();

    let reservation = Reservation {
        id: uuid::Uuid::new_v4().to_string(),
        property_id: prop_id.clone(),
        listing_id: None,
        external_id: None,
        confirmation_code: Some("R1".into()),
        status: "confirmed".into(),
        source: "manual".into(),
        check_in: now[..10].to_string(),
        check_out: now[..10].to_string(),
        booked_at: None,
        cancelled_at: None,
        nights: 2,
        guest_name: None,
        guest_email: None,
        guest_phone: None,
        number_of_guests: 1,
        gross_revenue: 100.0,
        cleaning_fee: 0.0,
        platform_fee: 0.0,
        taxes: 0.0,
        net_revenue: 100.0,
        currency: "USD".into(),
        property_name: None,
        property_city: None,
        property_country: None,
        notes: None,
        deleted_at: None,
        is_deleted: false,
        created_at: now.clone(),
        updated_at: now.clone(),
        sync_id: None,
    };
    hostwise_backend::reservations::repository::insert(&pool, &reservation)
        .await
        .unwrap();

    let finance = FinanceService::new(state);
    finance
        .create_revenue(RevenueCreateRequest {
            property_id: prop_id.clone(),
            reservation_id: None,
            category_id: None,
            date: now[..10].to_string(),
            gross_amount: 200.0,
            commission_amount: 20.0,
            source: "manual".into(),
            currency: "USD".into(),
            description: None,
            notes: None,
        })
        .await
        .unwrap();

    // ── Notifications ──
    assert_eq!(notifications::unread_count(&pool).await.unwrap(), 0);

    // refresh() with data -> at least the monthly-report notification.
    let r = notifications::refresh(&pool).await.unwrap();
    let created = r["created"].as_i64().unwrap();
    assert!(created >= 1, "expected >=1 created, got {created}");
    let unread = notifications::unread_count(&pool).await.unwrap();
    assert!(unread >= 1);

    // Idempotent — refreshing again creates nothing new.
    let r2 = notifications::refresh(&pool).await.unwrap();
    assert_eq!(r2["created"].as_i64().unwrap(), 0);

    // List + mark read + summary + archive.
    let items = notifications::list(&pool, 50).await.unwrap();
    assert!(!items.is_empty());
    let first_id = items[0].id.clone();
    assert!(notifications::mark_read(&pool, &first_id).await.unwrap());
    assert_eq!(
        notifications::unread_count(&pool).await.unwrap(),
        (unread - 1).max(0)
    );
    let updated = notifications::mark_all_read(&pool).await.unwrap();
    assert_eq!(notifications::unread_count(&pool).await.unwrap(), 0);
    assert!(updated >= 0);
    let archived = notifications::clear_all(&pool).await.unwrap();
    assert!(archived >= 1);
    assert_eq!(notifications::list(&pool, 50).await.unwrap().len(), 0);

    // ── Maintenance ──
    let st = maintenance::status(&pool, &config).await.unwrap();
    assert_eq!(st["database_type"], "sqlite");
    assert_eq!(st["integrity"], "ok");
    assert!(st["database_size"].as_u64().unwrap() > 0);

    // Soft-delete a reservation with an old deleted_at, then purge via cleanup.
    sqlx::query(
        "UPDATE reservations SET is_deleted = 1, deleted_at = '2020-01-01T00:00:00Z' WHERE id = ?",
    )
    .bind(&reservation.id)
    .execute(&pool)
    .await
    .unwrap();
    let cl = maintenance::cleanup(&pool, 1).await.unwrap();
    let purged = cl["purged"]["reservations"].as_i64().unwrap_or(0);
    assert_eq!(purged, 1);
    let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reservations")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(remaining, 0);

    // reset-demo-data deletes revenues.
    let rd = maintenance::reset_demo(&pool).await.unwrap();
    assert!(rd["deleted"]["revenues"].as_i64().unwrap() >= 1);
    let revs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM revenues")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(revs, 0);

    drop(pool);
    let _ = std::fs::remove_dir_all(&dir);
}
