from typing import Annotated

from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import MerchantMigration
from polar.models.merchant_migration_record import (
    MerchantMigrationCutoverStatus,
    MerchantMigrationRecordStatus,
)
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from .auth import MerchantMigrationRead, MerchantMigrationWrite
from .pan_transfer import (
    PanStepNotActionable,
    PanStepNotFound,
    PanStepNotOwned,
    PanTransferAlreadyStarted,
    PanTransferNotReady,
    PanTransferNotStarted,
    PanTransferUnavailable,
)
from .schemas import MerchantMigration as MerchantMigrationSchema
from .schemas import (
    MerchantMigrationCreate,
    MerchantMigrationCutoverReport,
    MerchantMigrationCutoverRequest,
    MerchantMigrationImportReport,
    MerchantMigrationImportRequest,
    MerchantMigrationRecordItem,
    MerchantMigrationRecordSummary,
    PanTransferChecklist,
    PanTransferStepComplete,
    PrecheckEntity,
    PrecheckReasonLevel,
    PrecheckRecordStatus,
    PrecheckReport,
)
from .service import (
    CatalogImportBlocked,
    CatalogImportNotReady,
    CutoverNotStarted,
    InvalidSourceCredentials,
    MerchantMigrationNotEnabled,
    MerchantMigrationNotFound,
    MissingStripeScopes,
    SourceAccountNotMigratable,
    SourceKeyModeMismatch,
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
            "description": "The Stripe API key is invalid, wrong mode, or missing "
            "permissions, or the account it belongs to can't be migrated.",
            "model": InvalidSourceCredentials.schema()
            | MissingStripeScopes.schema()
            | SourceAccountNotMigratable.schema()
            | SourceKeyModeMismatch.schema()
            | UnsupportedMigrationSource.schema(),
        },
        403: {
            "description": "Not allowed to manage this organization, or "
            "migrations aren't enabled for it.",
            "model": NotPermitted.schema() | MerchantMigrationNotEnabled.schema(),
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


@router.post(
    "/{id}/import",
    response_model=MerchantMigrationImportReport,
    summary="Import Merchant Migration Catalog",
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
        409: {
            "description": "The pre-check hasn't run yet, or it reports a blocker.",
            "model": CatalogImportNotReady.schema() | CatalogImportBlocked.schema(),
        },
    },
)
async def import_catalog(
    id: UUID4,
    auth_subject: MerchantMigrationWrite,
    body: MerchantMigrationImportRequest | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> MerchantMigrationImportReport:
    return await merchant_migration_service.import_catalog(
        session,
        auth_subject,
        id,
        record_ids=body.record_ids if body is not None else None,
        exclude_record_ids=body.exclude_record_ids if body is not None else None,
    )


@router.get(
    "/{id}/pan-transfer",
    response_model=PanTransferChecklist,
    summary="Get Merchant Migration Card Transfer",
    responses={
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
async def pan_transfer(
    id: UUID4,
    auth_subject: MerchantMigrationWrite,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> PanTransferChecklist:
    return await merchant_migration_service.get_pan_transfer(session, auth_subject, id)


@router.post(
    "/{id}/pan-transfer",
    response_model=PanTransferChecklist,
    summary="Start Merchant Migration Card Transfer",
    responses={
        403: {
            "description": "Not allowed to manage this organization.",
            "model": NotPermitted.schema(),
        },
        404: {
            "description": "Merchant migration not found.",
            "model": MerchantMigrationNotFound.schema(),
        },
        409: {
            "description": "The catalog isn't imported yet, the transfer already "
            "started, or card transfers aren't configured.",
            "model": PanTransferNotReady.schema()
            | PanTransferAlreadyStarted.schema()
            | PanTransferUnavailable.schema(),
        },
    },
)
async def start_pan_transfer(
    id: UUID4,
    auth_subject: MerchantMigrationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> PanTransferChecklist:
    return await merchant_migration_service.start_pan_transfer(
        session, auth_subject, id
    )


@router.post(
    "/{id}/pan-transfer/steps/{key}/complete",
    response_model=PanTransferChecklist,
    summary="Complete Merchant Migration Card Transfer Step",
    responses={
        403: {
            "description": "Not allowed to manage this organization, or the step "
            "is completed by someone else.",
            "model": NotPermitted.schema() | PanStepNotOwned.schema(),
        },
        404: {
            "description": "Merchant migration or step not found.",
            "model": MerchantMigrationNotFound.schema() | PanStepNotFound.schema(),
        },
        409: {
            "description": "The card transfer hasn't started, or this isn't the "
            "step to act on.",
            "model": PanTransferNotStarted.schema() | PanStepNotActionable.schema(),
        },
    },
)
async def complete_pan_transfer_step(
    id: UUID4,
    key: str,
    auth_subject: MerchantMigrationWrite,
    body: PanTransferStepComplete | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> PanTransferChecklist:
    return await merchant_migration_service.complete_pan_step(
        session,
        auth_subject,
        id,
        key,
        inputs=body.inputs if body is not None else {},
    )


@router.get(
    "/{id}/cutover",
    response_model=MerchantMigrationCutoverReport,
    summary="Get Merchant Migration Switch",
    responses={
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
async def get_cutover(
    id: UUID4,
    auth_subject: MerchantMigrationWrite,
    # The primary: the client polls this as the switch runs, and replica lag
    # would report subscriptions as still pending after they've moved.
    session: AsyncSession = Depends(get_db_session),
) -> MerchantMigrationCutoverReport:
    return await merchant_migration_service.get_cutover_report(
        session, auth_subject, id
    )


@router.post(
    "/{id}/cutover",
    response_model=MerchantMigrationCutoverReport,
    summary="Switch Merchant Migration Subscriptions",
    responses={
        403: {
            "description": "Not allowed to manage this organization.",
            "model": NotPermitted.schema(),
        },
        404: {
            "description": "Merchant migration not found.",
            "model": MerchantMigrationNotFound.schema(),
        },
        409: {
            "description": "The card transfer hasn't reached the switch step yet.",
            "model": CutoverNotStarted.schema(),
        },
    },
)
async def start_cutover(
    id: UUID4,
    auth_subject: MerchantMigrationWrite,
    body: MerchantMigrationCutoverRequest | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> MerchantMigrationCutoverReport:
    return await merchant_migration_service.start_cutover(
        session,
        auth_subject,
        id,
        record_ids=body.record_ids if body is not None else None,
        exclude_record_ids=body.exclude_record_ids if body is not None else None,
    )


@router.get(
    "/{id}/records/summary",
    response_model=MerchantMigrationRecordSummary,
    summary="Summarize Merchant Migration Records",
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
async def records_summary(
    id: UUID4,
    auth_subject: MerchantMigrationWrite,
    # The primary, not the replica: the receipt reads these counts back the
    # moment the import commits, so replica lag would report it as having
    # landed nothing.
    session: AsyncSession = Depends(get_db_session),
) -> MerchantMigrationRecordSummary:
    return await merchant_migration_service.summarize_records(session, auth_subject, id)


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
    entity: Annotated[PrecheckEntity | None, Query()] = None,
    status: Annotated[PrecheckRecordStatus | None, Query()] = None,
    reason_level: Annotated[PrecheckReasonLevel | None, Query()] = None,
    import_status: Annotated[MerchantMigrationRecordStatus | None, Query()] = None,
    cutover_status: Annotated[MerchantMigrationCutoverStatus | None, Query()] = None,
    # The primary, like the summary above: it supplies the selection ceiling
    # and these rows supply the checkboxes, so a split would let replica lag
    # show a tickable row the count doesn't include.
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[MerchantMigrationRecordItem]:
    items, count = await merchant_migration_service.list_records(
        session,
        auth_subject,
        id,
        entity=entity,
        status=status,
        reason_level=reason_level,
        import_status=import_status,
        cutover_status=cutover_status,
        pagination=pagination,
    )
    return ListResource.from_paginated_results(items, count, pagination)
