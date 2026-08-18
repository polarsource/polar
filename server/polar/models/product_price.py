from decimal import Decimal
from enum import StrEnum
from itertools import pairwise
from typing import TYPE_CHECKING, Any, Literal, TypedDict
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
from polar.exceptions import PolarError
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
    """A per-unit rate up to and including `bound`.

    Each tier starts where the previous one ended. The first starts at
    zero. `bound` is None on the last tier if it's unbounded. Rates are
    in cents and may be fractional, so they're stored as strings and
    parsed to Decimal before any math.
    """

    bound: int | None
    unit_amount: str


class TiersData(TypedDict):
    """The structure of the shared tiers JSONB column, used by every tiered
    price type. Purchasable quantity bounds live in the `minimum_units` and
    `maximum_units` columns, not here.
    """

    type: TierType
    tiers: list[Tier]


class TiersError(PolarError):
    """Base error for invalid or unusable tiered pricing data."""


class InvalidTiersError(TiersError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class UnboundedTierNotLastError(InvalidTiersError):
    def __init__(self) -> None:
        super().__init__("Only the last tier can be unbounded")


class NonContiguousTiersError(InvalidTiersError):
    """Raised when translating seat tiers that have a gap or overlap."""

    def __init__(self, previous_max_seats: int, next_min_seats: int) -> None:
        super().__init__(
            "Gap or overlap between tiers: "
            f"tier ending at {previous_max_seats} and tier starting at {next_min_seats}"
        )
        self.previous_max_seats = previous_max_seats
        self.next_min_seats = next_min_seats


class InvalidQuantityError(TiersError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


def _parse_tier_type(data: TiersData) -> TierType:
    tier_type = data.get("type")
    try:
        return TierType(tier_type)
    except ValueError as e:
        raise InvalidTiersError(f"Missing or unknown tier_type: {tier_type!r}") from e


class _ParsedTier(TypedDict):
    bound: int | None
    unit_amount: Decimal


def _parse_tiers(data: TiersData) -> list[_ParsedTier]:
    parsed: list[_ParsedTier] = [
        {
            "bound": tier["bound"],
            "unit_amount": Decimal(tier["unit_amount"]),
        }
        for tier in data.get("tiers", [])
    ]
    return sorted(parsed, key=lambda t: (t["bound"] is None, t["bound"] or 0))


def _calculate_volume(quantity: int, tiers: list[_ParsedTier]) -> Decimal:
    for tier in tiers:
        bound = tier["bound"]
        if bound is None or quantity <= bound:
            return tier["unit_amount"] * quantity
    raise InvalidQuantityError(f"No tier covers quantity {quantity}")


def _calculate_graduated(quantity: int, tiers: list[_ParsedTier]) -> Decimal:
    total = Decimal(0)
    remaining = quantity
    previous_bound = 0
    for tier in tiers:
        if remaining <= 0:
            break
        bound = tier["bound"]
        tier_capacity = (bound - previous_bound) if bound is not None else None
        units_in_tier = (
            remaining if tier_capacity is None else min(remaining, tier_capacity)
        )
        total += units_in_tier * tier["unit_amount"]
        remaining -= units_in_tier
        if bound is not None:
            previous_bound = bound
    return total


def validate_tiers_data(
    data: TiersData,
    *,
    minimum_units: int | None = None,
    maximum_units: int | None = None,
) -> None:
    _parse_tier_type(data)
    tiers = _parse_tiers(data)

    if not tiers:
        raise InvalidTiersError("At least one tier is required")

    for tier in tiers:
        if tier["unit_amount"] < 0:
            raise InvalidTiersError(
                f"Tier unit_amount must be >= 0, got {tier['unit_amount']}"
            )
        bound = tier["bound"]
        if bound is not None and bound <= 0:
            raise InvalidTiersError(f"Tier bound must be > 0, got {bound}")

    for current, next_tier in pairwise(tiers):
        # Tiers are sorted with None last, so a duplicate None lands here.
        if current["bound"] is None:
            raise UnboundedTierNotLastError()
        if next_tier["bound"] == current["bound"]:
            raise InvalidTiersError(
                f"Tier bound values must be unique, got {current['bound']} twice"
            )

    last_bound = tiers[-1]["bound"]
    if minimum_units is not None:
        if minimum_units < 0:
            raise InvalidTiersError(f"minimum_units must be >= 0, got {minimum_units}")
        if last_bound is not None and minimum_units > last_bound:
            raise InvalidTiersError(
                f"minimum_units must not exceed the last tier's bound, "
                f"got {minimum_units} > {last_bound}"
            )
    if maximum_units is not None:
        if maximum_units <= 0:
            raise InvalidTiersError(f"maximum_units must be > 0, got {maximum_units}")
        if minimum_units is not None and maximum_units < minimum_units:
            raise InvalidTiersError(
                f"maximum_units must be >= minimum_units, "
                f"got {maximum_units} < {minimum_units}"
            )
        if last_bound is not None and maximum_units > last_bound:
            raise InvalidTiersError(
                f"maximum_units must not exceed the last tier's bound, "
                f"got {maximum_units} > {last_bound}"
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

    Each tier's max_seats becomes `bound`. Gaps and overlaps raise, since the
    shared format can't represent them. A missing seat_tier_type means volume.
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
            "bound": tier.get("max_seats"),
            "unit_amount": str(tier["price_per_seat"]),
        }
        for tier in sorted_seat_tiers
    ]
    return {"type": tier_type, "tiers": tiers}


def seat_tiers_unit_bounds(seat_tiers: SeatTiersData) -> tuple[int | None, int | None]:
    """Return the first tier's min_seats and the last tier's max_seats."""
    sorted_seat_tiers = sorted(
        seat_tiers.get("tiers", []), key=lambda t: t["min_seats"]
    )
    if not sorted_seat_tiers:
        return None, None
    return sorted_seat_tiers[0]["min_seats"], sorted_seat_tiers[-1].get("max_seats")


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

    tiers: Mapped[TiersData | None] = mapped_column(
        postgresql.JSONB(none_as_null=True),
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

    def get_tiers_data(self) -> TiersData:
        """The tiers this price bills on."""
        if self.tiers is None:
            raise InvalidTiersError("Price has no tiers")
        return self.tiers

    def get_tiered_amount(self, quantity: int) -> Decimal:
        data = self.get_tiers_data()
        tier_type = _parse_tier_type(data)
        tiers = _parse_tiers(data)

        if quantity < 0:
            raise InvalidQuantityError(f"Negative quantity: {quantity}")
        if quantity == 0:
            return Decimal(0)

        match tier_type:
            case TierType.volume:
                return _calculate_volume(quantity, tiers)
            case TierType.graduated:
                return _calculate_graduated(quantity, tiers)

    def get_minimum_units(self) -> int:
        """The smallest purchasable quantity (inclusive), 0 when unset.
        Enforced by the purchase layer, not the pricing engine."""
        return self.minimum_units or 0

    def get_maximum_units(self) -> int | None:
        """The largest purchasable quantity (inclusive), or None if
        open-ended. Defaults to the last tier's bound when unset."""
        if self.maximum_units is not None:
            return self.maximum_units
        tiers = _parse_tiers(self.get_tiers_data())
        if not tiers:
            return None
        return tiers[-1]["bound"]


class ProductPriceSeatUnit(TieredPrice, NewProductPrice, ProductPrice):
    """Seat-based price. Billing still reads `seat_tiers`; the shared
    columns are dual-written. Delete the overrides when reads move to
    `tiers`.
    """

    amount_type: Mapped[Literal[ProductPriceAmountType.seat_based]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.seat_based
    )
    seat_tiers: Mapped[SeatTiersData] = mapped_column(
        postgresql.JSONB,
        nullable=True,
    )

    def get_tiers_data(self) -> TiersData:
        return seat_tiers_to_tiers_data(self.seat_tiers)

    def get_minimum_units(self) -> int:
        minimum_units, _ = seat_tiers_unit_bounds(self.seat_tiers)
        return minimum_units or 0

    def get_maximum_units(self) -> int | None:
        _, maximum_units = seat_tiers_unit_bounds(self.seat_tiers)
        return maximum_units

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
        return all(Decimal(tier["unit_amount"]) == 0 for tier in tiers)

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
    """Dual-write to the shared `tiers`, `minimum_units` and `maximum_units`
    columns. Delete when `seat_tiers` is dropped."""
    if value is None:
        target.tiers = None
        target.minimum_units = None
        target.maximum_units = None
    else:
        target.tiers = seat_tiers_to_tiers_data(value)
        target.minimum_units, target.maximum_units = seat_tiers_unit_bounds(value)


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
