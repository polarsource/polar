from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Index,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import IDModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.utils import utc_now

if TYPE_CHECKING:
    from polar.models import Customer, Meter, Organization, ProductPrice, Subscription


class UsagePolicy(StrEnum):
    charge = "charge"
    trial = "trial"
    paused = "paused"


class BillingInterval(IDModel):
    __tablename__ = "billing_intervals"
    __table_args__ = (
        UniqueConstraint("subscription_id", "meter_id", "period_start"),
        Index(
            "ix_billing_intervals_open_stream",
            "subscription_id",
            "meter_id",
            unique=True,
            postgresql_where=text("period_end IS NULL"),
        ),
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="restrict"), nullable=False
    )
    subscription_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("subscriptions.id", ondelete="cascade"), nullable=False
    )
    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False
    )
    meter_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("meters.id"), nullable=False
    )
    product_price_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("product_prices.id", ondelete="restrict"), nullable=False
    )
    period_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    period_end: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    usage_policy: Mapped[UsagePolicy] = mapped_column(
        StringEnum(UsagePolicy), nullable=False
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
    subscription: Mapped["Subscription"] = relationship(lazy="raise")
    customer: Mapped["Customer"] = relationship(lazy="raise")
    meter: Mapped["Meter"] = relationship(lazy="raise")
    product_price: Mapped["ProductPrice"] = relationship(lazy="raise")
