//! Request-ID + timing middleware (mirrors `RequestLogMiddleware` in main.py).

use std::time::Instant;

use axum::extract::State;
use axum::http::{HeaderValue, Request};
use axum::middleware::Next;
use axum::response::Response;
use uuid::Uuid;

use crate::core::state::AppState;

pub async fn request_logging(
    State(_state): State<AppState>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let request_id = Uuid::new_v4().simple().to_string();
    let start = Instant::now();
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    let mut response = next.run(req).await;
    let elapsed_ms = start.elapsed().as_millis();

    if let Ok(v) = request_id.parse::<HeaderValue>() {
        response.headers_mut().insert("X-Request-ID", v);
    }
    if let Ok(v) = format!("{elapsed_ms}").parse::<HeaderValue>() {
        response.headers_mut().insert("X-Response-Time-Ms", v);
    }

    tracing::info!(
        method = %method,
        path = %path,
        status = response.status().as_u16(),
        ms = elapsed_ms,
        request_id = %request_id,
        "request"
    );

    response
}
