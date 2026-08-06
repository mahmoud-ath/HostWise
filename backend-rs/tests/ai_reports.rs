//! Smoke test: AI advisor (rules engine + scenarios + connection) and reports
//! (weekly/monthly/annual/executive/portfolio JSON + PDF rendering).

use std::sync::Arc;

use hostwise_backend::ai::rules;
use hostwise_backend::ai::service::AiAdvisorService;
use hostwise_backend::core::config::Config;
use hostwise_backend::core::db;
use hostwise_backend::core::state::AppState;
use hostwise_backend::finance::schemas::{ExpenseCreateRequest, RevenueCreateRequest};
use hostwise_backend::finance::service::FinanceService;
use hostwise_backend::properties::models::Property;
use hostwise_backend::reports::pdf_service;
use hostwise_backend::reports::service::ReportGenerationService;

#[tokio::test]
async fn ai_and_reports_flow() {
    let dir = std::env::temp_dir().join(format!("hostwise-ar-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();

    let mut config = Config::from_env();
    config.sqlite_path = dir.join("test.db");
    let pool = db::init_pool(&config).await.expect("init pool");
    let state = AppState {
        config: Arc::new(config.clone()),
        pool: pool.clone(),
    };
    let now = hostwise_backend::core::time::now_iso();

    // Seed property + reservation + revenue + expense in June 2026.
    let prop_id = uuid::Uuid::new_v4().to_string();
    let property = Property {
        id: prop_id.clone(),
        name: "Villa".into(),
        r#type: "villa".into(),
        status: "active".into(),
        address: None,
        city: None,
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

    let reservation = hostwise_backend::reservations::models::Reservation {
        id: uuid::Uuid::new_v4().to_string(),
        property_id: prop_id.clone(),
        listing_id: None,
        external_id: None,
        confirmation_code: Some("A1".into()),
        status: "confirmed".into(),
        source: "manual".into(),
        check_in: "2026-06-10".into(),
        check_out: "2026-06-14".into(),
        booked_at: None,
        cancelled_at: None,
        nights: 4,
        guest_name: None,
        guest_email: None,
        guest_phone: None,
        number_of_guests: 2,
        gross_revenue: 800.0,
        cleaning_fee: 0.0,
        platform_fee: 0.0,
        taxes: 0.0,
        net_revenue: 800.0,
        currency: "EUR".into(),
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
            currency: "EUR".into(),
            description: None,
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
            currency: "EUR".into(),
            vendor: None,
            payment_method: None,
            description: None,
            notes: None,
            is_recurring: false,
            receipt_url: None,
        })
        .await
        .unwrap();

    // ── AI: rules engine ──
    let analysis = rules::analyze_financial_performance(&pool, "2026-01-01", "2026-12-31", 2026)
        .await
        .unwrap();
    assert!(!analysis["summary_text"].as_str().unwrap().is_empty());
    assert_eq!(
        analysis["metrics"]["profit_margin"].as_f64().unwrap(),
        77.78
    );

    let advisor = rules::generate_advisor_report(&pool, "2026-01-01", "2026-12-31", 2026)
        .await
        .unwrap();
    assert!(!advisor["executive_summary"].as_str().unwrap().is_empty());
    assert!(advisor["priority_actions"].is_object());
    let score = advisor["health_score"]["score"].as_i64().unwrap();
    assert!((0..=100).contains(&score));

    // ── AI: service (scenario + connection) ──
    let svc = AiAdvisorService { pool: pool.clone() };
    let sc = svc
        .simulate_scenario(
            "price_increase",
            &serde_json::json!({"increase_pct": 5}),
            2026,
        )
        .await
        .unwrap();
    assert_eq!(sc["scenario"], "price_increase");
    assert!(sc["projected_profit"].as_f64().unwrap() > 0.0);

    let conn = svc.test_llm_connection().await.unwrap();
    assert_eq!(conn["ok"], true);

    // ── Reports ──
    let reports = ReportGenerationService::from_pool(pool.clone());
    let weekly = reports.generate_weekly_report().await.unwrap();
    assert_eq!(weekly["report_type"], "weekly");

    let monthly = reports.generate_monthly_report(2026, 6).await.unwrap();
    assert_eq!(monthly["report_type"], "monthly");
    assert!(
        monthly["financial_data"]["summary"]["net_revenue"]
            .as_f64()
            .unwrap()
            > 0.0
    );

    let annual = reports.generate_annual_report(2026).await.unwrap();
    assert_eq!(annual["report_type"], "annual");

    let exec = reports.generate_executive_summary().await.unwrap();
    assert_eq!(exec["report_type"], "executive_summary");

    let portfolio = reports
        .generate_portfolio_report(Some("2026-01-01"), Some("2026-12-31"), None)
        .await
        .unwrap();
    assert_eq!(portfolio["report_type"], "portfolio");
    assert_eq!(portfolio["kpis"]["net_revenue"].as_f64().unwrap(), 450.0);

    // PDF renders (starts with %PDF).
    let pdf = pdf_service::render_portfolio_pdf(&portfolio).unwrap();
    assert!(pdf.starts_with(b"%PDF"), "expected a PDF document");

    drop(pool);
    let _ = std::fs::remove_dir_all(&dir);
}
