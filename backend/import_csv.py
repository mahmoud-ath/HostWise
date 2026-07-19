"""
CSV Import Script — Import reservations, revenues, and expenses from CSV files.
Maps CSV property IDs (P001, P002, P003) to database UUIDs.
"""
import asyncio, csv, uuid
from datetime import datetime, date
from app.core.database import async_session_factory
from app.properties.models import Property, PropertyType
from app.reservations.models import Reservation, ReservationStatus, ReservationSource
from app.finance.models import Revenue, Expense, RevenueSource

ORG_ID = uuid.UUID("2fed18f2-e4c5-46c1-a1d9-811f87cfaf14")

async def import_all():
    async with async_session_factory() as session:
        # ── Step 1: Create CSV properties and map IDs ──
        prop_map = {}
        csv_props = [
            ("P001", "Ocean View Apartment", "Tangier", "MA", "apartment"),
            ("P002", "Medina Riad", "Marrakech", "MA", "riad"),
            ("P003", "Beach Studio", "Agadir", "MA", "studio"),
        ]
        for pid, name, city, country, ptype in csv_props:
            prop = Property(
                organization_id=ORG_ID, name=name, city=city, country=country,
                type=PropertyType(ptype) if ptype in [e.value for e in PropertyType] else PropertyType.OTHER,
                bedrooms=1, bathrooms=1, max_guests=2,
            )
            session.add(prop)
            await session.flush()
            prop_map[pid] = prop.id
            print(f"  Property: {name} ({pid} → {prop.id})")

        await session.flush()

        # ── Step 2: Import reservations ──
        res_map = {}  # CSV reservation_id → DB UUID
        with open("uploads/reservations.csv") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = row["property_id"].strip()
                prop_id = prop_map.get(pid)
                if not prop_id:
                    print(f"  SKIP reservation {row['reservation_id']}: unknown property {pid}")
                    continue

                status_map = {"Confirmed": ReservationStatus.CONFIRMED, "Cancelled": ReservationStatus.CANCELLED,
                              "Completed": ReservationStatus.COMPLETED}
                status = status_map.get(row.get("status", "Confirmed"), ReservationStatus.CONFIRMED)
                check_in = datetime.strptime(row["check_in"].strip(), "%Y-%m-%d").date()
                check_out = datetime.strptime(row["check_out"].strip(), "%Y-%m-%d").date()
                nights = int(row["nights"].strip())
                gross = float(row["gross_amount"].strip())

                res = Reservation(
                    organization_id=ORG_ID, property_id=prop_id,
                    confirmation_code=row["reservation_id"].strip(),
                    status=status, source=ReservationSource.CSV,
                    check_in=check_in, check_out=check_out, nights=nights,
                    guest_name=row.get("guest_country", "").strip() or None,
                    gross_revenue=gross, net_revenue=gross * 0.85,
                    cleaning_fee=0, platform_fee=gross * 0.15, taxes=0,
                    currency="USD", number_of_guests=2,
                    property_name=row.get("property_name", "").strip(),
                    property_city=row.get("city", "").strip(),
                )
                session.add(res)
                await session.flush()
                res_map[row["reservation_id"].strip()] = res.id

        print(f"  Imported {len(res_map)} reservations")

        # ── Step 3: Import revenues ──
        rev_count = 0
        with open("uploads/revenues.csv") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = row["property_id"].strip()
                prop_id = prop_map.get(pid)
                if not prop_id:
                    continue

                res_id = res_map.get(row["reservation_id"].strip())
                rev_date = datetime.strptime(row["date"].strip(), "%Y-%m-%d").date()
                gross = float(row["gross_revenue"].strip())
                comm = float(row["management_commission"].strip())
                net = float(row["net_revenue"].strip())
                source_str = row.get("source", "Airbnb").strip().lower()
                source_map = {"airbnb": RevenueSource.AIRBNB, "booking": RevenueSource.BOOKING,
                              "direct": RevenueSource.DIRECT, "csv": RevenueSource.CSV}
                source = source_map.get(source_str, RevenueSource.CSV)

                rev = Revenue(
                    organization_id=ORG_ID, property_id=prop_id, reservation_id=res_id,
                    date=rev_date, gross_amount=gross, commission_amount=comm,
                    net_amount=net, source=source, currency="USD",
                )
                session.add(rev)
                rev_count += 1

        print(f"  Imported {rev_count} revenue records")

        # ── Step 4: Import expenses ──
        exp_count = 0
        with open("uploads/expenses.csv") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = row["property_id"].strip()
                prop_id = prop_map.get(pid)
                if not prop_id:
                    continue

                exp_date = datetime.strptime(row["date"].strip(), "%Y-%m-%d").date()
                amount = float(row["amount"].strip())
                category = row.get("category", "").strip()

                exp = Expense(
                    organization_id=ORG_ID, property_id=prop_id,
                    date=exp_date, amount=amount, currency="USD",
                    description=category, vendor=None,
                )
                session.add(exp)
                exp_count += 1

        print(f"  Imported {exp_count} expense records")

        await session.commit()
        print("\n✅ Import complete!")

if __name__ == "__main__":
    asyncio.run(import_all())
