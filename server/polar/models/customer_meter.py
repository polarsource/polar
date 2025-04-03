from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Numeric, UniqueConstraint, Uuid
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .customer import Customer
    from .event import Event
    from .meter import Meter
    from .organization import Organization


class CustomerMeter(RecordModel):
    __tablename__ = "customer_meters"
    __table_args__ = (UniqueConstraint("customer_id", "meter_id"),)

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade")
    )
    meter_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("meters.id", ondelete="cascade"), index=True
    )
    last_balanced_event_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=True, index=True, default=None
    )
    units_balance: Mapped[Decimal] = mapped_column(
        Numeric, nullable=False, default=Decimal(0)
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise_on_sql")

    @declared_attr
    def meter(cls) -> Mapped["Meter"]:
        return relationship("Meter", lazy="raise_on_sql")

    @declared_attr
    def last_balanced_event(cls) -> Mapped["Event | None"]:
        return relationship("Event", lazy="raise_on_sql")

    organization: AssociationProxy["Organization"] = association_proxy(
        "customer", "organization"
    )
