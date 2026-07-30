use std::fs;
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

const BASE_PORT: u16 = 18000;
const MAX_PORT_ATTEMPTS: u16 = 100;
const HEALTH_CHECK_TIMEOUT_SECS: u64 = 30;
const HEALTH_CHECK_POLL_MS: u64 = 250;
const HEALTH_MONITOR_INTERVAL_SECS: u64 = 10;
const APP_NAME: &str = "hostwise";
const BACKEND_EXE_NAME: &str = "hostwise-backend";

// ── Shared application state ─────────────────────────────
pub struct AppState {
    pub backend_ready: AtomicBool,
    pub backend_child: Mutex<Option<tokio::process::Child>>,
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

/// Find the bundled backend executable in the app's resource directory.
fn find_backend_exe(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource directory: {e}"))?;

    let backend_dir = resource_dir.join("embedded").join("hostwise-backend");

    let exe_name = if cfg!(target_os = "windows") {
        format!("{}.exe", BACKEND_EXE_NAME)
    } else {
        BACKEND_EXE_NAME.to_string()
    };

    let exe_path = backend_dir.join(&exe_name);

    if !exe_path.exists() {
        return Err(format!(
            "Backend executable not found at: {}. \
             Make sure the backend is built with PyInstaller --onedir \
             and placed in frontend/src-tauri/embedded/hostwise-backend/",
            exe_path.display()
        ));
    }

    log::info!("Backend executable: {}", exe_path.display());
    Ok(exe_path)
}

/// Prepare the runtime directory and clean stale _MEI* dirs.
fn prepare_runtime_dir() -> std::path::PathBuf {
    let data_dir = get_data_dir();
    let runtime_dir = data_dir.join("runtime");
    std::fs::create_dir_all(&runtime_dir).ok();

    if let Ok(entries) = std::fs::read_dir(&runtime_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("_MEI") && path.is_dir() {
                    let _ = std::fs::remove_dir_all(&path);
                    log::info!("Cleaned stale PyInstaller temp: {:?}", path);
                }
            }
        }
    }

    runtime_dir
}

