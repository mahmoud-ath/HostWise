"""
Settings Module — Router

GET/PUT for the application settings store, plus full-data export
and a "start fresh" wipe (used by the Security section).
"""
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.settings.service import SettingsService

router = APIRouter()


class SettingsUpdateRequest(BaseModel):
    settings: dict


@router.get("")
async def get_settings(
    session: AsyncSession = Depends(get_db),
):
    """Return all application settings (defaults merged with stored)."""
    return await SettingsService(session).get_all()


@router.put("")
async def update_settings(
    data: SettingsUpdateRequest,
    session: AsyncSession = Depends(get_db),
):
    """Upsert settings and return the full updated map."""
    return await SettingsService(session).update(data.settings)


def _csv_escape(value) -> str:
    s = "" if value is None else str(value)
    if any(c in s for c in ('"', ",", "\n")):
        return '"' + s.replace('"', '""') + '"'
    return s


def _xls(rows: list[tuple], headers: list[str]) -> str:
    thead = "".join(f"<th>{_csv_escape(h)}</th>" for h in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{_csv_escape(v)}</td>" for v in row) + "</tr>"
        for row in rows
    )
    return f"<table><tr>{thead}</tr>{body}</table><br/>"


@router.get("/export")
async def export_all_data(
    session: AsyncSession = Depends(get_db),
):
    """
    Export all business data as a multi-sheet Excel workbook (.xls).
    One sheet per sidebar tab: Properties, Revenue, Expenses, Reservations.
    """
    from app.finance.models import Expense, Revenue
    from app.properties.models import Property
    from app.reservations.models import Reservation

    props = (await session.execute(select(Property).where(Property.is_deleted == False))).scalars().all()
    revenues = (await session.execute(select(Revenue).where(Revenue.is_deleted == False))).scalars().all()
    expenses = (await session.execute(select(Expense).where(Expense.is_deleted == False))).scalars().all()
    reservations = (await session.execute(select(Reservation).where(Reservation.is_deleted == False))).scalars().all()

    prop_by_id = {str(p.id): p.name for p in props}

    sheets = [
        ("Properties", ["Name", "Type", "City", "Country", "Bedrooms", "Bathrooms", "Max Guests", "Status"],
         [(p.name, p.type.value if hasattr(p.type, "value") else p.type, p.city or "", p.country or "",
           p.bedrooms, p.bathrooms, p.max_guests, p.status.value if hasattr(p.status, "value") else p.status)
          for p in props]),
        ("Revenue", ["Date", "Property", "Gross", "Commission", "Net", "Currency", "Description"],
         [(r.date, prop_by_id.get(str(r.property_id), ""), r.gross_amount, r.commission_amount, r.net_amount, r.currency, r.description or "")
          for r in revenues]),
        ("Expenses", ["Date", "Property", "Amount", "Currency", "Vendor", "Description", "Recurring"],
         [(e.date, prop_by_id.get(str(e.property_id), ""), e.amount, e.currency, e.vendor or "", e.description or "", "yes" if e.is_recurring else "no")
          for e in expenses]),
        ("Reservations", ["Check In", "Check Out", "Property", "Status", "Guest", "Nights", "Gross", "Net", "Currency"],
         [(r.check_in, r.check_out, prop_by_id.get(str(r.property_id), ""),
           r.status.value if hasattr(r.status, "value") else r.status,
           r.guest_name or "", r.nights, r.gross_revenue, r.net_revenue, r.currency)
          for r in reservations]),
    ]

    sheet_xml = "".join(
        f"<x:ExcelWorksheet><x:Name>{name}</x:Name>"
        "<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>"
        for name, _, _ in sheets
    )
    tables = "".join(_xls(rows, headers) for _, headers, rows in sheets)
    html = (
        "<html xmlns:x=\"urn:schemas-microsoft-com:office:excel\">"
        "<head><meta charset=\"utf-8\">"
        "<!--[if gte mso 9]><xml><x:ExcelWorkbook>"
        f"<x:ExcelWorksheets>{sheet_xml}</x:ExcelWorksheets>"
        "</x:ExcelWorkbook></xml><![endif]-->"
        "<style>td,th{border:1px solid #ccc;padding:4px 8px;}th{background:#f5f5f5;}</style>"
        f"</head><body>{tables}</body></html>"
    )

    return Response(
        content=html,
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": 'attachment; filename="hostwise-export.xls"'},
    )


@router.post("/wipe")
async def wipe_all_data(
    session: AsyncSession = Depends(get_db),
):
    """Delete all business data (reservations, revenues, expenses, properties)
    so the user can start fresh. Settings and profile are kept."""
    from app.finance.models import Expense, Revenue
    from app.properties.models import Property
    from app.reservations.models import Reservation

    deleted: dict[str, int] = {}
    for model in (Reservation, Revenue, Expense, Property):
        table = model.__tablename__
        count = (await session.execute(select(func.count(model.id)))).scalar() or 0
        await session.execute(delete(model))
        deleted[table] = int(count)
    await session.commit()
    return {"deleted": deleted}
