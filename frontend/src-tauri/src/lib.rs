use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_shell::ShellExt;

const BASE_PORT: u16 = 18000;
const MAX_PORT_ATTEMPTS: u16 = 100;
const HEALTH_CHECK_TIMEOUT_SECS: u64 = 30;
const HEALTH_CHECK_POLL_MS: u64 = 250;
const HEALTH_MONITOR_INTERVAL_SECS: u64 = 10;
const APP_NAME: &str = "hostwise";

// ── Shared application state ─────────────────────────────
pub struct AppState {
    pub backend_ready: AtomicBool,
    pub backend_child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    pub backend_port: Mutex<u16>,
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
fn setup_backend_env(port: u16) {
    let data_dir = get_data_dir();
    let db_path = data_dir.join("hostwise.db");
    let uploads_dir = data_dir.join("uploads");

    // Ensure directories exist
    std::fs::create_dir_all(&data_dir).ok();
    std::fs::create_dir_all(&uploads_dir).ok();

    // Set TMP/TEMP to app data dir so PyInstaller extracts DLLs
    // to a path Windows Defender doesn't monitor as aggressively
    // as the system temp directory (fixes "access violation" on Windows).
    let runtime_dir = data_dir.join("runtime");
    std::fs::create_dir_all(&runtime_dir).ok();
    let runtime_path = runtime_dir.to_string_lossy().to_string();
    std::env::set_var("TMP", &runtime_path);
    std::env::set_var("TEMP", &runtime_path);
    // PyInstaller-specific: override default extraction directory
    std::env::set_var("PYINSTALLER_TMPDIR", &runtime_path);

    std::env::set_var("DATABASE_TYPE", "sqlite");
    std::env::set_var("SQLITE_PATH", db_path.to_string_lossy().as_ref());
    std::env::set_var(
        "CORS_ORIGINS",
        r#"["http://localhost:3000","http://127.0.0.1:3000","tauri://localhost","https://tauri.localhost"]"#,
    );
    std::env::set_var("HOST", "127.0.0.1");
    std::env::set_var("PORT", port.to_string());
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
async fn wait_for_backend(port: u16) -> Result<(), String> {
    let health_url = format!("http://127.0.0.1:{}/api/health", port);
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

        match client.get(&health_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                // Backend is ready!
                log::info!(
                    "Backend health check passed after ~{}ms",
                    attempts * HEALTH_CHECK_POLL_MS
                );
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

/// Find an available TCP port by scanning from BASE_PORT upward.
fn find_available_port() -> Result<u16, String> {
    for port in BASE_PORT..BASE_PORT + MAX_PORT_ATTEMPTS {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            log::info!("Selected port {} for backend", port);
            return Ok(port);
        }
    }
    Err(format!(
        "No available port found in range {}-{}",
        BASE_PORT,
        BASE_PORT + MAX_PORT_ATTEMPTS - 1
    ))
}

/// Kill any stale process holding our backend port.
fn cleanup_stale_backend(port: u16) {
    if TcpListener::bind(("127.0.0.1", port)).is_ok() {
        // Port is already free — nothing to clean up
        return;
    }

    log::warn!(
        "Port {} is already in use — attempting to kill stale process",
        port
    );

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("sh")
            .args(["-c", &format!("fuser -k {}/tcp 2>/dev/null", port)])
            .output();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("sh")
            .args([
                "-c",
                &format!("lsof -ti tcp:{} | xargs kill -9 2>/dev/null", port),
            ])
            .output();
    }
    #[cfg(target_os = "windows")]
    {
        // Find the PID holding the port, then kill it
        let output = std::process::Command::new("cmd")
            .args(["/C", &format!("netstat -ano | findstr :{}", port)])
            .output()
            .ok();
        if let Some(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                // netstat output: "  TCP    127.0.0.1:18000   0.0.0.0:0   LISTENING    12345"
                if let Some(pid_str) = line.split_whitespace().last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        log::info!("Killing stale backend process PID={}", pid);
                        let _ = std::process::Command::new("taskkill")
                            .args(["/F", "/PID", &pid.to_string()])
                            .output();
                    }
                }
            }
        }
    }

    // Wait for the port to be released
    std::thread::sleep(Duration::from_millis(500));
}

