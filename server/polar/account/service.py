from __future__ import annotations

import uuid

from sqlalchemy.orm.strategy_options import joinedload

from polar.account.repository import AccountRepository
from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids
from polar.config import settings
from polar.exceptions import PolarError
from polar.models import Account, Organization, User
from polar.postgres import AsyncReadSession, AsyncSession

from .schemas import AccountUpdate


class AccountServiceError(PolarError):
    pass


class AccountService:
    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Account | None:
        org_ids = await get_accessible_org_ids(session, auth_subject)
        repository = AccountRepository.from_session(session)
        statement = (
            repository.get_statement_by_org_ids(org_ids)
            .where(Account.id == id)
            .options(
                joinedload(Account.users),
                joinedload(Account.organizations),
            )
        )
        return await repository.get_one_or_none(statement)

    async def get_by_organization(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
    ) -> Account | None:
        repository = AccountRepository.from_session(session)
        return await repository.get_by_organization(organization_id)

    async def create(self, session: AsyncSession) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.create(
            Account(
                currency="usd",  # FIXME: main Polar currency
                _platform_fee_percent=settings.PLATFORM_FEE_BASIS_POINTS,
                _platform_fee_fixed=settings.PLATFORM_FEE_FIXED,
                _platform_subscription_fee_percent=settings.PLATFORM_SUBSCRIPTION_FEE_BASIS_POINTS,
            )
        )

    async def update(
        self, session: AsyncSession, account: Account, account_update: AccountUpdate
    ) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.update(
            account, update_dict=account_update.model_dump(exclude_unset=True)
        )

    async def set_platform_fee(
        self,
        session: AsyncSession,
        account: Account,
        *,
        fee_percent: int | None,
        fee_fixed: int | None,
        subscription_fee_percent: int | None,
    ) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.update(
            account,
            update_dict={
                "_platform_fee_percent": fee_percent,
                "_platform_fee_fixed": fee_fixed,
                "_platform_subscription_fee_percent": subscription_fee_percent,
            },
        )

    async def _get_unrestricted(
        self,
        session: AsyncReadSession,
        id: uuid.UUID,
    ) -> Account | None:
        repository = AccountRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(Account.id == id)
            .options(
                joinedload(Account.users),
                joinedload(Account.organizations),
            )
        )
        return await repository.get_one_or_none(statement)


account = AccountService()
