from fastapi import Depends

from polar.exceptions import NotPermitted, ResourceNotFound
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

from . import auth
from .schemas import CatalogMigration as CatalogMigrationSchema
from .schemas import CatalogMigrationCreate, CatalogMigrationID
from .service import catalog_migration as catalog_migration_service

router = APIRouter(
    prefix="/catalog-migrations", tags=["catalog-migrations", APITag.private]
)

CatalogMigrationNotFound = {
    "description": "Catalog migration not found.",
    "model": ResourceNotFound.schema(),
}


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
