-- HostWise notifications table (Rust port of app/notifications/models.py).
-- Unique partial index on fingerprint (live rows only) guards against
-- concurrent refresh() calls creating duplicates.

CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY NOT NULL,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL DEFAULT '',
    severity    TEXT NOT NULL DEFAULT 'info',
    fingerprint TEXT NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0,
    deleted_at  TEXT,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    sync_id     TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_type        ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_fingerprint ON notifications(fingerprint);
CREATE INDEX IF NOT EXISTS idx_notifications_read        ON notifications(is_read);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_fingerprint_active
    ON notifications(fingerprint) WHERE is_deleted = 0;
