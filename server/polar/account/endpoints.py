from fastapi import APIRouter, Depends, HTTPException
from pydantic import UUID4

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
    "/{platform}/{org_name}/accounts/{account_id}/onboarding_link",
    response_model=AccountLink,
)
async def onboarding_link(
    platform: Platforms,
    org_name: str,
    account_id: UUID4,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> AccountLink:
    account = await account_service.get_by(
        session, id=account_id, organization_id=auth.organization.id
    )
    if account is None:
        raise HTTPException(status_code=404)

    link = await account_service.onboarding_link_for_user(
        account,
        auth.user,
        f"?platform={platform.value}&org_name={auth.organization.name}",
    )
    if not link:
        raise HTTPException(status_code=400, detail="Error while creating link")
    return link


@router.get(
    "/{platform}/{org_name}/accounts/{account_id}/dashboard_link",
    response_model=AccountLink,
)
async def dashboard_link(
    platform: Platforms,
    org_name: str,
    account_id: UUID4,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> AccountLink:
    account = await account_service.get_by(
        session, id=account_id, organization_id=auth.organization.id
    )
    if account is None:
        raise HTTPException(status_code=404)

    link = await account_service.dashboard_link(account)
    if not link:
        raise HTTPException(status_code=400, detail="Error while creating link")
    return link


@router.get("/{platform}/{org_name}/accounts", response_model=list[AccountRead | None])
async def get_accounts(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
) -> list[AccountRead | None]:
    if auth.organization.account is not None:
        ret = AccountRead.from_orm(auth.organization.account)
        balance = account_service.get_balance(auth.organization.account)
        if balance is not None:
            currency, amount = balance
            ret.balance_currency = currency
            ret.balance = amount
        ret.is_admin = auth.organization.account.admin_id == auth.user.id
        return [ret]
    else:
        return []
