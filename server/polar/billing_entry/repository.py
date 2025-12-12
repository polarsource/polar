from collections.abc import AsyncGenerator, Sequence
from datetime import datetime
from itertools import batched
from uuid import UUID

from sqlalchemy import Select, func, update
from sqlalchemy.orm.strategy_options import contains_eager

from polar.config import settings
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import BillingEntry
from polar.models.product_price import ProductPrice, ProductPriceMeteredUnit


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
            )
            await self.session.execute(statement)

    async def get_pending_by_subscription(
        self, subscription_id: UUID, *, options: Options = ()
    ) -> Sequence[BillingEntry]:
        statement = self.get_pending_by_subscription_statement(
            subscription_id, options=options
        )
        return await self.get_all(statement)

    async def get_static_pending_by_subscription(
        self, subscription_id: UUID
    ) -> AsyncGenerator[BillingEntry]:
        statement = (
            self.get_pending_by_subscription_statement(subscription_id)
            .join(BillingEntry.product_price)
            .where(ProductPrice.is_static.is_(True))
            .options(contains_eager(BillingEntry.product_price))
        )
        async for result in self.stream(statement):
            yield result

    async def get_pending_metered_by_subscription_tuples(
        self, subscription_id: UUID
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
            self.get_pending_by_subscription_statement(subscription_id)
            .join(
                ProductPriceMeteredUnit,
                BillingEntry.product_price_id == ProductPriceMeteredUnit.id,
            )
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

    async def get_pending_ids_by_subscription_and_price(
        self, subscription_id: UUID, product_price_id: UUID
    ) -> Sequence[UUID]:
        statement = (
            self.get_pending_by_subscription_statement(subscription_id)
            .with_only_columns(BillingEntry.id)
            .where(BillingEntry.product_price_id == product_price_id)
        )
        results = await self.session.execute(statement)
        return results.scalars().unique().all()

    async def get_pending_ids_by_subscription_and_meter(
        self, subscription_id: UUID, meter_id: UUID
    ) -> Sequence[UUID]:
        """
        Get all pending billing entry IDs for a subscription and meter across all prices.
        """
        statement = (
            self.get_pending_by_subscription_statement(subscription_id)
            .join(
                ProductPriceMeteredUnit,
                BillingEntry.product_price_id == ProductPriceMeteredUnit.id,
            )
            .with_only_columns(BillingEntry.id)
            .where(ProductPriceMeteredUnit.meter_id == meter_id)
        )
        results = await self.session.execute(statement)
        return results.scalars().unique().all()

    def get_pending_by_subscription_statement(
        self, subscription_id: UUID, *, options: Options = ()
    ) -> Select[tuple["BillingEntry"]]:
        return (
            self.get_base_statement()
            .where(
                BillingEntry.order_item_id.is_(None),
                BillingEntry.subscription_id == subscription_id,
            )
            .order_by(BillingEntry.product_price_id.asc())
            .options(*options)
        )
