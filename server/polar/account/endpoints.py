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
    created = await account_service.create_stripe_account(
        session, auth.organization.id, auth.user.id, account
    )
    if not created:
        raise HTTPException(status_code=400, detail="Error while creating account")
    return AccountRead.from_orm(created)


@router.post(
    "/{platform}/{org_name}/accounts/{stripe_id}/links", response_model=AccountLink
)
async def create_link(
    platform: Platforms,
    org_name: str,
    stripe_id: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> AccountLink:
    created = await account_service.create_link(
        session,
        auth.organization.id,
        stripe_id,
        f"?platform={platform.value}&org_name={auth.organization.name}",
    )
    if not created:
        raise HTTPException(status_code=400, detail="Error while creating link")
    return created
