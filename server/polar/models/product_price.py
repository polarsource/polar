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

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Product, Subscription


class ProductPriceType(StrEnum):
    one_time = "one_time"
    recurring = "recurring"

    def as_literal(self) -> Literal["one_time", "recurring"]:
        return cast(Literal["one_time", "recurring"], self.value)


class ProductPriceAmountType(StrEnum):
    fixed = "fixed"
    custom = "custom"
    free = "free"


class HasPriceCurrency:
    price_currency: Mapped[str] = mapped_column(
        String(3), nullable=True, use_existing_column=True
    )


class ProductPrice(RecordModel):
    __tablename__ = "product_prices"

    type: Mapped[ProductPriceType] = mapped_column(String, nullable=False, index=True)
    recurring_interval: Mapped[SubscriptionRecurringInterval] = mapped_column(
        String, nullable=True, index=True
    )
    amount_type: Mapped[ProductPriceAmountType] = mapped_column(
        String, nullable=False, index=True
    )
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

    __mapper_args__ = {
        "polymorphic_on": "amount_type",
    }


class ProductPriceFixed(HasPriceCurrency, ProductPrice):
    price_amount: Mapped[int] = mapped_column(Integer, nullable=True)
    amount_type: Mapped[Literal[ProductPriceAmountType.fixed]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.fixed
    )

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.fixed,
        "polymorphic_load": "inline",
    }


class ProductPriceCustom(HasPriceCurrency, ProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.custom]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.custom
    )
    minimum_amount: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )
    maximum_amount: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )
    preset_amount: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.custom,
        "polymorphic_load": "inline",
    }


class ProductPriceFree(ProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.free]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.free
    )

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.free,
        "polymorphic_load": "inline",
    }
