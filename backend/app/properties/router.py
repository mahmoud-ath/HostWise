"""
Properties Module — Router
"""
import uuid

from fastapi import APIRouter, Depends, Query

from app.properties.schemas import (
    ListingCreateRequest,
    ListingResponse,
    PropertyCreateRequest,
    PropertyDetailResponse,
    PropertyResponse,
    PropertyUpdateRequest,
)
from app.properties.service import (
    ListingService,
    PropertyService,
    get_listing_service,
    get_property_service,
)

router = APIRouter()


@router.post("", response_model=PropertyResponse, status_code=201)
async def create_property(
    data: PropertyCreateRequest,
    service: PropertyService = Depends(get_property_service),
):
    return await service.create(data)


@router.get("", response_model=list[PropertyDetailResponse])
async def list_properties(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: PropertyService = Depends(get_property_service),
):
    items, _ = await service.list_all(skip, limit)
    return items


@router.get("/{property_id}", response_model=PropertyDetailResponse)
async def get_property(
    property_id: uuid.UUID,
    service: PropertyService = Depends(get_property_service),
):
    return await service.get_by_id(property_id)


@router.patch("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: uuid.UUID,
    data: PropertyUpdateRequest,
    service: PropertyService = Depends(get_property_service),
):
    return await service.update(property_id, data)


@router.delete("/{property_id}", status_code=204)
async def delete_property(
    property_id: uuid.UUID,
    service: PropertyService = Depends(get_property_service),
):
    """Delete a property (soft delete)."""
    await service.delete(property_id)


# Listings
@router.post("/{property_id}/listings", response_model=ListingResponse, status_code=201)
async def create_listing(
    property_id: uuid.UUID,
    data: ListingCreateRequest,
    service: ListingService = Depends(get_listing_service),
):
    return await service.create(property_id, data)


@router.get("/{property_id}/listings", response_model=list[ListingResponse])
async def list_property_listings(
    property_id: uuid.UUID,
    service: ListingService = Depends(get_listing_service),
):
    return await service.list_for_property(property_id)
