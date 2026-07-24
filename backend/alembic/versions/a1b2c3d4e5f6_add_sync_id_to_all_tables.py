"""Add sync_id to all tables for future cloud synchronization

Revision ID: a1b2c3d4e5f6
Revises: 2dba478e1d2d
Create Date: 2026-07-22 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '2dba478e1d2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# All tables that inherit from BaseModel
TABLES = [
    "users",
    "organizations",
    "organization_members",
    "properties",
    "listings",
    "revenues",
    "expenses",
    "reservations",
    "guests",
    "revenue_categories",
    "expense_categories",
]


def upgrade() -> None:
    for table in TABLES:
        # Add nullable column first (sa.Uuid works on both PostgreSQL and SQLite)
        op.add_column(
            table,
            sa.Column("sync_id", sa.Uuid, nullable=True),
        )
        # Populate existing rows with Python-generated UUIDs (cross-db safe)
        import uuid as _uuid_mod
        conn = op.get_bind()
        rows = conn.execute(sa.text(f"SELECT id FROM {table}")).fetchall()
        for (row_id,) in rows:
            conn.execute(
                sa.text(f"UPDATE {table} SET sync_id = :sid WHERE id = :rid"),
                {"sid": _uuid_mod.uuid4(), "rid": row_id},
            )
        # Make it NOT NULL and UNIQUE
        op.alter_column(table, "sync_id", nullable=False)
        op.create_unique_constraint(f"uq_{table}_sync_id", table, ["sync_id"])


def downgrade() -> None:
    for table in TABLES:
        op.drop_constraint(f"uq_{table}_sync_id", table, type_="unique")
        op.drop_column(table, "sync_id")
