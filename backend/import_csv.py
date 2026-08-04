"""
HostWise — CSV Import / Demo Seed Script

Kept in sync with the CURRENT app models (backend/app) and the in-app
connector (backend/app/connectors/service.py):

  * No `organization_id` / `sync_id` columns — the current properties,
    reservations, revenues and expenses tables don't have them (older
    versions of this script set organization_id, which no longer exists).
  * Same CSV column names as the app's Import UI, and dates are parsed
    flexibly (DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY).
  * Properties are created / reused automatically from `property_id` /
    `property_name` — no hard-coded property list.
  * Revenues are linked back to their reservation when `reservation_id`
    is present.
  * Soft-delete aware: existing records with is_deleted=0 are reused.

Usage (run from backend/):
  python import_csv.py seed [--reset]
      Write fresh sample CSVs to docs/samples/ and import them.
      --reset wipes ALL existing data first (true "start fresh").

  python import_csv.py [--reset]
      Import from docs/samples/{reservations,revenues,expenses}.csv.
      --reset wipes existing financial rows (reservations / revenues /
      expenses) first; properties are kept and reused by name.

  python import_csv.py --reservations a.csv --revenues b.csv --expenses c.csv

  Options:
    --currency MAD   Override the currency (default: from app settings).
"""
import argparse
import asyncio
import csv
import logging
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# Target the backend database (backend/hostwise.db) before app config loads.
BACKEND_DIR = Path(__file__).resolve().parent
SAMPLES_DIR = Path(__file__).resolve().parent.parent / "docs" / "samples"

os.environ.setdefault("DATABASE_TYPE", "sqlite")
os.environ.setdefault("SQLITE_PATH", str(BACKEND_DIR / "hostwise.db"))

from sqlalchemy import delete, select  # noqa: E402

from app.core.database import Base, async_session_factory, engine  # noqa: E402
from app.finance.models import Expense, ExpenseCategory, Revenue, RevenueSource  # noqa: E402
from app.properties.models import Listing, Property, PropertyType  # noqa: E402
from app.reservations.models import Reservation, ReservationSource, ReservationStatus  # noqa: E402

# Import every model module so `Base.metadata` is fully populated (needed to
# create the schema on a fresh database, like the app does at startup).
from app.finance import models as _finance_models  # noqa: E402, F401
from app.properties import models as _property_models  # noqa: E402, F401
from app.reservations import models as _reservation_models  # noqa: E402, F401
from app.settings import models as _settings_models  # noqa: E402, F401

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("import_csv")

DATE_FORMATS = ["%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"]

# ─────────────────────────────────────────────────────────────────────────────
# Fresh demo dataset (Morocco / MAD context) — used by `seed`
# ─────────────────────────────────────────────────────────────────────────────
DEMO_PROPERTIES = [
    {"property_id": "PROP001", "property_name": "Riad Atlas", "city": "Marrakech", "country": "MA", "type": "house"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "city": "Agadir", "country": "MA", "type": "villa"},
    {"property_id": "PROP003", "property_name": "Studio Marina", "city": "Casablanca", "country": "MA", "type": "studio"},
]

DEMO_RESERVATIONS = [
    {"property_id": "PROP001", "property_name": "Riad Atlas", "reservation_id": "RES-2026-001",
     "check_in": "12/01/2026", "check_out": "19/01/2026", "nights": "7",
     "guest_name": "Omar El Amrani", "status": "Completed", "gross_amount": "1240.00",
     "city": "Marrakech", "country": "MA"},
    {"property_id": "PROP001", "property_name": "Riad Atlas", "reservation_id": "RES-2026-002",
     "check_in": "08/02/2026", "check_out": "12/02/2026", "nights": "4",
     "guest_name": "Sofia Martin", "status": "Confirmed", "gross_amount": "820.00",
     "city": "Marrakech", "country": "MA"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "reservation_id": "RES-2026-003",
     "check_in": "01/03/2026", "check_out": "08/03/2026", "nights": "7",
     "guest_name": "Lucas Bernard", "status": "Completed", "gross_amount": "2100.00",
     "city": "Agadir", "country": "MA"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "reservation_id": "RES-2026-004",
     "check_in": "15/04/2026", "check_out": "22/04/2026", "nights": "7",
     "guest_name": "Amine Benali", "status": "Completed", "gross_amount": "2300.00",
     "city": "Agadir", "country": "MA"},
    {"property_id": "PROP003", "property_name": "Studio Marina", "reservation_id": "RES-2026-005",
     "check_in": "05/05/2026", "check_out": "09/05/2026", "nights": "4",
     "guest_name": "Claire Dubois", "status": "Confirmed", "gross_amount": "560.00",
     "city": "Casablanca", "country": "MA"},
    {"property_id": "PROP003", "property_name": "Studio Marina", "reservation_id": "RES-2026-006",
     "check_in": "20/06/2026", "check_out": "27/06/2026", "nights": "7",
     "guest_name": "Youssef Alaoui", "status": "Completed", "gross_amount": "840.00",
     "city": "Casablanca", "country": "MA"},
    {"property_id": "PROP001", "property_name": "Riad Atlas", "reservation_id": "RES-2026-007",
     "check_in": "10/07/2026", "check_out": "17/07/2026", "nights": "7",
     "guest_name": "Sarah Johnson", "status": "Confirmed", "gross_amount": "1320.00",
     "city": "Marrakech", "country": "MA"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "reservation_id": "RES-2026-008",
     "check_in": "05/08/2026", "check_out": "12/08/2026", "nights": "7",
     "guest_name": "Maria Garcia", "status": "Confirmed", "gross_amount": "2450.00",
     "city": "Agadir", "country": "MA"},
]

