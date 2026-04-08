from uuid import UUID

from fastapi import Depends

from polar.account_credit.repository import AccountCreditRepository
from polar.account_credit.schemas import AccountCredit as AccountCreditSchema
from polar.auth.dependencies import WebUserRead, WebUserWrite
from polar.exceptions import ResourceNotFound
from polar.models import Account
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
    id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Account:
    account = await account_service.get(session, auth_subject, id)
    if account is None:
        raise ResourceNotFound()

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


@router.get("/accounts/{id}/credits", response_model=list[AccountCreditSchema])
async def get_credits(
    id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[AccountCreditSchema]:
    account = await account_service.get(session, auth_subject, id)
    if account is None:
        raise ResourceNotFound()

    credit_repository = AccountCreditRepository.from_session(session)
    credits = await credit_repository.get_active(account.id)
    return [AccountCreditSchema.model_validate(credit) for credit in credits]
