from decimal import Decimal
from enum import StrEnum
from itertools import pairwise
from typing import TYPE_CHECKING, Any, Literal, NotRequired, TypedDict
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
from sqlalchemy.orm.attributes import Event

from polar.enums import (
    SubscriptionRecurringInterval,
    TaxBehaviorOption,
)
from polar.kit.currency import format_currency
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.math import polar_round

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


class TierType(StrEnum):
    volume = "volume"
    graduated = "graduated"


class Tier(TypedDict):
    """A per-unit rate applying up to `up_to` units, inclusive.

    Each tier starts where the previous one ends, the first at zero, and
    `up_to` is None on the last tier if it's unbounded. Rates are in cents
    and may be fractional, so they're stored as strings and parsed to
    Decimal before any math.
    """

    up_to: int | None
    price_per_unit: str


class TiersData(TypedDict):
    """The structure of the shared tiers JSONB column, used by every tiered
    price type.

    `minimum_units` is the smallest purchasable quantity, enforced by the
    purchase layer.
    """

    tier_type: TierType
    minimum_units: NotRequired[int]
    tiers: list[Tier]


class InvalidTiersError(ValueError):
    pass


class UnboundedTierNotLastError(InvalidTiersError):
    def __init__(self) -> None:
        super().__init__("Only the last tier can be unbounded")


class NonContiguousTiersError(InvalidTiersError):
    """Gap or overlap in legacy seat tiers, caught before translating to the
    shared format, where non-contiguous ranges cannot be represented."""

    def __init__(self, previous_max_seats: int, next_min_seats: int) -> None:
        super().__init__(
            "Gap or overlap between tiers: "
            f"tier ending at {previous_max_seats} and tier starting at {next_min_seats}"
        )
        self.previous_max_seats = previous_max_seats
        self.next_min_seats = next_min_seats


class InvalidQuantityError(ValueError):
    pass


def _parse_tier_type(data: TiersData) -> TierType:
    tier_type = data.get("tier_type")
    try:
        return TierType(tier_type)
    except ValueError as e:
        raise InvalidTiersError(f"Missing or unknown tier_type: {tier_type!r}") from e


class _ParsedTier(TypedDict):
    up_to: int | None
    price_per_unit: Decimal


def _parse_tiers(data: TiersData) -> list[_ParsedTier]:
    parsed: list[_ParsedTier] = [
        {
            "up_to": tier["up_to"],
            "price_per_unit": Decimal(tier["price_per_unit"]),
        }
        for tier in data.get("tiers", [])
    ]
    return sorted(parsed, key=lambda t: (t["up_to"] is None, t["up_to"] or 0))


def _parse_minimum_units(data: TiersData) -> int:
    return data.get("minimum_units") or 0


def _calculate_volume(quantity: Decimal | int, tiers: list[_ParsedTier]) -> Decimal:
    for tier in tiers:
        up_to = tier["up_to"]
        if up_to is None or quantity <= up_to:
            return tier["price_per_unit"] * quantity
    raise InvalidQuantityError(f"No tier covers quantity {quantity}")


def _calculate_graduated(quantity: Decimal | int, tiers: list[_ParsedTier]) -> Decimal:
    total = Decimal(0)
    remaining = quantity
    previous_up_to = 0
    for tier in tiers:
        if remaining <= 0:
            break
        up_to = tier["up_to"]
        tier_capacity = (up_to - previous_up_to) if up_to is not None else None
        units_in_tier = (
            remaining if tier_capacity is None else min(remaining, tier_capacity)
        )
        total += units_in_tier * tier["price_per_unit"]
        remaining -= units_in_tier
        if up_to is not None:
            previous_up_to = up_to
    return total