DEMO_REVENUES = [
    {"property_id": "PROP001", "property_name": "Riad Atlas", "reservation_id": "RES-2026-001",
     "date": "19/01/2026", "gross_revenue": "1240.00", "management_commission": "186.00",
     "net_revenue": "1054.00", "source": "Airbnb"},
    {"property_id": "PROP001", "property_name": "Riad Atlas", "reservation_id": "RES-2026-002",
     "date": "12/02/2026", "gross_revenue": "820.00", "management_commission": "123.00",
     "net_revenue": "697.00", "source": "Airbnb"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "reservation_id": "RES-2026-003",
     "date": "08/03/2026", "gross_revenue": "2100.00", "management_commission": "315.00",
     "net_revenue": "1785.00", "source": "Booking"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "reservation_id": "RES-2026-004",
     "date": "22/04/2026", "gross_revenue": "2300.00", "management_commission": "345.00",
     "net_revenue": "1955.00", "source": "Airbnb"},
    {"property_id": "PROP003", "property_name": "Studio Marina", "reservation_id": "RES-2026-005",
     "date": "09/05/2026", "gross_revenue": "560.00", "management_commission": "84.00",
     "net_revenue": "476.00", "source": "Airbnb"},
    {"property_id": "PROP003", "property_name": "Studio Marina", "reservation_id": "RES-2026-006",
     "date": "27/06/2026", "gross_revenue": "840.00", "management_commission": "126.00",
     "net_revenue": "714.00", "source": "Booking"},
    {"property_id": "PROP001", "property_name": "Riad Atlas", "reservation_id": "RES-2026-007",
     "date": "17/07/2026", "gross_revenue": "1320.00", "management_commission": "198.00",
     "net_revenue": "1122.00", "source": "Airbnb"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "reservation_id": "RES-2026-008",
     "date": "12/08/2026", "gross_revenue": "2450.00", "management_commission": "367.50",
     "net_revenue": "2082.50", "source": "Direct"},
]

DEMO_EXPENSES = [
    {"property_id": "PROP001", "property_name": "Riad Atlas", "date": "15/01/2026",
     "amount": "45.00", "category": "Cleaning", "vendor": "CleanPro Services"},
    {"property_id": "PROP001", "property_name": "Riad Atlas", "date": "20/02/2026",
     "amount": "120.00", "category": "Maintenance", "vendor": "FixIt Solutions"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "date": "10/03/2026",
     "amount": "95.00", "category": "Pool Maintenance", "vendor": "Blue Pool Care"},
    {"property_id": "PROP002", "property_name": "Villa Océan", "date": "05/04/2026",
     "amount": "220.00", "category": "Utilities", "vendor": "Maroc Électricité"},
    {"property_id": "PROP003", "property_name": "Studio Marina", "date": "12/05/2026",
     "amount": "60.00", "category": "Cleaning", "vendor": "CleanPro Services"},
    {"property_id": "PROP003", "property_name": "Studio Marina", "date": "18/06/2026",
     "amount": "85.00", "category": "Internet & TV", "vendor": "Maroc Telecom"},
    {"property_id": "PROP001", "property_name": "Riad Atlas", "date": "01/08/2026",
     "amount": "150.00", "category": "Gardening", "vendor": "Jardin Vert"},
]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _parse_date(value: str) -> object:
    value = (value or "").strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"unparseable date: {value!r}")


def _to_float(value, default: float = 0.0) -> float:
    try:
        return float((value or "").strip().replace(",", "")) if value else default
    except (TypeError, ValueError):
        return default


