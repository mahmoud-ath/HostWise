"""
Default application settings.

These are merged with any values stored in the database, so users only
persist the settings they actually change. New defaults added here are
picked up automatically.
"""

DEFAULT_SETTINGS: dict = {
    # ── Business ──
    "profile_name": "",
    "profile_email": "",
    "business_name": "HostWise",
    "default_currency": "EUR",
    "tax_rate": 20.0,
    "fiscal_year_start": 1,  # month (1-12)
    "country": "",
    # ── Profile / localization ──
    "timezone": "UTC",
    "date_format": "DD/MM/YYYY",
    "language": "English",
    # ── AI ──
    "ai_enabled": True,
    "ai_provider": "hostwise",
    "ai_api_key": "",
    "ai_base_url": "https://api.openai.com/v1",
    "ai_model": "gpt-4o-mini",
    "ai_analysis_level": "detailed",
    "ai_automatic_analysis": "daily",
    "ai_language": "English",
    # ── Notifications ──
    "notify_profit_drops": True,
    "notify_revenue_increase": True,
    "notify_occupancy_falls": True,
    "notify_backup_completed": True,
    "notify_monthly_report": True,
    # ── Appearance ──
    "appearance_theme": "light",
    "appearance_accent": "default",
    "appearance_compact": False,
    "appearance_animations": True,
    # ── Dashboard ──
    "dashboard_default": "financial",
    "dashboard_show_ai_summary": True,
    "dashboard_show_forecast": True,
    "dashboard_default_year": "current",
    # ── Import ──
    "import_encoding": "UTF-8",
    "import_delimiter": ",",
    "import_date_format": "DD/MM/YYYY",
    # ── Reports ──
    "report_default": "annual",
    "report_default_format": "pdf",
    "report_auto_generate": "monthly",
    "report_send_email": False,
}
