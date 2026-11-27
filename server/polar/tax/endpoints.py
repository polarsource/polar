from typing import Annotated

from fastapi import Depends, Query

from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import (
    TaxJurisdiction,
    TaxReportParams,
    TaxSummary,
)
from .service import tax as tax_service

router = APIRouter(prefix="/taxes", tags=["taxes", APITag.private])


@router.get(
    "/jurisdictions",
    summary="List Tax Jurisdictions",
    response_model=ListResource[TaxJurisdiction],
)
async def list_jurisdictions(
    filters: Annotated[TaxReportParams, Query()],
    auth_subject: auth.TaxRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[TaxJurisdiction]:
    results, count = await tax_service.list_jurisdictions(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(results, count, pagination)


@router.get(
    "/summary",
    summary="Get Tax Summary",
    response_model=TaxSummary,
)
async def get_summary(
    filters: Annotated[TaxReportParams, Query()],
    auth_subject: auth.TaxRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> TaxSummary:
    return await tax_service.get_summary(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
    )
