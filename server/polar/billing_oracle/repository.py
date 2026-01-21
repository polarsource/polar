"""
Repository for fetching actual billing data for reconciliation.

Provides read-only access to production billing artifacts:
- Orders and order items
- Subscriptions and their prices
- Billing entries
"""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from polar.kit.db.postgres import AsyncSession
from polar.models import (
    BillingEntry,
    Customer,
    Discount,
    Order,
    OrderItem,
    Product,
    ProductPrice,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.order import OrderBillingReasonInternal

from .models import ActualLineItem, ActualOrder


class BillingOracleRepository:
    """
    Repository for fetching actual billing data.

    All methods are read-only and optimized for reconciliation queries.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_order_with_items(self, order_id: UUID) -> ActualOrder | None:
        """
        Fetch an order with all its items.

        Returns normalized ActualOrder for reconciliation.
        """
        stmt = (
            select(Order)
            .where(Order.id == order_id, Order.deleted_at.is_(None))
            .options(
                selectinload(Order.items).selectinload(OrderItem.product_price),
                joinedload(Order.product),
                joinedload(Order.discount),
            )
        )

        result = await self.session.execute(stmt)
        order = result.scalar_one_or_none()

        if order is None:
            return None

        return self._order_to_actual(order)

    async def get_subscription(self, subscription_id: UUID) -> Subscription | None:
        """
        Fetch a subscription with all related data needed for simulation.
        """
        stmt = (
            select(Subscription)
            .where(Subscription.id == subscription_id, Subscription.deleted_at.is_(None))
            .options(
                selectinload(Subscription.subscription_product_prices).selectinload(
                    SubscriptionProductPrice.product_price
                ).selectinload(ProductPrice.product),
                joinedload(Subscription.customer),
                joinedload(Subscription.product),
                joinedload(Subscription.discount),
            )
        )

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_billing_entries_for_order(
        self,
        order_id: UUID,
    ) -> Sequence[BillingEntry]:
        """
        Fetch billing entries that were consumed by an order.

        These are entries where order_item_id points to items in this order.
        """
        # First get the order item IDs
        item_stmt = select(OrderItem.id).where(OrderItem.order_id == order_id)
        item_result = await self.session.execute(item_stmt)
        item_ids = [row[0] for row in item_result.all()]

        if not item_ids:
            return []

        # Then get billing entries for those items
        stmt = (
            select(BillingEntry)
            .where(
                BillingEntry.order_item_id.in_(item_ids),
                BillingEntry.deleted_at.is_(None),
            )
            .options(
                joinedload(BillingEntry.product_price).selectinload(ProductPrice.product),
            )
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_pending_billing_entries(
        self,
        subscription_id: UUID,
    ) -> Sequence[BillingEntry]:
        """
        Fetch pending (not yet billed) billing entries for a subscription.
        """
        stmt = (
            select(BillingEntry)
            .where(
                BillingEntry.subscription_id == subscription_id,
                BillingEntry.order_item_id.is_(None),
                BillingEntry.deleted_at.is_(None),
            )
            .options(
                joinedload(BillingEntry.product_price).selectinload(ProductPrice.product),
            )
            .order_by(BillingEntry.start_timestamp)
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_orders_for_subscription(
        self,
        subscription_id: UUID,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> Sequence[Order]:
        """
        Fetch all orders for a subscription within an optional period.
        """
        stmt = (
            select(Order)
            .where(
                Order.subscription_id == subscription_id,
                Order.deleted_at.is_(None),
            )
        )

        if period_start is not None:
            stmt = stmt.where(Order.created_at >= period_start)
        if period_end is not None:
            stmt = stmt.where(Order.created_at <= period_end)

        stmt = stmt.order_by(Order.created_at)

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_recent_subscription_orders(
        self,
        hours: int = 24,
        limit: int = 1000,
    ) -> Sequence[Order]:
        """
        Fetch recent subscription orders for sweep reconciliation.

        Only returns orders with subscription_id (excludes one-time purchases).
        """
        cutoff = datetime.now(UTC) - timedelta(hours=hours)

        stmt = (
            select(Order)
            .where(
                Order.created_at >= cutoff,
                Order.subscription_id.is_not(None),
                Order.deleted_at.is_(None),
                # Only reconcile cycle orders for now
                Order.billing_reason.in_([
                    OrderBillingReasonInternal.subscription_cycle,
                    OrderBillingReasonInternal.subscription_cycle_after_trial,
                ]),
            )
            .order_by(Order.created_at.desc())
            .limit(limit)
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_active_subscriptions(
        self,
        limit: int = 1000,
        offset: int = 0,
    ) -> Sequence[Subscription]:
        """
        Fetch active subscriptions for validation.
        """
        from polar.models.subscription import SubscriptionStatus

        stmt = (
            select(Subscription)
            .where(
                Subscription.status.in_(SubscriptionStatus.active_statuses()),
                Subscription.deleted_at.is_(None),
            )
            .options(
                selectinload(Subscription.subscription_product_prices),
                joinedload(Subscription.product),
                joinedload(Subscription.discount),
            )
            .order_by(Subscription.created_at)
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    def _order_to_actual(self, order: Order) -> ActualOrder:
        """Convert a database Order to an ActualOrder for reconciliation."""
        line_items = tuple(
            ActualLineItem(
                order_item_id=item.id,
                label=item.label,
                amount=item.amount,
                currency=order.currency,
                tax_amount=item.tax_amount,
                proration=item.proration,
                price_id=item.product_price_id,
            )
            for item in order.items
        )

        # Determine period from order or subscription context
        # For now, use created_at as fallback
        period_start = order.created_at
        period_end = order.created_at

        return ActualOrder(
            order_id=order.id,
            subscription_id=order.subscription_id,
            customer_id=order.customer_id,
            product_id=order.product_id,
            billing_reason=order.billing_reason.value,
            currency=order.currency,
            status=order.status.value,
            subtotal_amount=order.subtotal_amount,
            discount_amount=order.discount_amount,
            tax_amount=order.tax_amount,
            total_amount=order.total_amount,
            applied_balance_amount=order.applied_balance_amount,
            period_start=period_start,
            period_end=period_end,
            discount_id=order.discount_id,
            line_items=line_items,
        )
