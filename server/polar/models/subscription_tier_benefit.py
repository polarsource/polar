from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import SubscriptionBenefit


class SubscriptionTierBenefit(RecordModel):
    __tablename__ = "subscription_tier_benefits"
    __table_args__ = (UniqueConstraint("subscription_tier_id", "order"),)

    subscription_tier_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_tiers.id", ondelete="cascade"),
        primary_key=True,
    )
    subscription_benefit_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_benefits.id", ondelete="cascade"),
        primary_key=True,
    )
    order: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    subscription_benefit: Mapped["SubscriptionBenefit"] = relationship(lazy="joined")
