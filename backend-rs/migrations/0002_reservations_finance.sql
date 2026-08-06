-- HostWise reservations + finance schema (Rust port of SQLAlchemy models).

CREATE TABLE IF NOT EXISTS reservations (
    id                 TEXT PRIMARY KEY NOT NULL,
    property_id        TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    listing_id         TEXT,
    external_id        TEXT,
    confirmation_code  TEXT,
    status             TEXT NOT NULL DEFAULT 'confirmed',
    source             TEXT NOT NULL DEFAULT 'manual',
    check_in           TEXT NOT NULL,
    check_out          TEXT NOT NULL,
    booked_at          TEXT,
    cancelled_at       TEXT,
    nights             INTEGER NOT NULL,
    guest_name         TEXT,
    guest_email        TEXT,
    guest_phone        TEXT,
    number_of_guests   INTEGER NOT NULL DEFAULT 1,
    gross_revenue      REAL NOT NULL DEFAULT 0.0,
    cleaning_fee       REAL NOT NULL DEFAULT 0.0,
    platform_fee       REAL NOT NULL DEFAULT 0.0,
    taxes              REAL NOT NULL DEFAULT 0.0,
    net_revenue        REAL NOT NULL DEFAULT 0.0,
    currency           TEXT NOT NULL DEFAULT 'USD',
    property_name      TEXT,
    property_city      TEXT,
    property_country   TEXT,
    notes              TEXT,
    deleted_at         TEXT,
    is_deleted         INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    sync_id            TEXT
);
CREATE INDEX IF NOT EXISTS idx_reservations_property  ON reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_check_in  ON reservations(check_in);
CREATE INDEX IF NOT EXISTS idx_reservations_status    ON reservations(status);

CREATE TABLE IF NOT EXISTS revenue_categories (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    deleted_at  TEXT,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    sync_id     TEXT
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    deleted_at  TEXT,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    sync_id     TEXT
);

CREATE TABLE IF NOT EXISTS revenues (
    id                TEXT PRIMARY KEY NOT NULL,
    property_id       TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    reservation_id    TEXT REFERENCES reservations(id) ON DELETE SET NULL,
    category_id       TEXT REFERENCES revenue_categories(id) ON DELETE SET NULL,
    date              TEXT NOT NULL,
    gross_amount      REAL NOT NULL DEFAULT 0.0,
    commission_amount REAL NOT NULL DEFAULT 0.0,
    net_amount        REAL NOT NULL DEFAULT 0.0,
    source            TEXT NOT NULL DEFAULT 'manual',
    currency          TEXT NOT NULL DEFAULT 'USD',
    description       TEXT,
    notes             TEXT,
    deleted_at        TEXT,
    is_deleted        INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    sync_id           TEXT
);
CREATE INDEX IF NOT EXISTS idx_revenues_property ON revenues(property_id);
CREATE INDEX IF NOT EXISTS idx_revenues_date     ON revenues(date);

CREATE TABLE IF NOT EXISTS expenses (
    id             TEXT PRIMARY KEY NOT NULL,
    property_id    TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category_id    TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
    date           TEXT NOT NULL,
    amount         REAL NOT NULL DEFAULT 0.0,
    currency       TEXT NOT NULL DEFAULT 'USD',
    vendor         TEXT,
    payment_method TEXT,
    description    TEXT,
    notes          TEXT,
    is_recurring   INTEGER NOT NULL DEFAULT 0,
    receipt_url    TEXT,
    deleted_at     TEXT,
    is_deleted     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    sync_id        TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date);
