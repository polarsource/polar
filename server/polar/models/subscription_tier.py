from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import SubscriptionGroup


class SubscriptionTier(RecordModel):
    __tablename__ = "subscription_tiers"

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stripe_product_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )
    stripe_price_id: Mapped[str | None] = mapped_column(String, nullable=True)

    subscription_group_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_groups.id", ondelete="cascade"),
        nullable=False,
    )
    subscription_group: Mapped["SubscriptionGroup"] = relationship(
        "SubscriptionGroup", lazy="raise", back_populates="tiers"
    )
