from decimal import Decimal
from typing import Any

import pytest

from polar.models import Meter, Product
from polar.models.product_price import (
    InvalidQuantityError,
    InvalidTiersError,
    NonContiguousTiersError,
    ProductPriceFixed,
    ProductPriceSeatUnit,
    SeatTierType,
    Tier,
    TieredPrice,
    TiersData,
    TierType,
    UnboundedTierNotLastError,
    seat_tiers_to_tiers_data,
    validate_tiers_data,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product_price_metered_unit


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("unit_amount", "cap_amount", "units", "expected_amount", "expected_label"),
    [
        (Decimal(1_00), None, 1, 1_00, "(1 consumed units) × $1.00"),
        (Decimal(1_00), None, 1.994, 1_99, "(1.994 consumed units) × $1.00"),
        (Decimal(1_00), None, 1.995, 2_00, "(1.995 consumed units) × $1.00"),
        (Decimal(1_00), None, 1.996, 2_00, "(1.996 consumed units) × $1.00"),
        (
            Decimal(1_00),
            50_00,
            1000,
            50_00,
            "(1,000 consumed units) × $1.00 — Capped at $50.00",
        ),
        (Decimal(1_00), 50_00, 1, 1_00, "(1 consumed units) × $1.00"),
        (
            Decimal("0.000000000001"),
            None,
            1_000_000,
            0,
            "(1,000,000 consumed units) × $0.00000000000001",
        ),
        (
            Decimal("0.000000000001"),
            None,
            1_000_000_000_000,
            1,
            "(1,000,000,000,000 consumed units) × $0.00000000000001",
        ),
        # Full precision unit price: $0.005 should not be rounded to $0.00
        (
            Decimal("0.5"),
            None,
            100,
            50,
            "(100 consumed units) × $0.005",
        ),
        # Negative units should display as 0
        (
            Decimal(1_00),
            None,
            -5,
            0,
            "(0 consumed units) × $1.00",
        ),
    ],
)
async def test_get_amount_and_label(
    unit_amount: Decimal,
    cap_amount: int | None,
    units: float,
    expected_amount: int,
    expected_label: str,
    save_fixture: SaveFixture,
    product: Product,
    meter: Meter,
) -> None:
    price = await create_product_price_metered_unit(
        save_fixture,
        product=product,
        meter=meter,
        unit_amount=unit_amount,
        cap_amount=cap_amount,
    )

    amount, label = price.get_amount_and_label(units)
    assert amount == expected_amount
    assert label == expected_label


class TestFixedPriceIsFree:
    """A fixed price with an amount of 0 is the free-pricing representation and must
    behave like a free price (`is_free` is True)."""

    def test_zero_amount_is_free(self) -> None:
        price = ProductPriceFixed(price_amount=0, price_currency="usd")
        assert price.is_free is True

    def test_positive_amount_is_not_free(self) -> None:
        price = ProductPriceFixed(price_amount=1000, price_currency="usd")
        assert price.is_free is False


def _make_seat_price(
    tiers: list[dict[str, Any]],
    seat_tier_type: SeatTierType = SeatTierType.volume,
) -> ProductPriceSeatUnit:
    return ProductPriceSeatUnit(
        seat_tiers={"seat_tier_type": seat_tier_type, "tiers": tiers},
        price_currency="usd",
    )


MULTI_TIER: list[dict[str, Any]] = [
    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
    {"min_seats": 11, "max_seats": 50, "price_per_seat": 800},
    {"min_seats": 51, "max_seats": None, "price_per_seat": 600},
]


