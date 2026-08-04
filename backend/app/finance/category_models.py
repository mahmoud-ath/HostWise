"""
Finance Module — Category Models

Configurable revenue and expense categories.
These were previously part of the organizations module.
"""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base_model import BaseModel


class RevenueCategory(BaseModel):
    """Configurable revenue categories."""
    __tablename__ = "revenue_categories"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)


class ExpenseCategory(BaseModel):
    """Configurable expense categories."""
    __tablename__ = "expense_categories"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
