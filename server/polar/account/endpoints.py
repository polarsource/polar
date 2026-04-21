from fastapi import Depends

from polar.account_credit.repository import AccountCreditRepository
from polar.account_credit.schemas import AccountCredit as AccountCreditSchema
from polar.authz.dependencies import AuthorizeAccountRead, AuthorizeAccountWrite
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import Account as AccountSchema
from .schemas import AccountUpdate
from .service import account as account_service

router = APIRouter(tags=["accounts", APITag.private])


@router.get("/accounts/{id}", response_model=AccountSchema)
async def get(
    authorized: AuthorizeAccountRead,
) -> AccountSchema:
    return AccountSchema.model_validate(authorized.account)


@router.patch("/accounts/{id}", response_model=AccountSchema)
async def patch(
    authorized: AuthorizeAccountWrite,
    account_update: AccountUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> AccountSchema:
    updated = await account_service.update(session, authorized.account, account_update)
    return AccountSchema.model_validate(updated)


@router.get("/accounts/{id}/credits", response_model=list[AccountCreditSchema])
async def get_credits(
    authorized: AuthorizeAccountRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[AccountCreditSchema]:
    credit_repository = AccountCreditRepository.from_session(session)
    credits = await credit_repository.get_active(authorized.account.id)
    return [AccountCreditSchema.model_validate(credit) for credit in credits]
