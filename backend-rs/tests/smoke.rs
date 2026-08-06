//! Smoke test: full auth flow (register → login → refresh → duplicate email)
//! against a real SQLite database with migrations applied.

use std::sync::Arc;

use hostwise_backend::auth::schemas::{LoginRequest, RegisterRequest};
use hostwise_backend::auth::AuthService;
use hostwise_backend::core::config::Config;
use hostwise_backend::core::db;
use hostwise_backend::core::state::AppState;

#[tokio::test]
async fn register_login_refresh_flow() {
    let dir = std::env::temp_dir().join(format!("hostwise-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();

    let mut config = Config::from_env();
    config.sqlite_path = dir.join("test.db");

    let pool = db::init_pool(&config).await.expect("init pool");
    let state = AppState {
        config: Arc::new(config.clone()),
        pool: pool.clone(),
    };
    let svc = AuthService::new(state);

    // Register
    let tokens = svc
        .register(RegisterRequest {
            email: "alice@example.com".into(),
            password: "password123".into(),
            full_name: Some("Alice".into()),
        })
        .await
        .expect("register");
    assert!(!tokens.access_token.is_empty());
    assert!(!tokens.refresh_token.is_empty());

    // Login with the same credentials → valid access token (iat differs by
    // a second from register, so the tokens differ — that's expected).
    let login = svc
        .login(LoginRequest {
            email: "alice@example.com".into(),
            password: "password123".into(),
        })
        .await
        .expect("login");
    let claims = hostwise_backend::auth::security::decode_token(
        &config.jwt_secret_key,
        &login.access_token,
    )
    .expect("login token decodes");
    assert_eq!(claims.typ, "access");
    assert!(!claims.sub.is_empty());

    // Refresh token works
    let refreshed = svc.refresh(&tokens.refresh_token).await.expect("refresh");
    assert!(!refreshed.access_token.is_empty());

    // Wrong password rejected
    let bad = svc
        .login(LoginRequest {
            email: "alice@example.com".into(),
            password: "wrong-password".into(),
        })
        .await;
    assert!(bad.is_err());

    // Duplicate email rejected (case-insensitive)
    let dup = svc
        .register(RegisterRequest {
            email: "ALICE@example.com".into(),
            password: "password123".into(),
            full_name: None,
        })
        .await;
    assert!(dup.is_err());

    drop(pool);
    let _ = std::fs::remove_dir_all(&dir);
}
