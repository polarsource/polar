from decimal import Decimal
from typing import Any

import pytest
from pydantic import ValidationError

from polar.product.tiers import (
    InvalidQuantityError,
    NonContiguousTiersError,
    SeatTiersData,
    SeatTierType,
    Tiers,
    TierType,
    UnboundedTierNotLastError,
    seat_tiers_to_tiers,
    seat_tiers_unit_bounds,
    tiers_to_seat_tiers,
    validate_unit_bounds,
)


def _tiers_data(tier_type: TierType, tiers: list[dict[str, Any]]) -> Tiers:
    return Tiers.model_validate({"type": tier_type, "tiers": tiers})


SHARED_MULTI_TIER: list[dict[str, Any]] = [
    {"bound": 10, "unit_amount": "1000"},
    {"bound": 50, "unit_amount": "800"},
    {"bound": None, "unit_amount": "600"},
]


class TestTiersValidation:
    def test_valid_unsorted_input(self) -> None:
        tiers = _tiers_data(
            TierType.volume,
            list(reversed(SHARED_MULTI_TIER)),
        )
        assert [tier.bound for tier in tiers.tiers] == [10, 50, None]

    def test_two_unbounded_tiers_raises(self) -> None:
        with pytest.raises(ValidationError) as exc:
            _tiers_data(
                TierType.volume,
                [
                    {"bound": None, "unit_amount": "500"},
                    {"bound": None, "unit_amount": "300"},
                ],
            )
        assert exc.value.errors()[0]["type"] == "unbounded_tier_not_last"

    def test_duplicate_bound_raises(self) -> None:
        with pytest.raises(ValidationError) as exc:
            _tiers_data(
                TierType.volume,
                [
                    {"bound": 10, "unit_amount": "500"},
                    {"bound": 10, "unit_amount": "300"},
                ],
            )
        assert exc.value.errors()[0]["type"] == "duplicate_tier_bound"

    def test_serializes_decimal_rates_as_strings(self) -> None:
        tiers = _tiers_data(
            TierType.volume,
            [{"bound": None, "unit_amount": "0.000000000001"}],
        )
        serialized = tiers.model_dump(mode="json")
        assert serialized["type"] == "volume"
        assert serialized["tiers"][0]["bound"] is None
        assert serialized["tiers"][0]["unit_amount"] == "1E-12"


class TestTiersCalculateVolume:
    def test_fractional_rate(self) -> None:
        tiers = _tiers_data(
            TierType.volume,
            [{"bound": None, "unit_amount": "0.5"}],
        )
        assert tiers.calculate(10) == Decimal(5)

    def test_fractional_quantity(self) -> None:
        # Bounds are whole units, the quantity need not be: an inclusive
        # bound still places a fractional quantity unambiguously.
        tiers = _tiers_data(TierType.volume, SHARED_MULTI_TIER)
        assert tiers.calculate(Decimal("9.5")) == Decimal("9.5") * 1000
        assert tiers.calculate(Decimal("10.5")) == Decimal("10.5") * 800

    def test_fractional_quantity_on_and_below_a_bound(self) -> None:
        tiers = _tiers_data(TierType.volume, SHARED_MULTI_TIER)
        assert tiers.calculate(Decimal("10.0")) == Decimal("10.0") * 1000
        assert tiers.calculate(Decimal("9.999")) == Decimal("9.999") * 1000
        assert tiers.calculate(Decimal("10.001")) == Decimal("10.001") * 800

    def test_quantity_below_first_bound(self) -> None:
        # The engine prices from 0; purchase floors live on the price.
        tiers = _tiers_data(
            TierType.volume,
            [
                {"bound": 10, "unit_amount": "20000"},
                {"bound": None, "unit_amount": "6000"},
            ],
        )
        assert tiers.calculate(5) == 5 * 20000

    def test_past_bounded_last_tier_raises(self) -> None:
        tiers = _tiers_data(
            TierType.volume,
            [{"bound": 10, "unit_amount": "500"}],
        )
        with pytest.raises(InvalidQuantityError):
            tiers.calculate(11)


class TestTiersCalculateGraduated:
    def test_past_bounded_last_tier_bills_covered_units(self) -> None:
        tiers = _tiers_data(
            TierType.graduated,
            [{"bound": 10, "unit_amount": "500"}],
        )
        assert tiers.calculate(15) == 10 * 500

    def test_fractional_quantity_straddles_a_bound(self) -> None:
        # 9.8 splits into 9.8 inside the first tier; 15.5 into 10 + 5.5.
        tiers = _tiers_data(TierType.graduated, SHARED_MULTI_TIER)
        assert tiers.calculate(Decimal("9.8")) == Decimal("9.8") * 1000
        assert tiers.calculate(Decimal("15.5")) == 10 * 1000 + Decimal("5.5") * 800
        assert (
            tiers.calculate(Decimal("50.25"))
            == 10 * 1000 + 40 * 800 + Decimal("0.25") * 600
        )

    def test_first_tier_bills_from_unit_one(self) -> None:
        # The first tier still bills from unit one.
        tiers = _tiers_data(
            TierType.graduated,
            [
                {"bound": 10, "unit_amount": "20000"},
                {"bound": None, "unit_amount": "6000"},
            ],
        )
        assert tiers.calculate(10) == 10 * 20000
        assert tiers.calculate(15) == 10 * 20000 + 5 * 6000
        assert tiers.calculate(5) == 5 * 20000


