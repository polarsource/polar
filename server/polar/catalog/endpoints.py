from fastapi import Depends, Query
from pydantic import UUID4, AwareDatetime

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models.catalog import CatalogStatus
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth
from .schemas import Catalog as CatalogSchema
from .schemas import CatalogVersion
from .service import catalog as catalog_service

router = APIRouter(prefix="/catalogs", tags=["catalogs", APITag.private])


@router.get(
    "/",
    summary="List Catalogs",
    response_model=ListResource[CatalogSchema],
)
async def list(
    auth_subject: auth.CatalogRead,
    pagination: PaginationParamsQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    status: MultipleQueryFilter[CatalogStatus] | None = Query(
        None, title="Status Filter", description="Filter by catalog status."
    ),
    published_after: AwareDatetime | None = Query(
        None,
        description=(
            "Only include catalogs published after this date. "
            "Must include a UTC offset."
        ),
    ),
    published_before: AwareDatetime | None = Query(
        None,
        description=(
            "Only include catalogs published before this date. "
            "Must include a UTC offset."
        ),
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CatalogSchema]:
    """List the catalogs of organizations using config as code, newest first."""
    results, count = await catalog_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        status=status,
        published_after=published_after,
        published_before=published_before,
        pagination=pagination,
    )
    return ListResource.from_paginated_results(
        [CatalogSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


CatalogNotFound = {
    "description": "Catalog not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/{id}",
    summary="Get Catalog",
    response_model=CatalogVersion,
    responses={404: CatalogNotFound},
)
async def get(
    id: UUID4,
    auth_subject: auth.CatalogRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CatalogVersion:
    """Get a catalog version and the products in it."""
    catalog = await catalog_service.get(session, auth_subject, id)
    if catalog is None:
        raise ResourceNotFound()
    return await catalog_service.get_version(session, catalog)
