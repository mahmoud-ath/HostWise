"""
Settings Module — Service

Business logic for reading and updating application settings.
Defaults are merged with stored values so the store stays minimal.
"""
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings.defaults import DEFAULT_SETTINGS
from app.settings.models import Setting


class SettingsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self) -> dict:
        """Return all settings with defaults merged under stored values."""
        result = await self.session.execute(select(Setting))
        stored: dict = {}
        for row in result.scalars():
            try:
                stored[row.key] = json.loads(row.value)
            except (ValueError, TypeError):
                stored[row.key] = row.value
        return {**DEFAULT_SETTINGS, **stored}

    async def get(self, key: str, default=None):
        """Return a single setting (with fallback to default)."""
        all_settings = await self.get_all()
        return all_settings.get(key, default)

    async def update(self, updates: dict) -> dict:
        """Upsert a partial set of settings and return the full merged map."""
        for key, value in updates.items():
            row = await self.session.get(Setting, key)
            if row:
                row.value = json.dumps(value)
            else:
                self.session.add(Setting(key=key, value=json.dumps(value)))
        await self.session.commit()
        return await self.get_all()