class TestTiersCalculateContract:
    @pytest.mark.parametrize("tier_type", [TierType.volume, TierType.graduated])
    def test_zero_quantity_costs_zero(self, tier_type: TierType) -> None:
        tiers = _tiers_data(tier_type, SHARED_MULTI_TIER)
        assert tiers.calculate(0) == 0

    @pytest.mark.parametrize("tier_type", [TierType.volume, TierType.graduated])
    def test_negative_quantity_raises(self, tier_type: TierType) -> None:
        tiers = _tiers_data(tier_type, SHARED_MULTI_TIER)
        with pytest.raises(InvalidQuantityError):
            tiers.calculate(-5)


class TestValidateUnitBounds:
    def test_valid_unit_bounds(self) -> None:
        validate_unit_bounds(
            _tiers_data(TierType.volume, SHARED_MULTI_TIER),
            minimum_units=5,
            maximum_units=100,
        )

    def test_negative_minimum_units_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="minimum_units must be >= 0"):
            validate_unit_bounds(tiers, minimum_units=-1)

    def test_minimum_units_above_last_bounded_tier_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": 10, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="minimum_units must not exceed"):
            validate_unit_bounds(tiers, minimum_units=11)

    def test_minimum_units_with_unbounded_last_tier(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        validate_unit_bounds(tiers, minimum_units=1000)

    def test_zero_maximum_units_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="maximum_units must be > 0"):
            validate_unit_bounds(tiers, maximum_units=0)

    def test_maximum_units_below_minimum_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="maximum_units must be >= minimum_units"):
            validate_unit_bounds(
                tiers,
                minimum_units=10,
                maximum_units=5,
            )

    def test_maximum_units_above_last_bounded_tier_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": 10, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="maximum_units must not exceed"):
            validate_unit_bounds(tiers, maximum_units=11)


