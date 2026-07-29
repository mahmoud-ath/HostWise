"""
HostWise Backend Launcher

Entry point for the compiled backend executable (PyInstaller / Nuitka).
Works both as a standalone script and as a compiled bundle.
"""
import os
import sys


def _is_frozen() -> bool:
    """Check if running as a compiled executable (PyInstaller or Nuitka)."""
    return getattr(sys, "frozen", False) or hasattr(sys, "_MEIPASS")


def _get_db_path() -> str:
    """Get the database path in the user's app data directory."""
    if _is_frozen():
        app_name = "hostwise"
        if sys.platform == "win32":
            base = os.environ.get("APPDATA", os.path.expanduser("~"))
            data_dir = os.path.join(base, app_name)
        elif sys.platform == "darwin":
            data_dir = os.path.join(
                os.path.expanduser("~"), "Library", "Application Support", app_name
            )
        else:
            # Linux: XDG_DATA_HOME or ~/.local/share
            xdg = os.environ.get(
                "XDG_DATA_HOME",
                os.path.join(os.path.expanduser("~"), ".local", "share"),
            )
            data_dir = os.path.join(xdg, app_name)
        os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, "hostwise.db")
    else:
        # Dev mode — alongside the backend directory
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hostwise.db")


# ── Diagnostic logging ─────────────────────────────────
import logging as _logging
_logging.basicConfig(
    level=_logging.DEBUG,
    format="[HOSTWISE-LAUNCHER] %(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,
)
_logger = _logging.getLogger("hostwise-launcher")

# Log all relevant env vars at startup for debugging
_logger.debug("sys.frozen=%s sys._MEIPASS=%s", getattr(sys, "frozen", None), getattr(sys, "_MEIPASS", None))
_logger.debug("DATABASE_TYPE=%s", os.environ.get("DATABASE_TYPE", "NOT SET"))
_logger.debug("SQLITE_PATH before = %s", os.environ.get("SQLITE_PATH", "NOT SET"))
_logger.debug("ENVIRONMENT=%s", os.environ.get("ENVIRONMENT", "NOT SET"))

# Force SQLite for desktop builds — no PostgreSQL dependency
os.environ.setdefault("DATABASE_TYPE", "sqlite")
os.environ.setdefault("SQLITE_PATH", _get_db_path())

_logger.debug("SQLITE_PATH after setdefault = %s", os.environ.get("SQLITE_PATH", "NOT SET"))

# Redirect temp extraction to app data dir (avoids Windows Defender false positives)
_runtime_dir = os.path.join(os.path.dirname(os.path.abspath(_get_db_path())), "runtime")
os.makedirs(_runtime_dir, exist_ok=True)
os.environ.setdefault("TMP", _runtime_dir)
os.environ.setdefault("TEMP", _runtime_dir)
os.environ.setdefault("NUITKA_ONEFILE_TEMP_DIR", _runtime_dir)

_logger.debug("Runtime dir = %s", _runtime_dir)

# Allow frontend to connect (CORS for dev and prod origins)
os.environ.setdefault(
    "CORS_ORIGINS",
    '["http://localhost:3000","http://127.0.0.1:3000","tauri://localhost","https://tauri.localhost"]',
)

# Production defaults for desktop builds
if _is_frozen():
    os.environ.setdefault("ENVIRONMENT", "production")
    os.environ.setdefault("LOG_LEVEL", "warning")

_logger.debug("ENVIRONMENT final = %s", os.environ.get("ENVIRONMENT", "NOT SET"))
_logger.debug("LOG_LEVEL = %s", os.environ.get("LOG_LEVEL", "NOT SET"))

import uvicorn
from app.main import app


def main():
    """Start the FastAPI server for desktop use."""
    _logger.info("Starting HostWise backend on 127.0.0.1:8000 ...")
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
