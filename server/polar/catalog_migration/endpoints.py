from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.versioning import version
from polar.models import CatalogMigration
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.version import V2027_01

from . import auth, sorting
from .schemas import CatalogMigration as CatalogMigrationSchema
from .schemas import (
    CatalogMigrationCreate,
    CatalogMigrationID,
    CatalogMigrationListParams,
)
from .service import catalog_migration as catalog_migration_service

router = APIRouter(
    prefix="/catalog-migrations", tags=["catalog-migrations", APITag.private]
)

CatalogMigrationNotFound = {
    "description": "Catalog migration not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Catalog Migrations",
    response_model=ListResource[CatalogMigrationSchema],
)
@version(starting_from=V2027_01)
async def list(
    filters: Annotated[CatalogMigrationListParams, Query()],
    auth_subject: auth.CatalogMigrationsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CatalogMigrationSchema]:
    """List catalog migrations."""
    results, count = await catalog_migration_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        product_id=filters.product_id,
        status=filters.status,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(
        [CatalogMigrationSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Catalog Migration",
    response_model=CatalogMigrationSchema,
    responses={404: CatalogMigrationNotFound},
)
@version(starting_from=V2027_01)
async def get(
    id: CatalogMigrationID,
    auth_subject: auth.CatalogMigrationsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CatalogMigration:
    """Get a catalog migration and its progress."""
    catalog_migration = await catalog_migration_service.get(session, auth_subject, id)

    if catalog_migration is None:
        raise ResourceNotFound()

    return catalog_migration


@router.post(
    "/",
    summary="Create Catalog Migration",
    response_model=CatalogMigrationSchema,
    status_code=201,
    responses={
        201: {"description": "Catalog migration started."},
        403: {
            "description": (
                "You don't have the permission to manage sales, "
                "or the organization doesn't use config as code."
            ),
            "model": NotPermitted.schema(),
        },
    },
)
@version(starting_from=V2027_01)
async def create(
    catalog_migration_create: CatalogMigrationCreate,
    auth_subject: auth.CatalogMigrationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CatalogMigration:
    """
    Move the subscriptions of older versions of a product to its current version.

    Subscriptions move in the background, each one at its next renewal, without
    notifying customers. Subscriptions that are canceling or already have a
    pending change are left alone.
    """
    return await catalog_migration_service.create(
        session, auth_subject, catalog_migration_create
    )
