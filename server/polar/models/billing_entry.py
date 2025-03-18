from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StrEnumType

if TYPE_CHECKING:
    from polar.models import Customer, Event, OrderItem, ProductPrice


class BillingEntryDirection(StrEnum):
    debit = "debit"
    credit = "credit"


class BillingEntry(RecordModel):
    __tablename__ = "billing_entry"

    start_timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, index=True
    )
    end_timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, index=True
    )
    direction: Mapped[BillingEntryDirection] = mapped_column(
        StrEnumType(BillingEntryDirection), nullable=False
    )
    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False
    )
    product_price_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("product_prices.id", ondelete="cascade"), nullable=False
    )
    event_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("events.id", ondelete="cascade"), nullable=False
    )
    order_item_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("order_items.id", ondelete="cascade"), nullable=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise_on_sql")

    @declared_attr
    def product_price(cls) -> Mapped["ProductPrice"]:
        return relationship("ProductPrice", lazy="raise_on_sql")

    @declared_attr
    def event(cls) -> Mapped["Event"]:
        return relationship("Event", lazy="raise_on_sql")

    @declared_attr
    def order_item(cls) -> Mapped["OrderItem | None"]:
        return relationship("OrderItem", lazy="raise_on_sql")
