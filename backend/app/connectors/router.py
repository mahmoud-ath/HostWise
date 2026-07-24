"""
Connectors Module — Router
"""
from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.core.database import get_db
from app.connectors.base import ConnectorRegistry

router = APIRouter()


@router.get("/available")
async def list_connectors():
    """List available data connectors."""
    return {"connectors": ConnectorRegistry.list_available()}


@router.post("/csv/upload")
async def upload_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a CSV file for import.
    Saves the file and returns a preview of detected columns.
    """
    import csv
    import io
    import os
    from app.core.config import get_settings

    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # Parse preview
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    columns = reader.fieldnames or []
    rows = [row for _, row in zip(range(5), reader)]

    return {
        "filename": file.filename,
        "file_path": file_path,
        "columns": columns,
        "preview_rows": rows,
        "row_count_estimate": "Preview only — run import to process all rows",
    }


@router.post("/csv/import")
async def import_csv_data(
    filename: str = Query(..., description="Uploaded filename to import"),
    import_type: str = Query("auto", description="auto, reservations, revenues, or expenses"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Import a previously uploaded CSV file into the database.
    Auto-detects the CSV type from column names.
    Returns counts of imported rows.
    """
    import csv
    import os
    import uuid as _uuid
    from datetime import datetime
    from app.core.config import get_settings
    from app.properties.models import Property, PropertyType
    from app.reservations.models import Reservation, ReservationStatus, ReservationSource
    from app.finance.models import Revenue, RevenueSource, Expense

    settings = get_settings()
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        return {"error": f"File '{filename}' not found. Upload it first.", "imported": 0}

    with open(file_path, "r") as f:
        reader = csv.DictReader(f)
        columns = [c.lower().strip() for c in (reader.fieldnames or [])]
        rows = list(reader)

    if not rows:
        return {"error": "CSV file is empty.", "imported": 0}

    # ── Get or resolve organization ──
    org_id = None
    for membership in current_user.memberships:
        org_id = membership.organization_id
        break

    if not org_id:
        return {"error": "No organization found for this user.", "imported": 0}

    # ── Build property map: CSV property_id → DB UUID ──
    from sqlalchemy import select
    result = await session.execute(
        select(Property).where(
            Property.organization_id == org_id,
            Property.is_deleted == False,
        )
    )
    existing_props = {p.name.lower(): p for p in result.scalars().all()}

    prop_map: dict[str, _uuid.UUID] = {}
    props_created = 0

    async def resolve_property(csv_pid: str, prop_name: str = "", city: str = "", country: str = "") -> _uuid.UUID | None:
        nonlocal props_created
        csv_pid = csv_pid.strip()
        prop_name = prop_name.strip()

        if csv_pid in prop_map:
            return prop_map[csv_pid]

        # Try matching by name
        if prop_name.lower() in existing_props:
            prop_map[csv_pid] = existing_props[prop_name.lower()].id
            return prop_map[csv_pid]

        # Create new property
        prop = Property(
            organization_id=org_id,
            name=prop_name or f"Imported Property {csv_pid}",
            city=city or None,
            country=country or None,
            type=PropertyType.OTHER,
            bedrooms=1, bathrooms=1, max_guests=2,
        )
        session.add(prop)
        await session.flush()
        prop_map[csv_pid] = prop.id
        existing_props[prop.name.lower()] = prop
        props_created += 1
        return prop.id

    # ── Auto-detect CSV type ──
    detected = import_type
    if detected == "auto":
        if any("gross_revenue" in c or "gross_amount" in c for c in columns) and any("reservation_id" in c for c in columns):
            detected = "revenues"
        elif any("check_in" in c for c in columns) and any("check_out" in c for c in columns):
            detected = "reservations"
        elif any("expense_id" in c or "category" in c for c in columns) and "amount" in columns:
            detected = "expenses"
        else:
            detected = "reservations"  # default

    imported = 0
    errors = []

    # ── Import reservations ──
    if detected == "reservations":
        for row in rows:
            try:
                prop_id = await resolve_property(
                    row.get("property_id", ""),
                    row.get("property_name", row.get("Property Name", "")),
                    row.get("city", ""),
                    row.get("country", ""),
                )
                if not prop_id:
                    continue

                check_in = datetime.strptime((row.get("check_in") or row.get("Check-in") or "").strip(), "%Y-%m-%d").date()
                check_out = datetime.strptime((row.get("check_out") or row.get("Check-out") or "").strip(), "%Y-%m-%d").date()
                nights = int(row.get("nights", row.get("Nights", 0)) or 0) or (check_out - check_in).days
                gross = float(row.get("gross_amount", row.get("gross_revenue", row.get("Amount", 0)) or 0))

                status_map = {"Confirmed": ReservationStatus.CONFIRMED, "Cancelled": ReservationStatus.CANCELLED,
                              "Completed": ReservationStatus.COMPLETED}
                status = status_map.get(row.get("status", "Confirmed"), ReservationStatus.CONFIRMED)

                res = Reservation(
                    organization_id=org_id,
                    property_id=prop_id,
                    confirmation_code=row.get("reservation_id", row.get("confirmation_code", "")).strip() or None,
                    status=status,
                    source=ReservationSource.CSV,
                    check_in=check_in,
                    check_out=check_out,
                    nights=nights,
                    guest_name=row.get("guest_country", row.get("guest_name", "")).strip() or None,
                    gross_revenue=gross,
                    net_revenue=gross * 0.85,
                    cleaning_fee=0,
                    platform_fee=gross * 0.15,
                    taxes=0,
                    currency="USD",
                    number_of_guests=2,
                    property_name=row.get("property_name", "").strip() or None,
                )
                session.add(res)
                imported += 1
            except Exception as e:
                errors.append(str(e))

    # ── Import revenues ──
    elif detected == "revenues":
        for row in rows:
            try:
                prop_id = await resolve_property(
                    row.get("property_id", ""),
                    row.get("property_name", ""),
                )
                if not prop_id:
                    continue

                rev_date = datetime.strptime((row.get("date") or "").strip(), "%Y-%m-%d").date()
                gross = float(row.get("gross_revenue", row.get("gross_amount", 0)) or 0)
                comm = float(row.get("management_commission", row.get("commission_amount", 0)) or 0)
                net = float(row.get("net_revenue", row.get("net_amount", gross - comm)) or 0)
                source_str = (row.get("source", "CSV") or "CSV").strip().lower()
                source_map = {"airbnb": RevenueSource.AIRBNB, "booking": RevenueSource.BOOKING,
                              "direct": RevenueSource.DIRECT, "csv": RevenueSource.CSV}
                source = source_map.get(source_str, RevenueSource.CSV)

                rev = Revenue(
                    organization_id=org_id,
                    property_id=prop_id,
                    date=rev_date,
                    gross_amount=gross,
                    commission_amount=comm,
                    net_amount=net,
                    source=source,
                    currency="USD",
                )
                session.add(rev)
                imported += 1
            except Exception as e:
                errors.append(str(e))

    # ── Import expenses ──
    elif detected == "expenses":
        for row in rows:
            try:
                prop_id = await resolve_property(row.get("property_id", ""))
                if not prop_id:
                    continue

                exp_date = datetime.strptime((row.get("date") or "").strip(), "%Y-%m-%d").date()
                amount = float(row.get("amount", 0) or 0)
                category = row.get("category", "").strip()

                exp = Expense(
                    organization_id=org_id,
                    property_id=prop_id,
                    date=exp_date,
                    amount=amount,
                    currency="USD",
                    description=category,
                    vendor=None,
                )
                session.add(exp)
                imported += 1
            except Exception as e:
                errors.append(str(e))

    return {
        "import_type": detected,
        "imported": imported,
        "properties_created": props_created,
        "errors": errors[:10],  # first 10 errors
    }