class TestVolumePricing:
    def test_single_tier(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}],
            SeatTierType.volume,
        )
        assert price.calculate_amount(1) == 500
        assert price.calculate_amount(10) == 5000
        assert price.calculate_amount(100) == 50_000

    def test_multi_tier_first(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        assert price.calculate_amount(1) == 1000
        assert price.calculate_amount(10) == 10_000

    def test_multi_tier_second(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        assert price.calculate_amount(11) == 11 * 800
        assert price.calculate_amount(50) == 50 * 800

    def test_multi_tier_third(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        assert price.calculate_amount(51) == 51 * 600
        assert price.calculate_amount(100) == 100 * 600

    def test_no_seat_tier_type_defaults_to_volume(self) -> None:
        price = ProductPriceSeatUnit(
            seat_tiers={
                "tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}]
            },
            price_currency="usd",
        )
        assert price.calculate_amount(10) == 5000

    def test_single_seat(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        assert price.calculate_amount(1) == 1000

    def test_free_tier(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 0}],
            SeatTierType.volume,
        )
        assert price.calculate_amount(100) == 0

    def test_zero_seats_cost_zero(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        assert price.calculate_amount(0) == 0


class TestCalculateAmountIntegralityGuard:
    def test_fractional_stored_rate_raises(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 500.5}],
            SeatTierType.volume,
        )
        with pytest.raises(ValueError, match="non-integral amount"):
            price.calculate_amount(3)


class TestGraduatedPricing:
    def test_single_tier(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}],
            SeatTierType.graduated,
        )
        assert price.calculate_amount(1) == 500
        assert price.calculate_amount(10) == 5000

    def test_multi_tier_within_first(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        assert price.calculate_amount(5) == 5 * 1000

    def test_multi_tier_spans_two(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        # 10 seats at 1000 + 5 seats at 800
        assert price.calculate_amount(15) == 10 * 1000 + 5 * 800

    def test_multi_tier_exact_boundary(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        # Exactly 10 seats fills first tier
        assert price.calculate_amount(10) == 10 * 1000

    def test_multi_tier_exact_second_boundary(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        # 10 at 1000 + 40 at 800
        assert price.calculate_amount(50) == 10 * 1000 + 40 * 800

    def test_multi_tier_spans_all(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        # 10 at 1000 + 40 at 800 + 50 at 600
        assert price.calculate_amount(100) == 10 * 1000 + 40 * 800 + 50 * 600

    def test_multi_tier_one_seat_into_last(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        # 10 at 1000 + 40 at 800 + 1 at 600
        assert price.calculate_amount(51) == 10 * 1000 + 40 * 800 + 1 * 600

    def test_single_seat(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        assert price.calculate_amount(1) == 1000

    def test_free_first_tier_then_paid(self) -> None:
        price = _make_seat_price(
            [
                {"min_seats": 1, "max_seats": 5, "price_per_seat": 0},
                {"min_seats": 6, "max_seats": None, "price_per_seat": 1000},
            ],
            SeatTierType.graduated,
        )
        assert price.calculate_amount(3) == 0
        assert price.calculate_amount(5) == 0
        assert price.calculate_amount(8) == 3 * 1000
        assert price.calculate_amount(15) == 10 * 1000

    def test_zero_seats_cost_zero(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        assert price.calculate_amount(0) == 0

    def test_first_tier_min_seats_above_one(self) -> None:
        # Regression for T-28449: a merchant enforcing a 10-seat minimum sets the
        # first tier's min_seats to 10. The first 10 seats should all be priced at
        # the first tier's rate ($200/seat = $2000), then cheaper after.
        # Reproduces the exact sandbox config of product 231d03ca.
        price = _make_seat_price(
            [
                {"min_seats": 10, "max_seats": 10, "price_per_seat": 20000},
                {"min_seats": 11, "max_seats": None, "price_per_seat": 6000},
            ],
            SeatTierType.graduated,
        )
        # All 10 seats fall in the first tier.
        assert price.calculate_amount(10) == 10 * 20000
        # 10 at first tier + 5 at second tier.
        assert price.calculate_amount(15) == 10 * 20000 + 5 * 6000


def _tiers_data(
    tier_type: TierType,
    tiers: list[Tier],
    minimum_units: int | None = None,
) -> TiersData:
    data: TiersData = {"tier_type": tier_type, "tiers": tiers}
    if minimum_units is not None:
        data["minimum_units"] = minimum_units
    return data


def _make_tiered_price(data: TiersData) -> TieredPrice:
    price = object.__new__(TieredPrice)
    price.tiers = data
    return price


SHARED_MULTI_TIER: list[Tier] = [
    {"up_to": 10, "price_per_unit": "1000"},
    {"up_to": 50, "price_per_unit": "800"},
    {"up_to": None, "price_per_unit": "600"},
]


class TestGetTieredAmountVolume:
    def test_single_tier(self) -> None:
        price = _make_tiered_price(
            _tiers_data(
                TierType.volume,
                [{"up_to": None, "price_per_unit": "500"}],
            )
        )
        assert price.get_tiered_amount(1) == 500
        assert price.get_tiered_amount(10) == 5000

    def test_fractional_rate(self) -> None:
        price = _make_tiered_price(
            _tiers_data(
                TierType.volume,
                [{"up_to": None, "price_per_unit": "0.5"}],
            )
        )
        assert price.get_tiered_amount(10) == Decimal("5")

    def test_multi_tier(self) -> None:
        price = _make_tiered_price(_tiers_data(TierType.volume, SHARED_MULTI_TIER))
        assert price.get_tiered_amount(10) == 10_000
        assert price.get_tiered_amount(11) == 11 * 800
        assert price.get_tiered_amount(50) == 50 * 800
        assert price.get_tiered_amount(51) == 51 * 600

    def test_boundary_is_inclusive_up_to(self) -> None:
        price = _make_tiered_price(_tiers_data(TierType.volume, SHARED_MULTI_TIER))
        assert price.get_tiered_amount(10) == 10 * 1000

    def test_below_minimum_units_still_prices(self) -> None:
        # The minimum is a purchase-layer constraint; the engine prices from 0.
        price = _make_tiered_price(
            _tiers_data(
                TierType.volume,
                [
                    {"up_to": 10, "price_per_unit": "20000"},
                    {"up_to": None, "price_per_unit": "6000"},
                ],
                minimum_units=10,
            )
        )
        assert price.get_tiered_amount(5) == 5 * 20000

    def test_past_bounded_last_tier_raises(self) -> None:
        price = _make_tiered_price(
            _tiers_data(
                TierType.volume,
                [{"up_to": 10, "price_per_unit": "500"}],
            )
        )
        with pytest.raises(InvalidQuantityError):
            price.get_tiered_amount(11)

    def test_unsorted_tiers(self) -> None:
        price = _make_tiered_price(
            _tiers_data(TierType.volume, list(reversed(SHARED_MULTI_TIER)))
        )
        assert price.get_tiered_amount(5) == 5 * 1000
        assert price.get_tiered_amount(51) == 51 * 600


class TestGetTieredAmountGraduated:
    def test_spans_tiers(self) -> None:
        price = _make_tiered_price(_tiers_data(TierType.graduated, SHARED_MULTI_TIER))
        assert price.get_tiered_amount(15) == 10 * 1000 + 5 * 800
        assert price.get_tiered_amount(100) == 10 * 1000 + 40 * 800 + 50 * 600

    def test_exact_boundary(self) -> None:
        price = _make_tiered_price(_tiers_data(TierType.graduated, SHARED_MULTI_TIER))
        assert price.get_tiered_amount(10) == 10 * 1000
        assert price.get_tiered_amount(50) == 10 * 1000 + 40 * 800

    def test_past_bounded_last_tier_bills_covered_units(self) -> None:
        price = _make_tiered_price(
            _tiers_data(
                TierType.graduated,
                [{"up_to": 10, "price_per_unit": "500"}],
            )
        )
        assert price.get_tiered_amount(15) == 10 * 500

    def test_minimum_units_does_not_shift_billing(self) -> None:
        # T-28449: the minimum is a purchase floor, not a billing start — the
        # first tier still bills from unit one.
        price = _make_tiered_price(
            _tiers_data(
                TierType.graduated,
                [
                    {"up_to": 10, "price_per_unit": "20000"},
                    {"up_to": None, "price_per_unit": "6000"},
                ],
                minimum_units=10,
            )
        )
        assert price.get_tiered_amount(10) == 10 * 20000
        assert price.get_tiered_amount(15) == 10 * 20000 + 5 * 6000
        # Below the floor still bills at the first tier's rate.
        assert price.get_tiered_amount(5) == 5 * 20000

    def test_unsorted_tiers(self) -> None:
        price = _make_tiered_price(
            _tiers_data(TierType.graduated, list(reversed(SHARED_MULTI_TIER)))
        )
        assert price.get_tiered_amount(15) == 10 * 1000 + 5 * 800


class TestGetTieredAmountContract:
    @pytest.mark.parametrize("tier_type", [TierType.volume, TierType.graduated])
    def test_zero_quantity_costs_zero(self, tier_type: TierType) -> None:
        price = _make_tiered_price(_tiers_data(tier_type, SHARED_MULTI_TIER))
        assert price.get_tiered_amount(0) == 0

    @pytest.mark.parametrize("tier_type", [TierType.volume, TierType.graduated])
    def test_negative_quantity_raises(self, tier_type: TierType) -> None:
        price = _make_tiered_price(_tiers_data(tier_type, SHARED_MULTI_TIER))
        with pytest.raises(InvalidQuantityError):
            price.get_tiered_amount(-5)

    def test_missing_tier_type_raises(self) -> None:
        price = _make_tiered_price({"tiers": SHARED_MULTI_TIER})  # type: ignore[typeddict-item]
        with pytest.raises(InvalidTiersError, match="Missing or unknown tier_type"):
            price.get_tiered_amount(10)

    def test_unknown_tier_type_raises(self) -> None:
        price = _make_tiered_price(
            {"tier_type": "stepped", "tiers": SHARED_MULTI_TIER}  # type: ignore[typeddict-item]
        )
        with pytest.raises(InvalidTiersError, match="Missing or unknown tier_type"):
            price.get_tiered_amount(10)


class TestValidateTiersData:
    def test_valid_multi_tier(self) -> None:
        validate_tiers_data(_tiers_data(TierType.volume, SHARED_MULTI_TIER))

    def test_valid_single_unbounded_tier(self) -> None:
        validate_tiers_data(
            _tiers_data(
                TierType.graduated,
                [{"up_to": None, "price_per_unit": "500"}],
            )
        )

    def test_valid_unsorted_input(self) -> None:
        validate_tiers_data(
            _tiers_data(TierType.volume, list(reversed(SHARED_MULTI_TIER)))
        )

    def test_valid_minimum_units(self) -> None:
        validate_tiers_data(
            _tiers_data(TierType.volume, SHARED_MULTI_TIER, minimum_units=5)
        )

    def test_empty_tiers_raises(self) -> None:
        with pytest.raises(InvalidTiersError, match="At least one tier is required"):
            validate_tiers_data(_tiers_data(TierType.volume, []))

    def test_missing_tier_type_raises(self) -> None:
        data: Any = {"tiers": SHARED_MULTI_TIER}
        with pytest.raises(InvalidTiersError, match="Missing or unknown tier_type"):
            validate_tiers_data(data)

    def test_negative_price_raises(self) -> None:
        with pytest.raises(InvalidTiersError, match="price_per_unit must be >= 0"):
            validate_tiers_data(
                _tiers_data(
                    TierType.volume,
                    [{"up_to": None, "price_per_unit": "-500"}],
                )
            )

    def test_zero_up_to_raises(self) -> None:
        with pytest.raises(InvalidTiersError, match="up_to must be > 0"):
            validate_tiers_data(
                _tiers_data(
                    TierType.volume,
                    [
                        {"up_to": 0, "price_per_unit": "500"},
                        {"up_to": None, "price_per_unit": "300"},
                    ],
                )
            )

    def test_two_unbounded_tiers_raises(self) -> None:
        with pytest.raises(UnboundedTierNotLastError):
            validate_tiers_data(
                _tiers_data(
                    TierType.volume,
                    [
                        {"up_to": None, "price_per_unit": "500"},
                        {"up_to": None, "price_per_unit": "300"},
                    ],
                )
            )

    def test_duplicate_up_to_raises(self) -> None:
        with pytest.raises(InvalidTiersError, match="must be unique"):
            validate_tiers_data(
                _tiers_data(
                    TierType.volume,
                    [
                        {"up_to": 10, "price_per_unit": "500"},
                        {"up_to": 10, "price_per_unit": "300"},
                    ],
                )
            )

    def test_negative_minimum_units_raises(self) -> None:
        with pytest.raises(InvalidTiersError, match="minimum_units must be >= 0"):
            validate_tiers_data(
                _tiers_data(
                    TierType.volume,
                    [{"up_to": None, "price_per_unit": "500"}],
                    minimum_units=-1,
                )
            )

    def test_minimum_units_above_last_bounded_tier_raises(self) -> None:
        with pytest.raises(InvalidTiersError, match="minimum_units must not exceed"):
            validate_tiers_data(
                _tiers_data(
                    TierType.volume,
                    [{"up_to": 10, "price_per_unit": "500"}],
                    minimum_units=11,
                )
            )

    def test_minimum_units_with_unbounded_last_tier(self) -> None:
        validate_tiers_data(
            _tiers_data(
                TierType.volume,
                [{"up_to": None, "price_per_unit": "500"}],
                minimum_units=1000,
            )
        )


class TestSeatTiersToTiersData:
    def test_converts_bounds_to_up_to_and_minimum(self) -> None:
        result = seat_tiers_to_tiers_data(
            {
                "seat_tier_type": SeatTierType.graduated,
                "tiers": [
                    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                    {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
                ],
            }
        )
        assert result == {
            "tier_type": TierType.graduated,
            "minimum_units": 1,
            "tiers": [
                {"up_to": 10, "price_per_unit": "1000"},
                {"up_to": None, "price_per_unit": "800"},
            ],
        }

    def test_first_tier_min_seats_becomes_minimum_units(self) -> None:
        result = seat_tiers_to_tiers_data(
            {
                "seat_tier_type": SeatTierType.volume,
                "tiers": [
                    {"min_seats": 5, "max_seats": 10, "price_per_seat": 1000},
                    {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
                ],
            }
        )
        assert result["minimum_units"] == 5

    def test_missing_seat_tier_type_defaults_to_volume(self) -> None:
        result = seat_tiers_to_tiers_data(
            {"tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}]}  # type: ignore[typeddict-item]
        )
        assert result["tier_type"] == TierType.volume

    def test_sorts_tiers(self) -> None:
        result = seat_tiers_to_tiers_data(
            {
                "seat_tier_type": SeatTierType.volume,
                "tiers": [
                    {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
                    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                ],
            }
        )
        assert [t["up_to"] for t in result["tiers"]] == [10, None]
        assert result["minimum_units"] == 1

    def test_missing_max_seats_key(self) -> None:
        result = seat_tiers_to_tiers_data(
            {
                "seat_tier_type": SeatTierType.volume,
                "tiers": [{"min_seats": 1, "price_per_seat": 500}],  # type: ignore[typeddict-item]
            }
        )
        assert result["tiers"][0]["up_to"] is None

    def test_gap_raises(self) -> None:
        # A gap cannot be represented with up_to bounds, so translation must
        # reject it instead of silently swallowing it.
        with pytest.raises(NonContiguousTiersError):
            seat_tiers_to_tiers_data(
                {
                    "seat_tier_type": SeatTierType.volume,
                    "tiers": [
                        {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                        {"min_seats": 12, "max_seats": None, "price_per_seat": 800},
                    ],
                }
            )

    def test_overlap_raises(self) -> None:
        with pytest.raises(NonContiguousTiersError):
            seat_tiers_to_tiers_data(
                {
                    "seat_tier_type": SeatTierType.volume,
                    "tiers": [
                        {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                        {"min_seats": 8, "max_seats": None, "price_per_seat": 800},
                    ],
                }
            )

    def test_unbounded_tier_not_last_raises(self) -> None:
        with pytest.raises(UnboundedTierNotLastError):
            seat_tiers_to_tiers_data(
                {
                    "seat_tier_type": SeatTierType.volume,
                    "tiers": [
                        {"min_seats": 1, "max_seats": None, "price_per_seat": 1000},
                        {"min_seats": 11, "max_seats": 20, "price_per_seat": 800},
                    ],
                }
            )


class TestSeatTiersDualWrite:
    def test_constructor_populates_tiers(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        assert price.tiers == seat_tiers_to_tiers_data(price.seat_tiers)

    def test_updating_seat_tiers_updates_tiers(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        price.seat_tiers = {
            "seat_tier_type": SeatTierType.volume,
            "tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 250}],
        }
        assert price.tiers == {
            "tier_type": TierType.volume,
            "minimum_units": 1,
            "tiers": [
                {"up_to": None, "price_per_unit": "250"},
            ],
        }

    def test_dual_written_seat_data_passes_validation(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        assert price.tiers is not None
        validate_tiers_data(price.tiers)


class TestMinimumMaximumUnits:
    def test_minimum_units_from_key(self) -> None:
        price = _make_tiered_price(
            _tiers_data(TierType.volume, SHARED_MULTI_TIER, minimum_units=5)
        )
        assert price.get_minimum_units() == 5

    def test_minimum_units_defaults_to_zero(self) -> None:
        price = _make_tiered_price(_tiers_data(TierType.volume, SHARED_MULTI_TIER))
        assert price.get_minimum_units() == 0

    def test_maximum_units_from_last_tier(self) -> None:
        price = _make_tiered_price(
            _tiers_data(
                TierType.volume,
                [
                    {"up_to": 10, "price_per_unit": "500"},
                    {"up_to": 20, "price_per_unit": "300"},
                ],
            )
        )
        assert price.get_maximum_units() == 20

    def test_maximum_units_unbounded(self) -> None:
        price = _make_tiered_price(_tiers_data(TierType.volume, SHARED_MULTI_TIER))
        assert price.get_maximum_units() is None


class TestSeatMinimumMaximum:
    def test_minimum_seats_from_first_tier(self) -> None:
        price = _make_seat_price(
            [
                {"min_seats": 5, "max_seats": 10, "price_per_seat": 1000},
                {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
            ]
        )
        assert price.get_minimum_seats() == 5

    def test_minimum_seats_defaults_to_one(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 1000}]
        )
        assert price.get_minimum_seats() == 1

    def test_maximum_seats_from_last_tier(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": 20, "price_per_seat": 1000}]
        )
        assert price.get_maximum_seats() == 20

    def test_maximum_seats_unbounded(self) -> None:
        price = _make_seat_price(MULTI_TIER)
        assert price.get_maximum_seats() is None
