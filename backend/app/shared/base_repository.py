"""
Shared Base Repository

Generic CRUD operations. Every domain repository extends this.
Never depend on a specific ORM implementation outside repositories.
"""
import uuid
from collections.abc import Sequence
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.base_model import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)


class BaseRepository(Generic[ModelType]):
    """
    Generic repository with standard CRUD operations.

    Usage:
        class PropertyRepository(BaseRepository[Property]):
            def __init__(self, session: AsyncSession):
                super().__init__(Property, session)
    """

    def __init__(self, model: type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def get_by_id(self, id: uuid.UUID) -> ModelType | None:
        result = await self.session.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.is_deleted == False,
            )
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        organization_id: uuid.UUID | None = None,
    ) -> Sequence[ModelType]:
        stmt = select(self.model).where(self.model.is_deleted == False)
        if organization_id and hasattr(self.model, "organization_id"):
            stmt = stmt.where(self.model.organization_id == organization_id)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, obj: ModelType) -> ModelType:
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def update(self, obj: ModelType) -> ModelType:
        await self.session.flush()
        return obj

    async def hard_delete(self, id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.is_deleted == False,
            )
        )
        obj = result.scalar_one_or_none()
        if obj:
            await self.session.delete(obj)
            await self.session.flush()
            return True
        return False
