-- HostWise settings table (Rust port of app/settings/models.py).
-- Simple key -> JSON-value store, no soft-delete (not a BaseModel).

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY NOT NULL,
    value      TEXT NOT NULL DEFAULT 'null',
    updated_at TEXT NOT NULL
);
