from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import asc
from sqlalchemy.orm import joinedload

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import AccountCredit


class AccountCreditRepository(
    RepositorySoftDeletionIDMixin[AccountCredit, UUID],
    RepositorySoftDeletionMixin[AccountCredit],
    RepositoryBase[AccountCredit],
):
    model = AccountCredit

    async def get_active(
        self,
        account_id: UUID,
        *,
        options: Options = (),
    ) -> Sequence[AccountCredit]:
        now = utc_now()
        statement = (
            self.get_base_statement()
            .where(
                AccountCredit.account_id == account_id,
                (
                    (AccountCredit.expires_at.is_(None))
                    | (AccountCredit.expires_at > now)
                ),
                AccountCredit.revoked_at.is_(None),
                AccountCredit.amount > AccountCredit.used,
            )
            .order_by(asc(AccountCredit.granted_at))
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_all_by_account(
        self,
        account_id: UUID,
        *,
        options: Options = (),
        include_deleted: bool = False,
    ) -> Sequence[AccountCredit]:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(AccountCredit.account_id == account_id)
            .options(joinedload(AccountCredit.campaign), *options)
            .order_by(AccountCredit.granted_at.desc())
        )
        return await self.get_all(statement)

    async def get_by_id_and_account(
        self,
        credit_id: UUID,
        account_id: UUID,
        *,
        options: Options = (),
    ) -> AccountCredit | None:
        statement = (
            self.get_base_statement()
            .where(
                AccountCredit.id == credit_id,
                AccountCredit.account_id == account_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)
