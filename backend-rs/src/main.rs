//! HostWise backend — standalone dev server.
//!
//! In production this library is embedded inside the Tauri shell; this binary
//! exists so the backend can be run/tested on its own during development.

use hostwise_backend::core::config::Config;
use hostwise_backend::serve;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = Config::from_env();
    serve(config).await?;
    Ok(())
}

fn init_tracing() {
    use tracing_subscriber::EnvFilter;

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("hostwise_backend=info,tower_http=info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();
}