def read_csv(path: Path) -> list[dict]:
    if not Path(path).exists():
        log.warning(f"  ! missing file: {path}")
        return []
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        return
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


async def load_existing_props(session) -> dict[str, uuid.UUID]:
    result = await session.execute(select(Property).where(Property.is_deleted == False))
    return {p.name.lower(): p.id for p in result.scalars().all()}


async def resolve_property(
    session,
    prop_map: dict[str, uuid.UUID],
    existing_props: dict[str, uuid.UUID],
    row: dict,
) -> uuid.UUID | None:
    csv_pid = (row.get("property_id") or "").strip()
    name = (row.get("property_name") or "").strip()

    if csv_pid and csv_pid in prop_map:
        return prop_map[csv_pid]
    if name and name.lower() in existing_props:
        prop_map[csv_pid] = existing_props[name.lower()]
        return prop_map[csv_pid]

    prop = Property(
        name=name or f"Imported {csv_pid[:8] or uuid.uuid4().hex[:6]}",
        city=(row.get("city") or "").strip() or None,
        country=(row.get("country") or "").strip() or None,
        type=PropertyType.OTHER,
        bedrooms=1, bathrooms=1, max_guests=2,
    )
    session.add(prop)
    await session.flush()
    prop_map[csv_pid] = prop.id
    existing_props[prop.name.lower()] = prop.id
    return prop.id


async def get_currency(session, override: str | None) -> str:
    if override:
        return override
    try:
        from app.settings.service import SettingsService
        settings = await SettingsService(session).get_all()
        return settings.get("default_currency") or "EUR"
    except Exception:
        return "EUR"


# ─────────────────────────────────────────────────────────────────────────────
# Importers
# ─────────────────────────────────────────────────────────────────────────────
async def import_reservations(
    session, path: Path, prop_map, existing_props, currency: str,
) -> tuple[int, dict[str, uuid.UUID]]:
    res_map: dict[str, uuid.UUID] = {}
    imported = 0
    status_map = {
        "Confirmed": ReservationStatus.CONFIRMED,
        "Cancelled": ReservationStatus.CANCELLED,
        "Completed": ReservationStatus.COMPLETED,
    }
    for row in read_csv(path):
        pid = await resolve_property(session, prop_map, existing_props, row)
        if not pid:
            continue
        check_in = _parse_date(row.get("check_in") or row.get("Check-in"))
        check_out = _parse_date(row.get("check_out") or row.get("Check-out"))
        nights = int(row.get("nights") or 0) or (check_out - check_in).days
        gross = _to_float(row.get("gross_amount") or row.get("gross_revenue"))
        status = status_map.get((row.get("status") or "Confirmed").strip(), ReservationStatus.CONFIRMED)
        conf = (row.get("reservation_id") or row.get("confirmation_code") or "").strip()

        # Booking date: use the CSV `booked_at` when present, otherwise derive a
        # 21-day booking window so Portfolio Insights can show it.
        booked_raw = (row.get("booked_at") or "").strip()
        booked_date = _parse_date(booked_raw) if booked_raw else (check_in - timedelta(days=21))
        booked_at = datetime.combine(booked_date, datetime.min.time())

        res = Reservation(
            property_id=pid,
            confirmation_code=conf or None,
            status=status,
            source=ReservationSource.CSV,
            check_in=check_in,
            check_out=check_out,
            nights=nights,
            booked_at=booked_at,
            guest_name=(row.get("guest_name") or "").strip() or None,
            gross_revenue=gross,
            net_revenue=round(gross * 0.85, 2),
            cleaning_fee=0,
            platform_fee=round(gross * 0.15, 2),
            taxes=0,
            currency=currency,
            number_of_guests=2,
            property_name=(row.get("property_name") or "").strip() or None,
            property_city=(row.get("city") or "").strip() or None,
            property_country=(row.get("country") or "").strip() or None,
        )
        session.add(res)
        await session.flush()
        if conf:
            res_map[conf] = res.id
        imported += 1
    return imported, res_map


