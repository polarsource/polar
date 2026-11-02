from typing import Annotated

from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Catalog
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth
from .schemas import Catalog as CatalogSchema
from .schemas import CatalogListParams, CatalogVersion
from .service import catalog as catalog_service

router = APIRouter(prefix="/catalogs", tags=["catalogs", APITag.private])


@router.get(
    "/",
    summary="List Catalogs",
    response_model=ListResource[CatalogSchema],
)
async def list(
    filters: Annotated[CatalogListParams, Query()],
    auth_subject: auth.CatalogRead,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CatalogSchema]:
    """List the catalogs of organizations using config as code, newest first."""
    results, count = await catalog_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        status=filters.status,
        published_after=filters.published_after,
        published_before=filters.published_before,
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
) -> Catalog:
    """Get a catalog version and the products in it."""
    catalog = await catalog_service.get(session, auth_subject, id)
    if catalog is None:
        raise ResourceNotFound()
    return catalog
