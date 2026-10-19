from collections.abc import Sequence
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Interval, Row, cast, func, select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import Order, OrderItem, ProductPrice, Subscription
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus

BilledRow = Row[tuple[UUID, str, SubscriptionRecurringInterval, int, UUID, Decimal]]


class PricingSimulationRepository(
    RepositorySoftDeletionMixin[Subscription], RepositoryBase[Subscription]
):
    model = Subscription

    async def get_subscribers(self, product_ids: set[UUID]) -> Sequence[Subscription]:
        statement = self.get_base_statement().where(
            Subscription.product_id.in_(product_ids),
            Subscription.status.in_(SubscriptionStatus.billable_statuses()),
        )
        return await self.get_all(statement)

    async def get_billed(
        self, product_ids: set[UUID], since: datetime, until: datetime
    ) -> Sequence[BilledRow]:
        """
        Sum, per subscription and price, the subscription order items billed for
        a period overlapping the window, each weighted by its share of the window.
        """
        start = func.coalesce(OrderItem.start_timestamp, Order.created_at)
        # Items billed before 2026-09-08 have no period: assume one interval
        # from the order.
        end = func.coalesce(
            OrderItem.end_timestamp,
            Order.created_at
            + cast(
                func.concat(
                    Subscription.recurring_interval_count,
                    " ",
                    Subscription.recurring_interval,
                ),
                Interval,
            ),
        )
        overlap = func.extract(
            "epoch", func.least(end, until) - func.greatest(start, since)
        )
        length = func.nullif(func.extract("epoch", end - start), 0)
        statement = (
            select(
                Subscription.id,
                Subscription.currency,
                Subscription.recurring_interval,
                Subscription.recurring_interval_count,
                OrderItem.product_price_id,
                func.coalesce(func.sum(OrderItem.amount * overlap / length), 0),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .join(Subscription, Subscription.id == Order.subscription_id)
            .join(ProductPrice, ProductPrice.id == OrderItem.product_price_id)
            .where(
                ProductPrice.product_id.in_(product_ids),
                Order.status.in_(
                    {
                        OrderStatus.paid,
                        OrderStatus.partially_refunded,
                        OrderStatus.refunded,
                    }
                ),
                # A yearly order paid before the window still has a share in it.
                Order.created_at >= since - timedelta(days=366),
                Order.created_at < until,
                start < until,
                end > since,
            )
            .group_by(Subscription.id, OrderItem.product_price_id)
        )
        result = await self.session.execute(statement)
        return result.tuples().all()  # type: ignore[return-value]

    async def get_prices(self, price_ids: set[UUID]) -> Sequence[ProductPrice]:
        result = await self.session.execute(
            select(ProductPrice).where(ProductPrice.id.in_(price_ids))
        )
        return result.scalars().all()
