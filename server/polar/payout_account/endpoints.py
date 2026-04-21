from collections.abc import Sequence

from fastapi import Depends, Query

from polar.auth.dependencies import WebUserRead, WebUserWrite
from polar.authz.dependencies import (
    AuthorizePayoutAccountRead,
    AuthorizePayoutAccountWrite,
)
from polar.exceptions import ResourceNotFound
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
    auth_subject: WebUserRead,
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
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> PayoutAccount:
    return await payout_account_service.create(
        auth_subject, session, payout_account_create
    )


@router.get("/{id}", response_model=PayoutAccountSchema)
async def get(
    authorized: AuthorizePayoutAccountRead,
) -> PayoutAccountSchema:
    return PayoutAccountSchema.model_validate(authorized.payout_account)


@router.delete("/{id}", status_code=204)
async def delete(
    authorized: AuthorizePayoutAccountWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    # Re-fetch on write session — the guard loaded on a read session
    from polar.payout_account.repository import PayoutAccountRepository

    repository = PayoutAccountRepository.from_session(session)
    payout_account = await repository.get_by_id(authorized.payout_account.id)
    if payout_account is None:
        raise ResourceNotFound()
    await payout_account_service.delete(session, payout_account)


@router.post("/{id}/onboarding-link", response_model=PayoutAccountLink)
async def onboarding_link(
    authorized: AuthorizePayoutAccountWrite,
    return_path: str = Query(...),
) -> PayoutAccountLink:
    return await payout_account_service.onboarding_link(
        authorized.payout_account, return_path
    )


@router.post("/{id}/dashboard-link", response_model=PayoutAccountLink)
async def dashboard_link(
    authorized: AuthorizePayoutAccountWrite,
) -> PayoutAccountLink:
    return await payout_account_service.dashboard_link(authorized.payout_account)
