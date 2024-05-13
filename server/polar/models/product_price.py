from enum import StrEnum
from typing import TYPE_CHECKING, Literal, cast
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import Product, Subscription


class ProductPriceRecurringInterval(StrEnum):
    month = "month"
    year = "year"

    def as_literal(self) -> Literal["month", "year"]:
        return cast(Literal["month", "year"], self.value)


class ProductPrice(RecordModel):
    __tablename__ = "product_prices"

    recurring_interval: Mapped[ProductPriceRecurringInterval] = mapped_column(
        String, nullable=False, index=True
    )
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stripe_price_id: Mapped[str] = mapped_column(String, nullable=False)

    product_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("products.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise", back_populates="all_prices")

    @declared_attr
    def subscriptions(cls) -> Mapped[list["Subscription"]]:
        return relationship("Subscription", lazy="raise", back_populates="price")
