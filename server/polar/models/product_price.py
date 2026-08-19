from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

from babel.numbers import format_decimal
from sqlalchemy import (
    BigInteger,
    Boolean,
    ColumnElement,
    ForeignKey,
    Numeric,
    String,
    Uuid,
    case,
    event,
    func,
    type_coerce,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    Mapped,
    declared_attr,
    mapped_column,
    object_mapper,
    relationship,
)

from polar.enums import (
    SubscriptionRecurringInterval,
    TaxBehaviorOption,
)
from polar.kit.currency import format_currency
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.math import polar_round
from polar.product.tiers import (
    SeatTiersData,
    SeatTierType,
    Tiers,
    TiersType,
    seat_tiers_to_tiers,
    seat_tiers_unit_bounds,
    tiers_to_seat_tiers,
)

if TYPE_CHECKING:
    from polar.models import Meter, Product


class ProductPriceType(StrEnum):
    one_time = "one_time"
    recurring = "recurring"

    def as_literal(self) -> Literal["one_time", "recurring"]:
        return self.value


class ProductPriceAmountType(StrEnum):
    fixed = "fixed"
    custom = "custom"
    metered_unit = "metered_unit"
    seat_based = "seat_based"


class ProductPriceSource(StrEnum):
    catalog = "catalog"
    ad_hoc = "ad_hoc"


LEGACY_IDENTITY_PREFIX = "legacy_"


class ProductPrice(RecordModel):
    __tablename__ = "product_prices"

    # Legacy: recurring is now set on product
    type: Mapped[Any] = mapped_column(String, nullable=True, index=True, default=None)
    recurring_interval: Mapped[Any] = mapped_column(
        StringEnum(SubscriptionRecurringInterval),
        nullable=True,
        index=True,
        default=None,
    )

    source = mapped_column(
        StringEnum(ProductPriceSource),
        nullable=False,
        index=True,
        default=ProductPriceSource.catalog,
    )
    amount_type: Mapped[ProductPriceAmountType] = mapped_column(
        String, nullable=False, index=True
    )
    price_currency: Mapped[str] = mapped_column(
        String(3), nullable=False, use_existing_column=True
    )
    tax_behavior: Mapped[TaxBehaviorOption | None] = mapped_column(
        StringEnum(TaxBehaviorOption), nullable=True
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="cascade"), nullable=False, index=True
    )

    checkout_product_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("checkout_products.id", ondelete="set null"),
        nullable=True,
        index=True,
        default=None,
    )
    """
    Foreign key to the CheckoutProduct this price is associated with, if any.

    Used for ad-hoc prices created on-demand for checkout sessions.
    """

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise_on_sql", back_populates="all_prices")

    @declared_attr
    def checkout_product(cls) -> Mapped["Product | None"]:
        return relationship(
            "CheckoutProduct", lazy="raise_on_sql", back_populates="ad_hoc_prices"
        )

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
            ProductPriceAmountType.custom,
            ProductPriceAmountType.seat_based,
        }

    @is_static.inplace.expression
    @classmethod
    def _is_static_price_expression(cls) -> ColumnElement[bool]:
        return cls.amount_type.in_(
            (
                ProductPriceAmountType.fixed,
                ProductPriceAmountType.custom,
                ProductPriceAmountType.seat_based,
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

    @property
    def is_free(self) -> bool:
        return False

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

    type: Mapped[None] = mapped_column(
        use_existing_column=True, nullable=True, default=None
    )
    recurring_interval: Mapped[None] = mapped_column(
        use_existing_column=True, nullable=True, default=None
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class _ProductPriceFixed(ProductPrice):
    price_amount: Mapped[int] = mapped_column(
        "price_amount_v2", BigInteger, nullable=True
    )
    amount_type: Mapped[Literal[ProductPriceAmountType.fixed]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.fixed
    )

    @property
    def is_free(self) -> bool:
        return self.price_amount == 0

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


class _ProductPriceCustom(ProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.custom]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.custom
    )
    minimum_amount: Mapped[int] = mapped_column(
        "minimum_amount_v2", BigInteger, nullable=True
    )
    maximum_amount: Mapped[int | None] = mapped_column(
        "maximum_amount_v2", BigInteger, nullable=True
    )
    preset_amount: Mapped[int | None] = mapped_column(
        "preset_amount_v2", BigInteger, nullable=True
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


class ProductPriceMeteredUnit(ProductPrice, NewProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.metered_unit]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.metered_unit
    )
    unit_amount: Mapped[Decimal] = mapped_column(
        Numeric(17, 12),  # 12 decimal places, 17 digits total
        # Polymorphic columns must be nullable, as they don't apply to other types
        nullable=True,
    )
    cap_amount: Mapped[int | None] = mapped_column(
        "cap_amount_v2", BigInteger, nullable=True
    )
    meter_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("meters.id"),
        # Polymorphic columns must be nullable, as they don't apply to other types
        nullable=True,
        index=True,
    )

    @declared_attr
    def meter(cls) -> Mapped["Meter"]:
        # For convenience, eager load it, at it's embedded in all schemas outputting a price
        return relationship("Meter", lazy="joined")

    def get_amount_and_label(self, units: float) -> tuple[int, str]:
        label = f"({format_decimal(max(0, units), locale='en_US')} consumed units"

        label += f") × {format_currency(self.unit_amount, self.price_currency, decimal_quantization=False)}"

        billable_units = Decimal(max(0, units))
        raw_amount = self.unit_amount * billable_units
        amount = polar_round(raw_amount)

        if self.cap_amount is not None and amount > self.cap_amount:
            amount = self.cap_amount
            label += (
                f" — Capped at {format_currency(self.cap_amount, self.price_currency)}"
            )

        return amount, label

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.metered_unit,
        "polymorphic_load": "inline",
    }


