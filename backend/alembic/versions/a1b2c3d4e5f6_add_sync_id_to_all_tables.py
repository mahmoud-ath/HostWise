"""Baseline migration — the schema is bootstrapped by create_all.

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-07-22 00:00:00.000000

The desktop app creates the schema with `Base.metadata.create_all` at startup,
so this baseline revision intentionally does nothing and represents
"schema == current models". Future migrations build on this revision.
"""
from typing import Sequence, Union


# revision identifiers
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
