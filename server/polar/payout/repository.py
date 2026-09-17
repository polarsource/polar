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
                    a.query_id::text AS query_id,
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
                            'query_id', b.query_id::text,
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

    async def sample_database_statistics(self) -> RowMapping:
        await self.session.execute(text("SET LOCAL statement_timeout = '1s'"))
        result = await self.session.execute(
            text("""
                SELECT
                    clock_timestamp() AS sampled_at,
                    current_database() AS database_name,
                    pg_postmaster_start_time() AS server_started_at,
                    current_setting('server_version_num') AS server_version,
                    to_regclass('pg_stat_statements') IS NOT NULL
                        AND current_setting('pg_stat_statements.track', true)
                            IN ('top', 'all') AS statement_statistics_available,
                    (SELECT jsonb_object_agg(name,
                        jsonb_build_object('value', setting, 'unit', unit))
                        FROM pg_settings WHERE name IN (
                            'block_size', 'shared_buffers', 'effective_cache_size',
                            'track_counts', 'track_activities', 'track_io_timing',
                            'track_wal_io_timing', 'compute_query_id',
                            'checkpoint_timeout', 'checkpoint_completion_target',
                            'max_wal_size', 'synchronous_commit',
                            'autovacuum', 'autovacuum_vacuum_scale_factor',
                            'autovacuum_vacuum_threshold'
                        )) AS settings,
                    (SELECT to_jsonb(d) FROM pg_stat_database d
                        WHERE datname = current_database()) AS database,
                    (SELECT to_jsonb(w) FROM pg_stat_wal w) AS cluster_wal,
                    (SELECT to_jsonb(b) FROM pg_stat_bgwriter b)
                        AS cluster_bgwriter,
                    ARRAY(
                        SELECT to_jsonb(s) || to_jsonb(io)
                            || jsonb_build_object(
                                'heap_size_bytes', pg_relation_size(s.relid))
                        FROM pg_stat_user_tables s
                        JOIN pg_statio_user_tables io USING (relid)
                        WHERE s.schemaname = 'public'
                            AND s.relname IN ('transactions', 'accounts', 'payouts')
                        ORDER BY s.relname
                    ) AS tables,
                    ARRAY(
                        SELECT to_jsonb(s) || to_jsonb(io)
                            || jsonb_build_object(
                                'size_bytes', pg_relation_size(s.indexrelid),
                                'valid', i.indisvalid)
                        FROM pg_stat_user_indexes s
                        JOIN pg_statio_user_indexes io USING (indexrelid)
                        JOIN pg_index i ON i.indexrelid = s.indexrelid
                        WHERE s.schemaname = 'public'
                            AND s.relname IN ('transactions', 'accounts', 'payouts')
                        ORDER BY s.indexrelid
                    ) AS indexes,
                    ARRAY(
                        SELECT to_jsonb(activity)
                        FROM (
                            SELECT backend_type, state, wait_event_type, wait_event,
                                count(*) AS connections,
                                max(EXTRACT(EPOCH FROM
                                    statement_timestamp() - xact_start))
                                    AS oldest_transaction_seconds
                            FROM pg_stat_activity
                            WHERE datname = current_database()
                                AND pid <> pg_backend_pid()
                            GROUP BY backend_type, state, wait_event_type, wait_event
                        ) activity
                    ) AS activity,
                    ARRAY(
                        SELECT to_jsonb(oldest)
                        FROM (
                            SELECT pid, application_name, state,
                                query_id::text AS query_id, xact_start,
                                wait_event_type, wait_event, age(backend_xmin)
                                    AS xmin_age
                            FROM pg_stat_activity
                            WHERE datname = current_database()
                                AND pid <> pg_backend_pid()
                                AND xact_start < statement_timestamp()
                                    - interval '30 seconds'
                            ORDER BY xact_start LIMIT 10
                        ) oldest
                    ) AS oldest_transactions,
                    ARRAY(
                        SELECT to_jsonb(v) FROM pg_stat_progress_vacuum v
                        WHERE datname = current_database()
                    ) AS vacuum_progress,
                    (SELECT jsonb_build_object(
                        'replicas', count(*),
                        'max_write_lag_seconds', max(EXTRACT(EPOCH FROM write_lag)),
                        'max_flush_lag_seconds', max(EXTRACT(EPOCH FROM flush_lag)),
                        'max_replay_lag_seconds', max(EXTRACT(EPOCH FROM replay_lag))
                    ) FROM pg_stat_replication) AS cluster_replication
            """)
        )
        return result.mappings().one()

    async def sample_payout_query_statistics(self) -> Sequence[RowMapping]:
        await self.session.execute(text("SET LOCAL statement_timeout = '1s'"))
        result = await self.session.execute(
            text("""
                SELECT s.queryid::text AS query_id, s.userid, s.toplevel,
                    s.calls, s.rows, s.total_exec_time, s.min_exec_time,
                    s.max_exec_time, s.mean_exec_time, s.stddev_exec_time,
                    s.shared_blks_hit, s.shared_blks_read,
                    s.shared_blks_dirtied, s.shared_blks_written,
                    s.temp_blks_read, s.temp_blks_written,
                    s.blk_read_time, s.blk_write_time,
                    s.wal_records, s.wal_fpi, s.wal_bytes,
                    count(*) OVER () AS matching_statements,
                    info.stats_reset, info.dealloc
                FROM pg_stat_statements s
                CROSS JOIN pg_stat_statements_info info
                WHERE s.dbid = (SELECT oid FROM pg_database
                    WHERE datname = current_database())
                    AND s.query ~* '^UPDATE (public[.])?transactions SET'
                    AND s.query ILIKE '%payout_transaction_id%'
                ORDER BY s.total_exec_time DESC, s.queryid
                LIMIT 100
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
