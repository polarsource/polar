from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Numeric, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.sql.sqltypes import Integer

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .meter import Meter
    from .subscription import Subscription


class SubscriptionMeter(RecordModel):
    __tablename__ = "subscription_meters"

    consumed_units: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=0)
    credited_units: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("subscriptions.id", ondelete="cascade"), nullable=False
    )
    meter_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("meters.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship(
            "Subscription", lazy="raise_on_sql", back_populates="meters"
        )

    @declared_attr
    def meter(cls) -> Mapped["Meter"]:
        return relationship("Meter", lazy="raise_on_sql")

    def reset(self) -> None:
        self.consumed_units = Decimal(0)
        self.credited_units = 0
        self.amount = 0
