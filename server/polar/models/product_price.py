import math
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, cast
from uuid import UUID

from babel.numbers import format_currency, format_decimal
from sqlalchemy import (
    Boolean,
    ColumnElement,
    ForeignKey,
    Integer,
    String,
    Uuid,
    case,
    event,
    func,
    type_coerce,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    Mapped,
    declared_attr,
    mapped_column,
    object_mapper,
    relationship,
)

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Meter, Product


class ProductPriceType(StrEnum):
    one_time = "one_time"
    recurring = "recurring"

    def as_literal(self) -> Literal["one_time", "recurring"]:
        return cast(Literal["one_time", "recurring"], self.value)


class ProductPriceAmountType(StrEnum):
    fixed = "fixed"
    custom = "custom"
    free = "free"
    metered_unit = "metered_unit"


class HasPriceCurrency:
    price_currency: Mapped[str] = mapped_column(
        String(3), nullable=True, use_existing_column=True
    )


LEGACY_IDENTITY_PREFIX = "legacy_"


class ProductPrice(RecordModel):
    __tablename__ = "product_prices"

    # Legacy: recurring is now set on product
    type: Mapped[Any] = mapped_column(String, nullable=True, index=True, default=None)
    recurring_interval: Mapped[Any] = mapped_column(
        String, nullable=True, index=True, default=None
    )

    amount_type: Mapped[ProductPriceAmountType] = mapped_column(
        String, nullable=False, index=True
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stripe_price_id: Mapped[str | None] = mapped_column(String, nullable=True)

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise_on_sql", back_populates="all_prices")

    @hybrid_property
    def is_recurring(self) -> bool:
        return self.type == ProductPriceType.recurring

    @is_recurring.inplace.expression
    @classmethod
    def _is_recurring_expression(cls) -> ColumnElement[bool]:
        return type_coerce(cls.type == ProductPriceType.recurring, Boolean)

    @hybrid_property
    def is_static(self) -> bool:
        return self.amount_type in {
            ProductPriceAmountType.fixed,
            ProductPriceAmountType.free,
            ProductPriceAmountType.custom,
        }

    @is_static.inplace.expression
    @classmethod
    def _is_static_price_expression(cls) -> ColumnElement[bool]:
        return cls.amount_type.in_(
            (
                ProductPriceAmountType.fixed,
                ProductPriceAmountType.free,
                ProductPriceAmountType.custom,
            )
        )

    @hybrid_property
    def is_metered(self) -> bool:
        return self.amount_type in {ProductPriceAmountType.metered_unit}

    @is_metered.inplace.expression
    @classmethod
    def _is_metered_price_expression(cls) -> ColumnElement[bool]:
        return cls.amount_type.in_((ProductPriceAmountType.metered_unit,))

    @property
    def legacy_type(self) -> ProductPriceType | None:
        if self.product.is_recurring:
            return ProductPriceType.recurring
        return ProductPriceType.one_time

    @property
    def legacy_recurring_interval(self) -> SubscriptionRecurringInterval | None:
        return self.product.recurring_interval

    __mapper_args__ = {
        "polymorphic_on": case(
            (type.is_(None), amount_type),
            else_=func.concat(LEGACY_IDENTITY_PREFIX, amount_type),
        )
    }


class LegacyRecurringProductPrice:
    __abstract__ = True

    type: Mapped[ProductPriceType] = mapped_column(
        use_existing_column=True, nullable=True
    )
    recurring_interval: Mapped[SubscriptionRecurringInterval] = mapped_column(
        use_existing_column=True, nullable=True
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class NewProductPrice:
    __abstract__ = True

    type: Mapped[Literal[None]] = mapped_column(
        use_existing_column=True, nullable=True, default=None
    )
    recurring_interval: Mapped[Literal[None]] = mapped_column(
        use_existing_column=True, nullable=True, default=None
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class _ProductPriceFixed(HasPriceCurrency, ProductPrice):
    stripe_price_id: Mapped[str] = mapped_column(
        use_existing_column=True, nullable=True
    )
    price_amount: Mapped[int] = mapped_column(Integer, nullable=True)
    amount_type: Mapped[Literal[ProductPriceAmountType.fixed]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.fixed
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class ProductPriceFixed(NewProductPrice, _ProductPriceFixed):
    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.fixed,
        "polymorphic_load": "inline",
    }


class LegacyRecurringProductPriceFixed(LegacyRecurringProductPrice, _ProductPriceFixed):
    __mapper_args__ = {
        "polymorphic_identity": f"{LEGACY_IDENTITY_PREFIX}{ProductPriceAmountType.fixed}",
        "polymorphic_load": "inline",
    }


class _ProductPriceCustom(HasPriceCurrency, ProductPrice):
    stripe_price_id: Mapped[str] = mapped_column(
        use_existing_column=True, nullable=True
    )
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
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class ProductPriceCustom(NewProductPrice, _ProductPriceCustom):
    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.custom,
        "polymorphic_load": "inline",
    }


class LegacyRecurringProductPriceCustom(
    LegacyRecurringProductPrice, _ProductPriceCustom
):
    __mapper_args__ = {
        "polymorphic_identity": f"{LEGACY_IDENTITY_PREFIX}{ProductPriceAmountType.custom}",
        "polymorphic_load": "inline",
    }


class _ProductPriceFree(ProductPrice):
    stripe_price_id: Mapped[str] = mapped_column(
        use_existing_column=True, nullable=True
    )
    amount_type: Mapped[Literal[ProductPriceAmountType.free]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.free
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class ProductPriceFree(NewProductPrice, _ProductPriceFree):
    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.free,
        "polymorphic_load": "inline",
    }


class LegacyRecurringProductPriceFree(LegacyRecurringProductPrice, _ProductPriceFree):
    __mapper_args__ = {
        "polymorphic_identity": f"{LEGACY_IDENTITY_PREFIX}{ProductPriceAmountType.free}",
        "polymorphic_load": "inline",
    }


class ProductPriceMeteredUnit(ProductPrice, HasPriceCurrency, NewProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.metered_unit]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.metered_unit
    )
    unit_amount: Mapped[int] = mapped_column(
        Integer,
        # Polymorphic columns must be nullable, as they don't apply to other types
        nullable=True,
    )
    included_units: Mapped[int] = mapped_column(
        Integer,
        # Polymorphic columns must be nullable, as they don't apply to other types
        nullable=True,
        default=0,
    )
    cap_amount: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    meter_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("meters.id"),
        # Polymorphic columns must be nullable, as they don't apply to other types
        nullable=True,
        index=True,
    )

    @declared_attr
    def meter(cls) -> Mapped["Meter"]:
        return relationship("Meter", lazy="raise_on_sql")

    def get_amount_and_label(self, units: float) -> tuple[int, str]:
        label = f"({format_decimal(units, locale='en_US')} consumed units"

        if self.included_units:
            label += f"- {format_decimal(self.included_units, locale='en_US')} included units"

        label += f") × {format_currency(self.unit_amount / 100, self.price_currency.upper(), locale='en_US')}"

        billable_units = max(0, units - self.included_units)
        raw_amount = self.unit_amount * billable_units
        amount = (
            math.ceil(raw_amount)
            if raw_amount - int(raw_amount) >= 0.5
            else math.floor(raw_amount)
        )

        if self.cap_amount is not None and amount > self.cap_amount:
            amount = self.cap_amount
            label += f"— Capped at {format_currency(self.cap_amount / 100, self.price_currency.upper(), locale='en_US')}"

        return amount, label

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.metered_unit,
        "polymorphic_load": "inline",
    }


@event.listens_for(ProductPrice, "init", propagate=True)
def set_identity(instance: ProductPrice, *arg: Any, **kw: Any) -> None:
    mapper = object_mapper(instance)

    identity: str | None = mapper.polymorphic_identity

    if identity is None:
        return

    if identity.startswith(LEGACY_IDENTITY_PREFIX):
        identity = identity[len(LEGACY_IDENTITY_PREFIX) :]
    else:
        instance.type = None
        instance.recurring_interval = None

    instance.amount_type = ProductPriceAmountType(identity)
