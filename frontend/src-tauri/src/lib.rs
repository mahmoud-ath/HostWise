// HostWise — Tauri Desktop Application
//
// The backend binary is embedded directly into this binary at compile time
// via include_bytes!. On startup, it's extracted to a temp directory and executed.
// This makes the entire app a SINGLE executable file.
//
// Dev mode (debug builds): spawns Python directly from backend source.

use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// Holds the backend child process and temp path for cleanup.
struct BackendProcess {
    child: Mutex<Option<Child>>,
    temp_path: Option<PathBuf>,
}

/// Embedded backend binary — compiled into the .exe at compile time.
#[cfg(not(debug_assertions))]
const BACKEND_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/embedded/hostwise-backend.bin"
));

// ── Dev mode helpers ──────────────────────────────────────

fn find_python() -> Option<&'static str> {
    let candidates = ["python3", "python", "/usr/bin/python3", "/usr/bin/python"];
    for &name in &candidates {
        if Command::new(name).arg("--version").output().is_ok() { return Some(name); }
    }
    None
}

fn spawn_dev_backend() -> Result<Child, Box<dyn std::error::Error>> {
    let base = std::env::current_dir()?
        .parent().unwrap_or(std::path::Path::new("."))
        .parent().unwrap_or(std::path::Path::new("."))
        .join("backend");
    let py = base.join(".venv/bin/python3");
    let py = if py.exists() { py } else { PathBuf::from(find_python().ok_or("Python not found")?) };
    let child = Command::new(&py)
        .args(["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"])
        .env("DATABASE_TYPE", "sqlite")
        .current_dir(&base).spawn()?;
    println!("Dev backend started (PID: {})", child.id());
    Ok(child)
}

// ── Production mode: embed + extract ─────────────────────

#[cfg(not(debug_assertions))]
fn extract_and_spawn() -> Result<(Child, PathBuf), Box<dyn std::error::Error>> {
    let temp = std::env::temp_dir().join("hostwise-backend");
    if temp.exists() { let _ = std::fs::remove_dir_all(&temp); }
    std::fs::create_dir_all(&temp)?;

    let exe_name = if cfg!(target_os = "windows") { "backend.exe" } else { "backend" };
    let exe = temp.join(exe_name);
    let mut f = std::fs::File::create(&exe)?;
    f.write_all(BACKEND_BYTES)?;
    f.sync_all()?;

    #[cfg(unix)]
    { use std::os::unix::fs::PermissionsExt; std::fs::set_permissions(&exe, std::fs::Permissions::from_mode(0o755))?; }

    let child = Command::new(&exe).spawn()?;
    println!("Prod backend started (PID: {})", child.id());
    Ok((child, exe))
}

// ── Health check ─────────────────────────────────────────

async fn wait_for_backend() -> bool {
    for _ in 0..30 {
        if let Ok(r) = reqwest::get("http://127.0.0.1:8000/api/health").await {
            if r.status().is_success() { println!("Backend is healthy."); return true; }
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    eprintln!("Warning: Backend health check timed out.");
    false
}

// ── App entry point ─────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let ok = rt.block_on(async {
                reqwest::get("http://127.0.0.1:8000/api/health").await
                    .map(|r| r.status().is_success()).unwrap_or(false)
            });
            if ok { println!("Backend already running."); return Ok(()); }

            let r: Result<(Child, Option<PathBuf>), Box<dyn std::error::Error>> = {
                #[cfg(not(debug_assertions))] {
                    let (c, p) = extract_and_spawn()?;
                    Ok((c, Some(p)))
                }
                #[cfg(debug_assertions)] {
                    let c = spawn_dev_backend()?;
                    Ok((c, None))
                }
            };

            match r {
                Ok((child, temp)) => { app.manage(BackendProcess { child: Mutex::new(Some(child)), temp_path: temp }); }
                Err(e) => eprintln!("Failed to start backend: {e}"),
            }

            let h = app.handle().clone();
            tauri::async_runtime::spawn(async move { wait_for_backend().await; let _ = h.emit("backend-ready", ()); });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                if let Some(s) = app.try_state::<BackendProcess>() {
                    if let Ok(mut g) = s.child.lock() {
                        if let Some(ref mut c) = *g { let _ = c.kill(); let _ = c.wait(); }
                        *g = None;
                    }
                    if let Some(ref p) = s.temp_path {
                        if let Some(parent) = p.parent() { let _ = std::fs::remove_dir_all(parent); }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running HostWise");
}
