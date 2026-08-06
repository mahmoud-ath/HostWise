//! Smoke test: property → reservation → revenue → expense → summary/monthly
//! report, verifying the auto-categorization and KPI math.

use std::sync::Arc;

use hostwise_backend::core::config::Config;
use hostwise_backend::core::db;
use hostwise_backend::core::state::AppState;
use hostwise_backend::finance::schemas::{ExpenseCreateRequest, RevenueCreateRequest};
use hostwise_backend::finance::service::FinanceService;
use hostwise_backend::properties::models::Property;
use hostwise_backend::reservations::models::Reservation;

#[tokio::test]
async fn reservations_finance_flow() {
    let dir = std::env::temp_dir().join(format!("hostwise-fin-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();

    let mut config = Config::from_env();
    config.sqlite_path = dir.join("test.db");

    let pool = db::init_pool(&config).await.expect("init pool");
    let state = AppState {
        config: Arc::new(config.clone()),
        pool: pool.clone(),
    };
    let now = hostwise_backend::core::time::now_iso();

    // Property
    let prop_id = uuid::Uuid::new_v4().to_string();
    let property = Property {
        id: prop_id.clone(),
        name: "Casa do Mar".into(),
        r#type: "house".into(),
        status: "active".into(),
        address: None,
        city: Some("Lisbon".into()),
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

    // Reservation
    let reservation = Reservation {
        id: uuid::Uuid::new_v4().to_string(),
        property_id: prop_id.clone(),
        listing_id: None,
        external_id: None,
        confirmation_code: Some("ABC123".into()),
        status: "confirmed".into(),
        source: "manual".into(),
        check_in: "2026-08-01".into(),
        check_out: "2026-08-05".into(),
        booked_at: None,
        cancelled_at: None,
        nights: 4,
        guest_name: Some("João".into()),
        guest_email: None,
        guest_phone: None,
        number_of_guests: 2,
        gross_revenue: 1000.0,
        cleaning_fee: 50.0,
        platform_fee: 100.0,
        taxes: 30.0,
        net_revenue: 870.0,
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

    // Revenue: gross 500 - commission 50 = net 450; description auto-categorizes.
    let rev = finance
        .create_revenue(RevenueCreateRequest {
            property_id: prop_id.clone(),
            reservation_id: None,
            category_id: None,
            date: "2026-08-10".into(),
            gross_amount: 500.0,
            commission_amount: 50.0,
            source: "manual".into(),
            currency: "USD".into(),
            description: Some("Cleaning fee".into()),
            notes: None,
        })
        .await
        .expect("create revenue");
    assert_eq!(rev.net_amount, 450.0);
    assert!(rev.category_id.is_some(), "description should auto-create a category");

    // Expense
    let exp = finance
        .create_expense(ExpenseCreateRequest {
            property_id: prop_id.clone(),
            category_id: None,
            date: "2026-08-11".into(),
            amount: 120.0,
            currency: "USD".into(),
            vendor: Some("Handyman".into()),
            payment_method: None,
            description: None,
            notes: None,
            is_recurring: false,
            receipt_url: None,
        })
        .await
        .expect("create expense");
    assert_eq!(exp.amount, 120.0);

    // Summary KPIs
    let summary = finance.get_summary(None, None).await.unwrap();
    assert_eq!(summary.total_revenue, 450.0);
    assert_eq!(summary.total_expenses, 120.0);
    assert_eq!(summary.net_cashflow, 330.0);
    assert_eq!(summary.revenue_count, 1);
    assert_eq!(summary.expense_count, 1);

    // Monthly report for Aug 2026
    let monthly = finance.get_monthly_report(2026, 8).await.unwrap();
    assert_eq!(monthly.total_revenue, 450.0);
    assert_eq!(monthly.total_expenses, 120.0);
    assert_eq!(monthly.net, 330.0);

    drop(pool);
    let _ = std::fs::remove_dir_all(&dir);
}
