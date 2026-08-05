mod backend;

use std::sync::Mutex;
use tauri::{Manager, WindowEvent};

/// Holds the spawned backend process so we can stop it when the app closes.
struct BackendProcess(Mutex<Option<std::process::Child>>);

/// The webview asks the Rust shell where the local API lives. The frontend's
/// `api` client calls this when running inside Tauri (`__TAURI_INTERNALS__`).
#[tauri::command]
fn get_backend_url() -> String {
    backend::BACKEND_URL.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Start the Python backend before the window loads; the webview
            // shows "Starting HostWise..." until /api/health is reachable.
            let child = backend::spawn(app.handle());
            app.manage(BackendProcess(Mutex::new(child)));
            Ok(())
        })
        .on_window_event(|window, event| {
            // Kill the backend once the last window is destroyed.
            if let WindowEvent::Destroyed = event {
                let app = window.app_handle();
                if let Some(state) = app.try_state::<BackendProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_backend_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
