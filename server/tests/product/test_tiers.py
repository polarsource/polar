from decimal import Decimal
from typing import Any

import pytest
from pydantic import ValidationError

from polar.product.tiers import (
    InvalidQuantityError,
    NonContiguousTiersError,
    SeatTierType,
    Tiers,
    TierType,
    UnboundedTierNotLastError,
    seat_tiers_to_tiers,
    seat_tiers_unit_bounds,
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
