from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .meter import Meter
    from .product_price import ProductPriceMeteredUnit
    from .subscription import Subscription


class MeterPeriodStatus(StrEnum):
    accruing = "accruing"
    settled = "settled"


class MeterPeriod(RecordModel):
    __tablename__ = "meter_periods"
    __table_args__ = (
        UniqueConstraint("subscription_id", "meter_id", "starts_at"),
        Index("ix_meter_periods_status_ends_at", "status", "ends_at"),
    )

    starts_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    ends_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    status: Mapped[MeterPeriodStatus] = mapped_column(
        StringEnum(MeterPeriodStatus),
        nullable=False,
        default=MeterPeriodStatus.accruing,
    )
    billable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    quantity: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=0)
    credited_units: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=0)
    billed_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    meter_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("meters.id", ondelete="cascade"), nullable=False, index=True
    )
    product_price_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("product_prices.id", ondelete="restrict"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise_on_sql")

    @declared_attr
    def meter(cls) -> Mapped["Meter"]:
        return relationship("Meter", lazy="raise_on_sql")

    @declared_attr
    def product_price(cls) -> Mapped["ProductPriceMeteredUnit"]:
        return relationship("ProductPriceMeteredUnit", lazy="raise_on_sql")
