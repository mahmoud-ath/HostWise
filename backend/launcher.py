"""
HostWise Backend Launcher

Entry point for the PyInstaller-bundled backend executable.
Works both as a standalone script and as a PyInstaller bundle.
"""
import os
import sys


def _get_db_path() -> str:
    """Get the database path in the user's app data directory."""
    import sys

    if getattr(sys, 'frozen', False):
        # PyInstaller bundle — use user's app data directory
        app_name = "hostwise"
        if sys.platform == "win32":
            base = os.environ.get("APPDATA", os.path.expanduser("~"))
            data_dir = os.path.join(base, app_name)
        elif sys.platform == "darwin":
            data_dir = os.path.join(os.path.expanduser("~"), "Library", "Application Support", app_name)
        else:
            # Linux: XDG_DATA_HOME or ~/.local/share
            xdg = os.environ.get("XDG_DATA_HOME", os.path.join(os.path.expanduser("~"), ".local", "share"))
            data_dir = os.path.join(xdg, app_name)
        os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, "hostwise.db")
    else:
        # Dev mode — alongside the backend directory
        return os.path.join(os.path.dirname(__file__), "..", "hostwise.db")


# Force SQLite for desktop builds — no PostgreSQL dependency
os.environ.setdefault("DATABASE_TYPE", "sqlite")
os.environ.setdefault("SQLITE_PATH", _get_db_path())

# Allow Tauri's webview to connect (CORS for both dev and prod origins)
os.environ.setdefault(
    "CORS_ORIGINS",
    '["http://localhost:3000","http://127.0.0.1:3000","tauri://localhost","https://tauri.localhost"]',
)

# Production defaults for desktop builds
if getattr(sys, 'frozen', False):
    os.environ.setdefault("ENVIRONMENT", "production")
    os.environ.setdefault("LOG_LEVEL", "warn")

import uvicorn
from app.main import app


def main():
    """Start the FastAPI server for desktop use."""
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
