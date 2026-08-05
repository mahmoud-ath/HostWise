//! Local Python backend (sidecar) management.
//!
//! In development the app runs `backend/launcher.py` with the project's
//! virtualenv Python. In release the PyInstaller-bundled `hostwise-backend`
//! executable (bundled as a Tauri resource) is launched. We wait for the API
//! port to accept connections so the webview never races the backend.

use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::{Duration, Instant};

use tauri::Manager;

/// Where the webview talks to the backend (the FastAPI app binds here).
pub const BACKEND_URL: &str = "http://127.0.0.1:8000";
const BACKEND_PORT: u16 = 8000;
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

/// Wait until the backend accepts a TCP connection on the API port.
/// Returns true if it became reachable within `timeout`.
fn wait_for_backend(timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if std::net::TcpStream::connect(("127.0.0.1", BACKEND_PORT)).is_ok() {
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
pub fn spawn(app: &tauri::AppHandle) -> Option<Child> {
    let (program, args) = if cfg!(debug_assertions) {
        dev_launcher_command()?
    } else {
        release_binary_command(app)?
    };

    for attempt in 1..=SPAWN_ATTEMPTS {
        let mut command = Command::new(&program);
        command.args(&args);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(_) => {
                // Could not start the process at all (e.g. Defender still
                // holding the just-extracted exe). Retry shortly.
                std::thread::sleep(RETRY_DELAY);
                continue;
            }
        };

        if wait_for_backend(PER_ATTEMPT_TIMEOUT) {
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
    None
}
