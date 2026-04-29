from collections.abc import Sequence

from fastapi import Depends, Query

from polar.authz.dependencies import (
    AuthorizePayoutAccountRead,
    AuthorizePayoutAccountWrite,
    AuthorizeWebPayoutsRead,
    AuthorizeWebPayoutsWrite,
)
from polar.kit.pagination import ListResource, Pagination
from polar.models import PayoutAccount
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import PayoutAccount as PayoutAccountSchema
from .schemas import PayoutAccountCreate, PayoutAccountLink
from .service import payout_account as payout_account_service

router = APIRouter(prefix="/payout-accounts", tags=["payout_accounts", APITag.private])


@router.get("/", response_model=ListResource[PayoutAccountSchema])
async def list(
    auth_subject: AuthorizeWebPayoutsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[PayoutAccountSchema]:
    """List payout accounts accessible to the authenticated user."""
    results: Sequence[PayoutAccount] = await payout_account_service.list(
        session, auth_subject
    )
    items = [PayoutAccountSchema.model_validate(r) for r in results]
    return ListResource(
        items=items,
        pagination=Pagination(total_count=len(items), max_page=1),
    )


@router.post("/", response_model=PayoutAccountSchema)
async def create(
    payout_account_create: PayoutAccountCreate,
    auth_subject: AuthorizeWebPayoutsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> PayoutAccount:
    return await payout_account_service.create(
        auth_subject, session, payout_account_create
    )


@router.get("/{id}", response_model=PayoutAccountSchema)
async def get(
    authz: AuthorizePayoutAccountRead,
) -> PayoutAccount:
    return authz.payout_account


@router.delete("/{id}", status_code=204)
async def delete(
    authz: AuthorizePayoutAccountWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await payout_account_service.delete(session, authz.payout_account)


@router.post("/{id}/onboarding-link", response_model=PayoutAccountLink)
async def onboarding_link(
    authz: AuthorizePayoutAccountWrite,
    return_path: str = Query(...),
) -> PayoutAccountLink:
    return await payout_account_service.onboarding_link(
        authz.payout_account, return_path
    )


@router.post("/{id}/dashboard-link", response_model=PayoutAccountLink)
async def dashboard_link(
    authz: AuthorizePayoutAccountWrite,
) -> PayoutAccountLink:
    return await payout_account_service.dashboard_link(authz.payout_account)
