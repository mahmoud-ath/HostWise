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
    use tracing_subscriber::prelude::*;
    use tracing_subscriber::EnvFilter;

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("hostwise_backend=info,tower_http=info"));

    // Write to stdout AND to `<app-data>/logs/hostwise.log` so standalone /
    // dev runs produce the same on-disk logs as the desktop app.
    let log_dir = hostwise_backend::core::config::default_data_dir().join("logs");
    let file = std::fs::create_dir_all(&log_dir).ok().and_then(|_| {
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_dir.join("hostwise.log"))
            .ok()
    });

    match file {
        Some(file) => {
            let stdout = tracing_subscriber::fmt::layer();
            let file_layer = tracing_subscriber::fmt::layer()
                .with_writer(file)
                .with_ansi(false);
            tracing_subscriber::registry()
                .with(stdout.with_filter(filter.clone()))
                .with(file_layer.with_filter(filter))
                .init();
        }
        None => tracing_subscriber::fmt().with_env_filter(filter).init(),
    }
}
