from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Order, ProductPrice


class OrderItem(RecordModel):
    __tablename__ = "order_items"

    label: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    proration: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("orders.id", ondelete="cascade"),
    )
    product_price_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("product_prices.id", ondelete="cascade"),
        nullable=True,
    )

    @declared_attr
    def product_price(cls) -> Mapped["ProductPrice | None"]:
        return relationship("ProductPrice", lazy="raise_on_sql")

    @declared_attr
    def order(cls) -> Mapped["Order"]:
        return relationship("Order", lazy="raise_on_sql", back_populates="items")

    @property
    def total_amount(self) -> int:
        return self.amount + self.tax_amount
