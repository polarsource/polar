from fastapi import APIRouter, Depends, HTTPException
from pydantic import UUID4

from polar.account.schemas import AccountCreate, AccountLink, AccountRead
from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session

from .service import AccountServiceError
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
    try:
        created = await account_service.create_account(
            session, auth.organization.id, auth.user.id, account
        )
    except AccountServiceError as e:
        raise HTTPException(status_code=400, detail=e.message)

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
    session: AsyncSession = Depends(get_db_session),
) -> list[AccountRead | None]:
    # get loaded
    org = await organization_service.get_with_loaded(
        session=session, id=auth.organization.id
    )

    if org and org.account is not None:
        ret = AccountRead.from_orm(org.account)
        balance = account_service.get_balance(org.account)
        if balance is not None:
            currency, amount = balance
            ret.balance_currency = currency
            ret.balance = amount
        ret.is_admin = org.account.admin_id == auth.user.id
        return [ret]
    else:
        return []
