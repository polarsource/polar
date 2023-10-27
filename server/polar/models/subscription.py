from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import SubscriptionTier, User


class SubscriptionStatus(StrEnum):
    incomplete = "incomplete"
    incomplete_expired = "incomplete_expired"
    trialing = "trialing"
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    unpaid = "unpaid"


class Subscription(RecordModel):
    __tablename__ = "subscriptions"

    stripe_subscription_id: Mapped[str] = mapped_column(
        String, nullable=False, index=True
    )

    status: Mapped[SubscriptionStatus] = mapped_column(String, nullable=False)
    current_period_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    current_period_end: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    price_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    user: Mapped["User"] = relationship("User", lazy="raise")

    subscription_tier_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_tiers.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    subscription_tier: Mapped["SubscriptionTier"] = relationship(
        "SubscriptionTier", lazy="raise"
    )

    def is_incomplete(self) -> bool:
        return self.status in [
            SubscriptionStatus.incomplete,
            SubscriptionStatus.incomplete_expired,
        ]

    def is_active(self) -> bool:
        return self.status in [SubscriptionStatus.trialing, SubscriptionStatus.active]

    def is_canceled(self) -> bool:
        return self.status in [
            SubscriptionStatus.past_due,
            SubscriptionStatus.canceled,
            SubscriptionStatus.unpaid,
        ]
