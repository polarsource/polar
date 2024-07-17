from fastapi import Depends, Query

from polar.enums import Platforms
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import ExternalOrganization
from .service import external_organization as external_organization_service

router = APIRouter(
    prefix="/external-organizations", tags=["external_organizations", APITag.documented]
)

ExternalOrganizationNotFound = {
    "description": "External Organization not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List External Organizations",
    response_model=ListResource[ExternalOrganization],
)
async def list(
    auth_subject: auth.ExternalOrganizationsReadOrAnonymous,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    name: str | None = Query(None, description="Filter by name."),
    platform: Platforms | None = Query(None, description="Filter by platform."),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[ExternalOrganization]:
    """List external organizations."""
    results, count = await external_organization_service.list(
        session,
        auth_subject,
        name=name,
        platform=platform,
        organization_id=organization_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [ExternalOrganization.model_validate(result) for result in results],
        count,
        pagination,
    )
