"""
Settings Module — Service

Business logic for reading and updating application settings.
Defaults are merged with stored values so the store stays minimal.
"""
import json
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings.defaults import DEFAULT_SETTINGS
from app.settings.models import Setting
from app.shared.exceptions import ValidationException

# Marker used by the API-key masking (roadmap 4.3). Contains a bullet so it can
# never collide with a real key, and lets the client round-trip settings back
# without clobbering the stored secret.
MASK_FULL = "••••••••"
MASKED_PREFIX = "••"

# Sentinel returned by `_normalize_api_key` for a masked placeholder.
_SKIP = object()


def mask_secret(value: str) -> str:
    """Mask an API key for display: keep first 4 + last 4 when long enough."""
    value = (value or "").strip()
    if not value:
        return ""
    if len(value) <= 8:
        return MASK_FULL
    return f"{value[:4]}{'•' * 4}{value[-4:]}"


class SettingsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _get_raw(self) -> dict:
        """All settings merged, WITHOUT masking secrets (server-side only)."""
        result = await self.session.execute(select(Setting))
        stored: dict = {}
        for row in result.scalars():
            try:
                stored[row.key] = json.loads(row.value)
            except (ValueError, TypeError):
                stored[row.key] = row.value
        return {**DEFAULT_SETTINGS, **stored}

    async def get_all(self) -> dict:
        """Public settings — API keys are masked (roadmap 4.3)."""
        merged = await self._get_raw()
        key = merged.get("ai_api_key", "")
        if key:
            merged["ai_api_key"] = mask_secret(key)
        return merged

    async def get_all_internal(self) -> dict:
        """Server-side settings — includes the real API key. Use only in
        backend services that actually call the provider (never the router)."""
        return await self._get_raw()

    async def get(self, key: str, default=None):
        """Return a single setting (with fallback to default)."""
        all_settings = await self.get_all()
        return all_settings.get(key, default)

    async def update(self, updates: dict) -> dict:
        """Upsert a partial set of settings and return the full merged map."""
        for key, value in updates.items():
            if key == "ai_api_key":
                value = self._normalize_api_key(value)
                if value is _SKIP:
                    continue  # masked placeholder → keep the stored secret
            if key == "ai_base_url":
                self._validate_base_url(value)
            row = await self.session.get(Setting, key)
            if row:
                row.value = json.dumps(value)
            else:
                self.session.add(Setting(key=key, value=json.dumps(value)))
        await self.session.commit()
        return await self.get_all()

    # ── Secret handling (roadmap 4.3) ─────────────────────
    @staticmethod
    def _normalize_api_key(value):
        """A masked placeholder means 'keep the stored key'; empty clears it."""
        if value is None:
            return ""
        s = str(value).strip()
        if not s:
            return ""  # clear
        if MASKED_PREFIX in s:
            return _SKIP  # masked placeholder → don't overwrite
        return s

    @staticmethod
    def _validate_base_url(value) -> None:
        """Reject non-http(s) or host-less base URLs (provider guard)."""
        if value is None or str(value).strip() == "":
            return  # empty is allowed — the provider default is used
        parsed = urlparse(str(value).strip())
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValidationException(
                "AI base URL must be a valid http(s) URL with a host (e.g. "
                "https://api.openai.com/v1)."
            )
