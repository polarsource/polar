from uuid import UUID

from fastapi import Depends, Query

from polar.auth.dependencies import WebUserRead, WebUserWrite
from polar.enums import AccountType
from polar.exceptions import InternalServerError, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Account
from polar.openapi import APITag
from polar.organization.service import organization as organization_service
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import Account as AccountSchema
from .schemas import AccountCreateForOrganization, AccountLink, AccountUpdate
from .service import account as account_service

router = APIRouter(tags=["accounts", APITag.private])


@router.get("/accounts/search", response_model=ListResource[AccountSchema])
async def search(
    auth_subject: WebUserRead,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[AccountSchema]:
    results, count = await account_service.search(
        session, auth_subject, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [AccountSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/accounts/{id}", response_model=AccountSchema)
async def get(
    id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Account:
    account = await account_service.get(session, auth_subject, id)
    if account is None:
        raise ResourceNotFound()

    return account


@router.post("/accounts", response_model=AccountSchema)
async def create(
    account_create: AccountCreateForOrganization,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Account:
    organization = await organization_service.get(
        session, auth_subject, account_create.organization_id
    )
    if organization is None:
        raise ResourceNotFound("Organization not found")

    account = await account_service.get_or_create_account_for_organization(
        session,
        organization=organization,
        admin=auth_subject.subject,
        account_create=account_create,
    )

    return account


@router.patch("/accounts/{id}", response_model=AccountSchema)
async def patch(
    id: UUID,
    account_update: AccountUpdate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Account:
    account = await account_service.get(session, auth_subject, id)
    if account is None:
        raise ResourceNotFound()

    return await account_service.update(session, account, account_update)


@router.post("/accounts/{id}/onboarding_link", response_model=AccountLink)
async def onboarding_link(
    id: UUID,
    auth_subject: WebUserWrite,
    return_path: str = Query(...),
    session: AsyncSession = Depends(get_db_session),
) -> AccountLink:
    account = await account_service.get(session, auth_subject, id)
    if account is None:
        raise ResourceNotFound()

    if account.account_type != AccountType.stripe:
        raise ResourceNotFound()

    link = await account_service.onboarding_link(account, return_path)
    if not link:
        raise InternalServerError("Failed to create link")

    return link


@router.post("/accounts/{id}/dashboard_link", response_model=AccountLink)
async def dashboard_link(
    id: UUID,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
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
