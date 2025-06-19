from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

from sqlalchemy import Select, false
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.config import settings
from polar.enums import AccountType
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.utils import utc_now
from polar.models import Account, Payout, Transaction
from polar.models.payout import PayoutStatus
from polar.payout.sorting import PayoutSortProperty


class PayoutRepository(
    RepositorySoftDeletionIDMixin[Payout, UUID],
    RepositorySoftDeletionMixin[Payout],
    RepositorySortingMixin[Payout, PayoutSortProperty],
    RepositoryBase[Payout],
):
    model = Payout
    sorting_enum = PayoutSortProperty

    async def count_by_account(self, account: UUID) -> int:
        statement = self.get_base_statement().where(Payout.account_id == account)
        return await self.count(statement)

    async def get_by_processor_id(
        self,
        processor: AccountType,
        processor_id: str,
        *,
        options: Options = (),
    ) -> Payout | None:
        statement = (
            self.get_base_statement()
            .where(
                Payout.processor == processor,
                Payout.processor_id == processor_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_all_stripe_pending(
        self, delay: timedelta = settings.ACCOUNT_PAYOUT_DELAY
    ) -> Sequence[Payout]:
        statement = (
            self.get_base_statement()
            .distinct(Payout.account_id)
            .where(
                Payout.processor == AccountType.stripe,
                Payout.status == PayoutStatus.pending,
                Payout.processor_id.is_(None),
                Payout.created_at < utc_now() - delay,
            )
            .order_by(Payout.account_id.asc(), Payout.created_at.asc())
        )
        return await self.get_all(statement)

    async def get_by_account_and_invoice_number(
        self, account: UUID, invoice_number: str
    ) -> Payout | None:
        statement = self.get_base_statement().where(
            Payout.account_id == account,
            Payout.invoice_number == invoice_number,
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Options:
        return (
            joinedload(Payout.account),
            joinedload(Payout.transaction).selectinload(
                Transaction.incurred_transactions
            ),
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Payout]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.join(Payout.account).where(
                Account.admin_id == user.id
            )
        elif is_organization(auth_subject):
            # Only the admin of the account can access it
            statement = statement.where(false())

        return statement

    def get_sorting_clause(self, property: PayoutSortProperty) -> SortingClause:
        match property:
            case PayoutSortProperty.created_at:
                return Payout.created_at
            case PayoutSortProperty.amount:
                return Payout.amount
            case PayoutSortProperty.fees_amount:
                return Payout.fees_amount
            case PayoutSortProperty.status:
                return Payout.status
            case PayoutSortProperty.paid_at:
                return Payout.paid_at
            case PayoutSortProperty.account_id:
                return Payout.account_id
