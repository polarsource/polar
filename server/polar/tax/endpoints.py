from datetime import date

from fastapi import Depends, Query

from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import TaxJurisdiction
from .service import tax as tax_service

router = APIRouter(prefix="/taxes", tags=["taxes", APITag.private])


@router.get(
    "/jurisdictions",
    summary="List Tax Jurisdictions",
    response_model=ListResource[TaxJurisdiction],
)
async def list_jurisdictions(
    auth_subject: auth.TaxRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    start_date: date | None = Query(
        None,
        description="Only include tax remitted on or after this date.",
    ),
    end_date: date | None = Query(
        None,
        description="Only include tax remitted on or before this date.",
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[TaxJurisdiction]:
    results, count = await tax_service.list_jurisdictions(
        session,
        auth_subject,
        organization_id=organization_id,
        start_date=start_date,
        end_date=end_date,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(results, count, pagination)
