from uuid import UUID

from fastapi import Depends, Query

from polar.auth.dependencies import WebUser
from polar.authz.service import AccessType, Authz
from polar.enums import AccountType
from polar.exceptions import InternalServerError, NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import Account, AccountCreate, AccountLink
from .service import account as account_service

router = APIRouter(tags=["accounts"])


@router.get(
    "/accounts/search", response_model=ListResource[Account], tags=[Tags.PUBLIC]
)
async def search(
    auth_subject: WebUser,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[Account]:
    results, count = await account_service.search(
        session,
        auth_subject.subject,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [Account.from_db(result) for result in results],
        count,
        pagination,
    )


@router.get("/accounts/{id}", tags=[Tags.PUBLIC], response_model=Account)
async def get(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Account:
    acc = await account_service.get_by_id(session, id)
    if not acc:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.read, acc):
        raise NotPermitted()

    return Account.from_db(acc)


@router.post(
    "/accounts/{id}/onboarding_link", tags=[Tags.PUBLIC], response_model=AccountLink
)
async def onboarding_link(
    id: UUID,
    auth_subject: WebUser,
    return_path: str = Query(...),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> AccountLink:
    acc = await account_service.get_by_id(session, id)
    if not acc:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, acc):
        raise NotPermitted()

    if acc.account_type == AccountType.open_collective:
        raise ResourceNotFound()

    link = await account_service.onboarding_link(acc, return_path)
    if not link:
        raise InternalServerError("Failed to create link")

    return link


@router.post(
    "/accounts/{id}/dashboard_link", tags=[Tags.PUBLIC], response_model=AccountLink
)
async def dashboard_link(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> AccountLink:
    acc = await account_service.get_by_id(session, id)
    if not acc:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, acc):
        raise NotPermitted()

    # update stripe account details
    await account_service.sync_to_upstream(session, acc)

    link = await account_service.dashboard_link(acc)
    if not link:
        raise InternalServerError("Failed to create link")

    return link


@router.post("/accounts", tags=[Tags.PUBLIC], response_model=Account)
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
