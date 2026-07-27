use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_shell::ShellExt;

const BACKEND_HOST: &str = "127.0.0.1";
const BACKEND_PORT: u16 = 8000;
const HEALTH_CHECK_URL: &str = "http://127.0.0.1:8000/api/health";
const HEALTH_CHECK_TIMEOUT_SECS: u64 = 30;
const HEALTH_CHECK_POLL_MS: u64 = 250;
const APP_NAME: &str = "hostwise";

// ── Shared application state ─────────────────────────────
pub struct AppState {
    pub backend_ready: AtomicBool,
}

/// Get the platform-appropriate data directory for database/upload storage.
fn get_data_dir() -> std::path::PathBuf {
    let app_name = APP_NAME;

    #[cfg(target_os = "linux")]
    {
        let xdg = std::env::var("XDG_DATA_HOME")
            .unwrap_or_else(|_| format!("{}/.local/share", std::env::var("HOME").unwrap()));
        std::path::PathBuf::from(xdg).join(app_name)
    }

    #[cfg(target_os = "macos")]
    {
        std::path::PathBuf::from(
            std::env::var("HOME").unwrap_or_default(),
        )
        .join("Library")
        .join("Application Support")
        .join(app_name)
    }

    #[cfg(target_os = "windows")]
    {
        std::path::PathBuf::from(
            std::env::var("APPDATA")
                .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_default()),
        )
        .join(app_name)
    }
}

/// Set environment variables that the Python backend will read.
fn setup_backend_env() {
    let data_dir = get_data_dir();
    let db_path = data_dir.join("hostwise.db");
    let uploads_dir = data_dir.join("uploads");

    // Ensure directories exist
    std::fs::create_dir_all(&data_dir).ok();
    std::fs::create_dir_all(&uploads_dir).ok();

    std::env::set_var("DATABASE_TYPE", "sqlite");
    std::env::set_var("SQLITE_PATH", db_path.to_string_lossy().as_ref());
    std::env::set_var(
        "CORS_ORIGINS",
        r#"["http://localhost:3000","http://127.0.0.1:3000","tauri://localhost","https://tauri.localhost"]"#,
    );
    std::env::set_var("HOST", BACKEND_HOST);
    std::env::set_var("PORT", BACKEND_PORT.to_string());
    std::env::set_var("UPLOAD_DIR", uploads_dir.to_string_lossy().as_ref());
    std::env::set_var("ENVIRONMENT", "production");
    std::env::set_var("LOG_LEVEL", "warning");

    #[cfg(debug_assertions)]
    {
        // In dev mode, keep more verbose logging so we can debug
        std::env::set_var("ENVIRONMENT", "development");
        std::env::set_var("LOG_LEVEL", "info");
    }
}

/// Poll the backend health endpoint until it responds or times out.
async fn wait_for_backend() -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let max_attempts = HEALTH_CHECK_TIMEOUT_SECS * 1000 / HEALTH_CHECK_POLL_MS;
    let mut attempts = 0u64;

    loop {
        if attempts >= max_attempts {
            return Err(format!(
                "Backend did not start within {} seconds",
                HEALTH_CHECK_TIMEOUT_SECS
            ));
        }

        match client.get(HEALTH_CHECK_URL).send().await {
            Ok(resp) if resp.status().is_success() => {
                // Backend is ready!
                log::info!("Backend health check passed after ~{}ms", attempts * HEALTH_CHECK_POLL_MS);
                return Ok(());
            }
            _ => {
                // Not ready yet — wait and retry
                tokio::time::sleep(Duration::from_millis(HEALTH_CHECK_POLL_MS)).await;
                attempts += 1;
            }
        }
    }
}

/// Kill any stale process holding our backend port.
fn cleanup_stale_backend() {
    // Try to connect to the port — if it's already in use, we have a stale backend
    use std::net::TcpStream;
    if TcpStream::connect(format!("{}:{}", BACKEND_HOST, BACKEND_PORT)).is_ok() {
        log::warn!(
            "Port {} is already in use by a stale backend — killing it",
            BACKEND_PORT
        );
        // Read the PID from the health endpoint if possible, or just kill all
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("sh")
                .args(["-c", &format!("fuser -k {}/tcp 2>/dev/null", BACKEND_PORT)])
                .output();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("sh")
                .args(["-c", &format!("lsof -ti:{} | xargs kill -9 2>/dev/null", BACKEND_PORT)])
                .output();
        }
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("cmd")
                .args(["/C", &format!("netstat -ano | findstr :{}", BACKEND_PORT)])
                .output();
        }
        // Wait for the port to be released
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
}

