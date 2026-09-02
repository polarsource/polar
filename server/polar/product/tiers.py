from decimal import Decimal
from enum import StrEnum
from itertools import pairwise
from typing import Any, TypedDict

from pydantic import BaseModel, Field, ValidationError, field_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import Dialect, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB

from polar.exceptions import PolarError


class TierType(StrEnum):
    volume = "volume"
    graduated = "graduated"


class Tier(BaseModel):
    """A per-unit rate up to and including `bound`.

    Each tier starts where the previous one ended. The first starts at
    zero. `bound` is None on the last tier if it's unbounded. Rates are
    in cents and may be fractional.

    Rates carry no precision bound: this schema reads stored rows, and a
    bound tightened later would stop them loading. `TierInput` holds the
    rules new rates must meet.
    """

    bound: int | None = Field(default=None, gt=0)
    unit_amount: Decimal = Field(ge=0, allow_inf_nan=False)


class TierInput(BaseModel):
    """A tier submitted through the API. Rates go up to 19 whole digits, the
    reach of the BigInteger amount columns, with 12 decimal places.
    """

    bound: int | None = Field(default=None, gt=0)
    unit_amount: Decimal = Field(
        ge=0, max_digits=31, decimal_places=12, allow_inf_nan=False
    )


def sort_and_check_bounds[TierT: Tier | TierInput](tiers: list[TierT]) -> list[TierT]:
    sorted_tiers = sorted(tiers, key=lambda tier: (tier.bound is None, tier.bound or 0))
    for current, next_tier in pairwise(sorted_tiers):
        if current.bound is None:
            raise PydanticCustomError(
                "unbounded_tier_not_last",
                "Only the last tier can be unbounded",
            )
        if next_tier.bound == current.bound:
            raise PydanticCustomError(
                "duplicate_tier_bound",
                "Tier bound values must be unique, got {bound} twice",
                {"bound": current.bound},
            )
    return sorted_tiers


class Tiers(BaseModel):
    """The structure of the shared tiers JSONB column, used by every tiered
    price type. Purchasable quantity bounds live in the `minimum_units` and
    `maximum_units` columns, not here.
    """

    type: TierType
    tiers: list[Tier] = Field(min_length=1)

    @field_validator("tiers")
    @classmethod
    def validate_tiers(cls, tiers: list[Tier]) -> list[Tier]:
        return sort_and_check_bounds(tiers)

    def calculate(self, quantity: Decimal | int) -> Decimal:
        if quantity < 0:
            raise InvalidQuantityError(f"Negative quantity: {quantity}")
        if quantity == 0:
            return Decimal(0)

        match self.type:
            case TierType.volume:
                return self._calculate_volume(quantity)
            case TierType.graduated:
                return self._calculate_graduated(quantity)

    def _calculate_volume(self, quantity: Decimal | int) -> Decimal:
        for tier in self.tiers:
            if tier.bound is None or quantity <= tier.bound:
                return tier.unit_amount * quantity
        raise InvalidQuantityError(f"No tier covers quantity {quantity}")

    def _calculate_graduated(self, quantity: Decimal | int) -> Decimal:
        total = Decimal(0)
        remaining = quantity
        previous_bound = 0
        for tier in self.tiers:
            if remaining <= 0:
                break
            tier_capacity = (
                tier.bound - previous_bound if tier.bound is not None else None
            )
            units_in_tier = (
                remaining if tier_capacity is None else min(remaining, tier_capacity)
            )
            total += units_in_tier * tier.unit_amount
            remaining -= units_in_tier
            if tier.bound is not None:
                previous_bound = tier.bound
        return total

    @property
    def last_bound(self) -> int | None:
        return self.tiers[-1].bound


class TiersInput(BaseModel):
    """Tiers submitted through the API. Kept apart from `Tiers` so tightening
    a rule here never stops a stored row from loading.
    """

    type: TierType
    tiers: list[TierInput] = Field(min_length=1)

    @field_validator("tiers")
    @classmethod
    def validate_tiers(cls, tiers: list[TierInput]) -> list[TierInput]:
        return sort_and_check_bounds(tiers)

    @property
    def last_bound(self) -> int | None:
        return self.tiers[-1].bound

    def to_tiers(self) -> Tiers:
        return Tiers.model_validate(self.model_dump())


