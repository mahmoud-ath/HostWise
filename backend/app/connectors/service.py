"""
Connectors Module — Service

Data ingestion logic for CSV and JSON files. Routers stay thin; all
parsing, normalization and inserts live here. Honors import settings
(date format, default currency) from the settings store.
"""
import asyncio
import csv
import json
import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.finance.models import Expense, ExpenseCategory, Revenue, RevenueSource
from app.properties.models import Property, PropertyType
from app.reservations.models import Reservation, ReservationSource, ReservationStatus

log = logging.getLogger("hostwise.connectors")

DATE_FORMATS = {
    "DD/MM/YYYY": "%d/%m/%Y",
    "MM/DD/YYYY": "%m/%d/%Y",
    "YYYY-MM-DD": "%Y-%m-%d",
}


def _parse_date(value: str, fmt: str) -> object:
    """Parse a date string honoring the configured import date format."""
    value = (value or "").strip()
    if not value:
        raise ValueError("empty date")
    for candidate in [DATE_FORMATS.get(fmt), "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]:
        if not candidate:
            continue
        try:
            return datetime.strptime(value, candidate).date()
        except ValueError:
            continue
    raise ValueError(f"unparseable date: {value}")


def _resolve_encoding(label: str) -> str:
    """Map the settings encoding label to a Python codec name.

    'UTF-8' is opened as utf-8-sig so an optional BOM is handled transparently.
    """
    codecs = {
        "utf-8": "utf-8-sig",
        "utf-8 bom": "utf-8-sig",
        "utf8": "utf-8-sig",
        "latin-1": "latin-1",
        "iso-8859-1": "latin-1",
        "windows-1252": "cp1252",
        "cp1252": "cp1252",
    }
    return codecs.get((label or "").strip().lower(), (label or "utf-8-sig").strip() or "utf-8-sig")


class ConnectorService:
    """Handles file preview and import for CSV and JSON data."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._props_created = 0

    @staticmethod
    def read_file(
        file_path: str,
        encoding: str | None = None,
        delimiter: str | None = None,
    ) -> tuple[str, list[str], list[dict]]:
        """Read a file, returning (format, columns, rows).

        `encoding` and `delimiter` honor the import settings
        (import_encoding / import_delimiter) when provided.
        """
        codec = _resolve_encoding(encoding or "UTF-8")
        if file_path.lower().endswith(".json"):
            with open(file_path, encoding=codec) as f:
                payload = json.load(f)
            if isinstance(payload, dict) and isinstance(payload.get("rows"), list):
                rows = payload["rows"]
            elif isinstance(payload, list):
                rows = payload
            else:
                raise ValueError("JSON must be an array of objects or {type, rows}")
            columns = list(rows[0].keys()) if rows else []
            return "json", columns, rows

        with open(file_path, encoding=codec) as f:
            reader = csv.DictReader(f, delimiter=delimiter or ",")
            columns = [c.lower().strip() for c in (reader.fieldnames or [])]
            rows = list(reader)
        return "csv", columns, rows

    @staticmethod
    def detect_type(import_type: str, columns: list[str]) -> str:
        if import_type != "auto":
            return import_type
        cols = " ".join(columns)
        if ("gross_revenue" in cols or "gross_amount" in cols) and "reservation_id" in cols:
            return "revenues"
        if "check_in" in cols and "check_out" in cols:
            return "reservations"
        if ("expense" in cols or "category" in cols) and "amount" in cols:
            return "expenses"
        return "reservations"

    async def _resolve_property(
        self,
        prop_map: dict,
        existing_props: dict,
        csv_pid: str,
        prop_name: str = "",
        city: str = "",
        country: str = "",
    ) -> uuid.UUID | None:
        csv_pid = (csv_pid or "").strip()
        prop_name = (prop_name or "").strip()

        if csv_pid and csv_pid in prop_map:
            return prop_map[csv_pid]
        if prop_name and prop_name.lower() in existing_props:
            prop_map[csv_pid] = existing_props[prop_name.lower()].id
            return prop_map[csv_pid]

        prop = Property(
            name=prop_name or f"Imported {csv_pid[:8] or uuid.uuid4().hex[:6]}",
            city=city or None,
            country=country or None,
            type=PropertyType.OTHER,
            bedrooms=1, bathrooms=1, max_guests=2,
        )
        self.session.add(prop)
        await self.session.flush()
        prop_map[csv_pid] = prop.id
        existing_props[prop.name.lower()] = prop
        self._props_created += 1
        return prop.id

    async def import_file(self, file_path: str, import_type: str) -> dict:
        """Import a CSV/JSON file into the database."""
        from app.settings.service import SettingsService

        settings = await SettingsService(self.session).get_all()
        date_fmt = settings.get("import_date_format", "DD/MM/YYYY")
        currency = settings.get("default_currency", "EUR")
        enc = settings.get("import_encoding", "UTF-8")
        delim = settings.get("import_delimiter", ",")

        fmt, columns, rows = self.read_file(file_path, encoding=enc, delimiter=delim)
        if not rows:
            return {
                "import_type": import_type, "imported": 0, "skipped": 0,
                "properties_created": 0, "errors": ["File is empty."],
            }

        # Build property map from existing properties
        result = await self.session.execute(
            select(Property).where(Property.is_deleted == False)
        )
        existing_props = {p.name.lower(): p for p in result.scalars().all()}
        prop_map: dict[str, uuid.UUID] = {}

        async def resolve_property(row: dict) -> uuid.UUID | None:
            pid = await self._resolve_property(
                prop_map,
                existing_props,
                row.get("property_id", ""),
                row.get("property_name", row.get("Property Name", "")),
                row.get("city", ""),
                row.get("country", ""),
            )
            if pid and not prop_map.get(row.get("property_id", "")):
                prop_map[row.get("property_id", "")] = pid
            return pid

        # Expense category cache — CSV imports carry a category name, so we
        # find-or-create the matching ExpenseCategory and link it by id.
        exp_cat_cache: dict[str, ExpenseCategory] = {}
        result = await self.session.execute(
            select(ExpenseCategory).where(ExpenseCategory.is_deleted == False)
        )
        for cat in result.scalars().all():
            exp_cat_cache[cat.name.lower()] = cat

        async def resolve_expense_category(name: str) -> ExpenseCategory | None:
            key = (name or "").strip().lower()
            if not key:
                return None
            cat = exp_cat_cache.get(key)
            if not cat:
                cat = ExpenseCategory(name=name.strip(), is_default=False, sort_order=0)
                self.session.add(cat)
                await self.session.flush()
                exp_cat_cache[key] = cat
            return cat

        detected = self.detect_type(import_type, columns)
        imported = 0
        skipped = 0
        errors: list[str] = []

        # Idempotency — build natural-key sets so re-importing the same file
        # skips rows that already exist instead of creating duplicates.
        if detected == "reservations":
            existing_res_codes = {
                code for (code,) in (
                    await self.session.execute(
                        select(Reservation.confirmation_code).where(
                            Reservation.is_deleted == False,
                            Reservation.confirmation_code.is_not(None),
                        )
                    )
                ).all()
            }
        elif detected == "revenues":
            existing_rev_keys = {
                (str(p), str(d), float(g), float(n), s.value)
                for p, d, g, n, s in (
                    await self.session.execute(
                        select(
                            Revenue.property_id, Revenue.date, Revenue.gross_amount,
                            Revenue.net_amount, Revenue.source,
                        ).where(Revenue.is_deleted == False)
                    )
                ).all()
            }
        elif detected == "expenses":
            existing_exp_keys = {
                (str(p), str(d), float(a), (v or "").strip(), (desc or "").strip())
                for p, d, a, v, desc in (
                    await self.session.execute(
                        select(
                            Expense.property_id, Expense.date, Expense.amount,
                            Expense.vendor, Expense.description,
                        ).where(Expense.is_deleted == False)
                    )
                ).all()
            }

        if detected == "reservations":
            for row in rows:
                try:
                    prop_id = await resolve_property(row)
                    if not prop_id:
                        continue
                    code = (row.get("reservation_id") or row.get("confirmation_code") or "").strip()
                    if code and code in existing_res_codes:
                        skipped += 1
                        continue
                    check_in = _parse_date(row.get("check_in") or row.get("Check-in") or "", date_fmt)
                    check_out = _parse_date(row.get("check_out") or row.get("Check-out") or "", date_fmt)
                    nights = int(row.get("nights", row.get("Nights", 0)) or 0) or (check_out - check_in).days
                    gross = float(row.get("gross_amount", row.get("gross_revenue", row.get("Amount", 0)) or 0))
                    status_map = {
                        "Confirmed": ReservationStatus.CONFIRMED,
                        "Cancelled": ReservationStatus.CANCELLED,
                        "Completed": ReservationStatus.COMPLETED,
                    }
                    status = status_map.get(row.get("status", "Confirmed"), ReservationStatus.CONFIRMED)
                    self.session.add(Reservation(
                        property_id=prop_id,
                        confirmation_code=code or None,
                        status=status,
                        source=ReservationSource.CSV,
                        check_in=check_in,
                        check_out=check_out,
                        nights=nights,
                        guest_name=(row.get("guest_name") or "").strip() or None,
                        gross_revenue=gross,
                        net_revenue=gross * 0.85,
                        cleaning_fee=0,
                        platform_fee=gross * 0.15,
                        taxes=0,
                        currency=currency,
                        number_of_guests=2,
                        property_name=(row.get("property_name") or "").strip() or None,
                    ))
                    if code:
                        existing_res_codes.add(code)
                    imported += 1
                except Exception as exc:  # noqa: BLE001 - per-row import errors are collected and surfaced
                    errors.append(str(exc))

        elif detected == "revenues":
            for row in rows:
                try:
                    prop_id = await resolve_property(row)
                    if not prop_id:
                        continue
                    rev_date = _parse_date(row.get("date") or "", date_fmt)
                    gross = float(row.get("gross_revenue", row.get("gross_amount", 0)) or 0)
                    comm = float(row.get("management_commission", row.get("commission_amount", 0)) or 0)
                    net = float(row.get("net_revenue", row.get("net_amount", gross - comm)) or 0)
                    source_map = {"airbnb": RevenueSource.AIRBNB, "booking": RevenueSource.BOOKING,
                                  "direct": RevenueSource.DIRECT, "csv": RevenueSource.CSV}
                    source = source_map.get((row.get("source", "csv") or "csv").strip().lower(), RevenueSource.CSV)
                    key = (str(prop_id), str(rev_date), float(gross), float(net), source.value)
                    if key in existing_rev_keys:
                        skipped += 1
                        continue
                    self.session.add(Revenue(
                        property_id=prop_id,
                        date=rev_date,
                        gross_amount=gross,
                        commission_amount=comm,
                        net_amount=net,
                        source=source,
                        currency=currency,
                    ))
                    existing_rev_keys.add(key)
                    imported += 1
                except Exception as exc:  # noqa: BLE001 - per-row import errors are collected and surfaced
                    errors.append(str(exc))

        elif detected == "expenses":
            for row in rows:
                try:
                    prop_id = await resolve_property(row)
                    if not prop_id:
                        continue
                    exp_date = _parse_date(row.get("date") or "", date_fmt)
                    amount = float(row.get("amount", 0) or 0)
                    cat_name = (row.get("category") or "").strip()
                    vendor = (row.get("vendor") or "").strip()
                    key = (str(prop_id), str(exp_date), float(amount), vendor, cat_name)
                    if key in existing_exp_keys:
                        skipped += 1
                        continue
                    category = await resolve_expense_category(cat_name) if cat_name else None
                    self.session.add(Expense(
                        property_id=prop_id,
                        date=exp_date,
                        amount=amount,
                        currency=currency,
                        category_id=category.id if category else None,
                        description=cat_name or None,
                        vendor=vendor or None,
                    ))
                    existing_exp_keys.add(key)
                    imported += 1
                except Exception as exc:  # noqa: BLE001 - per-row import errors are collected and surfaced
                    errors.append(str(exc))
        else:
            errors.append(f"Unsupported import type: {detected}")

        return {
            "format": fmt,
            "import_type": detected,
            "imported": imported,
            "skipped": skipped,
            "properties_created": self._props_created,
            "errors": errors[:10],
        }

    async def import_ical(self, file_path: str, property_id: uuid.UUID) -> dict:
        """Import reservations from an .ics calendar export.

        Airbnb and Booking don't expose a public reservations API for hosts,
        but they do offer calendar export (.ics) links — this is the supported
        integration path. Each VEVENT becomes a reservation (guest name from
        SUMMARY, dates from DTSTART/DTEND).
        """
        from app.connectors.ical import parse_ics
        from app.settings.service import SettingsService

        def _read_ics() -> str:
            with open(file_path, encoding="utf-8", errors="replace") as f:
                return f.read()

        events = parse_ics(await asyncio.to_thread(_read_ics))

        if not events:
            return {
                "format": "ics", "import_type": "ical", "imported": 0,
                "skipped": 0, "properties_created": 0,
                "errors": ["No VEVENT entries found in the calendar file."],
            }

        prop = (
            await self.session.execute(
                select(Property).where(
                    Property.id == property_id,
                    Property.is_deleted == False,
                )
            )
        ).scalar_one_or_none()
        if not prop:
            return {
                "format": "ics", "import_type": "ical", "imported": 0,
                "skipped": 0, "properties_created": 0,
                "errors": ["Property not found."],
            }

        settings = await SettingsService(self.session).get_all()
        currency = settings.get("default_currency", "EUR")

        # Idempotency — skip UIDs already imported for this property's calendar.
        existing_uids = {
            uid for (uid,) in (
                await self.session.execute(
                    select(Reservation.external_id).where(
                        Reservation.external_id.is_not(None),
                        Reservation.property_id == property_id,
                    )
                )
            ).all()
        }

        imported = 0
        skipped = 0
        for ev in events:
            uid = ev["uid"] or ""
            if uid and uid in existing_uids:
                skipped += 1
                continue
            self.session.add(Reservation(
                property_id=property_id,
                external_id=uid or None,
                confirmation_code=uid or None,
                status=ReservationStatus.CONFIRMED,
                source=ReservationSource.ICAL,
                check_in=ev["check_in"],
                check_out=ev["check_out"],
                nights=ev["nights"],
                guest_name=ev["summary"] or None,
                gross_revenue=0.0,
                net_revenue=0.0,
                cleaning_fee=0,
                platform_fee=0.0,
                taxes=0,
                currency=currency,
                number_of_guests=1,
                property_name=prop.name,
            ))
            if uid:
                existing_uids.add(uid)
            imported += 1

        return {
            "format": "ics",
            "import_type": "ical",
            "imported": imported,
            "skipped": skipped,
            "properties_created": 0,
            "errors": [],
        }
