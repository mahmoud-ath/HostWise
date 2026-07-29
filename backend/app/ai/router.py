"""
AI Module — Router
"""
import uuid

from fastapi import APIRouter, Depends

from app.ai.service import AIAdvisorService, get_ai_advisor_service

router = APIRouter()


@router.get("/{org_id}/analyze")
async def analyze_financial_performance(
    org_id: str,
    service: AIAdvisorService = Depends(get_ai_advisor_service),
):
    """AI-driven financial performance analysis with recommendations."""
    return await service.analyze_financial_performance(uuid.UUID(org_id))
