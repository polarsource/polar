from collections.abc import Sequence

from fastapi import APIRouter, Depends

from polar.exceptions import ResourceNotFound
from polar.models import PricingCompany
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session

from .schemas import (
    PricingChangeSchema,
    PricingCompanySchema,
    PricingCompanySummary,
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
