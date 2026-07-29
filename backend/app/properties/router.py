"""
Properties Module — Router
"""
import uuid

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.auth.models import User
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


@router.post("/{org_id}", response_model=PropertyResponse, status_code=201)
async def create_property(
    org_id: uuid.UUID,
    data: PropertyCreateRequest,
    current_user: User = Depends(get_current_user),
    service: PropertyService = Depends(get_property_service),
):
    return await service.create(org_id, data)


@router.get("/{org_id}", response_model=list[PropertyDetailResponse])
async def list_properties(
    org_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: PropertyService = Depends(get_property_service),
):
    items, _ = await service.list_organization(org_id, skip, limit)
    return items


@router.get("/detail/{property_id}", response_model=PropertyDetailResponse)
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
