"""
AI Module — Router
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.ai.service import AIAdvisorService, get_ai_advisor_service

router = APIRouter()

ALLOWED_SCENARIOS = {
    "price_increase",
    "hire_cleaner",
    "expense_reduction",
    "minimum_stay",
}


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    year: int | None = None


class ScenarioRequest(BaseModel):
    scenario: str
    params: dict = {}
    year: int | None = None


@router.get("/analyze")
async def analyze_financial_performance(
    service: AIAdvisorService = Depends(get_ai_advisor_service),
):
    """AI-driven financial performance analysis with recommendations."""
    return await service.analyze_financial_performance()


@router.get("/advisor")
async def get_advisor_report(
    year: int | None = Query(None, ge=2020, le=2100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    service: AIAdvisorService = Depends(get_ai_advisor_service),
):
    """
    Comprehensive AI advisor dashboard: executive summary, business
    health, priority actions, opportunities, lost revenue, risks,
    property reviews, 30-day forecast, achievements, goals.

    Either `year` (defaults to the current year) or a `start_date`/`end_date`
    pair selects the reporting period.
    """
    if (start_date is None) != (end_date is None):
        raise HTTPException(
            status_code=422,
            detail="start_date and end_date must be provided together",
        )
    return await service.generate_advisor_report(year, start_date, end_date)


@router.post("/chat")
async def chat_with_advisor(
    data: ChatRequest,
    service: AIAdvisorService = Depends(get_ai_advisor_service),
):
    """Ask HostWise AI a natural-language question about your portfolio."""
    year = data.year or date.today().year
    return await service.answer_question(data.question, year)


@router.post("/test-connection")
async def test_ai_connection(
    service: AIAdvisorService = Depends(get_ai_advisor_service),
):
    """Validate the configured BYOK LLM connection."""
    return await service.test_llm_connection()


@router.post("/scenario")
async def run_scenario(
    data: ScenarioRequest,
    service: AIAdvisorService = Depends(get_ai_advisor_service),
):
    """Simulate a 'what-if' scenario and estimate its financial impact."""
    if data.scenario not in ALLOWED_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario. Allowed: {sorted(ALLOWED_SCENARIOS)}",
        )
    year = data.year or date.today().year
    return await service.simulate_scenario(data.scenario, data.params, year)
