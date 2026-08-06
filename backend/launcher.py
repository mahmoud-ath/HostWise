"""
HostWise Backend Launcher

Entry point for the compiled backend executable (PyInstaller).
Works both as a standalone script and as a PyInstaller bundle.
"""
import os
import sys
import logging

# Windowed (console=False) PyInstaller builds have no console on Windows, so
# sys.stdout/sys.stderr are None. That breaks logging AND crashes uvicorn's log
# formatters (they call sys.stdout.isatty() -> AttributeError: 'NoneType' object
# has no attribute 'isatty'). Point them at a real stream so isatty() -> False.
if getattr(sys, "frozen", False) and (sys.stdout is None or sys.stderr is None):
    _devnull = open(os.devnull, "w", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = _devnull
    if sys.stderr is None:
        sys.stderr = _devnull

logging.basicConfig(
    level=logging.DEBUG,
    format="[HOSTWISE] %(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,
)
log = logging.getLogger("hostwise")


def _get_data_dir() -> str:
    """Get the platform-appropriate app data directory."""
    app_name = "hostwise"
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    elif sys.platform == "darwin":
        base = os.path.join(os.path.expanduser("~"), "Library", "Application Support")
    else:
        base = os.environ.get(
            "XDG_DATA_HOME",
            os.path.join(os.path.expanduser("~"), ".local", "share"),
        )
    data_dir = os.path.join(base, app_name)
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


def _get_db_path() -> str:
    """Get the database path (always in app data dir when frozen, or local in dev)."""
    if getattr(sys, "frozen", False):
        return os.path.join(_get_data_dir(), "hostwise.db")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hostwise.db")


# ── Environment setup (runs before any imports) ─────────
log.debug("=== HostWise Launcher ===")
log.debug("sys.frozen=%s", getattr(sys, "frozen", False))

# Database: force SQLite for desktop, use APPDATA location
_data_dir = _get_data_dir()
_db_path = _get_db_path()
os.environ.setdefault("DATABASE_TYPE", "sqlite")
os.environ.setdefault("SQLITE_PATH", _db_path)
log.debug("DATABASE_TYPE=%s", os.environ.get("DATABASE_TYPE"))
log.debug("SQLITE_PATH=%s", os.environ.get("SQLITE_PATH"))

# Runtime temp dir for PyInstaller extraction (avoids Windows Defender issues)
_runtime_dir = os.path.join(_data_dir, "runtime")
os.makedirs(_runtime_dir, exist_ok=True)

# Clean up stale _MEI* temp dirs from previous crashed runs
for entry in os.listdir(_runtime_dir):
    entry_path = os.path.join(_runtime_dir, entry)
    if entry.startswith("_MEI") and os.path.isdir(entry_path):
        try:
            import shutil
            shutil.rmtree(entry_path, ignore_errors=True)
            log.debug("Cleaned stale PyInstaller temp: %s", entry_path)
        except Exception:
            pass

os.environ.setdefault("TMP", _runtime_dir)
os.environ.setdefault("TEMP", _runtime_dir)
log.debug("TEMP=%s", os.environ.get("TEMP"))

# CORS: allow Tauri webview origins
os.environ.setdefault(
    "CORS_ORIGINS",
    '["http://localhost:3000","http://127.0.0.1:3000","tauri://localhost","https://tauri.localhost"]',
)

# Production defaults
if getattr(sys, "frozen", False):
    os.environ.setdefault("ENVIRONMENT", "production")
    os.environ.setdefault("LOG_LEVEL", "warning")

log.debug("ENVIRONMENT=%s LOG_LEVEL=%s", os.environ.get("ENVIRONMENT"), os.environ.get("LOG_LEVEL"))

# ── Run initial backup ─────────────────────────────────
try:
    from app.backup_service import schedule_backup
    schedule_backup()
    log.info("Initial database backup created")
except Exception as e:
    log.debug("Skipped initial backup (first run or API not ready): %s", e)

# ── Import and start the app ────────────────────────────
import threading
import uvicorn
from app.main import app


def _backup_loop():
    """Run a backup every 6 hours in a background thread."""
    import time
    while True:
        time.sleep(6 * 3600)  # 6 hours
        try:
            from app.backup_service import schedule_backup
            schedule_backup()
            log.info("Scheduled backup created")
        except Exception as e:
            log.warning("Scheduled backup failed: %s", e)


def main():
    """Start the FastAPI server for desktop use."""
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    log_level = os.environ.get("LOG_LEVEL", "info")

    # Start background backup thread
    backup_thread = threading.Thread(target=_backup_loop, daemon=True)
    backup_thread.start()
    log.info("Backup scheduler started (every 6 hours)")

    # Defensive retry: on Windows, Windows Defender may still be scanning
    # .pyd files in the _MEI* temp dir, causing transient import errors.
    max_retries = 3
    for attempt in range(max_retries):
        try:
            log.info(
                "Starting HostWise backend on %s:%s (attempt %d/%d)...",
                host, port, attempt + 1, max_retries,
            )
            uvicorn.run(
                app,
                host=host,
                port=port,
                log_level=log_level,
                access_log=False,
                workers=1,
            )
            return  # Normal exit — uvicorn.run blocks until shutdown
        except Exception as e:
            log.error(
                "Backend startup failed (attempt %d/%d): %s",
                attempt + 1, max_retries, e,
            )
            if attempt < max_retries - 1:
                import time
                delay = 2 ** attempt  # 1s, 2s
                log.info("Waiting %ds before retry...", delay)
                time.sleep(delay)
            else:
                log.critical("All startup attempts failed, giving up")
                raise


if __name__ == "__main__":
    main()