/// Spawn the Python backend as a Tauri sidecar process.
async fn spawn_backend(
    app: &tauri::AppHandle,
) -> Result<tauri_plugin_shell::process::CommandChild, String> {
    // Find an available port
    let port = find_available_port()?;
    log::info!("Backend will listen on port {}", port);

    setup_backend_env(port);
    cleanup_stale_backend(port);

    // Store port in app state
    *app.state::<AppState>().backend_port.lock().unwrap() = port;

    // In dev mode, the binary may not exist yet — try to find it
    // or provide a helpful error.
    let mut sidecar = app.shell().sidecar("hostwise-backend").map_err(|e| {
        format!(
            "Failed to create sidecar command: {e}. \
             Make sure the backend binary exists at frontend/src-tauri/binaries/ \
             or build it first with: cd backend && pyinstaller hostwise-backend.spec"
        )
    })?;

    // Explicitly pass environment variables to the sidecar.
    // Tauri's shell plugin may sanitize the inherited environment,
    // so std::env::set_var in setup_backend_env() is not sufficient.
    let data_dir = get_data_dir();
    let runtime_dir = data_dir.join("runtime");
    let runtime_path = runtime_dir.to_string_lossy().to_string();
    sidecar = sidecar.env("TMP", &runtime_path);
    sidecar = sidecar.env("TEMP", &runtime_path);
    sidecar = sidecar.env("PYINSTALLER_TMPDIR", &runtime_path);
    sidecar = sidecar.env("DATABASE_TYPE", "sqlite");
    sidecar = sidecar.env("HOST", "127.0.0.1");
    sidecar = sidecar.env("PORT", &port.to_string());
    sidecar = sidecar.env(
        "CORS_ORIGINS",
        r#"["http://localhost:3000","http://127.0.0.1:3000","tauri://localhost","https://tauri.localhost"]"#,
    );
    sidecar = sidecar.env("ENVIRONMENT", "production");
    sidecar = sidecar.env("LOG_LEVEL", "warning");
    sidecar = sidecar.env(
        "SQLITE_PATH",
        data_dir.join("hostwise.db").to_string_lossy().as_ref(),
    );
    sidecar = sidecar.env(
        "UPLOAD_DIR",
        data_dir.join("uploads").to_string_lossy().as_ref(),
    );

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn backend sidecar: {e}"))?;

    // Spawn a task to log the sidecar output
    tauri::async_runtime::spawn({
        let app_handle = app.clone();
        async move {
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
                        // Notify frontend that backend crashed
                        let state = app_handle.state::<AppState>();
                        state.backend_ready.store(false, Ordering::SeqCst);
                        let _ = app_handle.emit("backend-status", serde_json::json!({
                            "status": "crashed",
                            "code": payload.code,
                            "signal": payload.signal,
                        }));
                    }
                    _ => {}
                }
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

/// Get the backend base URL for API calls from the frontend.
/// Uses the dynamically assigned port.
#[tauri::command]
fn get_backend_url(state: tauri::State<'_, AppState>) -> String {
    let port = *state.backend_port.lock().unwrap();
    format!("http://127.0.0.1:{}/api/v1", port)
}

/// Get the backend health endpoint URL (for frontend health checks).
#[tauri::command]
fn get_backend_health_url(state: tauri::State<'_, AppState>) -> String {
    let port = *state.backend_port.lock().unwrap();
    format!("http://127.0.0.1:{}/api/health", port)
}

/// Get the app data directory path (for diagnostics).
#[tauri::command]
fn get_app_data_dir() -> String {
    get_data_dir().to_string_lossy().to_string()
}

/// Restart the backend process (kills current, spawns new).
#[tauri::command]
async fn restart_backend(app: tauri::AppHandle) -> Result<(), String> {
    log::info!("Restarting backend...");

    // Mark as not ready immediately
    let state = app.state::<AppState>();
    state.backend_ready.store(false, Ordering::SeqCst);

    // Kill existing child (scope the lock so MutexGuard drops before await)
    let child_to_kill = {
        let mut guard = state.backend_child.lock().unwrap();
        guard.take()
    };
    if let Some(child) = child_to_kill {
        log::info!("Killing existing backend process");
        let _ = child.kill();
        // Give it a moment to release resources
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    // Emit restarting event
    let _ = app.emit(
        "backend-status",
        serde_json::json!({"status": "restarting"}),
    );

    // Spawn new backend
    match spawn_backend(&app).await {
        Ok(child) => {
            log::info!("New backend process started, waiting for health check...");
            let port = *app.state::<AppState>().backend_port.lock().unwrap();

            match wait_for_backend(port).await {
                Ok(()) => {
                    log::info!("Backend restart complete — healthy");
                    let state = app.state::<AppState>();
                    state.backend_ready.store(true, Ordering::SeqCst);
                    *state.backend_child.lock().unwrap() = Some(child);
                    let _ = app.emit(
                        "backend-status",
                        serde_json::json!({"status": "healthy"}),
                    );
                    Ok(())
                }
                Err(e) => {
                    log::error!("Backend restart failed: {e}");
                    let _ = child.kill();
                    let _ = app.emit(
                        "backend-status",
                        serde_json::json!({"status": "failed", "error": e}),
                    );
                    Err(format!("Backend failed to start after restart: {e}"))
                }
            }
        }
        Err(e) => {
            log::error!("Failed to spawn backend on restart: {e}");
            let _ = app.emit(
                "backend-status",
                serde_json::json!({"status": "failed", "error": e}),
            );
            Err(e)
        }
    }
}

/// Background health monitor — polls backend periodically and emits status events.
async fn start_health_monitor(app: tauri::AppHandle) {
    let port = *app.state::<AppState>().backend_port.lock().unwrap();
    let health_url = format!("http://127.0.0.1:{}/api/health", port);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("Failed to create HTTP client for health monitor");

    let mut was_healthy = true;

    loop {
        tokio::time::sleep(Duration::from_secs(HEALTH_MONITOR_INTERVAL_SECS)).await;

        let state = app.state::<AppState>();
        let is_healthy = client.get(&health_url).send().await.is_ok();

        if is_healthy && !was_healthy {
            // Backend recovered
            log::info!("Backend health restored");
            state.backend_ready.store(true, Ordering::SeqCst);
            let _ = app.emit(
                "backend-status",
                serde_json::json!({"status": "healthy"}),
            );
        } else if !is_healthy && was_healthy {
            // Backend just went down
            log::warn!("Backend health check failed — backend may have crashed");
            state.backend_ready.store(false, Ordering::SeqCst);
            let _ = app.emit(
                "backend-status",
                serde_json::json!({"status": "unreachable"}),
            );
        }

        was_healthy = is_healthy;
    }
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
            backend_child: Mutex::new(None),
            backend_port: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            is_backend_ready,
            get_backend_url,
            get_backend_health_url,
            get_app_data_dir,
            restart_backend,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Spawn the backend in a background task
            tauri::async_runtime::spawn(async move {
                log::info!("Starting backend sidecar...");

                match spawn_backend(&handle).await {
                    Ok(child) => {
                        log::info!("Backend process started, waiting for health check...");

                        let port = *handle.state::<AppState>().backend_port.lock().unwrap();

                        match wait_for_backend(port).await {
                            Ok(()) => {
                                log::info!("Backend is ready!");
                                let state = handle.state::<AppState>();
                                state.backend_ready.store(true, Ordering::SeqCst);
                                *state.backend_child.lock().unwrap() = Some(child);

                                // Emit healthy event for the frontend
                                let _ = handle.emit(
                                    "backend-status",
                                    serde_json::json!({"status": "healthy"}),
                                );

                                // Show the main window (it starts hidden)
                                if let Some(window) = handle.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }

                                // Start background health monitor
                                tauri::async_runtime::spawn(start_health_monitor(handle.clone()));
                            }
                            Err(e) => {
                                log::error!("Backend health check failed: {e}");
                                let _ = child.kill();
                                let _ = handle.emit(
                                    "backend-status",
                                    serde_json::json!({"status": "failed", "error": e}),
                                );
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
