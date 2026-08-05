"""Startup migration runner tests (create_all-seeded SQLite → stamped head)."""
import sqlite3

from app.core.config import get_settings
from app.core.migrations import run_migrations


def test_run_migrations_stamps_baseline():
    # conftest already created a fresh SQLite DB via create_all (no alembic_version).
    assert run_migrations() is True

    conn = sqlite3.connect(get_settings().SQLITE_PATH)
    try:
        row = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='alembic_version'"
        ).fetchone()
        assert row is not None, "alembic_version table should exist after run_migrations()"
        version = conn.execute("SELECT version_num FROM alembic_version").fetchone()
        assert version is not None and version[0]
    finally:
        conn.close()


def test_run_migrations_is_idempotent():
    # Second call: version table now present → upgrade path must not fail.
    assert run_migrations() is True
    assert run_migrations() is True