class TestSeatTiersToTiers:
    def test_converts_max_seats_to_bound(self) -> None:
        result = seat_tiers_to_tiers(
            {
                "seat_tier_type": SeatTierType.graduated,
                "tiers": [
                    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                    {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
                ],
            }
        )
        assert result.model_dump(mode="json") == {
            "type": TierType.graduated,
            "tiers": [
                {"bound": 10, "unit_amount": "1000"},
                {"bound": None, "unit_amount": "800"},
            ],
        }

    def test_missing_seat_tier_type_defaults_to_volume(self) -> None:
        result = seat_tiers_to_tiers(
            {"tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}]}  # type: ignore[typeddict-item]
        )
        assert result.type == TierType.volume

    def test_sorts_tiers(self) -> None:
        result = seat_tiers_to_tiers(
            {
                "seat_tier_type": SeatTierType.volume,
                "tiers": [
                    {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
                    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                ],
            }
        )
        assert [tier.bound for tier in result.tiers] == [10, None]

    def test_gap_raises(self) -> None:
        with pytest.raises(NonContiguousTiersError):
            seat_tiers_to_tiers(
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
            seat_tiers_to_tiers(
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
            seat_tiers_to_tiers(
                {
                    "seat_tier_type": SeatTierType.volume,
                    "tiers": [
                        {"min_seats": 1, "max_seats": None, "price_per_seat": 1000},
                        {"min_seats": 11, "max_seats": 20, "price_per_seat": 800},
                    ],
                }
            )

    def test_fractional_price_per_seat_raises(self) -> None:
        with pytest.raises(ValueError, match="whole cents"):
            seat_tiers_to_tiers(
                {
                    "seat_tier_type": SeatTierType.volume,
                    "tiers": [
                        {"min_seats": 1, "max_seats": None, "price_per_seat": 500.5},
                    ],
                }
            )


class TestSeatTiersUnitBounds:
    def test_first_min_and_last_max(self) -> None:
        assert seat_tiers_unit_bounds(
            {
                "seat_tier_type": SeatTierType.volume,
                "tiers": [
                    {"min_seats": 5, "max_seats": 10, "price_per_seat": 1000},
                    {"min_seats": 11, "max_seats": 20, "price_per_seat": 800},
                ],
            }
        ) == (5, 20)

    def test_unbounded_last_tier(self) -> None:
        assert seat_tiers_unit_bounds(
            {
                "seat_tier_type": SeatTierType.volume,
                "tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}],
            }
        ) == (1, None)

    def test_empty_tiers(self) -> None:
        assert seat_tiers_unit_bounds(
            {"seat_tier_type": SeatTierType.volume, "tiers": []}
        ) == (None, None)


MULTI_SEAT_TIERS: SeatTiersData = {
    "seat_tier_type": SeatTierType.graduated,
    "tiers": [
        {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
        {"min_seats": 11, "max_seats": 50, "price_per_seat": 800},
        {"min_seats": 51, "max_seats": None, "price_per_seat": 600},
    ],
}

SINGLE_UNLIMITED_TIER: SeatTiersData = {
    "seat_tier_type": SeatTierType.volume,
    "tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}],
}

MINIMUM_ABOVE_ONE: SeatTiersData = {
    "seat_tier_type": SeatTierType.graduated,
    "tiers": [
        {"min_seats": 10, "max_seats": 10, "price_per_seat": 20000},
        {"min_seats": 11, "max_seats": None, "price_per_seat": 6000},
    ],
}


class TestTiersToSeatTiers:
    def test_reconstructs_unbounded_last_tier(self) -> None:
        shared = seat_tiers_to_tiers(MULTI_SEAT_TIERS)
        minimum_units, maximum_units = seat_tiers_unit_bounds(MULTI_SEAT_TIERS)
        assert (
            tiers_to_seat_tiers(shared, minimum_units, maximum_units)
            == MULTI_SEAT_TIERS
        )

    def test_reconstructs_bounded_last_tier(self) -> None:
        seat_tiers: SeatTiersData = {
            "seat_tier_type": SeatTierType.volume,
            "tiers": [
                {"min_seats": 5, "max_seats": 10, "price_per_seat": 1000},
                {"min_seats": 11, "max_seats": 20, "price_per_seat": 800},
            ],
        }
        shared = seat_tiers_to_tiers(seat_tiers)
        minimum_units, maximum_units = seat_tiers_unit_bounds(seat_tiers)
        assert tiers_to_seat_tiers(shared, minimum_units, maximum_units) == seat_tiers

    def test_last_max_seats_prefers_maximum_units(self) -> None:
        shared = _tiers_data(
            TierType.volume,
            [
                {"bound": 10, "unit_amount": "1000"},
                {"bound": 50, "unit_amount": "800"},
            ],
        )
        result = tiers_to_seat_tiers(shared, minimum_units=1, maximum_units=40)
        assert result["tiers"][-1]["max_seats"] == 40
        assert result["tiers"][0]["max_seats"] == 10

    def test_omits_tiers_below_minimum_units(self) -> None:
        shared = _tiers_data(
            TierType.graduated,
            [
                {"bound": 10, "unit_amount": "1000"},
                {"bound": 50, "unit_amount": "800"},
                {"bound": None, "unit_amount": "600"},
            ],
        )
        result = tiers_to_seat_tiers(shared, minimum_units=15, maximum_units=None)
        assert result["tiers"] == [
            {"min_seats": 15, "max_seats": 50, "price_per_seat": 800},
            {"min_seats": 51, "max_seats": None, "price_per_seat": 600},
        ]

    def test_omits_tiers_above_maximum_units(self) -> None:
        shared = _tiers_data(
            TierType.graduated,
            [
                {"bound": 10, "unit_amount": "1000"},
                {"bound": 50, "unit_amount": "800"},
                {"bound": None, "unit_amount": "600"},
            ],
        )
        result = tiers_to_seat_tiers(shared, minimum_units=1, maximum_units=40)
        assert result["tiers"] == [
            {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
            {"min_seats": 11, "max_seats": 40, "price_per_seat": 800},
        ]

    def test_clips_single_tier_to_purchasable_bounds(self) -> None:
        shared = _tiers_data(
            TierType.volume,
            [
                {"bound": 10, "unit_amount": "1000"},
                {"bound": 50, "unit_amount": "800"},
            ],
        )
        result = tiers_to_seat_tiers(shared, minimum_units=15, maximum_units=40)
        assert result["tiers"] == [
            {"min_seats": 15, "max_seats": 40, "price_per_seat": 800},
        ]

    def test_fractional_unit_amount_raises(self) -> None:
        shared = _tiers_data(
            TierType.volume,
            [{"bound": None, "unit_amount": "500.5"}],
        )
        with pytest.raises(ValueError, match="whole cents"):
            tiers_to_seat_tiers(shared)

    @pytest.mark.parametrize(
        "seat_tiers",
        [MULTI_SEAT_TIERS, SINGLE_UNLIMITED_TIER, MINIMUM_ABOVE_ONE],
    )
    def test_roundtrip_is_lossless(self, seat_tiers: SeatTiersData) -> None:
        shared = seat_tiers_to_tiers(seat_tiers)
        minimum_units, maximum_units = seat_tiers_unit_bounds(seat_tiers)
        assert tiers_to_seat_tiers(shared, minimum_units, maximum_units) == seat_tiers
