from fastapi import Depends

from polar.account_credit.repository import AccountCreditRepository
from polar.account_credit.schemas import AccountCredit as AccountCreditSchema
from polar.authz.dependencies import AuthorizeAccountRead, AuthorizeAccountWrite
from polar.exceptions import ResourceNotFound
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
    authz: AuthorizeAccountRead,
) -> AccountSchema:
    return AccountSchema.model_validate(authz.account)


@router.patch("/accounts/{id}", response_model=AccountSchema)
async def patch(
    authz: AuthorizeAccountWrite,
    account_update: AccountUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> AccountSchema:
    # Re-fetch on write session — the guard loaded on a read session
    from polar.account.repository import AccountRepository

    repository = AccountRepository.from_session(session)
    account = await repository.get_by_id(authz.account.id)
    if account is None:
        raise ResourceNotFound()
    updated = await account_service.update(session, account, account_update)
    return AccountSchema.model_validate(updated)


@router.get("/accounts/{id}/credits", response_model=list[AccountCreditSchema])
async def get_credits(
    authz: AuthorizeAccountRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[AccountCreditSchema]:
    credit_repository = AccountCreditRepository.from_session(session)
    credits = await credit_repository.get_active(authz.account.id)
    return [AccountCreditSchema.model_validate(credit) for credit in credits]
