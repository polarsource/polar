from typing import TYPE_CHECKING, Self
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.models.product_price import (
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceSeatUnit,
)

if TYPE_CHECKING:
    from polar.models import Subscription


class SubscriptionProductPrice(RecordModel):
    __tablename__ = "subscription_product_prices"

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        primary_key=True,
    )
    product_price_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("product_prices.id", ondelete="restrict"),
        primary_key=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)

    @declared_attr
    def product_price(cls) -> Mapped["ProductPrice"]:
        # This is an association table, so eager loading makes sense
        return relationship("ProductPrice", lazy="joined")

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise_on_sql")

    @classmethod
    def from_price(
        cls,
        price: "ProductPrice",
        amount: int | None = None,
        seats: int | None = None,
    ) -> Self:
        if isinstance(price, ProductPriceFixed | LegacyRecurringProductPriceFixed):
            amount = price.price_amount
        elif isinstance(price, ProductPriceCustom | LegacyRecurringProductPriceCustom):
            assert amount is not None, "amount must be provided for custom prices"
        elif isinstance(price, ProductPriceSeatUnit):
            assert seats is not None, "seats must be provided for seat-based prices"
            amount = price.calculate_amount(seats)
        else:
            amount = 0
        return cls(product_price=price, amount=amount)
