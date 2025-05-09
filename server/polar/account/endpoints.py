from uuid import UUID

from fastapi import Depends, Query

from polar.auth.dependencies import WebUser
from polar.enums import AccountType
from polar.exceptions import InternalServerError, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import Account, AccountCreate, AccountLink
from .service import account as account_service

router = APIRouter(tags=["accounts", APITag.private])


@router.get("/accounts/search", response_model=ListResource[Account])
async def search(
    auth_subject: WebUser,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[Account]:
    results, count = await account_service.search(
        session, auth_subject, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [Account.from_db(result) for result in results],
        count,
        pagination,
    )


@router.get("/accounts/{id}", response_model=Account)
async def get(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> Account:
    account = await account_service.get(session, auth_subject, id)
    if account is None:
        raise ResourceNotFound()

    return Account.from_db(account)


@router.post("/accounts/{id}/onboarding_link", response_model=AccountLink)
async def onboarding_link(
    id: UUID,
    auth_subject: WebUser,
    return_path: str = Query(...),
    session: AsyncSession = Depends(get_db_session),
) -> AccountLink:
    account = await account_service.get(session, auth_subject, id)
    if account is None:
        raise ResourceNotFound()

    if account.account_type == AccountType.open_collective:
        raise ResourceNotFound()

    link = await account_service.onboarding_link(account, return_path)
    if not link:
        raise InternalServerError("Failed to create link")

    return link


@router.post("/accounts/{id}/dashboard_link", response_model=AccountLink)
async def dashboard_link(
    id: UUID, auth_subject: WebUser, session: AsyncSession = Depends(get_db_session)
) -> AccountLink:
    account = await account_service.get(session, auth_subject, id)
    if account is None:
        raise ResourceNotFound()

    # update stripe account details
    await account_service.sync_to_upstream(session, account)

    link = await account_service.dashboard_link(account)
    if not link:
        raise InternalServerError("Failed to create link")

    return link


@router.post("/accounts", response_model=Account)
async def create(
    account_create: AccountCreate,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> Account:
    created = await account_service.create_account(
        session, admin=auth_subject.subject, account_create=account_create
    )

    await session.flush()
    return Account.from_db(created)