async def import_revenues(
    session, path: Path, prop_map, existing_props, currency: str, res_map: dict,
) -> int:
    imported = 0
    source_map = {
        "airbnb": RevenueSource.AIRBNB, "booking": RevenueSource.BOOKING,
        "direct": RevenueSource.DIRECT, "csv": RevenueSource.CSV,
        "manual": RevenueSource.MANUAL, "vrbo": RevenueSource.VRBO,
        "connector": RevenueSource.CONNECTOR,
    }
    for row in read_csv(path):
        pid = await resolve_property(session, prop_map, existing_props, row)
        if not pid:
            continue
        gross = _to_float(row.get("gross_revenue") or row.get("gross_amount"))
        comm = _to_float(row.get("management_commission") or row.get("commission_amount"))
        net = _to_float(row.get("net_revenue") or row.get("net_amount"), default=(gross - comm))
        src = source_map.get((row.get("source") or "csv").strip().lower(), RevenueSource.CSV)
        res_id = res_map.get((row.get("reservation_id") or "").strip())

        session.add(Revenue(
            property_id=pid,
            reservation_id=res_id,
            date=_parse_date(row.get("date")),
            gross_amount=gross,
            commission_amount=comm,
            net_amount=net,
            source=src,
            currency=currency,
        ))
        imported += 1
    return imported


async def import_expenses(session, path: Path, prop_map, existing_props, currency: str) -> int:
    imported = 0
    # Case-insensitive map of existing expense categories (created on demand).
    result = await session.execute(
        select(ExpenseCategory).where(ExpenseCategory.is_deleted == False)
    )
    cat_cache: dict[str, ExpenseCategory] = {c.name.lower(): c for c in result.scalars().all()}

    for row in read_csv(path):
        pid = await resolve_property(session, prop_map, existing_props, row)
        if not pid:
            continue
        cat_name = (row.get("category") or "").strip()
        category = None
        if cat_name:
            key = cat_name.lower()
            category = cat_cache.get(key)
            if not category:
                category = ExpenseCategory(name=cat_name, is_default=False, sort_order=0)
                session.add(category)
                await session.flush()
                cat_cache[key] = category
        session.add(Expense(
            property_id=pid,
            category_id=category.id if category else None,
            date=_parse_date(row.get("date")),
            amount=_to_float(row.get("amount")),
            currency=currency,
            description=cat_name or None,
            vendor=(row.get("vendor") or "").strip() or None,
        ))
        imported += 1
    return imported


async def reset_data(session, reset_properties: bool) -> None:
    """Hard-delete existing rows in dependency order."""
    for model in (Revenue, Reservation, Listing, Expense):
        await session.execute(delete(model))
    if reset_properties:
        await session.execute(delete(Property))
    await session.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Orchestration
# ─────────────────────────────────────────────────────────────────────────────
def write_seed_csvs() -> None:
    write_csv(SAMPLES_DIR / "reservations.csv", DEMO_RESERVATIONS)
    write_csv(SAMPLES_DIR / "revenues.csv", DEMO_REVENUES)
    write_csv(SAMPLES_DIR / "expenses.csv", DEMO_EXPENSES)
    log.info(f"  Wrote fresh sample CSVs to {SAMPLES_DIR}")


async def ensure_schema() -> None:
    """Create all tables if the database is fresh (mirrors app startup)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def run(args) -> None:
    res_path = Path(args.reservations or SAMPLES_DIR / "reservations.csv")
    rev_path = Path(args.revenues or SAMPLES_DIR / "revenues.csv")
    exp_path = Path(args.expenses or SAMPLES_DIR / "expenses.csv")

    await ensure_schema()

    async with async_session_factory() as session:
        if args.reset:
            reset_properties = args.command == "seed"
            await reset_data(session, reset_properties)
            log.info(f"  Reset existing data (properties={'yes' if reset_properties else 'no'})")

        prop_map: dict[str, uuid.UUID] = {}
        existing_props = await load_existing_props(session)
        currency = await get_currency(session, args.currency)

        n_res, res_map = await import_reservations(session, res_path, prop_map, existing_props, currency)
        n_rev = await import_revenues(session, rev_path, prop_map, existing_props, currency, res_map)
        n_exp = await import_expenses(session, exp_path, prop_map, existing_props, currency)

        await session.commit()

        log.info("")
        log.info("  Summary:")
        log.info(f"    Reservations imported : {n_res}")
        log.info(f"    Revenues imported     : {n_rev}")
        log.info(f"    Expenses imported     : {n_exp}")
        log.info(f"    Properties used       : {len(prop_map)}")
        log.info("  ✅ Done.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import or seed HostWise data.")
    parser.add_argument("command", nargs="?", default="import", choices=["import", "seed"])
    parser.add_argument("--reset", action="store_true",
                        help="Wipe existing data first (seed wipes everything; import wipes financial rows only)")
    parser.add_argument("--currency", default=None, help="Currency override (default: app settings)")
    parser.add_argument("--reservations", default=None, help="Path to reservations CSV")
    parser.add_argument("--revenues", default=None, help="Path to revenues CSV")
    parser.add_argument("--expenses", default=None, help="Path to expenses CSV")
    args = parser.parse_args()

    if args.command == "seed":
        write_seed_csvs()

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
