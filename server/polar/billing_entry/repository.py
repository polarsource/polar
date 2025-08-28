from collections.abc import AsyncGenerator, Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, update
from sqlalchemy.orm.strategy_options import contains_eager

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import BillingEntry
from polar.models.product_price import ProductPrice


class BillingEntryRepository(
    RepositorySoftDeletionIDMixin[BillingEntry, UUID],
    RepositorySoftDeletionMixin[BillingEntry],
    RepositoryBase[BillingEntry],
):
    model = BillingEntry

    async def update_order_item_id(
        self, billing_entries: Sequence[UUID], order_item_id: UUID
    ) -> None:
        statement = (
            update(self.model)
            .where(
                self.model.id.in_(billing_entries),
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
    ) -> AsyncGenerator[tuple[UUID, datetime, datetime]]:
        statement = (
            self.get_pending_by_subscription_statement(subscription_id)
            .join(BillingEntry.product_price)
            .with_only_columns(
                BillingEntry.product_price_id,
                func.min(BillingEntry.start_timestamp),
                func.max(BillingEntry.end_timestamp),
            )
            .where(ProductPrice.is_metered.is_(True))
            .group_by(BillingEntry.product_price_id)
        )
        results = await self.session.stream(statement)
        try:
            async for result in results.unique():
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
