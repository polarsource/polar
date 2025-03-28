from typing import TYPE_CHECKING, Self
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Uuid
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.models.product_price import (
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    LegacyRecurringProductPriceFree,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
)

if TYPE_CHECKING:
    from polar.models import Order, Product


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
        ForeignKey("product_prices.id", ondelete="restrict"),
        nullable=True,
    )

    @declared_attr
    def product_price(cls) -> Mapped["ProductPrice | None"]:
        return relationship("ProductPrice", lazy="raise_on_sql")

    @declared_attr
    def order(cls) -> Mapped["Order"]:
        return relationship("Order", lazy="raise_on_sql", back_populates="items")

    product: AssociationProxy["Product"] = association_proxy("product_price", "product")

    @property
    def total_amount(self) -> int:
        return self.amount + self.tax_amount

    @classmethod
    def from_price(
        cls, price: ProductPrice, tax_amount: int, amount: int | None = None
    ) -> Self:
        if isinstance(price, ProductPriceFixed | LegacyRecurringProductPriceFixed):
            amount = price.price_amount
        elif isinstance(price, ProductPriceCustom | LegacyRecurringProductPriceCustom):
            assert amount is not None, "amount must be provided for custom prices"
        elif isinstance(price, ProductPriceFree | LegacyRecurringProductPriceFree):
            amount = 0
        return cls(
            label=price.product.name,
            amount=amount,
            tax_amount=tax_amount,
            proration=False,
            product_price=price,
        )
