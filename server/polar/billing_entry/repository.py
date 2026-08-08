from collections.abc import AsyncGenerator, Sequence
from datetime import datetime
from itertools import batched
from typing import cast
from uuid import UUID

from sqlalchemy import CursorResult, Select, and_, func, or_, select, update
from sqlalchemy.orm.strategy_options import contains_eager, joinedload

from polar.config import settings
from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import BillingEntry
from polar.models.billing_entry import BillingEntryType
from polar.models.product_price import ProductPrice, ProductPriceMeteredUnit

_LINK_PENDING_BATCH_SIZE = 5_000


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
            # Metered entries are the only ones created with `type=metered`, so
            # the static ones are exactly the non-metered ones. Filtering on
            # `type` lets the planner use the partial `ix_billing_entry_pending_static`
            # index and skip the pending metered entries entirely, instead of
            # scanning them all and joining `product_prices` just to discard them
            # — which times out on high-volume subscriptions.
            .where(BillingEntry.type != BillingEntryType.metered)
            .join(BillingEntry.product_price)
            # Metered entries always carry a metered price: `from_metered_event`
            # is the only writer of this type, and it takes the price from a
            # meter-scoped lookup. So this predicate selects the same rows as
            # `is_static` alone, but lets the `billing_entry` scan drop them
            # before the join to `events` rather than after it.
            .where(
                BillingEntry.type != BillingEntryType.metered,
                ProductPrice.is_static.is_(True),
            )
            .options(
                contains_eager(BillingEntry.product_price),
                joinedload(BillingEntry.event),
            )
        )
        async for result in self.stream(statement):
            yield result

    async def get_pending_metered_by_subscription_tuples(
        self, subscription_id: UUID, *, cutoff: datetime
    ) -> AsyncGenerator[tuple[UUID, UUID, datetime, datetime]]:
        """
        Get pending metered billing entries grouped by (product_price_id, meter_id).

        Returns tuples of (product_price_id, meter_id, start_timestamp, end_timestamp).

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
        results = await self.session.stream(
            statement,
            execution_options={"yield_per": settings.DATABASE_STREAM_YIELD_PER},
        )
        try:
            async for result in results:
                yield result._tuple()
        finally:
            await results.close()

    async def link_pending_by_subscription_and_price(
        self,
        subscription_id: UUID,
        product_price_id: UUID,
        order_item_id: UUID,
        *,
        cutoff: datetime,
    ) -> None:
        pending_ids = select(BillingEntry.id).where(
            BillingEntry.subscription_id == subscription_id,
            BillingEntry.deleted_at.is_(None),
            BillingEntry.order_item_id.is_(None),
            BillingEntry.product_price_id == product_price_id,
            BillingEntry.start_timestamp < cutoff,
            BillingEntry.created_at <= cutoff,
        )
        await self._link_pending(pending_ids, order_item_id)

    async def link_pending_by_subscription_and_meter(
        self,
        subscription_id: UUID,
        meter_id: UUID,
        order_item_id: UUID,
        *,
        cutoff: datetime,
    ) -> None:
        pending_ids = select(BillingEntry.id).where(
            BillingEntry.subscription_id == subscription_id,
            BillingEntry.deleted_at.is_(None),
            BillingEntry.order_item_id.is_(None),
            BillingEntry.product_price_id.in_(
                select(ProductPriceMeteredUnit.id).where(
                    ProductPriceMeteredUnit.meter_id == meter_id
                )
            ),
            BillingEntry.start_timestamp < cutoff,
            BillingEntry.created_at <= cutoff,
        )
        await self._link_pending(pending_ids, order_item_id)

    async def _link_pending(
        self, pending_ids: Select[tuple[UUID]], order_item_id: UUID
    ) -> None:
        batch_ids = pending_ids.limit(_LINK_PENDING_BATCH_SIZE)
        statement = (
            update(BillingEntry)
            .where(BillingEntry.id.in_(batch_ids))
            .values(order_item_id=order_item_id)
            .execution_options(synchronize_session=False)
        )
        while True:
            result = cast(
                CursorResult[BillingEntry], await self.session.execute(statement)
            )
            if result.rowcount < _LINK_PENDING_BATCH_SIZE:
                break

    async def lock_pending_by_subscription(self, subscription_id: UUID) -> None:
        """
        Serialize order creation for a subscription's pending billing entries
        with a transaction-level advisory lock.

        Unlike a ``FOR UPDATE`` on the pending rows, the advisory lock doesn't
        depend on those rows existing, so it also blocks a concurrent
        transaction that is about to insert new pending entries. With READ
        COMMITTED isolation, a blocked transaction resumes once the holder
        commits and sees the entries are no longer pending. The lock is
        released automatically when the transaction ends.
        """
        await pg_advisory_xact_lock(
            self.session, "billing_entry.pending", subscription_id
        )

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
