"""Programmatic Alembic runner used at app startup (SQLite desktop path).

Why this exists: the desktop app bootstraps the schema with
`Base.metadata.create_all`, which historically meant there was no versioned
schema. This runner records an Alembic version so future schema changes can
ship as real migrations, without replaying (potentially stale) migrations over
a create_all-seeded database.
"""
import logging
import os
import sqlite3

log = logging.getLogger("hostwise.migrations")

# app/core/migrations.py → up three levels to the backend/ package root.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _version_table_exists(db_path: str) -> bool:
    try:
        conn = sqlite3.connect(db_path, timeout=5)
        try:
            row = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='alembic_version'"
            ).fetchone()
            return row is not None
        finally:
            conn.close()
    except sqlite3.Error:
        return False


def run_migrations() -> bool:
    """Run (or stamp) Alembic migrations for the configured database.

    * No `alembic_version` table  → the schema came from `create_all`; stamp
      `head` so the baseline is recorded WITHOUT replaying old migrations.
    * Version table present       → `upgrade head` to apply pending migrations.

    Never raises: returns False on any error so callers can fall back to the
    existing `create_all` behaviour (startup must never be blocked).
    """
    from alembic.config import Config

    from alembic import command
    from app.core.config import get_settings

    try:
        settings = get_settings()
        if settings.DATABASE_TYPE != "sqlite":
            log.info("Non-SQLite database — skipping startup migrations.")
            return True
        cfg = Config(os.path.join(_BACKEND_DIR, "alembic.ini"))
        cfg.set_main_option("script_location", os.path.join(_BACKEND_DIR, "alembic"))
        cfg.set_main_option("prepend_sys_path", _BACKEND_DIR)
        if _version_table_exists(settings.SQLITE_PATH):
            command.upgrade(cfg, "head")
            log.info("Database migrations applied (upgrade to head).")
        else:
            command.stamp(cfg, "head")
            log.info("Database schema stamped to migration head.")
        return True
    except Exception as exc:  # noqa: BLE001 - deliberate: never block startup
        log.warning("Startup migrations skipped (%s) — falling back to create_all.", exc)
        return False
