from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import UUID4

from polar.auth.dependencies import Auth
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import Account, AccountCreate, AccountLink, AccountRead
from .service import AccountServiceError
from .service import account as account_service

router = APIRouter(tags=["accounts"])


@router.post("/accounts", tags=[Tags.PUBLIC], response_model=Account)
async def create(
    account: AccountCreate,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Account:
    if account.organization_id:
        org = await organization_service.get(session, account.organization_id)
        if not org or not authz.can(auth.user, AccessType.write, org):
            raise HTTPException(
                status_code=401,
                detail="Unauthorized",
            )

    if account.user_id and account.user_id is not auth.user.id:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    try:
        created = await account_service.create_account(
            session,
            organization_id=account.organization_id,
            user_id=account.user_id,
            admin_id=auth.user.id,
            account=account,
        )
    except AccountServiceError as e:
        raise HTTPException(status_code=400, detail=e.message)

    return Account.from_db(created)


@router.get("/accounts/{id}", tags=[Tags.PUBLIC], response_model=Account)
async def get(
    id: UUID,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> Account:
    acc = await account_service.get(session, id)
    if not acc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if not authz.can(auth.user, AccessType.read, acc):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    return Account.from_db(acc)


@router.post(
    "/accounts/{id}/onboarding_link", tags=[Tags.PUBLIC], response_model=AccountLink
)
async def onboarding_link(
    id: UUID,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> AccountLink:
    acc = await account_service.get(session, id)
    if not acc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if not authz.can(auth.user, AccessType.write, acc):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    link = await account_service.onboarding_link(
        acc,
        "?xxx_suffix"
        # f"?platform=.value}&org_name={auth.organization.name}",
    )
    if not link:
        raise HTTPException(status_code=500, detail="Failed to create link")

    return link


@router.post(
    "/accounts/{id}/dashboard_link", tags=[Tags.PUBLIC], response_model=AccountLink
)
async def dashboard_link(
    id: UUID,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> AccountLink:
    acc = await account_service.get(session, id)
    if not acc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if not authz.can(auth.user, AccessType.write, acc):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    link = await account_service.dashboard_link(acc)
    if not link:
        raise HTTPException(status_code=500, detail="Failed to create link")

    return link


@router.post(
    "/{platform}/{org_name}/accounts", response_model=AccountRead, deprecated=True
)
async def create_account(
    platform: Platforms,
    org_name: str,
    account: AccountCreate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> AccountRead:
    try:
        created = await account_service.create_account(
            session,
            organization_id=auth.organization.id,
            admin_id=auth.user.id,
            account=account,
        )
    except AccountServiceError as e:
        raise HTTPException(status_code=400, detail=e.message)

    return AccountRead.from_orm(created)


# @router.get(
#     "/{platform}/{org_name}/accounts/{account_id}/onboarding_link",
#     response_model=AccountLink,
#     deprecated=True,
# )
# async def onboarding_link_old(
#     platform: Platforms,
#     org_name: str,
#     account_id: UUID4,
#     auth: Auth = Depends(Auth.user_with_org_access),
#     session: AsyncSession = Depends(get_db_session),
# ) -> AccountLink:
#     account = await account_service.get_by(
#         session, id=account_id, organization_id=auth.organization.id
#     )
#     if account is None:
#         raise HTTPException(status_code=404)

#     link = await account_service.onboarding_link_for_user(
#         account,
#         auth.user,
#         f"?platform={platform.value}&org_name={auth.organization.name}",
#     )
#     if not link:
#         raise HTTPException(status_code=400, detail="Error while creating link")
#     return link


# @router.get(
#     "/{platform}/{org_name}/accounts/{account_id}/dashboard_link",
#     response_model=AccountLink,
#     deprecated=True,
# )
# async def dashboard_link_old(
#     platform: Platforms,
#     org_name: str,
#     account_id: UUID4,
#     auth: Auth = Depends(Auth.user_with_org_access),
#     session: AsyncSession = Depends(get_db_session),
# ) -> AccountLink:
#     account = await account_service.get_by(
#         session, id=account_id, organization_id=auth.organization.id
#     )
#     if account is None:
#         raise HTTPException(status_code=404)

#     link = await account_service.dashboard_link(account)
#     if not link:
#         raise HTTPException(status_code=400, detail="Error while creating link")
#     return link


@router.get("/{platform}/{org_name}/accounts", response_model=list[AccountRead | None])
async def get_accounts(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> list[AccountRead | None]:
    # get loaded
    org = await organization_service.get(session=session, id=auth.organization.id)
    if not org:
        return []

    if not await authz.can(auth.user, AccessType.read, org):
        return []

    acc = await account_service.get_by_org(session, org.id)
    if not acc:
        return []

    ret = AccountRead.from_orm(acc)
    balance = account_service.get_balance(acc)
    if balance is not None:
        currency, amount = balance
        ret.balance_currency = currency
        ret.balance = amount
    ret.is_admin = acc.admin_id == auth.user.id
    return [ret]
