"""
Properties Module — Repository
"""
import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.properties.models import Listing, Property
from app.shared.base_repository import BaseRepository


class PropertyRepository(BaseRepository[Property]):
    def __init__(self, session: AsyncSession):
        super().__init__(Property, session)

    async def get_by_id_with_listings(self, id: uuid.UUID) -> Property | None:
        result = await self.session.execute(
            select(Property)
            .options(selectinload(Property.listings))
            .where(Property.id == id, Property.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def get_all_properties(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Property]:
        result = await self.session.execute(
            select(Property)
            .options(selectinload(Property.listings))
            .where(Property.is_deleted == False)
            .order_by(Property.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def count_all(self) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Property)
            .where(Property.is_deleted == False)
        )
        return result.scalar() or 0


class ListingRepository(BaseRepository[Listing]):
    def __init__(self, session: AsyncSession):
        super().__init__(Listing, session)

    async def get_property_listings(self, property_id: uuid.UUID) -> Sequence[Listing]:
        result = await self.session.execute(
            select(Listing).where(
                Listing.property_id == property_id,
                Listing.is_deleted == False,
            )
        )
        return result.scalars().all()
