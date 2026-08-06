//! Smoke test: settings store (defaults + validation + masking + wipe) and
//! analytics KPIs against a real SQLite database.

use std::sync::Arc;

use hostwise_backend::analytics::service as analytics;
use hostwise_backend::core::config::Config;
use hostwise_backend::core::db;
use hostwise_backend::core::state::AppState;
use hostwise_backend::finance::schemas::{ExpenseCreateRequest, RevenueCreateRequest};
use hostwise_backend::finance::service::FinanceService;
use hostwise_backend::properties::models::Property;
use hostwise_backend::reservations::models::Reservation;
use hostwise_backend::settings::service as settings;

#[tokio::test]
async fn settings_and_analytics_flow() {
    let dir = std::env::temp_dir().join(format!("hostwise-sa-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();

    let mut config = Config::from_env();
    config.sqlite_path = dir.join("test.db");
    let pool = db::init_pool(&config).await.expect("init pool");
    let state = AppState {
        config: Arc::new(config.clone()),
        pool: pool.clone(),
    };
    let now = hostwise_backend::core::time::now_iso();

    // ── Settings: defaults, upsert, validation, masking ──
    let all = settings::get_all(&pool).await.unwrap();
    assert_eq!(all["business_name"], "HostWise");
    assert_eq!(all["default_currency"], "EUR");

    let mut patch = serde_json::Map::new();
    patch.insert("default_currency".into(), serde_json::json!("USD"));
    patch.insert("tax_rate".into(), serde_json::json!(15));
    patch.insert("ai_api_key".into(), serde_json::json!("sk-secret-123"));
    let updated = settings::update(&pool, patch).await.unwrap();
    assert_eq!(updated["default_currency"], "USD");
    assert_eq!(updated["tax_rate"], 15.0);
    // API key is masked on read.
    assert_eq!(updated["ai_api_key"], "••••••••");

    // Masked placeholder on write keeps the stored secret.
    let mut masked = serde_json::Map::new();
    masked.insert("ai_api_key".into(), serde_json::json!("••••••••"));
    let after_masked = settings::update(&pool, masked).await.unwrap();
    assert_eq!(after_masked["ai_api_key"], "••••••••");

    // Invalid enum is rejected.
    let mut bad = serde_json::Map::new();
    bad.insert("default_currency".into(), serde_json::json!("XXX"));
    assert!(settings::update(&pool, bad).await.is_err());

    // ── Seed property + reservation + revenue + expense ──
    let prop_id = uuid::Uuid::new_v4().to_string();
    let property = Property {
        id: prop_id.clone(),
        name: "Villa Azul".into(),
        r#type: "villa".into(),
        status: "active".into(),
        address: None,
        city: Some("Lisbon".into()),
        state: None,
        country: None,
        postal_code: None,
        latitude: None,
        longitude: None,
        bedrooms: 3,
        bathrooms: 2.0,
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
        confirmation_code: Some("XYZ".into()),
        status: "confirmed".into(),
        source: "manual".into(),
        check_in: "2026-06-10".into(),
        check_out: "2026-06-15".into(),
        booked_at: Some("2026-05-20T00:00:00+00:00".into()),
        cancelled_at: None,
        nights: 5,
        guest_name: Some("Ana".into()),
        guest_email: None,
        guest_phone: None,
        number_of_guests: 2,
        gross_revenue: 800.0,
        cleaning_fee: 40.0,
        platform_fee: 80.0,
        taxes: 24.0,
        net_revenue: 696.0,
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
            date: "2026-06-20".into(),
            gross_amount: 500.0,
            commission_amount: 50.0,
            source: "manual".into(),
            currency: "USD".into(),
            description: Some("Extra cleaning".into()),
            notes: None,
        })
        .await
        .unwrap();
    finance
        .create_expense(ExpenseCreateRequest {
            property_id: prop_id.clone(),
            category_id: None,
            date: "2026-06-21".into(),
            amount: 100.0,
            currency: "USD".into(),
            vendor: Some("Cleaner".into()),
            payment_method: None,
            description: None,
            notes: None,
            is_recurring: false,
            receipt_url: None,
        })
        .await
        .unwrap();

    // ── Analytics: property KPIs for 2026 ──
    let pa = analytics::get_property_analytics(&pool, &prop_id, 2026)
        .await
        .expect("property analytics");
    // Revenue: 500 gross - 50 commission = 450 net.
    assert_eq!(pa["gross_revenue"].as_f64().unwrap(), 500.0);
    assert_eq!(pa["net_revenue"].as_f64().unwrap(), 450.0);
    assert_eq!(pa["total_expenses"].as_f64().unwrap(), 100.0);
    assert_eq!(pa["profit"].as_f64().unwrap(), 350.0);
    assert_eq!(pa["cancellation_rate"].as_f64().unwrap(), 0.0);
    // Booking window: 2026-06-10 minus 2026-05-20 = 21 days.
    assert_eq!(pa["avg_booking_window_days"].as_f64().unwrap(), 21.0);
    let breakdown = pa["monthly_breakdown"].as_array().unwrap();
    assert!(breakdown.iter().any(|m| m["month"] == 6));

    let portfolio = analytics::get_portfolio_analytics(&pool, Some(2026), None, None)
        .await
        .expect("portfolio analytics");
    assert_eq!(portfolio["total_net_revenue"].as_f64().unwrap(), 450.0);
    assert_eq!(portfolio["total_expenses"].as_f64().unwrap(), 100.0);

    let health = analytics::get_property_health_score(&pool, &prop_id)
        .await
        .expect("health score");
    let score = health["score"].as_i64().unwrap();
    assert!((0..=100).contains(&score));

    // ── Wipe clears business data but keeps settings ──
    settings::wipe(&pool).await.unwrap();
    let props: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM properties")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(props, 0);
    let still = settings::get_all(&pool).await.unwrap();
    assert_eq!(still["business_name"], "HostWise");

    drop(pool);
    let _ = std::fs::remove_dir_all(&dir);
}
