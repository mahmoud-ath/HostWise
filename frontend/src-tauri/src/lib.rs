mod rust_backend;

use std::sync::Mutex;
use tauri::{Manager, State, WindowEvent};

/// The webview asks the Rust shell where the local API lives. Returns the port
/// the in-process Rust backend actually bound to (a free OS-assigned port).
#[tauri::command]
fn get_backend_url(state: State<'_, rust_backend::BackendUrl>) -> String {
    if let Ok(guard) = state.0.lock() {
        if let Some(url) = guard.as_ref() {
            return url.clone();
        }
    }
    rust_backend::default_backend_url()
}

/// Restart the in-process Rust backend (used by the frontend's connection
/// banner). The server is embedded in this process, so "restart" re-initialises
/// the router on a fresh free port.
#[tauri::command]
fn restart_backend(app: tauri::AppHandle) -> String {
    rust_backend::start(&app)
}

/// Install a tracing subscriber so the embedded backend's logs (every request
/// with method/path/status, plus any error) are printed to the terminal. The
/// Tauri shell previously initialized NO subscriber, so all `tracing` output
/// from `hostwise-backend` was silently dropped — leaving "no logs" when the
/// app runs under a single `bun run tauri:dev` command.
fn init_tracing() {
    use tracing_subscriber::EnvFilter;
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("hostwise_backend=info,tower_http=info,hostwise=info")
    });
    tracing_subscriber::fmt().with_env_filter(filter).init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // The native Rust backend starts before the window loads; the
            // webview shows "Starting HostWise..." until /api/health responds.
            app.manage(rust_backend::BackendUrl(Mutex::new(None)));
            app.manage(rust_backend::BackendServer(Mutex::new(None)));
            let url = rust_backend::start(app.handle());
            tracing::info!("Rust backend listening at {url}");
            Ok(())
        })
        .on_window_event(|window, event| {
            // Stop the in-process backend when the window is destroyed.
            if let WindowEvent::Destroyed = event {
                rust_backend::stop(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![get_backend_url, restart_backend])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
