"""
AI Module — Cache

Short-TTL, in-process cache for the expensive advisor/scenario paths (roadmap
4.2 / 4.5). Cache keys include a **data fingerprint** derived from the
business tables, so any import/edit bumps the fingerprint and the next call
recomputes — no stale reports.

Single-process local-first app → a plain dict with monotonic expiry is the
right size and has zero dependency cost.
"""
import hashlib
import time

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class TTLCache:
    """Minimal TTL cache keyed by string → value."""

    def __init__(self, ttl_seconds: int = 60):
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, object]] = {}

    def get(self, key: str):
        item = self._store.get(key)
        if item is None:
            return None
        ts, value = item
        if time.monotonic() - ts > self._ttl:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: object) -> None:
        self._store[key] = (time.monotonic(), value)

    def clear(self) -> None:
        self._store.clear()


# 60s TTL — short enough to stay fresh, long enough to make repeated loads cheap.
advisor_cache = TTLCache(ttl_seconds=60)
annual_report_cache = TTLCache(ttl_seconds=60)

_FINGERPRINT_TABLES = (
    # Imported lazily inside the function to avoid circular imports at module load.
)


async def data_fingerprint(session: AsyncSession) -> str:
    """Cheap fingerprint of the business data, for cache invalidation.

    Hash of per-table (count, max updated_at). Any insert/update/soft-delete
    that matters changes the fingerprint.
    """
    from app.finance.category_models import ExpenseCategory, RevenueCategory
    from app.finance.models import Expense, Revenue
    from app.properties.models import Property
    from app.reservations.models import Reservation

    parts: list[str] = []
    for model in (
        Reservation, Revenue, Expense, Property, ExpenseCategory, RevenueCategory,
    ):
        count = (await session.execute(
            select(func.count()).select_from(model)
        )).scalar() or 0
        max_updated = (await session.execute(
            select(func.max(model.updated_at))
        )).scalar()
        parts.append(f"{model.__tablename__}:{count}:{max_updated}")
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]
