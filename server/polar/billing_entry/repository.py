from collections.abc import AsyncGenerator, Sequence
from datetime import datetime
from itertools import batched
from typing import cast
from uuid import UUID

from sqlalchemy import (
    ColumnExpressionArgument,
    CursorResult,
    Select,
    and_,
    func,
    or_,
    select,
    update,
)
from sqlalchemy.orm.strategy_options import contains_eager, joinedload

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import BillingEntry
from polar.models.billing_entry import BillingEntryType
from polar.models.product_price import ProductPrice, ProductPriceMeteredUnit

# Upper bound on the rows touched by a single statement when claiming pending
# entries or aggregating their events. Subscriptions can accumulate hundreds of
# thousands of pending entries; unbounded statements over that set blow past
# the database statement timeout.
PENDING_BATCH_SIZE = 5_000


class BillingEntryRepository(
    RepositorySoftDeletionIDMixin[BillingEntry, UUID],
    RepositorySoftDeletionMixin[BillingEntry],
    RepositoryBase[BillingEntry],
):
    model = BillingEntry

    async def update_order_item_id(
        self, billing_entries: Sequence[UUID], order_item_id: UUID
    ) -> None:
        for batch in batched(billing_entries, 1000):
            statement = (
                update(self.model)
                .where(
                    self.model.id.in_(batch),
                    self.model.order_item_id.is_(None),
                )
                .values(order_item_id=order_item_id)
                # Without this, SQLAlchemy walks the whole identity map on every
                # batch to sync in-session objects, making this loop quadratic on
                # subscriptions with a lot of entries.
                .execution_options(synchronize_session=False)
            )
            await self.session.execute(statement)

    async def get_all_by_subscription(
        self, subscription_id: UUID
    ) -> Sequence[BillingEntry]:
        statement = select(self.model).where(
            self.model.subscription_id == subscription_id
        )
        return await self.get_all(statement)

    async def get_pending_by_subscription(
        self,
        subscription_id: UUID,
        *,
        cutoff: datetime | None = None,
        options: Options = (),
    ) -> Sequence[BillingEntry]:
        statement = self.get_pending_by_subscription_statement(
            subscription_id, cutoff=cutoff, options=options
        )
        return await self.get_all(statement)

    async def get_static_pending_by_subscription(
        self, subscription_id: UUID, *, cutoff: datetime | None = None
    ) -> AsyncGenerator[BillingEntry]:
        statement = (
            self.get_pending_by_subscription_statement(subscription_id, cutoff=cutoff)
            .join(BillingEntry.product_price)
            .where(ProductPrice.is_static.is_(True))
            .options(
                contains_eager(BillingEntry.product_price),
                joinedload(BillingEntry.event),
            )
        )
        async for result in self.stream(statement):
            yield result

    async def get_pending_metered_by_subscription_tuples(
        self, subscription_id: UUID, *, cutoff: datetime
    ) -> Sequence[tuple[UUID, UUID, datetime, datetime]]:
        """
        Get pending metered billing entries grouped by (product_price_id, meter_id).

        Returns tuples of (product_price_id, meter_id, start_timestamp, end_timestamp).
        The grouping keeps the result small even on subscriptions with hundreds of
        thousands of entries, and materializing it lets callers run other
        statements — including streams — while iterating.

        For summable aggregations (count, sum): Each tuple represents entries to bill separately.
        For non-summable aggregations (max, min, avg, unique): Multiple tuples for the same
        meter_id will be returned (one per price), but only the first is processed by the
        service layer - the rest are skipped. The active price is determined from
        subscription.subscription_product_prices, not from these tuples.
        """
        statement = (
            self.get_pending_by_subscription_statement(subscription_id, cutoff=cutoff)
            .join(
                ProductPriceMeteredUnit,
                BillingEntry.product_price_id == ProductPriceMeteredUnit.id,
            )
            .where(BillingEntry.created_at <= cutoff)
            .with_only_columns(
                BillingEntry.product_price_id,
                ProductPriceMeteredUnit.meter_id,
                func.min(BillingEntry.start_timestamp),
                func.max(BillingEntry.end_timestamp),
            )
            .group_by(BillingEntry.product_price_id, ProductPriceMeteredUnit.meter_id)
            .order_by(None)  # Clear existing ORDER BY from base statement
            .order_by(ProductPriceMeteredUnit.meter_id.asc())
        )
        result = await self.session.execute(statement)
        return [row._tuple() for row in result.all()]

    def _pending_metered_clauses(
        self, subscription_id: UUID, *, cutoff: datetime
    ) -> tuple[ColumnExpressionArgument[bool], ...]:
        return (
            BillingEntry.subscription_id == subscription_id,
            BillingEntry.deleted_at.is_(None),
            BillingEntry.order_item_id.is_(None),
            BillingEntry.start_timestamp < cutoff,
            BillingEntry.created_at <= cutoff,
        )

    async def get_pending_event_ids_by_subscription_and_price(
        self, subscription_id: UUID, product_price_id: UUID, *, cutoff: datetime
    ) -> AsyncGenerator[Sequence[UUID]]:
        """
        Yield the event ids of pending entries for a subscription and price, in
        batches of at most PENDING_BATCH_SIZE, without loading them all at once.
        """
        statement = select(BillingEntry.event_id).where(
            *self._pending_metered_clauses(subscription_id, cutoff=cutoff),
            BillingEntry.product_price_id == product_price_id,
        )
        results = await self.session.stream_scalars(
            statement, execution_options={"yield_per": PENDING_BATCH_SIZE}
        )
        try:
            async for partition in results.partitions():
                yield partition
        finally:
            await results.close()

    async def _link_pending_batched(
        self, statement: Select[tuple[UUID]], order_item_id: UUID
    ) -> None:
        """
        Claim pending entries in bounded batches: a single UPDATE over hundreds
        of thousands of entries exceeds the database statement timeout.
        """
        update_statement = (
            update(BillingEntry)
            .where(BillingEntry.id.in_(statement.limit(PENDING_BATCH_SIZE)))
            .values(order_item_id=order_item_id)
            .execution_options(synchronize_session=False)
        )
        while True:
            # https://github.com/sqlalchemy/sqlalchemy/commit/67f62aac5b49b6d048ca39019e5bd123d3c9cfb2
            result = cast(
                CursorResult[BillingEntry], await self.session.execute(update_statement)
            )
            if result.rowcount < PENDING_BATCH_SIZE:
                break

    async def link_pending_by_subscription_and_price(
        self,
        subscription_id: UUID,
        product_price_id: UUID,
        order_item_id: UUID,
        *,
        cutoff: datetime,
    ) -> None:
        statement = select(BillingEntry.id).where(
            *self._pending_metered_clauses(subscription_id, cutoff=cutoff),
            BillingEntry.product_price_id == product_price_id,
        )
        await self._link_pending_batched(statement, order_item_id)

    async def link_pending_by_subscription_and_meter(
        self,
        subscription_id: UUID,
        meter_id: UUID,
        order_item_id: UUID,
        *,
        cutoff: datetime,
    ) -> None:
        statement = select(BillingEntry.id).where(
            *self._pending_metered_clauses(subscription_id, cutoff=cutoff),
            BillingEntry.product_price_id.in_(
                select(ProductPriceMeteredUnit.id).where(
                    ProductPriceMeteredUnit.meter_id == meter_id
                )
            ),
        )
        await self._link_pending_batched(statement, order_item_id)

    async def lock_pending_by_subscription(self, subscription_id: UUID) -> None:
        """
        Serialize order creation for a subscription with a transaction-scoped
        advisory lock, released automatically at commit or rollback.

        This prevents concurrent order creation from reading the same pending
        entries: with READ COMMITTED isolation, a transaction blocked here
        reads fresh rows once the lock holder commits and sees the entries
        are no longer pending.

        Previously implemented as SELECT ... FOR UPDATE over every pending
        entry, but row locks scale with the row count and timed out on
        subscriptions with hundreds of thousands of pending entries; the
        advisory lock is O(1).
        """
        statement = select(
            func.pg_advisory_xact_lock(
                func.hashtextextended(f"billing_entry:{subscription_id}", 0)
            )
        )
        await self.session.execute(statement)

    def get_pending_by_subscription_statement(
        self,
        subscription_id: UUID,
        *,
        cutoff: datetime | None = None,
        options: Options = (),
    ) -> Select[tuple["BillingEntry"]]:
        statement = (
            self.get_base_statement()
            .where(
                BillingEntry.order_item_id.is_(None),
                BillingEntry.subscription_id == subscription_id,
            )
            .order_by(BillingEntry.product_price_id.asc())
            .options(*options)
        )
        if cutoff is not None:
            # Usage at the boundary belongs to the next meter window, while
            # static entries created there are the new period's recurring charge.
            statement = statement.where(
                or_(
                    BillingEntry.start_timestamp < cutoff,
                    and_(
                        BillingEntry.start_timestamp == cutoff,
                        BillingEntry.type != BillingEntryType.metered,
                    ),
                )
            )
        return statement
