//! HostWise native backend library root.
//!
//! Builds an `axum` router that can run standalone (`main.rs`) or embedded
//! inside the Tauri desktop shell (planned integration).

pub mod api;
pub mod auth;
pub mod core;
pub mod finance;
pub mod properties;
pub mod reservations;

use std::sync::Arc;

use axum::http::{header::HeaderValue, Method};
use axum::{middleware, Router};
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;

use crate::core::config::Config;
use crate::core::db;
use crate::core::error::AppError;
use crate::core::state::AppState;

/// Build the full HTTP router with middleware (request logging, gzip, CORS).
pub fn build_router(state: AppState) -> Router {
    let origins: Vec<HeaderValue> = state
        .config
        .cors_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any);

    api::build_api_router()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            core::middleware::request_logging,
        ))
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state)
}

/// Convenience: initialize the DB from config and serve until shutdown.
pub async fn serve(config: Config) -> Result<(), AppError> {
    let pool = db::init_pool(&config).await?;
    let state = AppState {
        config: Arc::new(config.clone()),
        pool,
    };
    let app = build_router(state);

    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!(%addr, "HostWise backend listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install Ctrl+C handler");
    tracing::info!("shutdown signal received");
}
