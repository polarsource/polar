from typing import Annotated

from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import MerchantMigration
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from .auth import MerchantMigrationRead, MerchantMigrationWrite
from .schemas import MerchantMigration as MerchantMigrationSchema
from .schemas import (
    MerchantMigrationCreate,
    MerchantMigrationRecordItem,
    PrecheckEntity,
    PrecheckRecordStatus,
    PrecheckReport,
)
from .service import (
    InvalidSourceCredentials,
    MerchantMigrationNotFound,
    MissingStripeScopes,
    SourceNotConnected,
    SourceVerificationUnavailable,
    UnsupportedMigrationSource,
)
from .service import merchant_migration as merchant_migration_service

router = APIRouter(
    prefix="/merchant-migrations",
    tags=["merchant-migrations", APITag.private],
)


@router.get(
    "/",
    response_model=ListResource[MerchantMigrationSchema],
    summary="List Merchant Migrations",
)
async def list(
    auth_subject: MerchantMigrationRead,
    pagination: PaginationParamsQuery,
    organization_id: Annotated[OrganizationID, Query()],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[MerchantMigrationSchema]:
    results, count = await merchant_migration_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        pagination=pagination,
    )
    return ListResource.from_paginated_results(
        [MerchantMigrationSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/",
    response_model=MerchantMigrationSchema,
    status_code=201,
    summary="Create Merchant Migration",
    responses={
        400: {
            "description": "The Stripe API key is invalid or missing permissions.",
            "model": InvalidSourceCredentials.schema()
            | MissingStripeScopes.schema()
            | UnsupportedMigrationSource.schema(),
        },
        403: {
            "description": "Not allowed to manage this organization.",
            "model": NotPermitted.schema(),
        },
        502: {
            "description": "Couldn't reach Stripe to validate the key.",
            "model": SourceVerificationUnavailable.schema(),
        },
    },
)
async def create(
    migration_create: MerchantMigrationCreate,
    auth_subject: MerchantMigrationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> MerchantMigration:
    return await merchant_migration_service.create(
        session, auth_subject, migration_create
    )


@router.get(
    "/{id}",
    response_model=MerchantMigrationSchema,
    summary="Get Merchant Migration",
    responses={404: {"description": "Merchant migration not found."}},
)
async def get(
    id: UUID4,
    auth_subject: MerchantMigrationRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> MerchantMigration:
    migration = await merchant_migration_service.get(session, auth_subject, id)
    if migration is None:
        raise ResourceNotFound()
    return migration


@router.post(
    "/{id}/precheck",
    response_model=PrecheckReport,
    summary="Run Merchant Migration Pre-check",
    responses={
        400: {
            "description": "The source is not connected or isn't supported.",
            "model": SourceNotConnected.schema() | UnsupportedMigrationSource.schema(),
        },
        403: {
            "description": "Not allowed to manage this organization.",
            "model": NotPermitted.schema(),
        },
        404: {
            "description": "Merchant migration not found.",
            "model": MerchantMigrationNotFound.schema(),
        },
    },
)
async def precheck(
    id: UUID4,
    auth_subject: MerchantMigrationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> PrecheckReport:
    return await merchant_migration_service.run_precheck(session, auth_subject, id)


@router.get(
    "/{id}/records",
    response_model=ListResource[MerchantMigrationRecordItem],
    summary="List Merchant Migration Records",
    responses={
        400: {
            "description": "The source is not connected or isn't supported.",
            "model": SourceNotConnected.schema() | UnsupportedMigrationSource.schema(),
        },
        403: {
            "description": "Not allowed to manage this organization.",
            "model": NotPermitted.schema(),
        },
        404: {
            "description": "Merchant migration not found.",
            "model": MerchantMigrationNotFound.schema(),
        },
    },
)
async def records(
    id: UUID4,
    auth_subject: MerchantMigrationWrite,
    pagination: PaginationParamsQuery,
    entity: Annotated[PrecheckEntity, Query()],
    status: Annotated[PrecheckRecordStatus | None, Query()] = None,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[MerchantMigrationRecordItem]:
    items, count = await merchant_migration_service.list_records(
        session,
        auth_subject,
        id,
        entity=entity,
        status=status,
        pagination=pagination,
    )
    return ListResource.from_paginated_results(items, count, pagination)