/// Poll the backend health endpoint until it responds or times out.
/// On failure, waits 2s and retries once (Windows Defender scan mitigation).
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
            log::warn!("Backend health check timed out, waiting 2s and retrying once...");
            tokio::time::sleep(Duration::from_secs(2)).await;
            match client.get(&health_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    log::info!("Backend recovered after delay (Defender scan likely finished)");
                    return Ok(());
                }
                _ => {
                    return Err(format!(
                        "Backend did not start within {} seconds",
                        HEALTH_CHECK_TIMEOUT_SECS + 2
                    ));
                }
            }
        }

        match client.get(&health_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                log::info!(
                    "Backend health check passed after ~{}ms",
                    attempts * HEALTH_CHECK_POLL_MS
                );
                return Ok(());
            }
            _ => {
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

/// Run stdout/stderr logging for a child process and detect termination.
async fn monitor_backend_output(mut child: tokio::process::Child, app: tauri::AppHandle) {
    use tokio::io::{AsyncBufReadExt, BufReader};

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(stdout) = stdout {
        tauri::async_runtime::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::info!("[backend] {}", line.trim());
            }
        });
    }

    if let Some(stderr) = stderr {
        tauri::async_runtime::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::warn!("[backend] {}", line.trim());
            }
        });
    }

    let status = child.wait().await;
    match status {
        Ok(exit_status) => {
            log::error!(
                "Backend process terminated unexpectedly: code={:?}",
                exit_status.code(),
            );
        }
        Err(e) => {
            log::error!("Failed to wait for backend process: {e}");
        }
    }

    let state = app.state::<AppState>();
    state.backend_ready.store(false, Ordering::SeqCst);
    let _ = app.emit(
        "backend-status",
        serde_json::json!({"status": "crashed"}),
    );
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
            log::info!("Backend health restored");
            state.backend_ready.store(true, Ordering::SeqCst);
            let _ = app.emit(
                "backend-status",
                serde_json::json!({"status": "healthy"}),
            );
        } else if !is_healthy && was_healthy {
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

// ── Tauri Commands ───────────────────────────────────────

#[tauri::command]
fn is_backend_ready(state: tauri::State<'_, AppState>) -> bool {
    state.backend_ready.load(Ordering::SeqCst)
}

#[tauri::command]
fn get_backend_url(state: tauri::State<'_, AppState>) -> String {
    let port = *state.backend_port.lock().unwrap();
    format!("http://127.0.0.1:{}/api/v1", port)
}

#[tauri::command]
fn get_backend_health_url(state: tauri::State<'_, AppState>) -> String {
    let port = *state.backend_port.lock().unwrap();
    format!("http://127.0.0.1:{}/api/health", port)
}

#[tauri::command]
fn get_app_data_dir() -> String {
    get_data_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn get_log_dir() -> String {
    get_data_dir().join("logs").to_string_lossy().to_string()
}

/// Restart the backend process (kills current, spawns new).
#[tauri::command]
async fn restart_backend(app: tauri::AppHandle) -> Result<(), String> {
    log::info!("Restarting backend...");

    let state = app.state::<AppState>();
    state.backend_ready.store(false, Ordering::SeqCst);

    // Kill existing child
    let child_to_kill = {
        let mut guard = state.backend_child.lock().unwrap();
        guard.take()
    };
    if let Some(mut child) = child_to_kill {
        log::info!("Killing existing backend process");
        let _ = child.kill().await;
        let _ = child.wait().await;
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    let _ = app.emit("backend-status", serde_json::json!({"status": "restarting"}));

    // Find backend exe
    let exe_path = find_backend_exe(&app)?;
    let backend_dir = exe_path.parent().unwrap().to_path_buf();
    let runtime_dir = prepare_runtime_dir();
    let runtime_path = runtime_dir.to_string_lossy().to_string();

    // Find new port
    let port = find_available_port()?;
    *app.state::<AppState>().backend_port.lock().unwrap() = port;
    cleanup_stale_backend(port);
    tokio::time::sleep(Duration::from_millis(200)).await;

    let data_dir = get_data_dir();
    let db_path = data_dir.join("hostwise.db");
    let uploads_dir = data_dir.join("uploads");
    let cors_origins = r#"["http://localhost:3000","http://127.0.0.1:3000","tauri://localhost","https://tauri.localhost"]"#;
    let environment = if cfg!(debug_assertions) { "development" } else { "production" };
    let log_level = if cfg!(debug_assertions) { "info" } else { "warning" };

    let child = tokio::process::Command::new(&exe_path)
        .env("TMP", &runtime_path)
        .env("TEMP", &runtime_path)
        .env("PYINSTALLER_TMPDIR", &runtime_path)
        .env("DATABASE_TYPE", "sqlite")
        .env("SQLITE_PATH", db_path.to_string_lossy().as_ref())
        .env("HOST", "127.0.0.1")
        .env("PORT", port.to_string())
        .env("CORS_ORIGINS", cors_origins)
        .env("UPLOAD_DIR", uploads_dir.to_string_lossy().as_ref())
        .env("ENVIRONMENT", environment)
        .env("LOG_LEVEL", log_level)
        .current_dir(&backend_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn backend: {e}"))?;

    log::info!("New backend process started, waiting for health check...");

    // Start monitoring output
    let app_clone = app.clone();
    tauri::async_runtime::spawn(monitor_backend_output(child, app_clone));

    match wait_for_backend(port).await {
        Ok(()) => {
            log::info!("Backend restart complete — healthy");
            let state = app.state::<AppState>();
            state.backend_ready.store(true, Ordering::SeqCst);
            let _ = app.emit("backend-status", serde_json::json!({"status": "healthy"}));
            Ok(())
        }
        Err(e) => {
            log::error!("Backend restart failed: {e}");
            let _ = app.emit("backend-status", serde_json::json!({"status": "failed", "error": e}));
            Err(format!("Backend failed to start after restart: {e}"))
        }
    }
}

// ── Application Entry Point ──────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Set up panic hook for crash logging
    let data_dir_for_crash = get_data_dir();
    let orig_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        orig_hook(info);
        // Write crash report to logs directory
        let log_dir = data_dir_for_crash.join("logs");
        let _ = fs::create_dir_all(&log_dir);
        let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
        let crash_file = log_dir.join(format!("crash_{}.txt", timestamp));
        let msg = format!(
            "HostWise Crash Report\n\
             =====================\n\
             Timestamp: {}\n\
             Panic: {}\n\
             Location: {:?}\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            info.to_string(),
            info.location(),
        );
        let _ = fs::write(&crash_file, &msg);
        eprintln!("FATAL: HostWise crashed — report saved to {}", crash_file.display());
    }));

    // Initialize logging — write both to console and file
    let data_dir = get_data_dir();
    let log_dir = data_dir.join("logs");
    let _ = fs::create_dir_all(&log_dir);
    let log_file = log_dir.join(format!(
        "{}.log",
        chrono::Local::now().format("%Y-%m-%d")
    ));

    let log_file_clone = log_file.clone();
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .target(env_logger::Target::Stdout)
        .format(move |buf, record| {
            let ts = chrono::Local::now().format("%H:%M:%S");
            let msg = format!("[{}] [{}] {}\n", ts, record.level(), record.args());
            // Write to file (best-effort)
            if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_file_clone) {
                use std::io::Write;
                let _ = f.write_all(msg.as_bytes());
            }
            // Write to env_logger's buffer
            use std::io::Write;
            write!(buf, "{}", msg)
        })
        .try_init();

    log::info!("=== HostWise v{} starting ===", env!("CARGO_PKG_VERSION"));

    // Set GDK backend for Linux compatibility
    #[cfg(all(target_os = "linux", not(debug_assertions)))]
    {
        std::env::set_var("GDK_BACKEND", "x11");
        std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
        std::env::set_var("GALLIUM_DRIVER", "llvmpipe");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            get_log_dir,
            restart_backend,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                log::info!("Starting backend...");

                // Find the backend executable
                let exe_path = match find_backend_exe(&handle) {
                    Ok(p) => p,
                    Err(e) => {
                        log::error!("{e}");
                        #[cfg(debug_assertions)]
                        {
                            handle.dialog()
                                .message(format!(
                                    "Backend not found.\n\n{0}\n\n\
                                     To start manually:\n\
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
                                    "Failed to find backend.\n\n{0}\n\n\
                                     Please try reinstalling the application.",
                                    e
                                ))
                                .title("Backend Error")
                                .kind(MessageDialogKind::Error)
                                .blocking_show();
                        }
                        return;
                    }
                };

                // Find available port
                let port = match find_available_port() {
                    Ok(p) => p,
                    Err(e) => {
                        log::error!("{e}");
                        handle.dialog()
                            .message(format!("{e}"))
                            .title("Port Error")
                            .kind(MessageDialogKind::Error)
                            .blocking_show();
                        return;
                    }
                };
                *handle.state::<AppState>().backend_port.lock().unwrap() = port;

                let backend_dir = exe_path.parent().unwrap().to_path_buf();
                let runtime_dir = prepare_runtime_dir();
                let runtime_path = runtime_dir.to_string_lossy().to_string();

                cleanup_stale_backend(port);
                tokio::time::sleep(Duration::from_millis(200)).await;

                let data_dir = get_data_dir();
                let db_path = data_dir.join("hostwise.db");
                let uploads_dir = data_dir.join("uploads");
                std::fs::create_dir_all(&data_dir).ok();
                std::fs::create_dir_all(&uploads_dir).ok();

                let cors_origins = r#"["http://localhost:3000","http://127.0.0.1:3000","tauri://localhost","https://tauri.localhost"]"#;
                let environment = if cfg!(debug_assertions) { "development" } else { "production" };
                let log_level = if cfg!(debug_assertions) { "info" } else { "warning" };

                let child = match tokio::process::Command::new(&exe_path)
                    .env("TMP", &runtime_path)
                    .env("TEMP", &runtime_path)
                    .env("PYINSTALLER_TMPDIR", &runtime_path)
                    .env("DATABASE_TYPE", "sqlite")
                    .env("SQLITE_PATH", db_path.to_string_lossy().as_ref())
                    .env("HOST", "127.0.0.1")
                    .env("PORT", port.to_string())
                    .env("CORS_ORIGINS", cors_origins)
                    .env("UPLOAD_DIR", uploads_dir.to_string_lossy().as_ref())
                    .env("ENVIRONMENT", environment)
                    .env("LOG_LEVEL", log_level)
                    .current_dir(&backend_dir)
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .spawn()
                {
                    Ok(c) => c,
                    Err(e) => {
                        log::error!("Failed to spawn backend: {e}");
                        handle.dialog()
                            .message(format!("Failed to start backend: {e}"))
                            .title("Backend Error")
                            .kind(MessageDialogKind::Error)
                            .blocking_show();
                        return;
                    }
                };

                log::info!("Backend process spawned");

                // Store child and start monitoring output
                *handle.state::<AppState>().backend_child.lock().unwrap() = Some(child);

                let app_monitor = handle.clone();
                tauri::async_runtime::spawn(async move {
                    let child = {
                        let app_state = app_monitor.state::<AppState>();
                        let mut guard = app_state.backend_child.lock().unwrap();
                        guard.take()
                    };
                    if let Some(child) = child {
                        monitor_backend_output(child, app_monitor).await;
                    }
                });

                log::info!("Waiting for backend health check...");
                match wait_for_backend(port).await {
                    Ok(()) => {
                        log::info!("Backend is ready!");
                        let state = handle.state::<AppState>();
                        state.backend_ready.store(true, Ordering::SeqCst);
                        let _ = handle.emit(
                            "backend-status",
                            serde_json::json!({"status": "healthy"}),
                        );
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        tauri::async_runtime::spawn(start_health_monitor(handle.clone()));
                    }
                    Err(e) => {
                        log::error!("Backend health check failed: {e}");
                        let _ = handle.emit(
                            "backend-status",
                            serde_json::json!({"status": "failed", "error": e}),
                        );
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
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Error building HostWise application");

    app.run(|_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            log::info!("Shutting down backend...");
        }
    });
}
