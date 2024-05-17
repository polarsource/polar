from fastapi import Depends, Query
from pydantic import UUID4

from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import Sale as SaleSchema
from .schemas import SalesStatistics
from .service import sale as sale_service

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/", response_model=ListResource[SaleSchema], tags=[Tags.PUBLIC])
async def list_sales(
    auth_subject: auth.SalesRead,
    pagination: PaginationParamsQuery,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SaleSchema]:
    """List sales."""
    results, count = await sale_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [SaleSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/statistics", response_model=SalesStatistics, tags=[Tags.PUBLIC])
async def get_sales_statistics(
    auth_subject: auth.SalesRead,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    product_id: UUID4 | None = Query(None, description="Filter by product ID."),
    session: AsyncSession = Depends(get_db_session),
) -> SalesStatistics:
    """Get monthly data about your sales and earnings."""
    periods = await sale_service.get_statistics_periods(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
    )
    return SalesStatistics(periods=periods)