def validate_tiers_data(data: TiersData) -> None:
    _parse_tier_type(data)
    tiers = _parse_tiers(data)

    if not tiers:
        raise InvalidTiersError("At least one tier is required")

    for tier in tiers:
        if tier["price_per_unit"] < 0:
            raise InvalidTiersError(
                f"Tier price_per_unit must be >= 0, got {tier['price_per_unit']}"
            )
        up_to = tier["up_to"]
        if up_to is not None and up_to <= 0:
            raise InvalidTiersError(f"Tier up_to must be > 0, got {up_to}")

    for current, next_tier in pairwise(tiers):
        # Tiers are sorted with None last, so a duplicate None lands here.
        if current["up_to"] is None:
            raise UnboundedTierNotLastError()
        if next_tier["up_to"] == current["up_to"]:
            raise InvalidTiersError(
                f"Tier up_to values must be unique, got {current['up_to']} twice"
            )

    minimum_units = _parse_minimum_units(data)
    if minimum_units < 0:
        raise InvalidTiersError(f"minimum_units must be >= 0, got {minimum_units}")
    last_up_to = tiers[-1]["up_to"]
    if last_up_to is not None and minimum_units > last_up_to:
        raise InvalidTiersError(
            f"minimum_units must not exceed the last tier's up_to, "
            f"got {minimum_units} > {last_up_to}"
        )


class SeatTierType(StrEnum):
    volume = "volume"
    graduated = "graduated"


class SeatTier(TypedDict):
    """A single pricing tier for seat-based pricing."""

    min_seats: int
    max_seats: int | None
    price_per_seat: int


class SeatTiersData(TypedDict):
    """The structure of the seat_tiers JSONB column."""

    seat_tier_type: SeatTierType
    tiers: list[SeatTier]


def seat_tiers_to_tiers_data(seat_tiers: SeatTiersData) -> TiersData:
    """Translate the legacy seat tier format to the shared tiers format.

    Each tier's max_seats becomes `up_to`, and the first tier's min_seats
    becomes `minimum_units`. Gaps and overlaps raise, since the shared format
    can't represent them. A missing seat_tier_type means volume.
    """
    tier_type = TierType(seat_tiers.get("seat_tier_type", SeatTierType.volume))
    sorted_seat_tiers = sorted(
        seat_tiers.get("tiers", []), key=lambda t: t["min_seats"]
    )

    for current, next_tier in pairwise(sorted_seat_tiers):
        max_seats = current.get("max_seats")
        if max_seats is None:
            raise UnboundedTierNotLastError()
        if next_tier["min_seats"] != max_seats + 1:
            raise NonContiguousTiersError(max_seats, next_tier["min_seats"])

    tiers: list[Tier] = [
        {
            "up_to": tier.get("max_seats"),
            "price_per_unit": str(tier["price_per_seat"]),
        }
        for tier in sorted_seat_tiers
    ]
    data: TiersData = {"tier_type": tier_type, "tiers": tiers}
    if sorted_seat_tiers:
        data["minimum_units"] = sorted_seat_tiers[0]["min_seats"]
    return data


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


class TieredPrice:
    """Mixin for prices that bill from a shared list of tiers.

    Gives you the amount in cents for a quantity, and the unit range those
    tiers cover. Tier bounds are whole units, but the quantity need not be:
    metered usage is consumed, not purchased, so a fractional quantity is
    still unambiguous against an integer bound. The price class is
    responsible for translating the result into its own terms (seats,
    integer cents, …).
    """

    __abstract__ = True

    tiers: Mapped[TiersData | None] = mapped_column(
        postgresql.JSONB,
        use_existing_column=True,
        nullable=True,
        default=None,
    )

    def get_tiers_data(self) -> TiersData:
        """The tiers this price bills on. A type mid-migration overrides this
        to read from its legacy column instead."""
        if self.tiers is None:
            raise InvalidTiersError("Price has no tiers")
        return self.tiers

    @property
    def tier_type(self) -> TierType:
        return _parse_tier_type(self.get_tiers_data())

    def get_tiered_amount(self, quantity: Decimal | int) -> Decimal:
        tiers = _parse_tiers(self.get_tiers_data())

        if quantity < 0:
            raise InvalidQuantityError(f"Negative quantity: {quantity}")
        if quantity == 0:
            return Decimal(0)

        match self.tier_type:
            case TierType.volume:
                return _calculate_volume(quantity, tiers)
            case TierType.graduated:
                return _calculate_graduated(quantity, tiers)

    def get_minimum_units(self) -> int:
        """The smallest purchasable quantity (inclusive), 0 when unset.
        Enforced by the purchase layer, not the pricing engine."""
        return _parse_minimum_units(self.get_tiers_data())

    def get_maximum_units(self) -> int | None:
        """Inclusive end of the last tier, or None if open-ended."""
        tiers = _parse_tiers(self.get_tiers_data())
        if not tiers:
            return None
        return tiers[-1]["up_to"]


