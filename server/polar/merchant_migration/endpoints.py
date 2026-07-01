from typing import Annotated
from uuid import UUID

from fastapi import Depends, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.models import MerchantMigration
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from .auth import MerchantMigrationRead, MerchantMigrationWrite
from .schemas import MerchantMigration as MerchantMigrationSchema
from .service import MerchantMigrationError
from .service import merchant_migration as merchant_migration_service
from .stripe_oauth import StripeOAuthError

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
    state_data = merchant_migration_service.decode_state(state)
    return_to = state_data.get("return_to") or ""

    if state_data.get("subject_id") != str(auth_subject.subject.id):
        redirect_url = get_safe_return_url(
            add_query_parameters(
                return_to,
                error="Authorization must be completed by the same account "
                "that started it.",
            )
        )
        return RedirectResponse(redirect_url, 303)

    if code is None or error is not None:
        redirect_url = get_safe_return_url(
            add_query_parameters(
                return_to, error=error or "Failed to connect Stripe account."
            )
        )
        return RedirectResponse(redirect_url, 303)

    try:
        await merchant_migration_service.complete_stripe_authorization(
            session,
            auth_subject,
            migration_id=UUID(state_data["migration_id"]),
            code=code,
        )
    except (StripeOAuthError, MerchantMigrationError):
        redirect_url = get_safe_return_url(
            add_query_parameters(return_to, error="Failed to connect Stripe account.")
        )
        return RedirectResponse(redirect_url, 303)
    return RedirectResponse(get_safe_return_url(return_to), 303)


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
