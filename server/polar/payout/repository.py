from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

from sqlalchemy import Select, exists, select
from sqlalchemy.orm import joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.config import settings
from polar.enums import PayoutAccountType
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.utils import utc_now
from polar.models import Organization, Payout, PayoutAttempt, Transaction
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

    async def get_latest_by_account(self, account: UUID) -> Payout | None:
        statement = (
            self.get_base_statement()
            .where(Payout.account_id == account)
            .order_by(Payout.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def count_pending_by_payout_account(self, payout_account_id: UUID) -> int:
        statement = self.get_base_statement().where(
            Payout.payout_account_id == payout_account_id,
            Payout.status.in_(
                {
                    PayoutStatus.pending,
                    PayoutStatus.in_transit,
                }
            ),
        )
        return await self.count(statement)

    async def get_all_stripe_pending(
        self, delay: timedelta = settings.ACCOUNT_PAYOUT_DELAY
    ) -> Sequence[Payout]:
        """
        Get all payouts that have no attempts yet and are ready to be triggered.
        """
        statement = (
            self.get_base_statement()
            .distinct(Payout.payout_account_id)
            .where(
                Payout.processor == PayoutAccountType.stripe,
                Payout.created_at < utc_now() - delay,
                Payout.status.not_in([PayoutStatus.canceled, PayoutStatus.succeeded]),
                # Only include payouts that have no attempts yet
                ~exists(
                    select(PayoutAttempt).where(PayoutAttempt.payout_id == Payout.id)
                ),
            )
            .order_by(Payout.payout_account_id.asc(), Payout.created_at.asc())
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
            joinedload(Payout.payout_account),
            joinedload(Payout.transactions).selectinload(
                Transaction.incurred_transactions
            ),
        )

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Payout]]:
        return self.get_base_statement().where(
            Payout.account_id.in_(
                select(Organization.account_id).where(Organization.id.in_(org_ids))
            )
        )

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
            case PayoutSortProperty.payout_account_id:
                return Payout.payout_account_id


class PayoutAttemptRepository(RepositoryBase[PayoutAttempt]):
    model = PayoutAttempt

    async def get_by_processor_id(
        self,
        processor: PayoutAccountType,
        processor_id: str,
    ) -> PayoutAttempt | None:
        statement = self.get_base_statement().where(
            PayoutAttempt.processor == processor,
            PayoutAttempt.processor_id == processor_id,
        )
        return await self.get_one_or_none(statement)
