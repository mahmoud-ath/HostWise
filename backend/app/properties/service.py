"""
Properties Module — Service Layer
"""
import uuid
from datetime import datetime

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.properties.models import Listing, Property
from app.properties.repository import ListingRepository, PropertyRepository
from app.properties.schemas import (
    ListingCreateRequest,
    ListingResponse,
    PropertyCreateRequest,
    PropertyDetailResponse,
    PropertyResponse,
    PropertyUpdateRequest,
)
from app.shared.exceptions import NotFoundException


class PropertyService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = PropertyRepository(session)

    async def create(
        self, data: PropertyCreateRequest
    ) -> PropertyResponse:
        prop = Property(**data.model_dump())
        prop = await self.repo.create(prop)
        return PropertyResponse.model_validate(prop)

    async def get_by_id(self, property_id: uuid.UUID) -> PropertyDetailResponse:
        prop = await self.repo.get_by_id_with_listings(property_id)
        if not prop:
            raise NotFoundException("Property", str(property_id))
        return PropertyDetailResponse.model_validate(prop)

    async def list_all(
        self, skip: int = 0, limit: int = 100
    ) -> tuple[list[PropertyDetailResponse], int]:
        props = await self.repo.get_all_properties(skip, limit)
        total = await self.repo.count_all()
        items = [PropertyDetailResponse.model_validate(p) for p in props]
        return items, total

    async def update(
        self, property_id: uuid.UUID, data: PropertyUpdateRequest
    ) -> PropertyResponse:
        prop = await self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundException("Property", str(property_id))
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(prop, field, value)
        return PropertyResponse.model_validate(prop)

    async def delete(self, property_id: uuid.UUID) -> None:
        """Soft-delete a property and its related records.

        Listings, reservations, revenues, and expenses linked to this
        property are soft-deleted too, so no orphaned financial data
        remains after the property is removed.
        """
        prop = await self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundException("Property", str(property_id))

        from sqlalchemy import update

        from app.finance.models import Expense, Revenue
        from app.reservations.models import Reservation

        now = datetime.utcnow()
        prop.is_deleted = True
        prop.deleted_at = now

        # Cascade soft-delete everything tied to this property.
        for model in (Listing, Reservation, Revenue, Expense):
            await self.session.execute(
                update(model)
                .where(
                    model.property_id == property_id,
                    model.is_deleted == False,
                )
                .values(is_deleted=True, deleted_at=now)
            )

        await self.session.flush()


class ListingService:
    def __init__(self, session: AsyncSession):
        self.repo = ListingRepository(session)

    async def create(
        self, property_id: uuid.UUID, data: ListingCreateRequest
    ) -> ListingResponse:
        listing = Listing(property_id=property_id, **data.model_dump())
        listing = await self.repo.create(listing)
        return ListingResponse.model_validate(listing)

    async def list_for_property(self, property_id: uuid.UUID) -> list[ListingResponse]:
        listings = await self.repo.get_property_listings(property_id)
        return [ListingResponse.model_validate(l) for l in listings]


async def get_property_service(session: AsyncSession = Depends(get_db)) -> PropertyService:
    return PropertyService(session)


async def get_listing_service(session: AsyncSession = Depends(get_db)) -> ListingService:
    return ListingService(session)
