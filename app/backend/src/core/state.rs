//! Shared application state passed to every handler via `State<AppState>`.

use std::sync::Arc;

use sqlx::SqlitePool;

use crate::core::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub pool: SqlitePool,
}
