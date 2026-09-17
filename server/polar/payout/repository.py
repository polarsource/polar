from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

from sqlalchemy import RowMapping, Select, exists, func, select, text, update
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

    async def sample_database_waits(self) -> Sequence[RowMapping]:
        await self.session.execute(text("SET LOCAL statement_timeout = '1s'"))
        result = await self.session.execute(
            text("""
                SELECT
                    clock_timestamp() AS sampled_at,
                    a.datname AS database_name,
                    a.pid,
                    a.application_name,
                    a.query_id,
                    a.query_start,
                    EXTRACT(EPOCH FROM clock_timestamp() - a.query_start)
                        AS query_age_seconds,
                    EXTRACT(EPOCH FROM clock_timestamp() - a.xact_start)
                        AS transaction_age_seconds,
                    a.wait_event_type,
                    a.wait_event,
                    pg_blocking_pids(a.pid) AS blocking_pids,
                    ARRAY(
                        SELECT json_build_object(
                            'pid', b.pid,
                            'application_name', b.application_name,
                            'state', b.state,
                            'query_id', b.query_id,
                            'query_start', b.query_start,
                            'transaction_start', b.xact_start,
                            'wait_event_type', b.wait_event_type,
                            'wait_event', b.wait_event
                        )
                        FROM pg_stat_activity b
                        WHERE b.pid = ANY(pg_blocking_pids(a.pid))
                    ) AS blockers
                FROM pg_stat_activity a
                WHERE a.datname = current_database()
                    AND a.pid <> pg_backend_pid()
                    AND a.state = 'active'
                    AND a.query_start < statement_timestamp() - interval '1 second'
                    AND a.query ~* 'UPDATE (public[.])?transactions SET'
                    AND a.query ILIKE '%payout_transaction_id%'
            """)
        )
        return result.mappings().all()

    async def count_by_account(self, account: UUID) -> int:
        statement = self.get_base_statement().where(Payout.account_id == account)
        return await self.count(statement)

    async def get_held_counts_by_accounts(
        self, account_ids: Sequence[UUID]
    ) -> dict[UUID, int]:
        """Count held payouts per account, for the Review-queue priority boost.

        Accounts with no held payout are absent from the result (caller defaults
        the count to 0).
        """
        if not account_ids:
            return {}
        statement = (
            self.get_base_statement()
            .with_only_columns(Payout.account_id, func.count(Payout.id))
            .where(
                Payout.account_id.in_(account_ids),
                Payout.status == PayoutStatus.held,
            )
            .group_by(Payout.account_id)
        )
        result = await self.session.execute(statement)
        return {account_id: count for account_id, count in result.all()}

    async def get_held_stats_by_account(self, account: UUID) -> tuple[int, int]:
        """Count and sum the amount of held payouts for a single account.
        Returns `(count, total_amount)` with the amount in USD cents.
        """
        statement = (
            self.get_base_statement()
            .with_only_columns(
                func.count(Payout.id),
                func.coalesce(func.sum(Payout.amount), 0),
            )
            .where(
                Payout.account_id == account,
                Payout.status == PayoutStatus.held,
            )
        )
        result = await self.session.execute(statement)
        count, total_amount = result.one()
        return count, total_amount

    async def get_latest_by_account(self, account: UUID) -> Payout | None:
        statement = (
            self.get_base_statement()
            .where(
                Payout.account_id == account,
                Payout.status != PayoutStatus.canceled,
            )
            .order_by(Payout.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def count_pending_by_payout_account(self, payout_account_id: UUID) -> int:
        statement = self.get_base_statement().where(
            Payout.payout_account_id == payout_account_id,
            Payout.status.in_(
                {
                    # held reserves funds like pending, so it must count here
                    # too (otherwise the payout account could be deleted).
                    PayoutStatus.held,
                    PayoutStatus.pending,
                    PayoutStatus.in_transit,
                }
            ),
        )
        return await self.count(statement)

    async def get_by_account_and_statuses(
        self,
        account_id: UUID,
        statuses: Sequence[PayoutStatus],
        *,
        payout_account_id: UUID | None = None,
        options: Options = (),
    ) -> Sequence[Payout]:
        statement = (
            self.get_base_statement()
            .where(
                Payout.account_id == account_id,
                Payout.status.in_(statuses),
            )
            # Deterministic order so concurrent cancel jobs lock rows in the
            # same order (FOR UPDATE in cancel()) and can't deadlock.
            .order_by(Payout.created_at.asc(), Payout.id.asc())
            .options(*options)
        )
        if payout_account_id is not None:
            statement = statement.where(Payout.payout_account_id == payout_account_id)
        return await self.get_all(statement)

    async def release_held_by_account(self, account_id: UUID) -> Sequence[UUID]:
        """Move every held payout for an account back to `pending`.

        Returns the ids of the released payouts so the caller can enqueue the
        Stripe transfer that was skipped while they were held. Done as a single
        UPDATE ... RETURNING so concurrent releases can't double-release a row.
        """
        statement = (
            update(Payout)
            .where(
                Payout.account_id == account_id,
                Payout.status == PayoutStatus.held,
                Payout.deleted_at.is_(None),
            )
            .values(status=PayoutStatus.pending)
            .returning(Payout.id)
        )
        result = await self.session.execute(statement)
        return [row[0] for row in result.all()]

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
                # Strictly `pending`: `held` payouts are not yet payable, so
                # they must not be picked up by the hourly Stripe-transfer cron.
                Payout.status == PayoutStatus.pending,
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
            joinedload(Payout.transactions).joinedload(Transaction.account),
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
