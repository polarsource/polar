from collections.abc import Sequence
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Self
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ColumnElement,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    event,
    type_coerce,
)
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.orm.attributes import OP_BULK_REPLACE, Event

from polar.custom_field.data import CustomFieldDataMixin
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.product.guard import is_metered_price

from .product_price import HasPriceCurrency
from .subscription_meter import SubscriptionMeter

if TYPE_CHECKING:
    from . import (
        BenefitGrant,
        Checkout,
        Customer,
        Discount,
        Meter,
        Organization,
        PaymentMethod,
        Product,
        ProductPrice,
        SubscriptionProductPrice,
    )


class SubscriptionStatus(StrEnum):
    incomplete = "incomplete"
    incomplete_expired = "incomplete_expired"
    trialing = "trialing"
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    unpaid = "unpaid"

    @classmethod
    def incomplete_statuses(cls) -> set[Self]:
        return {cls.incomplete, cls.incomplete_expired}  # type: ignore

    @classmethod
    def active_statuses(cls) -> set[Self]:
        return {cls.trialing, cls.active}  # type: ignore

    @classmethod
    def revoked_statuses(cls) -> set[Self]:
        return {cls.past_due, cls.canceled, cls.unpaid}  # type: ignore

    @classmethod
    def billable_statuses(cls) -> set[Self]:
        return cls.active_statuses() | {cls.past_due}  # type: ignore

    @classmethod
    def is_incomplete(cls, status: Self) -> bool:
        return status in cls.incomplete_statuses()

    @classmethod
    def is_active(cls, status: Self) -> bool:
        return status in cls.active_statuses()

    @classmethod
    def is_revoked(cls, status: Self) -> bool:
        return status in cls.revoked_statuses()

    @classmethod
    def is_billable(cls, status: Self) -> bool:
        return status in cls.billable_statuses()


class CustomerCancellationReason(StrEnum):
    customer_service = "customer_service"
    low_quality = "low_quality"
    missing_features = "missing_features"
    switched_service = "switched_service"
    too_complex = "too_complex"
    too_expensive = "too_expensive"
    unused = "unused"
    other = "other"


