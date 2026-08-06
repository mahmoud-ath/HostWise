//! In-process Rust backend (axum) management.
//!
//! The Python/FastAPI backend was retired at v0.6.9. The native Rust backend
//! crate `hostwise-backend` now runs as an axum HTTP server INSIDE the Tauri
//! process — no child process, no PyInstaller, no external runtime, no
//! Defender false positives. It serves the same `/api/v1/*` REST contract, so
//! the existing frontend (`frontend/src/lib/api.ts`) works unchanged.

use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};

/// Managed state holding the base URL of the running backend.
pub struct BackendUrl(pub Mutex<Option<String>>);

/// Managed state holding the in-process server task (so it can be restarted or
/// aborted when the app exits).
pub struct BackendServer(pub Mutex<Option<JoinHandle<()>>>);

/// Preferred port. We never hard-bind it in release: fixed ports are often
/// taken by other software, so we let the OS hand us a free port instead.
pub const DEFAULT_PORT: u16 = 8000;

/// Base URL to report before the backend has picked its port (dev/fallback).
pub fn default_backend_url() -> String {
    format!("http://127.0.0.1:{DEFAULT_PORT}")
}

/// Pick a free TCP port on 127.0.0.1, preferring `preferred` when it is free.
fn pick_free_port(preferred: u16) -> u16 {
    if let Ok(listener) = TcpListener::bind(("127.0.0.1", preferred)) {
        drop(listener);
        return preferred;
    }
    match TcpListener::bind(("127.0.0.1", 0)) {
        Ok(listener) => {
            let port = listener.local_addr().map(|a| a.port()).unwrap_or(preferred);
            drop(listener);
            port
        }
        Err(_) => preferred,
    }
}

/// Emit a `backend-status` event for the frontend connection banner.
fn emit_status(app: &AppHandle, status: &'static str, error: Option<String>) {
    #[derive(serde::Serialize, Clone)]
    struct BackendStatus {
        status: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    }
    let _ = app.emit("backend-status", BackendStatus { status, error });
}

/// Platform app-data directory (mirrors the old backend launcher).
fn data_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    let base = if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home)
    } else if cfg!(target_os = "macos") {
        home.join("Library").join("Application Support")
    } else {
        std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".local").join("share"))
    };
    base.join("hostwise")
}

/// Stable JWT secret persisted in the app-data dir (survives restarts, unlike
/// the old constant default).
fn load_or_create_secret(dir: &PathBuf) -> String {
    let secret_file = dir.join("jwt_secret");
    if let Ok(existing) = std::fs::read_to_string(&secret_file) {
        let existing = existing.trim().to_string();
        if !existing.is_empty() {
            return existing;
        }
    }
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    if std::fs::create_dir_all(dir).is_ok() {
        let _ = std::fs::write(&secret_file, &hex);
    }
    hex
}

/// Build the backend `Config` for the desktop: SQLite in the app-data dir,
/// Tauri webview CORS origins, a free port, and a persisted JWT secret.
fn desktop_config(port: u16) -> hostwise_backend::core::config::Config {
    let mut cfg = hostwise_backend::core::config::Config::from_env();
    let dir = data_dir();
    cfg.host = "127.0.0.1".to_string();
    cfg.port = port;
    cfg.database_type = "sqlite".to_string();
    cfg.sqlite_path = dir.join("hostwise.db");
    cfg.jwt_secret_key = load_or_create_secret(&dir);
    cfg.environment = if cfg!(debug_assertions) {
        "development".to_string()
    } else {
        "production".to_string()
    };
    cfg.cors_origins = vec![
        "http://localhost:3000".into(),
        "http://127.0.0.1:3000".into(),
        "tauri://localhost".into(),
        "https://tauri.localhost".into(),
    ];
    cfg
}

/// Start (or restart) the in-process Rust backend on a free port and return
/// its base URL. Emits `backend-status: healthy` once the port is bound.
pub fn start(app: &AppHandle) -> String {
    stop(app);

    let port = pick_free_port(DEFAULT_PORT);
    let url = format!("http://127.0.0.1:{port}");
    let config = desktop_config(port);

    // Open the SQLite pool + run migrations (quick; fine to block briefly here).
    let state = match tauri::async_runtime::block_on(async {
        let pool = hostwise_backend::core::db::init_pool(&config).await?;
        Ok::<_, anyhow::Error>(hostwise_backend::core::state::AppState {
            config: std::sync::Arc::new(config),
            pool,
        })
    }) {
        Ok(state) => state,
        Err(err) => {
            emit_status(app, "failed", Some(format!("Database init failed: {err}")));
            return url;
        }
    };

    let router = hostwise_backend::build_router(state);
    let app_handle = app.clone();

    let handle = tauri::async_runtime::spawn(async move {
        let addr = format!("127.0.0.1:{port}");
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                emit_status(&app_handle, "healthy", None);
                if let Err(err) = axum::serve(listener, router).await {
                    tracing::error!("backend server error: {err}");
                    emit_status(&app_handle, "failed", Some(err.to_string()));
                }
            }
            Err(err) => emit_status(&app_handle, "failed", Some(err.to_string())),
        }
    });

    if let Some(state) = app.try_state::<BackendServer>() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = Some(handle);
        }
    }
    if let Some(state) = app.try_state::<BackendUrl>() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = Some(url.clone());
        }
    }
    url
}

/// Abort the in-process server task.
pub fn stop(app: &AppHandle) {
    if let Some(state) = app.try_state::<BackendServer>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(handle) = guard.take() {
                handle.abort();
            }
        }
    }
}
