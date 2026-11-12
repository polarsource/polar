import builtins
from typing import Annotated

from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Catalog
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth
from .schemas import Catalog as CatalogSchema
from .schemas import (
    CatalogListParams,
    CatalogVersion,
    RemovedCatalogItem,
    RemovedCatalogItemsParams,
)
from .service import CatalogNotDraft, CatalogNotFound
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


@router.get(
    "/removed",
    summary="List Removed Catalog Items",
    response_model=builtins.list[RemovedCatalogItem],
)
async def list_removed(
    filters: Annotated[RemovedCatalogItemsParams, Query()],
    auth_subject: auth.CatalogRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> builtins.list[RemovedCatalogItem]:
    """List the products and benefits a published catalog listed but the live
    one doesn't, newest removal first. They're deprecated while customers still
    use them, and removed once nobody does."""
    return await catalog_service.list_removed(
        session, auth_subject, filters.organization_id
    )


CatalogNotFoundResponse = {
    "description": "Catalog not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/{id}",
    summary="Get Catalog",
    response_model=CatalogVersion,
    responses={404: CatalogNotFoundResponse},
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


@router.post(
    "/{id}/publish",
    summary="Publish Draft Catalog",
    response_model=CatalogSchema,
    responses={
        404: {
            "description": "No catalog with this ID.",
            "model": CatalogNotFound.schema(),
        },
        409: {
            "description": "The catalog isn't a draft.",
            "model": CatalogNotDraft.schema(),
        },
    },
)
async def publish(
    id: UUID4,
    auth_subject: auth.CatalogWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Catalog:
    """Publish the draft catalog. Its new products and benefits replace the live
    ones for new sales. Existing customers stay on their versions until moved.

    Requires `products:write`, and `benefits:write` when the draft changes
    benefits."""
    draft = await catalog_service.get_draft_for_write(session, auth_subject, id)
    return await catalog_service.publish_draft(
        session, auth_subject, draft.organization, draft
    )