class TieredPrice:
    """Mixin for prices billed from a shared list of tiers.

    `get_tiered_amount` returns cents for a whole-unit quantity.
    Subclasses interpret those units (seats, metered usage, …).
    """

    __abstract__ = True

    tiers: Mapped[Tiers] = mapped_column(
        TiersType(none_as_null=True),
        use_existing_column=True,
        nullable=True,
        default=None,
    )
    minimum_units: Mapped[int | None] = mapped_column(
        BigInteger,
        use_existing_column=True,
        nullable=True,
        default=None,
    )
    maximum_units: Mapped[int | None] = mapped_column(
        BigInteger,
        use_existing_column=True,
        nullable=True,
        default=None,
    )

    def get_tiered_amount(self, quantity: int) -> Decimal:
        return self.tiers.calculate(quantity)

    def get_minimum_units(self) -> int:
        """The smallest purchasable quantity (inclusive), 0 when unset.
        Enforced by the purchase layer, not the pricing engine."""
        return self.minimum_units or 0

    def get_maximum_units(self) -> int | None:
        """The largest purchasable quantity (inclusive), or None if
        open-ended. Defaults to the last tier's bound when unset."""
        if self.maximum_units is not None:
            return self.maximum_units
        return self.tiers.last_bound


class ProductPriceSeatUnit(TieredPrice, NewProductPrice, ProductPrice):
    """Seat-based price billed from the shared `tiers` columns.

    The public `seat_tiers` attribute is the HTTP payload reconstructed
    from those columns. `_seat_tiers` keeps the unused DB column mapped
    so Alembic does not try to drop it.
    """

    amount_type: Mapped[Literal[ProductPriceAmountType.seat_based]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.seat_based
    )
    _seat_tiers: Mapped[SeatTiersData | None] = mapped_column(
        "seat_tiers",
        postgresql.JSONB,
        nullable=True,
        default=None,
    )

    @property
    def seat_tiers(self) -> SeatTiersData:
        if self.tiers is None:
            return {"seat_tier_type": SeatTierType.volume, "tiers": []}
        return tiers_to_seat_tiers(self.tiers, self.minimum_units, self.maximum_units)

    @seat_tiers.setter
    def seat_tiers(self, value: SeatTiersData | None) -> None:
        if value is None:
            self.tiers = None  # type: ignore[assignment]
            self.minimum_units = None
            self.maximum_units = None
            return
        self.tiers = seat_tiers_to_tiers(value)
        self.minimum_units, self.maximum_units = seat_tiers_unit_bounds(value)

    def calculate_amount(self, seats: int) -> int:
        amount = self.get_tiered_amount(seats)
        # Seat rates are in the smallest currency unit, so any fraction
        # means corrupt data.
        if amount != amount.to_integral_value():
            raise ValueError(f"Seat price produced non-integral amount {amount}")
        return int(amount)

    def get_minimum_seats(self) -> int:
        return self.minimum_units if self.minimum_units is not None else 1

    def get_maximum_seats(self) -> int | None:
        return self.get_maximum_units()

    @property
    def is_free(self) -> bool:
        if not self.tiers.tiers:
            return True
        return all(tier.unit_amount == 0 for tier in self.tiers.tiers)

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.seat_based,
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
