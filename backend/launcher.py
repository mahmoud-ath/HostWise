"""
HostWise Backend Launcher

Entry point for the compiled backend executable (PyInstaller).
Works both as a standalone script and as a PyInstaller bundle.
"""
import os
import sys
import logging

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

# ── Import and start the app ────────────────────────────
import uvicorn
from app.main import app


def main():
    """Start the FastAPI server for desktop use."""
    log.info("Starting HostWise backend on 127.0.0.1:8000 ...")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level=os.environ.get("LOG_LEVEL", "info"),
        access_log=False,
        workers=1,
    )


if __name__ == "__main__":
    main()
