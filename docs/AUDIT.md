# HostWise — Codebase Audit Report

> Generated: July 29, 2026  
> Scope: Backend (Python/FastAPI), Frontend (Next.js/React/Tauri), Scripts, CI/CD

---

## Table of Contents

1. [Backend Issues](#1-backend-issues)
2. [Frontend Issues](#2-frontend-issues)
3. [Scripts & Build Issues](#3-scripts--build-issues)
4. [CI/CD Issues](#4-cicd-issues)
5. [Infrastructure & Config Issues](#5-infrastructure--config-issues)
6. [Security Concerns](#6-security-concerns)
7. [Recommendations](#7-recommendations)

---

## 1. Backend Issues

### 1.1 Unused Imports

| File | Import | Why Unused |
|------|--------|------------|
| `app/auth/dependencies.py` | `ForbiddenException` | Imported but never raised; all auth errors use `UnauthorizedException` |
| `app/auth/dependencies.py` | `OrganizationMember` | Imported but never referenced in this file |
| `app/auth/service.py` | `uuid` | `import uuid` at top — never used (UUIDs come from model defaults) |
| `app/auth/schemas.py` | `EmailStr` | Imported from pydantic but never used in field type annotations |
| `app/auth/schemas.py` | `uuid` | `import uuid` — never used in this file |
| `app/auth/schemas.py` | `Optional` | Only used twice — could be replaced with `str \| None` syntax (Python 3.10+) |
| `app/auth/security.py` | `JWTError` | Imported from jose but never referenced in code |
| `app/organizations/service.py` | `ValidationException` | Imported but never raised |
| `app/organizations/service.py` | `OrganizationMember` (line 9) | Unused at module level; re-imported locally in `create()` method |
| `app/organizations/service.py` | `RevenueCategoryResponse` | Imported but never used in this file |
| `app/organizations/service.py` | `ExpenseCategoryResponse` | Imported but never used in this file |
| `app/shared/base_model.py` | `sqlalchemy.Column` | All models use `mapped_column()` from ORM, not raw `Column` |
| `app/shared/base_model.py` | `sqlalchemy.String` | Not used; all string fields use ORM `mapped_column(String(...))` but the import is of the column type, not used directly |
| `app/shared/base_repository.py` | `delete as sa_delete` | Imported but `soft_delete()` uses `update()` pattern, not raw delete |
| `app/shared/base_repository.py` | `Sequence` | Should be imported from `collections.abc`, not `typing` (Python 3.9+) |
| `app/shared/schemas.py` | `Optional` | Used but should be `\| None` syntax |
| `app/core/dependencies.py` | `AsyncGenerator` | Imported but never used |
| `app/core/dependencies.py` | `AsyncSession` | Imported but used only in type hints; the dependency `get_db` already returns session |
| `app/core/dependencies.py` | `Depends` | Imported but never used in this file |
| `app/analytics/service.py` | `timedelta` | Imported but never used |
| `app/analytics/service.py` | `Optional` | Imported but never used |
| `app/analytics/service.py` | `ReservationRepository` | Should use this instead of raw queries |
| `app/connectors/base.py` | `Protocol` | Imported but never used |
| `app/connectors/base.py` | `datetime` (line 78) | Imported locally but never used |
| `app/finance/service.py` | `ValidationException` | Imported but never raised |
| `app/finance/repository.py` | `and_` | Imported but never used in queries |
| `app/finance/repository.py` | `case` | Imported but never used |
| `app/finance/repository.py` | `selectinload` | Imported but never used |
| `app/finance/repository.py` | `RevenueSource` | Imported but only `Revenue` and `Expense` are used |
| `app/properties/schemas.py` | `Field` | Imported from pydantic but never used |
| `app/properties/service.py` | `PropertySummaryResponse` | Imported but never used |
| `app/reservations/repository.py` | `and_` | Imported but never used |
| `app/reservations/schemas.py` | `datetime` | Imported but only `date` is used |
| `app/reports/service.py` | `monthrange` | Imported from calendar but never used |
| `app/reports/router.py` | `get_current_user` | Imported but never used as a dependency in any route |
| `app/reports/router.py` | `User` | Imported but never used |
| `app/ai/router.py` | `get_current_user` | Imported but never used |
| `app/ai/router.py` | `User` | Imported but never used |
| `app/analytics/router.py` | `get_current_user` | Imported but never used |
| `app/analytics/router.py` | `User` | Imported but never used |

### 1.2 Unused Functions / Methods

| File | Function | Why Unused |
|------|----------|------------|
| `app/auth/dependencies.py` | `require_role()` | Defined as a dependency factory but never used in any route. The inner `role_checker` is a no-op (`pass`). |
| `app/auth/service.py` | `AuthService.get_current_user()` | Method exists but is never called. The auth dependency `get_current_user` in `dependencies.py` uses the repository directly, not this service method. |
| `app/organizations/service.py` | `_seed_default_categories()` | Private method is called from `create()` ✅ — OK, not unused |
| `app/organizations/service.py` | `rc_repo` and `ec_repo` (line 129-130) | Assigned to variables that are never read |
| `app/shared/base_repository.py` | `BaseRepository.soft_delete()` | Method defined but never called anywhere in the codebase |
| `app/shared/base_repository.py` | `BaseRepository.count()` | Method defined but never called |
| `app/core/dependencies.py` | `get_db` | Re-exported from `database.py` — but the `__all__` includes `get_current_user` which is also not from this module |

### 1.3 Dead Code / Empty Functions

| File | Issue |
|------|-------|
| `app/auth/dependencies.py:63-65` | `require_role()` → `role_checker()` is a **no-op** (`pass`). The docstring says it should check roles but the implementation is empty. |
| `app/shared/base_model.py` | `sync_id` field defined with `default=uuid.uuid4` but never used/synced anywhere |
| `app/core/database.py:53-55` | `class Base(DeclarativeBase): pass` — unnecessary `pass` (PIE790) |
| `app/core/config.py:68` | `@lru_cache()` should be `@lru_cache` (no parens needed, Python 3.8+) |
| `app/connectors/base.py:99-106` | `_connectors` dict only has `"csv": CSVConnector` — multiple commented-out connector types |

### 1.4 Potential Bugs

| File | Issue | Severity |
|------|-------|----------|
| `app/auth/dependencies.py:38` | `except Exception:` catches all exceptions — masks `KeyboardInterrupt`, `SystemExit`, etc. | Medium |
| `app/auth/service.py:84` | `except Exception:` same issue in `refresh_token` | Medium |
| `app/organizations/service.py:64` | Re-imports `OrganizationMember` from `app.auth.models` inside `create()` even though it's already imported at line 9 (but unused there). This creates confusion. | Low |
| `app/connectors/router.py` | Multiple `except Exception:` blocks (lines 202, 237, 263) | Medium |
| `app/core/database.py:57-62` | `get_db()` closes the session in `finally` after `yield`, but the `async with` context manager also closes it on exit — potential double-close | Low |
| `app/reservations/service.py:43` | `Optional[uuid.UUID]` used but `Optional` is not imported at module level — relies on transitive import | Medium |
| `app/auth/service.py:85` | `user_id = payload.get("sub")` — `user_id` is `Any` but passed to `repo.get_by_id()` which expects `uuid.UUID` | Medium |
| `backend/launcher.py:50-51` | `os.environ.setdefault("DATABASE_TYPE", "sqlite")` followed by `os.environ.setdefault("SQLITE_PATH", _db_path)` — but if Rust's `sidecar.env()` already set these, `setdefault` is a no-op. However, the `_get_db_path()` is still called (creating directories) even when the Rust value takes precedence. | Low |
| `backend/app/main.py:166-173` | Routers are imported inside `create_app()` function — this is fine for FastAPI pattern but means import errors surface at runtime, not at startup | Low |

### 1.5 SQLAlchemy Inefficiencies

| File | Issue |
|------|-------|
| `app/auth/models.py:32` | `memberships` uses `lazy="selectin"` — this causes N+1 queries if not loaded eagerly. For a User with few orgs this is fine, but at scale would be expensive. |
| `app/finance/repository.py` | Multiple repository methods take many `Optional` parameters — the method signatures are complex and hard to test. |
| `app/shared/base_repository.py:43` | `get_all()` checks `hasattr(self.model, "organization_id")` at call time with a string — fragile. Better to define a mixin interface. |

---

## 2. Frontend Issues

### 2.1 Unused State / Variables

| File | Issue |
|------|-------|
| `frontend/src/contexts/auth-context.tsx` | `isRestoring` state is set but never exposed in the context value or used in any component |
| `frontend/src/contexts/auth-context.tsx:107` | `orgErr` parameter in catch is logged to console but never displayed to user |

### 2.2 Missing Tauri Integration

| File | Issue |
|------|-------|
| `frontend/src/lib/api.ts` | Hardcodes API URL. The Tauri backend exposes `get_backend_url` command but it's never called by the frontend. |
| `frontend/src/lib/api.ts` | No `@tauri-apps/api` import exists anywhere in `frontend/src/`. The Tauri commands `is_backend_ready`, `get_backend_url`, `get_app_data_dir` from `lib.rs` are never invoked. |
| `frontend/src/lib/api.ts` | No retry logic for backend startup — if the backend isn't ready when the first API call is made, the user sees "Failed to fetch" |

### 2.3 TypeScript Issues

| File | Issue |
|------|-------|
| `frontend/src/contexts/auth-context.tsx:107` | `orgErr` is typed as `unknown` (default catch type in TS) but logged directly with `console.log` — no type narrowing |
| `frontend/src/lib/api.ts:33` | `options.headers` cast to `Record<string, string>` — loses type safety |

---

## 3. Scripts & Build Issues

### 3.1 Inconsistency: Build Tooling

| File | Issue |
|------|-------|
| `scripts/build.ps1` | Uses `--collect-all app` — this is redundant since `--add-data "app;app"` already includes the `app` package. Also, the PyInstaller command doesn't have `--hidden-import=bcrypt` or `--hidden-import=jose` while the CI workflow does. **Out of sync with CI.** |
| `scripts/build.sh` | Same issue — missing `bcrypt` and `jose` hidden imports compared to CI workflow. Also uses `:` separator for `--add-data "app:app"` (correct for Linux). |
| `scripts/build.ps1` | Error handling: `bun install 2>$null` discards stderr — if bun fails, it silently falls back to npm. But `npm install` might not be available. |
| `scripts/build.sh` | Error handling: `bun install --silent 2>/dev/null \|\| npm install --silent` — same pattern, but if both fail the script continues. |
| `scripts/build.sh:86-88` | Binary detection checks for `.exe` on Linux — unnecessary branch since Linux PyInstaller never produces `.exe` files. |

### 3.2 Outdated Local Build Script

| File | Issue |
|------|-------|
| `backend/hostwise-backend.spec` | This is an auto-generated PyInstaller spec file. It uses `collect_all('app')` and `collect_all('aiosqlite')` which may pull in unnecessary dependencies. The CI uses command-line flags instead — the spec file is not kept in sync. |

### 3.3 Missing Clean Targets

| File | Issue |
|------|-------|
| `scripts/build.ps1` | Clean doesn't remove `.venv` |
| `scripts/build.sh` | Clean doesn't remove `.venv`, `__pycache__`, or `.pytest_cache` |

---

## 4. CI/CD Issues

### 4.1 Workflow Inconsistencies

| File | Issue |
|------|-------|
| `.github/workflows/release-windows.yml` | Uses `shell: pwsh` for PyInstaller step — `--add-data "app;app"` uses `;` separator which is correct for Windows PyInstaller, but the `--collect-all app` flag was recently removed while `--collect-all aiosqlite` remains. The local `build.ps1` still has both `--collect-all app` AND `--collect-all aiosqlite`. |
| `.github/workflows/release-windows.yml` | `--hidden-import=bcrypt` and `--hidden-import=jose` are in the CI but missing from `build.ps1` and `build.sh` |
| `.github/workflows/release-linux.yml` | Uses `"pyinstaller>=6.10,<7"` — good version pin |
| `.github/workflows/release-windows.yml` | Uses `"pyinstaller>=6.10,<7"` — good, matches Linux |
| `.github/workflows/release.yml` | Dispatcher uses `gh workflow run` to trigger OS-specific workflows — but the OS-specific workflows also trigger directly on tag pushes, making the dispatcher redundant for tag-based releases |

### 4.2 Cache Issues

| File | Issue |
|------|-------|
| `.github/workflows/release-windows.yml` | Bun cache is restored BEFORE the cache cleanup step runs — the cleanup runs after restore, making the restore useless for that workflow run. The cleanup step should run BEFORE cache restore, but that's the default order anyway. Actually, the cleanup runs AFTER restore but BEFORE `bun install`, so the install doesn't use the restored cache. This is intentional to avoid tarball extraction issues. But this means every build does a fresh `bun install` from scratch (no cache benefit). |

---

## 5. Infrastructure & Config Issues

### 5.1 Environment Configuration

| File | Issue |
|------|-------|
| `backend/.env` | Exists in repo — risks leaking secrets if not in `.gitignore` |
| `backend/.env.example` | Not checked — may be out of sync with actual config defaults |
| `backend/.env` | `JWT_SECRET_KEY` default is `"change-me-in-production-use-openssl-rand-hex-64"` — a hardcoded dev secret. This is fine for dev but must be documented clearly for production. |

### 5.2 AUR Package

| File | Issue |
|------|-------|
| `scripts/aur/PKGBUILD` | Hardcoded version `0.4.0` and AppImage URL — will break on version bump |
| `scripts/aur/PKGBUILD` | `sha256sums=('SKIP')` — skips integrity verification, a security risk |
| `scripts/aur/.SRCINFO` | Must be kept in sync with PKGBUILD — easy to forget |

### 5.3 Docker

| File | Issue |
|------|-------|
| `docker-compose.yml` | Not reviewed — uses PostgreSQL by default. The desktop build uses SQLite. This dual-database approach works but the Docker setup is only for development/testing, not production deployment of the desktop app. |

---

## 6. Security Concerns

### 6.1 Broad Exception Handling

Multiple places catch bare `Exception`:
- `app/auth/dependencies.py:38`
- `app/auth/service.py:84`
- `app/connectors/router.py:202, 237, 263`
- `app/main.py:107, 194`

This can hide `KeyboardInterrupt`, `SystemExit`, and `GeneratorExit`. In a CLI context, `KeyboardInterrupt` swallowing would prevent Ctrl+C from working properly.

**Fix:** Use `except Exception:` only when truly needed, or catch specific exception types.

### 6.2 JWT Secret in Code

```python
JWT_SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-64"
```

This is fine as a development default, but the `.env` file in the repo makes it easy to accidentally commit a real secret.

### 6.3 CORS Configuration

```python
CORS_ORIGINS: list[str] = ["http://localhost:3000"]
```

The desktop build overrides this to include `tauri://localhost` and `https://tauri.localhost`. In production web deployment, this must be restricted to the actual domain.

### 6.4 Soft Delete Implementation

All models use soft delete (`is_deleted` flag), but:
- No cleanup policy (old soft-deleted records accumulate)
- No unique constraint on email + is_deleted (could register same email after "deleting")

---

## 7. Recommendations

### Priority: High

1. **Sync build scripts with CI** — Add `--hidden-import=bcrypt` and `--hidden-import=jose` to `build.ps1` and `build.sh`
2. **Fix `require_role()`** — Either implement the role check logic or remove the dead function entirely
3. **Add `@tauri-apps/api` to frontend** — Use `invoke('get_backend_url')` to get the dynamic API URL instead of hardcoding
4. **Add backend readiness check** — Frontend should wait/poll for backend health before making API calls

### Priority: Medium

5. **Clean up unused imports** — Run `ruff check --fix` on the backend to auto-remove unused imports (252 are auto-fixable)
6. **Replace `Optional[X]` with `X | None`** — The project targets Python 3.12 which supports this syntax
7. **Replace `Sequence` import** — Use `collections.abc.Sequence` instead of `typing.Sequence` (deprecated in Python 3.9+)
8. **Remove dead code** — `soft_delete()`, `count()`, `require_role()`, `sync_id` field
9. **Add retry logic to API client** — Retry failed requests 2-3 times with backoff for transient failures

### Priority: Low

10. **Update AUR PKGBUILD** — Add version automation and proper checksums
11. **Clean up PyInstaller spec file** — Remove `hostwise-backend.spec` from repo (generated by CI) or keep it in sync
12. **Remove `isRestoring` state** — It's set but never exposed; simplifies auth context
13. **Add `.env` to `.gitignore`** — Prevent accidental secret commits (if not already done)

---

## Summary

| Category | Count |
|----------|-------|
| Unused imports | ~35 |
| Unused functions/methods | 7 |
| Dead code blocks | 5 |
| Potential bugs | 7 |
| Script/build inconsistencies | 5 |
| Security concerns | 4 |
| **Total issues found** | **~63** |
| Auto-fixable with ruff | 252 (mostly import sorting & formatting) |
