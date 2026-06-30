from collections.abc import Sequence

from fastapi import APIRouter, Depends, Query

from polar.exceptions import ResourceNotFound
from polar.models import PricingCompany
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session

from .schemas import (
    PriceComparisonRow,
    PricingChangeSchema,
    PricingCompanySchema,
    PricingCompanySummary,
    PricingFeatureRow,
)
from .service import pricing_directory as pricing_directory_service

router = APIRouter(
    prefix="/pricing-directory", tags=["pricing_directory", APITag.private]
)


@router.get("/companies", response_model=list[PricingCompanySummary])
async def list_companies(
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[PricingCompany]:
    return await pricing_directory_service.list_companies(session)


@router.get("/changes", response_model=list[PricingChangeSchema])
async def list_changes(
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[PricingChangeSchema]:
    return await pricing_directory_service.list_recent_changes(session)


@router.get("/compare", response_model=list[PriceComparisonRow])
async def compare(
    unit: str | None = Query(
        default=None, description="Exact unit to compare, e.g. 'tokens'."
    ),
    q: str | None = Query(
        default=None,
        description="Free-text concept to match on unit/label, e.g. 'workspace'.",
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[PriceComparisonRow]:
    return await pricing_directory_service.list_metrics(
        session, unit=unit, query=q
    )


@router.get("/features", response_model=list[PricingFeatureRow])
async def list_features(
    category: str | None = Query(
        default=None, description="Filter by feature theme, e.g. 'access_control'."
    ),
    key: str | None = Query(
        default=None, description="Filter by normalized feature key, e.g. 'sso'."
    ),
    q: str | None = Query(
        default=None, description="Free-text search over feature name/key."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[PricingFeatureRow]:
    return await pricing_directory_service.list_features(
        session, category=category, key=key, query=q
    )


@router.get(
    "/companies/{slug}",
    response_model=PricingCompanySchema,
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_company(
    slug: str,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> PricingCompany:
    company = await pricing_directory_service.get_company(session, slug)
    if company is None:
        raise ResourceNotFound("Company not found.")
    return company
