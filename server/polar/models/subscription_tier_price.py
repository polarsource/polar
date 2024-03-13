from enum import StrEnum
from typing import TYPE_CHECKING, Literal, cast
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import (
        SubscriptionTier,
    )


class SubscriptionTierPriceRecurringInterval(StrEnum):
    month = "month"
    year = "year"

    def as_literal(self) -> Literal["month", "year"]:
        return cast(Literal["month", "year"], self.value)


class SubscriptionTierPrice(RecordModel):
    __tablename__ = "subscription_tier_prices"

    recurring_interval: Mapped[SubscriptionTierPriceRecurringInterval] = mapped_column(
        String, nullable=False, index=True
    )
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stripe_price_id: Mapped[str] = mapped_column(String, nullable=False)

    subscription_tier_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_tiers.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def subscription_tier(cls) -> Mapped["SubscriptionTier"]:
        return relationship(
            "SubscriptionTier", lazy="raise", back_populates="all_prices"
        )
