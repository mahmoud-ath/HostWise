"""
Connectors Module — Base Interface & CSV Connector

Every data source connector must implement this interface.
The rest of the application never depends on a specific provider.
"""
from abc import ABC, abstractmethod
import uuid
from typing import Protocol


class ConnectorInterface(ABC):
    """
    Contract for all data source connectors.

    Every connector — CSV, Airbnb, Booking, Vrbo, iCal — implements this.
    The application calls these methods without knowing the provider.
    """

    @abstractmethod
    async def import_properties(self, organization_id: uuid.UUID) -> list[dict]:
        """Import properties from the data source."""
        ...

    @abstractmethod
    async def import_reservations(self, organization_id: uuid.UUID) -> list[dict]:
        """Import reservations/calendar from the data source."""
        ...

    @abstractmethod
    async def import_revenue(self, organization_id: uuid.UUID) -> list[dict]:
        """Import revenue records."""
        ...

    @abstractmethod
    async def import_expenses(self, organization_id: uuid.UUID) -> list[dict]:
        """Import expense records."""
        ...


class CSVConnector(ConnectorInterface):
    """
    CSV import connector.

    Supports importing reservations, revenue, and expenses from CSV files.
    This is the primary MVP data input method.
    """

    def __init__(self, file_path: str):
        self.file_path = file_path

    async def import_properties(self, organization_id: uuid.UUID) -> list[dict]:
        """CSV property import — placeholder for now."""
        return []

    async def import_reservations(self, organization_id: uuid.UUID) -> list[dict]:
        """Parse reservations from CSV."""
        import csv
        reservations = []
        with open(self.file_path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Normalize: map CSV columns to internal Reservation model
                reservations.append(self._normalize_reservation(row, organization_id))
        return reservations

    async def import_revenue(self, organization_id: uuid.UUID) -> list[dict]:
        return []

    async def import_expenses(self, organization_id: uuid.UUID) -> list[dict]:
        return []

    def _normalize_reservation(self, row: dict, org_id: uuid.UUID) -> dict:
        """
        Normalize CSV row to internal schema.
        Maps provider-specific column names to our domain model.
        """
        from datetime import datetime
        return {
            "organization_id": str(org_id),
            "confirmation_code": row.get("confirmation_code", row.get("Confirmation Code", "")),
            "guest_name": row.get("guest_name", row.get("Guest Name", "")),
            "check_in": row.get("check_in", row.get("Check-in", "")),
            "check_out": row.get("check_out", row.get("Check-out", "")),
            "nights": int(row.get("nights", row.get("Nights", 0))),
            "gross_revenue": float(row.get("gross_revenue", row.get("Amount", 0))),
            "cleaning_fee": float(row.get("cleaning_fee", row.get("Cleaning Fee", 0))),
            "status": row.get("status", "confirmed"),
            "source": "csv",
        }


class ConnectorRegistry:
    """
    Registry of available connectors.
    Add new connectors here as they're built.
    """

    _connectors: dict[str, type[ConnectorInterface]] = {
        "csv": CSVConnector,
        # Future:
        # "airbnb": AirbnbConnector,
        # "booking": BookingConnector,
        # "vrbo": VrboConnector,
        # "ical": ICalConnector,
    }

    @classmethod
    def get(cls, name: str) -> type[ConnectorInterface]:
        if name not in cls._connectors:
            raise ValueError(f"Unknown connector: {name}")
        return cls._connectors[name]

    @classmethod
    def list_available(cls) -> list[str]:
        return list(cls._connectors.keys())
