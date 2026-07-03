from typing import Annotated

from fastapi import Depends, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import UUID4

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.models import MerchantMigration
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from .auth import MerchantMigrationRead, MerchantMigrationWrite
from .schemas import MerchantMigration as MerchantMigrationSchema
from .schemas import PrecheckReport
from .service import (
    MerchantMigrationNotFound,
    SourceNotConnected,
    UnsupportedMigrationSource,
)
from .service import merchant_migration as merchant_migration_service

router = APIRouter(
    prefix="/merchant-migrations",
    tags=["merchant-migrations", APITag.private],
)

STRIPE_CALLBACK_ROUTE_NAME = "merchant_migrations.stripe.callback"


@router.get("/stripe/authorize", include_in_schema=False)
async def stripe_authorize(
    organization_id: Annotated[OrganizationID, Query()],
    return_to: ReturnTo,
    auth_subject: MerchantMigrationWrite,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    redirect_uri = str(request.url_for(STRIPE_CALLBACK_ROUTE_NAME))
    authorize_url = await merchant_migration_service.create_stripe_authorization_url(
        session,
        auth_subject,
        organization_id=organization_id,
        redirect_uri=redirect_uri,
        return_to=return_to,
    )
    return RedirectResponse(authorize_url, 303)


@router.get(
    "/stripe/callback",
    name=STRIPE_CALLBACK_ROUTE_NAME,
    include_in_schema=False,
)
async def stripe_callback(
    auth_subject: MerchantMigrationWrite,
    state: str = Query(...),
    code: str | None = Query(None),
    error: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    result = await merchant_migration_service.complete_stripe_authorization(
        session, auth_subject, state=state, code=code, error=error
    )
    target = result.return_to
    if result.error is not None:
        target = add_query_parameters(target, error=result.error)
    return RedirectResponse(get_safe_return_url(target), 303)


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
