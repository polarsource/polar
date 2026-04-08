from __future__ import annotations

import uuid

from sqlalchemy.orm.strategy_options import joinedload

from polar.account.repository import AccountRepository
from polar.auth.models import AuthSubject
from polar.enums import PayoutAccountType
from polar.models import Account, Organization, User
from polar.postgres import AsyncReadSession, AsyncSession

from .schemas import AccountUpdate


class AccountService:
    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Account | None:
        repository = AccountRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Account.id == id)
            .options(
                joinedload(Account.users),
                joinedload(Account.organizations),
            )
        )
        account = await repository.get_one_or_none(statement)

        return account

    async def is_user_admin(
        self, session: AsyncReadSession, account_id: uuid.UUID, user: User
    ) -> bool:
        account = await self._get_unrestricted(session, account_id)
        if account is None:
            return False
        return account.admin_id == user.id

    async def create(self, session: AsyncSession, admin: User) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.create(
            Account(
                currency="usd",  # FIXME: main Polar currency
                admin=admin,
                # Fields to remove
                account_type=PayoutAccountType.manual,
                country="XX",
                is_details_submitted=True,
                is_charges_enabled=True,
                is_payouts_enabled=True,
            )
        )

    async def update(
        self, session: AsyncSession, account: Account, account_update: AccountUpdate
    ) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.update(
            account, update_dict=account_update.model_dump(exclude_unset=True)
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
