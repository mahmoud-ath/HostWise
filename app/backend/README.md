# hostwise-backend (Rust)

Native Rust port of the HostWise Python/FastAPI backend. Replaces `backend/`
(see [`docs/rust-rewrite-prompt.md`](../docs/rust-rewrite-prompt.md) for the
full spec and migration plan).

## Status

Foundation + reference domains implemented and compiling:

- `core`: config (env), SQLite (sqlx + migrations), errors, request logging,
  CORS/gzip, shared app state
- `auth`: register / login / refresh / me (JWT HS256 + Argon2 password hashing)
- `properties`: CRUD + soft delete (reference domain showing the repo pattern)
- `health`: `GET /api/health`

Remaining domains (reservations, finance, analytics, reports/PDF, AI, settings,
maintenance, notifications, connectors, setup, backup) are stubs/TODO — see the
module map in the prompt doc.

## Run (standalone dev)

```bash
cd backend-rs
cp .env.example .env       # adjust as needed
cargo run                  # serves http://127.0.0.1:8000
```

## Test

```bash
cargo test                 # smoke test: register → login → refresh → duplicate
```

## Layout

```
backend-rs/
├── Cargo.toml
├── migrations/0001_init.sql   # sqlx migrations (mirrors SQLAlchemy schema)
└── src/
    ├── main.rs                # standalone dev server
    ├── lib.rs                 # library root (for Tauri embedding)
    ├── api/                   # router assembly + health
    ├── core/                  # config, db, error, state, middleware, time
    ├── auth/                  # security, models, schemas, repo, service, router
    └── properties/            # models, schemas, repo, router
```

## Tauri integration (planned)

Embed via `axum::serve` in a tokio task inside Tauri `setup()`; keep
`get_backend_url` returning the live URL; delete the child-process spawn and the
PyInstaller resource bundle once feature-parity is reached (v0.7.0).