/// Spawn the Python backend as a Tauri sidecar process.
async fn spawn_backend(app: &tauri::AppHandle) -> Result<tauri_plugin_shell::process::CommandChild, String> {
    setup_backend_env();
    cleanup_stale_backend();

    // In dev mode, the binary may not exist yet — try to find it
    // or provide a helpful error.
    let sidecar = app.shell().sidecar("hostwise-backend").map_err(|e| {
        format!(
            "Failed to create sidecar command: {e}. \
             Make sure the backend binary exists at frontend/src-tauri/binaries/ \
             or build it first with: cd backend && pyinstaller launcher.spec"
        )
    })?;

    let (mut rx, child) = sidecar.spawn().map_err(|e| {
        format!("Failed to spawn backend sidecar: {e}")
    })?;

    // Spawn a task to log the sidecar output
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log::info!("[backend] {}", text.trim());
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log::warn!("[backend] {}", text.trim());
                }
                CommandEvent::Terminated(payload) => {
                    log::error!(
                        "Backend process terminated unexpectedly: exit={:?} signal={:?}",
                        payload.code,
                        payload.signal
                    );
                }
                _ => {}
            }
        }
    });

    log::info!("Backend sidecar spawned, PID: {:?}", child.pid());
    Ok(child)
}

// ── Tauri Commands ───────────────────────────────────────

/// Check if the backend is ready (called from the frontend).
#[tauri::command]
fn is_backend_ready(state: tauri::State<'_, AppState>) -> bool {
    state.backend_ready.load(Ordering::SeqCst)
}

/// Get the backend URL for API calls from the frontend.
#[tauri::command]
fn get_backend_url() -> String {
    format!("http://{}:{}/api/v1", BACKEND_HOST, BACKEND_PORT)
}

/// Get the app data directory path (for diagnostics).
#[tauri::command]
fn get_app_data_dir() -> String {
    get_data_dir().to_string_lossy().to_string()
}

// ── Application Entry Point ──────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Set GDK backend for Linux compatibility (avoids Wayland/EGL crashes)
    #[cfg(all(target_os = "linux", not(debug_assertions)))]
    {
        std::env::set_var("GDK_BACKEND", "x11");
        std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
        std::env::set_var("GALLIUM_DRIVER", "llvmpipe");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            backend_ready: AtomicBool::new(false),
        })
        .setup(|app| {
            let handle = app.handle().clone();

            // Spawn the backend in a background task
            tauri::async_runtime::spawn(async move {
                log::info!("Starting backend sidecar...");

                match spawn_backend(&handle).await {
                    Ok(child) => {
                        log::info!("Backend process started, waiting for health check...");

                        match wait_for_backend().await {
                            Ok(()) => {
                                log::info!("Backend is ready!");
                                let state = handle.state::<AppState>();
                                state.backend_ready.store(true, Ordering::SeqCst);

                                // Show the main window (it starts hidden)
                                if let Some(window) = handle.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            Err(e) => {
                                log::error!("Backend health check failed: {e}");
                                let _ = child.kill();
                                // Show error dialog
                                handle.dialog()
                                    .message(format!(
                                        "Failed to start the HostWise backend.\n\n{0}\n\n\
                                         Please try reinstalling the application.",
                                        e
                                    ))
                                    .title("Backend Error")
                                    .kind(MessageDialogKind::Error)
                                    .blocking_show();
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to spawn backend: {e}");

                        // In dev mode, the binary may not exist — show a helpful message
                        #[cfg(debug_assertions)]
                        {
                            handle.dialog()
                                .message(format!(
                                    "Backend binary not found.\n\n{0}\n\n\
                                     To start the backend manually:\n\
                                     cd backend && source .venv/bin/activate && uvicorn app.main:app --reload\n\n\
                                     The app will continue without the backend.",
                                    e
                                ))
                                .title("Development Mode")
                                .kind(MessageDialogKind::Info)
                                .blocking_show();
                        }

                        #[cfg(not(debug_assertions))]
                        {
                            handle.dialog()
                                .message(format!(
                                    "Failed to start the HostWise backend.\n\n{0}\n\n\
                                     Please try reinstalling the application.",
                                    e
                                ))
                                .title("Backend Error")
                                .kind(MessageDialogKind::Error)
                                .blocking_show();
                        }
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Error building HostWise application");

    app.run(|_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            log::info!("Shutting down backend...");
            // The sidecar child is killed automatically when the app exits
            // because Tauri manages the process lifecycle.
        }
    });
}
