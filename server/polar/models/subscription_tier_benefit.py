from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import (
    Mapped,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import Benefit


class SubscriptionTierBenefit(RecordModel):
    __tablename__ = "subscription_tier_benefits"
    __table_args__ = (UniqueConstraint("subscription_tier_id", "order"),)

    subscription_tier_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_tiers.id", ondelete="cascade"),
        primary_key=True,
    )
    benefit_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("benefits.id", ondelete="cascade"),
        primary_key=True,
    )
    order: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    @declared_attr
    def benefit(cls) -> Mapped["Benefit"]:
        # This is an association table, so eager loading makes sense
        return relationship("Benefit", lazy="joined")
