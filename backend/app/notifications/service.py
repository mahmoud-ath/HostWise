"""
Notifications Module — Service

Generates in-app notifications from real data, wired to the stored
`notify_*` settings. `refresh()` acts as the lightweight scheduler tick
for the local-first desktop app: it recomputes the latest events and
inserts new notifications, deduplicated by fingerprint so nothing spams.

Email delivery is intentionally not wired in v1 (local-first app); the
roadmap risk "email delivery needs a server — keep local notify first"
applies.
"""
import asyncio
import uuid
from calendar import monthrange
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.properties.models import Property
from app.reservations.models import Reservation, ReservationStatus

from .models import Notification

# Notifications older than this are auto-archived on refresh.
MAX_AGE_DAYS = 90


class NotificationService:
    """Business logic for in-app notifications."""

    def __init__(self, session):
        self.session = session

    # ── Reading ─────────────────────────────────────────
    async def list_notifications(self, limit: int = 50) -> list[Notification]:
        result = await self.session.execute(
            select(Notification)
            .where(Notification.is_deleted == False)
            .order_by(Notification.is_read.asc(), Notification.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def unread_count(self) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.is_deleted == False,
                Notification.is_read == False,
            )
        )
        return result.scalar() or 0

    async def mark_read(self, notification_id: uuid.UUID) -> bool:
        n = (
            await self.session.execute(
                select(Notification).where(
                    Notification.id == notification_id,
                    Notification.is_deleted == False,
                )
            )
        ).scalar_one_or_none()
        if not n:
            return False
        n.is_read = True
        await self.session.flush()
        return True

    async def mark_all_read(self) -> int:
        rows = await self.session.execute(
            select(Notification).where(
                Notification.is_deleted == False,
                Notification.is_read == False,
            )
        )
        count = 0
        for n in rows.scalars().all():
            n.is_read = True
            count += 1
        await self.session.flush()
        return count

    async def clear_all(self) -> int:
        rows = await self.session.execute(
            select(Notification).where(Notification.is_deleted == False)
        )
        count = 0
        for n in rows.scalars().all():
            n.is_deleted = True
            count += 1
        await self.session.flush()
        return count

    # ── Generation (the "scheduler tick") ───────────────
    async def refresh(self) -> dict:
        """Recompute notifications from current data + enabled settings.

        Idempotent: each event is fingerprinted, so re-running never
        duplicates. Returns how many new notifications were created.
        """
        try:
            return await self._refresh_inner()
        except IntegrityError:
            # A concurrent refresh() inserted the same fingerprint first — the
            # unique partial index rejected ours. Roll back and report current
            # state (the winning request already has the notifications).
            await self.session.rollback()
            return {
                "created": 0,
                "unread": await self.unread_count(),
                "total": len(await self.list_notifications()),
            }

    async def _refresh_inner(self) -> dict:
        from app.settings.service import SettingsService

        settings = await SettingsService(self.session).get_all()
        currency = settings.get("default_currency", "EUR")
        created: list[str] = []

        if settings.get("notify_profit_drops", True):
            await self._check_trend("profit", created, currency)
        if settings.get("notify_revenue_increase", True):
            await self._check_trend("revenue", created, currency)
        if settings.get("notify_occupancy_falls", True):
            await self._check_occupancy(created)
        if settings.get("notify_backup_completed", True):
            await self._check_backup(created)
        if settings.get("notify_monthly_report", True):
            await self._check_report(created, settings)

        # Housekeeping — archive notifications older than MAX_AGE_DAYS.
        cutoff = datetime.utcnow() - timedelta(days=MAX_AGE_DAYS)
        stale = await self.session.execute(
            select(Notification).where(Notification.created_at < cutoff)
        )
        for n in stale.scalars().all():
            n.is_deleted = True

        await self.session.flush()
        return {
            "created": len(created),
            "unread": await self.unread_count(),
            "total": len(await self.list_notifications()),
        }

    # ── Helpers ─────────────────────────────────────────
    async def _add(
        self,
        created: list[str],
        type_: str,
        title: str,
        message: str,
        severity: str,
        fingerprint: str,
    ) -> None:
        exists = (
            await self.session.execute(
                select(Notification.id).where(
                    Notification.fingerprint == fingerprint,
                    Notification.is_deleted == False,
                )
            )
        ).first()
        if exists:
            return
        self.session.add(Notification(
            type=type_,
            title=title,
            message=message,
            severity=severity,
            fingerprint=fingerprint,
        ))
        created.append(fingerprint)

    async def _trend_months(self) -> list[dict]:
        """Last two calendar months (previous + current), oldest first."""
        from app.finance.service import FinancialReportingService

        today = date.today()
        cur_first = today.replace(day=1)
        prev_first = (cur_first - timedelta(days=1)).replace(day=1)
        period = await FinancialReportingService(self.session).get_period_report(prev_first, today)
        return [m.model_dump() for m in period.monthly_breakdown]

    async def _check_trend(self, kind: str, created: list[str], currency: str) -> None:
        months = await self._trend_months()
        if len(months) < 2:
            return
        prev, cur = months[0], months[1]
        key = f"{cur['year']}-{cur['month']:02d}"

        if kind == "profit":
            prev_profit, cur_profit = prev["profit"], cur["profit"]
            if prev_profit > 0 and cur_profit < prev_profit:
                drop = prev_profit - cur_profit
                await self._add(
                    created,
                    "profit_drop",
                    "Profit dropped",
                    f"Profit fell {_money(drop, currency)} month-over-month "
                    f"({_money(prev_profit, currency)} → {_money(cur_profit, currency)}).",
                    "warning",
                    f"profit:{key}",
                )
        elif kind == "revenue":
            prev_rev, cur_rev = prev["net_revenue"], cur["net_revenue"]
            if prev_rev > 0 and cur_rev > prev_rev:
                gain = cur_rev - prev_rev
                await self._add(
                    created,
                    "revenue_increase",
                    "Revenue up",
                    f"Net revenue grew {_money(gain, currency)} month-over-month "
                    f"({_money(prev_rev, currency)} → {_money(cur_rev, currency)}).",
                    "success",
                    f"revenue:{key}",
                )

    async def _occupancy_pct(self, year: int, month: int) -> float:
        """Rough occupancy = booked nights ÷ (properties × days in month)."""
        start = date(year, month, 1)
        _, last = monthrange(year, month)
        end = date(year, month, last)
        nights = (
            await self.session.execute(
                select(func.coalesce(func.sum(Reservation.nights), 0)).where(
                    Reservation.is_deleted == False,
                    Reservation.status.in_([
                        ReservationStatus.CONFIRMED,
                        ReservationStatus.COMPLETED,
                    ]),
                    Reservation.check_in >= start,
                    Reservation.check_in <= end,
                )
            )
        ).scalar() or 0
        prop_count = (
            await self.session.execute(
                select(func.count()).select_from(Property).where(
                    Property.is_deleted == False,
                )
            )
        ).scalar() or 0
        capacity = prop_count * last
        return (float(nights) / capacity * 100.0) if capacity else 0.0

    async def _check_occupancy(self, created: list[str]) -> None:
        today = date.today()
        cur_first = today.replace(day=1)
        prev_first = (cur_first - timedelta(days=1)).replace(day=1)
        prev_occ = await self._occupancy_pct(prev_first.year, prev_first.month)
        cur_occ = await self._occupancy_pct(today.year, today.month)
        if prev_occ > 0 and cur_occ < prev_occ:
            await self._add(
                created,
                "occupancy_fall",
                "Occupancy fell",
                f"Occupancy dropped from {prev_occ:.0f}% to {cur_occ:.0f}% month-over-month.",
                "warning",
                f"occupancy:{today.year}-{today.month:02d}",
            )

    async def _check_backup(self, created: list[str]) -> None:
        from app import backup_service

        backups = await asyncio.to_thread(backup_service.list_backups)
        if not backups:
            return
        latest = max(backups, key=lambda b: b.get("created", ""))
        try:
            created_at = datetime.fromisoformat(latest["created"])
        except (KeyError, ValueError):
            return
        if datetime.utcnow() - created_at <= timedelta(hours=24):
            await self._add(
                created,
                "backup_completed",
                "Backup completed",
                f"Your data was backed up successfully ({latest['name']}).",
                "success",
                f"backup:{latest['name']}",
            )

    async def _check_report(self, created: list[str], settings: dict) -> None:
        frequency = settings.get("report_auto_generate", "monthly")
        if not frequency or frequency in ("off", "none"):
            return
        # Don't announce an empty report on a fresh database.
        has_data = (
            await self.session.execute(
                select(func.count()).select_from(Reservation).where(
                    Reservation.is_deleted == False,
                )
            )
        ).scalar() or 0
        if has_data == 0:
            return
        today = date.today()
        period_key = f"{today.year}-{today.month:02d}"
        label = today.strftime("%B %Y")
        await self._add(
            created,
            "monthly_report",
            f"{label} report ready",
            f"Your {frequency} report for {label} is ready to view in Reports.",
            "info",
            f"report:{period_key}",
        )


def _money(amount: float, currency: str) -> str:
    """Format an amount as '<code> <value>' (e.g. 'USD 1,250.00')."""
    try:
        return f"{currency} {amount:,.2f}"
    except (ValueError, TypeError):
        return f"{currency} {amount}"