def validate_unit_bounds(
    tiers: Tiers | TiersInput,
    *,
    minimum_units: int | None = None,
    maximum_units: int | None = None,
) -> None:
    """Check purchasable quantity columns against the rate schedule.

    `minimum_units` / `maximum_units` live on the price, not in `tiers`.
    """
    last_bound = tiers.last_bound
    if minimum_units is not None:
        if minimum_units < 0:
            raise ValueError(f"minimum_units must be >= 0, got {minimum_units}")
        if last_bound is not None and minimum_units > last_bound:
            raise ValueError(
                f"minimum_units must not exceed the last tier's bound, "
                f"got {minimum_units} > {last_bound}"
            )
    if maximum_units is not None:
        if maximum_units <= 0:
            raise ValueError(f"maximum_units must be > 0, got {maximum_units}")
        if minimum_units is not None and maximum_units < minimum_units:
            raise ValueError(
                f"maximum_units must be >= minimum_units, "
                f"got {maximum_units} < {minimum_units}"
            )
        if last_bound is not None and maximum_units > last_bound:
            raise ValueError(
                f"maximum_units must not exceed the last tier's bound, "
                f"got {maximum_units} > {last_bound}"
            )


class TiersType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        return Tiers.model_validate(value).model_dump(mode="json")

    def process_result_value(self, value: Any, dialect: Dialect) -> Tiers | None:
        if value is None:
            return None
        return Tiers.model_validate(value)


class UnboundedTierNotLastError(ValueError):
    def __init__(self) -> None:
        super().__init__("Only the last tier can be unbounded")


class NonContiguousTiersError(ValueError):
    """Raised when translating seat tiers that have a gap or overlap."""

    def __init__(self, previous_max_seats: int, next_min_seats: int) -> None:
        super().__init__(
            "Gap or overlap between tiers: "
            f"tier ending at {previous_max_seats} and tier starting at {next_min_seats}"
        )
        self.previous_max_seats = previous_max_seats
        self.next_min_seats = next_min_seats


class InvalidQuantityError(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


def integral_price_per_seat(unit_amount: Decimal) -> int:
    if unit_amount != unit_amount.to_integral_value():
        raise ValueError(
            f"Seat tier rates must be in smallest currency unit, got {unit_amount}"
        )
    return int(unit_amount)


class SeatTierType(StrEnum):
    volume = "volume"
    graduated = "graduated"


class SeatTier(TypedDict):
    """A single pricing tier for seat-based pricing."""

    min_seats: int
    max_seats: int | None
    price_per_seat: int


class SeatTiersData(TypedDict):
    """The public seat-tier payload used by the HTTP API and dashboard."""

    seat_tier_type: SeatTierType
    tiers: list[SeatTier]


def seat_tiers_to_tiers(seat_tiers: SeatTiersData) -> Tiers:
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

    try:
        return Tiers(
            type=tier_type,
            tiers=[
                Tier(
                    bound=tier.get("max_seats"),
                    unit_amount=Decimal(
                        integral_price_per_seat(Decimal(tier["price_per_seat"]))
                    ),
                )
                for tier in sorted_seat_tiers
            ],
        )
    except ValidationError as e:
        raise ValueError(e.errors()[0]["msg"]) from None


def seat_tiers_unit_bounds(seat_tiers: SeatTiersData) -> tuple[int | None, int | None]:
    """Return the first tier's min_seats and the last tier's max_seats."""
    sorted_seat_tiers = sorted(
        seat_tiers.get("tiers", []), key=lambda t: t["min_seats"]
    )
    if not sorted_seat_tiers:
        return None, None
    return sorted_seat_tiers[0]["min_seats"], sorted_seat_tiers[-1].get("max_seats")


def tiers_to_seat_tiers(
    tiers: Tiers,
    minimum_units: int | None = None,
    maximum_units: int | None = None,
) -> SeatTiersData:
    """Translate the shared tiers format back to the seat API payload.

    Only tiers overlapping the purchasable interval are emitted. The first
    `min_seats` is clipped to `minimum_units` (at least 1). The last
    `max_seats` is clipped to `maximum_units` when set, otherwise the tier
    bound.
    """
    first_min = 1 if minimum_units is None or minimum_units < 1 else minimum_units
    last_max = maximum_units if maximum_units is not None else tiers.last_bound

    seat_tiers: list[SeatTier] = []
    previous_bound = 0
    for tier in tiers.tiers:
        tier_start = previous_bound + 1
        tier_end = tier.bound

        if tier_end is not None and tier_end < first_min:
            previous_bound = tier_end
            continue

        if last_max is not None and tier_start > last_max:
            break

        min_seats = max(first_min, tier_start)
        if tier_end is None:
            max_seats = last_max
        elif last_max is None:
            max_seats = tier_end
        else:
            max_seats = min(tier_end, last_max)

        seat_tiers.append(
            {
                "min_seats": min_seats,
                "max_seats": max_seats,
                "price_per_seat": integral_price_per_seat(tier.unit_amount),
            }
        )

        if tier_end is not None:
            previous_bound = tier_end

    return {
        "seat_tier_type": SeatTierType(tiers.type),
        "tiers": seat_tiers,
    }
