//! Local Python backend (sidecar) management.
//!
//! In development the app runs `backend/launcher.py` with the project's
//! virtualenv Python. In release the PyInstaller-bundled `hostwise-backend`
//! executable (bundled as a Tauri resource) is launched. We wait for the API
//! port to accept connections so the webview never races the backend.

use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Emitter, Manager};

/// Payload for the `backend-status` events the frontend listens for.
#[derive(serde::Serialize, Clone)]
struct BackendStatus {
    status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// Managed state holding the base URL of the running backend. It is set once
/// the backend is up so `get_backend_url` can tell the webview which port it
/// actually bound.
pub struct BackendUrl(pub Mutex<Option<String>>);

/// Fallback/dev port. We do NOT hard-bind this in release: fixed ports like
/// 8000 are frequently taken by other software, so the OS hands us a free port
/// instead and the backend is started on it.
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

// First-run resilience: Windows Defender (or other AV) can briefly hold the
// freshly-extracted backend DLLs, and the process dies at the bootloader level
// (before any Python code, so the launcher's retry can't help). Retry the whole
// spawn a few times with a backoff.
const SPAWN_ATTEMPTS: u32 = 3;
const PER_ATTEMPT_TIMEOUT: Duration = Duration::from_secs(25);
const RETRY_DELAY: Duration = Duration::from_secs(1);

fn exe_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "hostwise-backend.exe"
    } else {
        "hostwise-backend"
    }
}

/// Wait until the backend accepts a TCP connection on `port`.
/// Returns true if it became reachable within `timeout`.
fn wait_for_backend(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if std::net::TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    false
}

/// Dev mode: run `backend/launcher.py` with the repo virtualenv Python.
fn dev_launcher_command() -> Option<(String, Vec<String>)> {
    // CARGO_MANIFEST_DIR = <repo>/frontend/src-tauri
    let base = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    let backend_dir = PathBuf::from(&base).join("..").join("..").join("backend");
    let launcher = backend_dir.join("launcher.py");
    if !launcher.exists() {
        return None;
    }
    let python = if cfg!(target_os = "windows") {
        let venv = backend_dir.join(".venv").join("Scripts").join("python.exe");
        if venv.exists() {
            venv
        } else {
            PathBuf::from("python")
        }
    } else {
        let venv = backend_dir.join(".venv").join("bin").join("python");
        if venv.exists() {
            venv
        } else {
            PathBuf::from("python3")
        }
    };
    Some((
        python.to_string_lossy().into_owned(),
        vec![launcher.to_string_lossy().into_owned()],
    ))
}

/// Release mode: the PyInstaller binary bundled as a Tauri resource.
fn release_binary_command(app: &tauri::AppHandle) -> Option<(String, Vec<String>)> {
    let resource_dir = app.path().resource_dir().ok()?;
    let binary = resource_dir.join("hostwise-backend").join(exe_name());
    if !binary.exists() {
        return None;
    }
    Some((binary.to_string_lossy().into_owned(), Vec::new()))
}

/// Locate and spawn the backend, then wait for it to be reachable.
fn emit_failed(app: &tauri::AppHandle, error: &str) {
    let _ = app.emit(
        "backend-status",
        BackendStatus {
            status: "failed",
            error: Some(error.to_string()),
        },
    );
}

pub fn spawn(app: &tauri::AppHandle) -> Option<Child> {
    let (program, args) = if cfg!(debug_assertions) {
        match dev_launcher_command() {
            Some(cmd) => cmd,
            None => {
                emit_failed(app, "Development backend launcher not found.");
                return None;
            }
        }
    } else {
        match release_binary_command(app) {
            Some(cmd) => cmd,
            None => {
                emit_failed(
                    app,
                    "Backend executable not found — Windows may have quarantined it as a \
                     false positive. In Windows Defender, restore the file and add an \
                     exclusion for the HostWise app-data folder, then restart the app.",
                );
                return None;
            }
        }
    };

    let mut last_spawn_error: Option<String> = None;

    for attempt in 1..=SPAWN_ATTEMPTS {
        // Pick a free port instead of the fixed 8000 (often taken by other
        // software) and tell the backend which one to bind via the PORT env var.
        let port = pick_free_port(DEFAULT_PORT);

        let mut command = Command::new(&program);
        command.args(&args);
        command.env("PORT", port.to_string());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(err) => {
                last_spawn_error = Some(err.to_string());
                // Could not start the process at all (e.g. Defender still
                // holding or blocking the just-extracted exe). Retry shortly.
                std::thread::sleep(RETRY_DELAY);
                continue;
            }
        };

        if wait_for_backend(port, PER_ATTEMPT_TIMEOUT) {
            let url = format!("http://127.0.0.1:{port}");
            if let Some(state) = app.try_state::<BackendUrl>() {
                if let Ok(mut guard) = state.0.lock() {
                    *guard = Some(url);
                }
            }
            let _ = app.emit(
                "backend-status",
                BackendStatus {
                    status: "healthy",
                    error: None,
                },
            );
            return Some(child);
        }

        // The backend never came up — it may have crashed because Defender was
        // still scanning the freshly-extracted DLLs. Kill it and retry.
        let _ = child.kill();
        let _ = child.wait();
        if attempt < SPAWN_ATTEMPTS {
            std::thread::sleep(RETRY_DELAY);
        }
    }
    let error = match last_spawn_error {
        Some(e) => format!(
            "Backend could not be started: {e}. If Windows Defender blocked it, restore \
             the file and add an exclusion for the HostWise folder, then restart the app."
        ),
        None => "Backend did not become reachable on time".to_string(),
    };
    emit_failed(app, &error);
    None
}
