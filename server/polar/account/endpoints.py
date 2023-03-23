from fastapi import APIRouter, Depends, HTTPException
from polar.account.schemas import AccountCreate, AccountLink, AccountRead

from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from .service import account as account_service


router = APIRouter(tags=["accounts"])


@router.post("/{platform}/{org_name}/accounts", response_model=AccountRead)
async def create_account(
    platform: Platforms,
    org_name: str,
    account: AccountCreate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> AccountRead:
    created = await account_service.create_account(
        session, auth.organization.id, auth.user.id, account
    )
    if not created:
        raise HTTPException(status_code=400, detail="Error while creating account")
    return AccountRead.from_orm(created)


@router.get(
    "/{platform}/{org_name}/accounts/{stripe_id}/onboarding_link",
    response_model=AccountLink,
)
async def onboarding_link(
    platform: Platforms,
    org_name: str,
    stripe_id: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> AccountLink:
    link = await account_service.onboarding_link_for_user(
        session,
        auth.organization.id,
        auth.user,
        stripe_id,
        f"?platform={platform.value}&org_name={auth.organization.name}",
    )
    if not link:
        raise HTTPException(status_code=400, detail="Error while creating link")
    return link


@router.get(
    "/{platform}/{org_name}/accounts/{stripe_id}/dashboard_link",
    response_model=AccountLink,
)
async def dashboard_link(
    platform: Platforms,
    org_name: str,
    stripe_id: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> AccountLink:
    link = await account_service.dashboard_link(
        session,
        auth.organization.id,
        stripe_id,
    )
    if not link:
        raise HTTPException(status_code=400, detail="Error while creating link")
    return link


@router.get("/{platform}/{org_name}/accounts", response_model=list[AccountRead | None])
async def get_account(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> list[AccountRead | None]:
    if auth.organization.account is not None:
        ret = AccountRead.from_orm(auth.organization.account)
        ret.balance = account_service.get_balance(auth.organization.account)
        ret.is_admin = auth.organization.account.admin_id == auth.user.id
        return [ret]
    else:
        return []
