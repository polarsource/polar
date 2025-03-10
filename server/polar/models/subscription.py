from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Self
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ColumnElement,
    ForeignKey,
    String,
    Text,
    Uuid,
    func,
    select,
    type_coerce,
)
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.custom_field.data import CustomFieldDataMixin
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.models.product_price import HasPriceCurrency

from .subscription_product_price import SubscriptionProductPrice

if TYPE_CHECKING:
    from polar.models import (
        BenefitGrant,
        Checkout,
        Customer,
        Discount,
        Organization,
        Product,
        ProductPrice,
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
    def is_incomplete(cls, status: Self) -> bool:
        return status in cls.incomplete_statuses()

    @classmethod
    def is_active(cls, status: Self) -> bool:
        return status in cls.active_statuses()

    @classmethod
    def is_revoked(cls, status: Self) -> bool:
        return status in cls.revoked_statuses()


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
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

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
        return relationship("Discount", lazy="raise")

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

    @hybrid_property
    def amount(self) -> int | None:
        price_amounts = [
            subscription_price.amount
            for subscription_price in self.subscription_product_prices
        ]
        if not any(price_amounts):
            return None
        return sum(amount for amount in price_amounts if amount is not None)

    @amount.inplace.expression
    @classmethod
    def _amount_expression(cls) -> ColumnElement[int | None]:
        return (
            select(func.sum(SubscriptionProductPrice.amount))
            .where(SubscriptionProductPrice.subscription_id == cls.id)
            .label("amount")
        )

    @property
    def currency(self) -> str | None:
        for price in self.prices:
            if isinstance(price, HasPriceCurrency):
                return price.price_currency
        return None

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

    def can_cancel(self, immediately: bool = False) -> bool:
        if not SubscriptionStatus.is_active(self.status):
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
