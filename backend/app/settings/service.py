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

# Per-key schema (roadmap 5.3). Each entry is one of:
#   ("bool",)            → coerce to bool
#   ("number", low, high) → coerce to float within [low, high]
#   ("int", low, high)    → coerce to int within [low, high]
#   ("enum", {...allowed}) → must be one of the allowed values
# Unknown keys are stored as-is (forward compatibility).
SETTINGS_SCHEMA: dict[str, tuple] = {
    "profile_name": ("str",),
    "profile_email": ("str",),
    "business_name": ("str",),
    "default_currency": ("enum", {"USD", "EUR", "GBP", "MAD", "AED", "CAD", "AUD", "CHF"}),
    "tax_rate": ("number", 0.0, 100.0),
    "fiscal_year_start": ("int", 1, 12),
    "country": ("str",),
    "timezone": ("str",),
    "date_format": ("enum", {"DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"}),
    "language": ("enum", {"English", "Français", "Español", "العربية", "Deutsch"}),
    "ai_enabled": ("bool",),
    "ai_provider": ("enum", {"hostwise", "openai", "deepseek", "anthropic", "ollama"}),
    "ai_base_url": ("str",),
    "ai_model": ("str",),
    "ai_analysis_level": ("enum", {"summary", "detailed", "expert"}),
    "ai_automatic_analysis": ("enum", {"daily", "weekly", "monthly", "off"}),
    "ai_language": ("enum", {"English", "Français", "Español", "العربية", "Deutsch"}),
    "notify_profit_drops": ("bool",),
    "notify_revenue_increase": ("bool",),
    "notify_occupancy_falls": ("bool",),
    "notify_backup_completed": ("bool",),
    "notify_monthly_report": ("bool",),
    "appearance_theme": ("enum", {"light", "dark", "system"}),
    "appearance_compact": ("bool",),
    "appearance_animations": ("bool",),
    "dashboard_show_ai_summary": ("bool",),
    "dashboard_show_forecast": ("bool",),
    "import_encoding": ("enum", {"UTF-8", "ISO-8859-1", "Windows-1252", "UTF-16"}),
    "import_delimiter": ("str",),
    "import_date_format": ("enum", {"DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"}),
    "report_default_format": ("enum", {"pdf", "print"}),
    "report_auto_generate": ("enum", {"off", "daily", "weekly", "monthly"}),
    "report_send_email": ("bool",),
}

_KNOWN_BOOL_KEYS = {k for k, v in SETTINGS_SCHEMA.items() if v[0] == "bool"}


def validate_setting(key: str, value):
    """Coerce/validate a single setting against the schema (roadmap 5.3).

    Returns the coerced value, or raises ValidationException for invalid input.
    Unknown keys pass through unchanged.
    """
    spec = SETTINGS_SCHEMA.get(key)
    if spec is None:
        return value
    kind = spec[0]
    try:
        if kind == "bool":
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.strip().lower() in ("1", "true", "yes", "on")
            return bool(value)
        if kind in ("number", "int"):
            num = float(value)
            low, high = spec[1], spec[2]
            if num < low or num > high:
                raise ValidationException(
                    f"Setting '{key}' must be between {low} and {high}."
                )
            return int(num) if kind == "int" else num
        if kind == "enum":
            allowed = spec[1]
            s = str(value).strip()
            if s not in allowed:
                raise ValidationException(
                    f"Setting '{key}' must be one of: {', '.join(sorted(allowed))}."
                )
            return s
        if kind == "str":
            return str(value)
    except (ValueError, TypeError):
        raise ValidationException(f"Setting '{key}' has an invalid value.")
    return value


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
        """Upsert a partial set of settings and return the full merged map.

        Values are validated against `SETTINGS_SCHEMA` (roadmap 5.3); invalid
        values raise ValidationException (422) instead of corrupting the store.
        """
        for key, value in updates.items():
            if key == "ai_api_key":
                value = self._normalize_api_key(value)
                if value is _SKIP:
                    continue  # masked placeholder → keep the stored secret
            if key == "ai_base_url":
                self._validate_base_url(value)
            value = validate_setting(key, value)
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
