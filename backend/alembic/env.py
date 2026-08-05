"""
Alembic Environment Configuration

Handles database migrations for the modular monolith.
All models must be imported here for Alembic to detect them.
"""
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from app.core.config import get_settings
from app.core.database import Base
from app.auth.models import User
from app.properties.models import Property, Listing
from app.reservations.models import Reservation, Guest
from app.finance.models import Revenue, Expense
from app.finance.category_models import ExpenseCategory, RevenueCategory

# Alembic Config object
config = context.config

# Point Alembic at the SAME database the app uses (SQLite for the desktop
# build, Postgres for cloud) instead of the placeholder in alembic.ini.
_settings = get_settings()
if _settings.DATABASE_TYPE == "sqlite":
    _url = f"sqlite:///{_settings.SQLITE_PATH.replace(chr(92), '/')}"
else:
    _url = _settings.DATABASE_URL
config.set_main_option("sqlalchemy.url", _url)

# Logger
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
