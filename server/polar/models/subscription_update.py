from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.sql.sqltypes import Integer

from polar.kit.db.models import RecordModel
from polar.kit.utils import utc_now
from polar.product.guard import is_recurring_product
from polar.product.price_set import PriceSet

from .subscription_product_price import SubscriptionProductPrice

if TYPE_CHECKING:
    from polar.models import Product, Subscription


class SubscriptionUpdate(RecordModel):
    """
    Represent a pending subscription update.

    Can be used when:

    - A subscription is updated to a new product or when seats are added or removed,
    but we are waiting for a successful payment to be made before applying the update.
    - A subscription update is scheduled for a future date, for example to apply a new product at the end of the current billing cycle.
    """

    __tablename__ = "subscription_updates"

    applies_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    """Date and time at which the subscription update is applied. Anchor for proration calculations."""

    applied_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    """Date and time at which the subscription update was applied, or None if not applied yet."""

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    """ID of the `Subscription` concerned by this update."""

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise")

    product_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="cascade"), nullable=True
    )
    """ID of the new `Product` to apply to the subscription."""

    @declared_attr
    def product(cls) -> Mapped["Product | None"]:
        return relationship("Product", lazy="raise")

    new_cycle_start: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    """New cycle start to apply to the subscription."""

    new_cycle_end: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    """New cycle end to apply to the subscription."""

    seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    """Number of seats to apply to the subscription."""

    def is_interval_changed(self) -> bool:
        """Return True if the subscription update includes a change of billing interval."""
        if self.product is None:
            return False
        return (
            self.product.recurring_interval
            != self.subscription.product.recurring_interval
            or self.product.recurring_interval_count
            != self.subscription.product.recurring_interval_count
        )

    def apply_update(self) -> Subscription:
        """Apply the subscription update to the subscription and return the updated subscription."""
        subscription = self.subscription

        if self.product is not None:
            assert is_recurring_product(self.product)
            subscription.product = self.product
            subscription.subscription_product_prices = [
                SubscriptionProductPrice.from_price(price, seats=subscription.seats)
                for price in PriceSet.from_product(self.product, subscription.currency)
            ]
            subscription.recurring_interval = self.product.recurring_interval
            subscription.recurring_interval_count = (
                self.product.recurring_interval_count
            )

        if self.new_cycle_start is not None:
            subscription.current_period_start = self.new_cycle_start

        if self.new_cycle_end is not None:
            subscription.current_period_end = self.new_cycle_end

        if self.seats is not None:
            subscription.seats = self.seats
            subscription.subscription_product_prices = [
                SubscriptionProductPrice.from_price(spp.product_price, seats=self.seats)
                for spp in subscription.subscription_product_prices
            ]

        self.applied_at = utc_now()

        return subscription
