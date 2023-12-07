from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from polar.auth.dependencies import UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.enums import AccountType
from polar.exceptions import InternalServerError, NotPermitted, ResourceNotFound
from polar.models import Account as AccountModel
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import Account, AccountCreate, AccountLink
from .service import account as account_service

router = APIRouter(tags=["accounts"])


@router.get("/accounts/lookup", tags=[Tags.PUBLIC], response_model=Account)
async def lookup(
    auth: UserRequiredAuth,
    organization_id: UUID | None = Query(
        default=None,
        description="Search accounts connected to this organization. Either user_id or organization_id must be set.",  # noqa: E501
    ),
    user_id: UUID | None = Query(
        default=None,
        description="Search accounts connected to this user. Either user_id or organization_id must be set.",  # noqa: E501
    ),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Account:
    if not organization_id and not user_id or (organization_id and user_id):
        raise HTTPException(
            status_code=400, detail="Either organization_id or user_id must be set"
        )

    account: AccountModel | None = None
    if organization_id is not None:
        account = await account_service.get_by_org(session, organization_id)

    if user_id is not None:
        account = await account_service.get_by_user(session, user_id)

    if account is None:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, account):
        raise NotPermitted()

    return Account.from_db(account)


@router.get("/accounts/{id}", tags=[Tags.PUBLIC], response_model=Account)
async def get(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Account:
    acc = await account_service.get(session, id)
    if not acc:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, acc):
        raise NotPermitted()

    return Account.from_db(acc)


@router.post(
    "/accounts/{id}/onboarding_link", tags=[Tags.PUBLIC], response_model=AccountLink
)
async def onboarding_link(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> AccountLink:
    acc = await account_service.get(session, id)
    if not acc:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, acc):
        raise NotPermitted()

    if acc.account_type == AccountType.open_collective:
        raise ResourceNotFound()

    link = await account_service.onboarding_link(acc)
    if not link:
        raise InternalServerError("Failed to create link")

    return link


@router.post(
    "/accounts/{id}/dashboard_link", tags=[Tags.PUBLIC], response_model=AccountLink
)
async def dashboard_link(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> AccountLink:
    acc = await account_service.get(session, id)
    if not acc:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, acc):
        raise NotPermitted()

    # update stripe account details
    await account_service.sync_to_upstream(session, acc)

    link = await account_service.dashboard_link(acc)
    if not link:
        raise InternalServerError("Failed to create link")

    return link


@router.post("/accounts", tags=[Tags.PUBLIC], response_model=Account)
async def create(
    account: AccountCreate,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Account:
    if account.organization_id:
        org = await organization_service.get(session, account.organization_id)
        if not org or not await authz.can(auth.subject, AccessType.write, org):
            raise NotPermitted()

    if account.user_id and str(account.user_id) != str(auth.user.id):
        raise NotPermitted()

    created = await account_service.create_account(
        session,
        organization_id=account.organization_id,
        user_id=account.user_id,
        admin_id=auth.user.id,
        account=account,
    )

    return Account.from_db(created)