class ProductPriceMeteredUnit(TieredPrice, NewProductPrice, ProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.metered_unit]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.metered_unit
    )
    unit_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(17, 12),  # 12 decimal places, 17 digits total
        # Polymorphic columns must be nullable, as they don't apply to other types
        # None for tiered prices: exactly one of unit_amount and tiers is set
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
        billable_units = Decimal(max(0, units))
        formatted_units = format_decimal(max(0, units), locale="en_US")

        if self.tiers is not None:
            label = f"({formatted_units} consumed units, {self.tier_type} pricing)"
            raw_amount = self.get_tiered_amount(billable_units)
        else:
            if self.unit_amount is None:
                raise InvalidTiersError(
                    "Metered price has neither unit_amount nor tiers"
                )
            label = f"({formatted_units} consumed units) × {format_currency(self.unit_amount, self.price_currency, decimal_quantization=False)}"
            raw_amount = self.unit_amount * billable_units

        amount = polar_round(raw_amount)

        if self.cap_amount is not None and amount > self.cap_amount:
            amount = self.cap_amount
            label += (
                f" — Capped at {format_currency(self.cap_amount, self.price_currency)}"
            )

        return amount, label

    @property
    def is_free(self) -> bool:
        """Metered prices are never free: the amount depends on usage."""
        return False

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.metered_unit,
        "polymorphic_load": "inline",
    }


class ProductPriceSeatUnit(TieredPrice, NewProductPrice, ProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.seat_based]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.seat_based
    )
    seat_tiers: Mapped[SeatTiersData] = mapped_column(
        postgresql.JSONB,
        nullable=True,
    )

    def get_tiers_data(self) -> TiersData:
        """`seat_tiers` is still the source of truth, delete this override once reads move to `tiers`."""
        return seat_tiers_to_tiers_data(self.seat_tiers)

    def calculate_amount(self, seats: int) -> int:
        amount = self.get_tiered_amount(seats)
        # Seat rates are whole cents, so any fraction means corrupt data.
        if amount != amount.to_integral_value():
            raise ValueError(f"Seat price produced non-integral amount {amount}")
        return int(amount)

    def get_minimum_seats(self) -> int:
        return max(1, self.get_minimum_units())

    def get_maximum_seats(self) -> int | None:
        return self.get_maximum_units()

    @property
    def is_free(self) -> bool:
        tiers = self.get_tiers_data()["tiers"]
        if not tiers:
            return True
        return all(Decimal(tier["price_per_unit"]) == 0 for tier in tiers)

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.seat_based,
        "polymorphic_load": "inline",
    }


@event.listens_for(ProductPriceSeatUnit.seat_tiers, "set")
def _write_tiers_from_seat_tiers(
    target: ProductPriceSeatUnit,
    value: SeatTiersData | None,
    oldvalue: SeatTiersData | None,
    initiator: Event,
) -> None:
    """Dual-write to the shared `tiers` column, delete when `seat_tiers` is dropped."""
    target.tiers = seat_tiers_to_tiers_data(value) if value is not None else None


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