class Subscription(CustomFieldDataMixin, MetadataMixin, RecordModel):
    __tablename__ = "subscriptions"

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    recurring_interval: Mapped[SubscriptionRecurringInterval] = mapped_column(
        String, nullable=False, index=True
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, default=None
    )

    status: Mapped[SubscriptionStatus] = mapped_column(String, nullable=False)
    current_period_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    current_period_end: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False)
    canceled_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    started_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    payment_method_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("payment_methods.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def payment_method(cls) -> Mapped["PaymentMethod | None"]:
        return relationship("PaymentMethod", lazy="raise")

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")

    subscription_product_prices: Mapped[list["SubscriptionProductPrice"]] = (
        relationship(
            "SubscriptionProductPrice",
            back_populates="subscription",
            cascade="all, delete-orphan",
            # Prices are almost always needed, so eager loading makes sense
            lazy="selectin",
        )
    )

    prices: AssociationProxy[list["ProductPrice"]] = association_proxy(
        "subscription_product_prices", "product_price"
    )

    discount_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("discounts.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def discount(cls) -> Mapped["Discount | None"]:
        return relationship("Discount", lazy="joined")

    meters: Mapped[list[SubscriptionMeter]] = relationship(
        SubscriptionMeter,
        order_by="SubscriptionMeter.created_at",
        back_populates="subscription",
        cascade="all, delete-orphan",
        # Eager load
        lazy="selectin",
    )

    organization: AssociationProxy["Organization"] = association_proxy(
        "product", "organization"
    )

    checkout_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("checkouts.id", ondelete="set null"), nullable=True, index=True
    )

    customer_cancellation_reason: Mapped[CustomerCancellationReason | None] = (
        mapped_column(String, nullable=True)
    )
    customer_cancellation_comment: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    @declared_attr
    def checkout(cls) -> Mapped["Checkout | None"]:
        return relationship(
            "Checkout",
            lazy="raise",
            foreign_keys=[cls.checkout_id],  # type: ignore
        )

    @declared_attr
    def grants(cls) -> Mapped[list["BenefitGrant"]]:
        return relationship(
            "BenefitGrant",
            lazy="raise",
            order_by="BenefitGrant.benefit_id",
            back_populates="subscription",
        )

    def is_incomplete(self) -> bool:
        return SubscriptionStatus.is_incomplete(self.status)

    @hybrid_property
    def active(self) -> bool:
        return SubscriptionStatus.is_active(self.status)

    @active.inplace.expression
    @classmethod
    def _active_expression(cls) -> ColumnElement[bool]:
        return type_coerce(
            cls.status.in_(SubscriptionStatus.active_statuses()),
            Boolean,
        )

    @hybrid_property
    def revoked(self) -> bool:
        return SubscriptionStatus.is_revoked(self.status)

    @revoked.inplace.expression
    @classmethod
    def _revoked_expression(cls) -> ColumnElement[bool]:
        return type_coerce(
            cls.status.in_(SubscriptionStatus.revoked_statuses()),
            Boolean,
        )

    @hybrid_property
    def billable(self) -> bool:
        return SubscriptionStatus.is_billable(self.status)

    @billable.inplace.expression
    @classmethod
    def _billable_expression(cls) -> ColumnElement[bool]:
        return type_coerce(
            cls.status.in_(SubscriptionStatus.billable_statuses()),
            Boolean,
        )

    def can_cancel(self, immediately: bool = False) -> bool:
        if not SubscriptionStatus.is_billable(self.status):
            return False

        if self.ended_at:
            return False

        if immediately:
            return True

        if self.cancel_at_period_end or self.ends_at:
            return False
        return True

    def set_started_at(self) -> None:
        """
        Stores the starting date when the subscription
        becomes active for the first time.
        """
        if self.active and self.started_at is None:
            self.started_at = datetime.now(UTC)

    def update_amount_and_currency(
        self, prices: Sequence["SubscriptionProductPrice"], discount: "Discount | None"
    ) -> None:
        amount = sum(price.amount for price in prices)
        if discount is not None:
            amount -= discount.get_discount_amount(amount)
        self.amount = amount

        currencies = set(
            price.product_price.price_currency
            for price in prices
            if isinstance(price.product_price, HasPriceCurrency)
        )
        if len(currencies) == 0:
            self.currency = "usd"  # FIXME: Main Polar currency
        elif len(currencies) == 1:
            self.currency = currencies.pop()
        else:
            raise ValueError("Multiple currencies in subscription prices")

    def update_meters(self, prices: Sequence["SubscriptionProductPrice"]) -> None:
        subscription_meters = self.meters or []

        # Add new ones
        price_meters = [
            price.product_price.meter
            for price in prices
            if is_metered_price(price.product_price)
        ]
        for price_meter in price_meters:
            try:
                # Check if the meter already exists in the subscription
                next(sm for sm in subscription_meters if sm.meter == price_meter)
            except StopIteration:
                # If it doesn't, create a new SubscriptionMeter
                subscription_meters.append(SubscriptionMeter(meter=price_meter))

        # Remove old ones
        for subscription_meter in subscription_meters:
            if subscription_meter.meter not in price_meters:
                subscription_meters.remove(subscription_meter)

        self.meters = subscription_meters

    def get_meter(self, meter: "Meter") -> SubscriptionMeter | None:
        for subscription_meter in self.meters:
            if subscription_meter.meter_id == meter.id:
                return subscription_meter
        return None


@event.listens_for(Subscription.subscription_product_prices, "bulk_replace")
def _prices_replaced(
    target: Subscription, values: list["SubscriptionProductPrice"], initiator: Event
) -> None:
    target.update_amount_and_currency(values, target.discount)
    target.update_meters(values)


@event.listens_for(Subscription.subscription_product_prices, "append")
def _price_appended(
    target: Subscription, value: "SubscriptionProductPrice", initiator: Event
) -> None:
    # In case of a bulk replace, do nothing.
    # The bulk replace event will handle the update as a whole, preventing errors
    # where the append handler deletes a meter on first append which is still needed
    # in subsequent appends.
    if initiator is not None and initiator.op is OP_BULK_REPLACE:
        return

    target.update_amount_and_currency(
        [*target.subscription_product_prices, value], target.discount
    )
    target.update_meters([*target.subscription_product_prices, value])


@event.listens_for(Subscription.discount, "set")
def _discount_set(
    target: Subscription,
    value: "Discount | None",
    oldvalue: "Discount | None",
    initiator: Event,
) -> None:
    target.update_amount_and_currency(target.subscription_product_prices, value)
