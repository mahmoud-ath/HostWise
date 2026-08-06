-- HostWise initial schema (Rust port of the SQLAlchemy models).
-- Kept column-compatible with existing %APPDATA%\HostWise\hostwise.db files.

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     TEXT,
    avatar_url    TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    sync_id       TEXT
);

CREATE TABLE IF NOT EXISTS properties (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'other',
    status      TEXT NOT NULL DEFAULT 'active',
    address     TEXT,
    city        TEXT,
    state       TEXT,
    country     TEXT,
    postal_code TEXT,
    latitude    REAL,
    longitude   REAL,
    bedrooms    INTEGER NOT NULL DEFAULT 1,
    bathrooms   REAL NOT NULL DEFAULT 1.0,
    deleted_at  TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    sync_id     TEXT
);

CREATE INDEX IF NOT EXISTS idx_properties_type   ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
