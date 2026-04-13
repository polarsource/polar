from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends, Query

from polar.auth.dependencies import WebUserRead, WebUserWrite
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
    id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> PayoutAccount:
    payout_account = await payout_account_service.get(session, auth_subject, id)
    if payout_account is None:
        raise ResourceNotFound()
    return payout_account


@router.delete("/{id}", status_code=204)
async def delete(
    id: UUID,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    payout_account = await payout_account_service.get(session, auth_subject, id)
    if payout_account is None:
        raise ResourceNotFound()
    await payout_account_service.delete(session, payout_account)


@router.post("/{id}/onboarding-link", response_model=PayoutAccountLink)
async def onboarding_link(
    id: UUID,
    auth_subject: WebUserWrite,
    return_path: str = Query(...),
    session: AsyncSession = Depends(get_db_session),
) -> PayoutAccountLink:
    payout_account = await payout_account_service.get(session, auth_subject, id)
    if payout_account is None:
        raise ResourceNotFound()
    return await payout_account_service.onboarding_link(payout_account, return_path)


@router.post("/{id}/dashboard-link", response_model=PayoutAccountLink)
async def dashboard_link(
    id: UUID,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> PayoutAccountLink:
    payout_account = await payout_account_service.get(session, auth_subject, id)
    if payout_account is None:
        raise ResourceNotFound()
    return await payout_account_service.dashboard_link(payout_account)
