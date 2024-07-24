from enum import StrEnum
from typing import TYPE_CHECKING, Literal, cast
from uuid import UUID

from sqlalchemy import (
    Boolean,
    ColumnElement,
    ForeignKey,
    Integer,
    String,
    Uuid,
    type_coerce,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Product, Subscription


class ProductPriceType(StrEnum):
    one_time = "one_time"
    recurring = "recurring"

    def as_literal(self) -> Literal["one_time", "recurring"]:
        return cast(Literal["one_time", "recurring"], self.value)


class ProductPriceRecurringInterval(StrEnum):
    month = "month"
    year = "year"

    def as_literal(self) -> Literal["month", "year"]:
        return cast(Literal["month", "year"], self.value)


class ProductPrice(RecordModel):
    __tablename__ = "product_prices"

    type: Mapped[ProductPriceType] = mapped_column(String, nullable=False, index=True)
    recurring_interval: Mapped[ProductPriceRecurringInterval] = mapped_column(
        String, nullable=True, index=True
    )
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stripe_price_id: Mapped[str] = mapped_column(String, nullable=False)

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise", back_populates="all_prices")

    @declared_attr
    def subscriptions(cls) -> Mapped[list["Subscription"]]:
        return relationship("Subscription", lazy="raise", back_populates="price")

    @hybrid_property
    def is_recurring(self) -> bool:
        return self.type == ProductPriceType.recurring

    @is_recurring.inplace.expression
    @classmethod
    def _is_recurring_expression(cls) -> ColumnElement[bool]:
        return type_coerce(cls.type == ProductPriceType.recurring, Boolean)
