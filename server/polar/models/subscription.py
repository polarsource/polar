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
    Uuid,
    type_coerce,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import BenefitGrant, Checkout, Product, ProductPrice, User


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


class Subscription(MetadataMixin, RecordModel):
    __tablename__ = "subscriptions"

    amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
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
    started_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")

    price_id: Mapped[UUID] = mapped_column(
        ForeignKey("product_prices.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def price(cls) -> Mapped["ProductPrice"]:
        return relationship(
            "ProductPrice", lazy="raise", back_populates="subscriptions"
        )

    checkout_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("checkouts.id", ondelete="set null"), nullable=True, index=True
    )

    @declared_attr
    def checkout(cls) -> Mapped["Checkout | None"]:
        return relationship("Checkout", lazy="raise")

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

    def set_started_at(self) -> None:
        """
        Stores the starting date when the subscription
        becomes active for the first time.
        """
        if self.active and self.started_at is None:
            self.started_at = datetime.now(UTC)
