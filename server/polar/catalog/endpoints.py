from fastapi import Depends, Query

from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth
from .schemas import Catalog as CatalogSchema
from .service import catalog as catalog_service

router = APIRouter(prefix="/catalogs", tags=["catalogs", APITag.private])


@router.get("/", summary="List Catalogs", response_model=ListResource[CatalogSchema])
async def list(
    auth_subject: auth.CatalogRead,
    pagination: PaginationParamsQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CatalogSchema]:
    """List the published catalogs of organizations using config as code, newest first."""
    results, count = await catalog_service.list(
        session, auth_subject, organization_id=organization_id, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [
            CatalogSchema(
                id=catalog.id,
                created_at=catalog.created_at,
                modified_at=catalog.modified_at,
                organization_id=catalog.organization_id,
                version_hash=catalog.version_hash,
                status=catalog.status,
                published_at=catalog.published_at,
                product_count=product_count,
            )
            for catalog, product_count in results
        ],
        count,
        pagination,
    )
