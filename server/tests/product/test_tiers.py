from typing import Any

import pytest
from pydantic import ValidationError

from polar.product.tiers import (
    NonContiguousTiersError,
    SeatTierType,
    Tiers,
    TierType,
    UnboundedTierNotLastError,
    seat_tiers_to_tiers,
    seat_tiers_unit_bounds,
)


def _tiers_data(tier_type: TierType, tiers: list[dict[str, Any]]) -> Tiers:
    return Tiers.model_validate({"type": tier_type, "tiers": tiers})


SHARED_MULTI_TIER: list[dict[str, Any]] = [
    {"bound": 10, "unit_amount": "1000"},
    {"bound": 50, "unit_amount": "800"},
    {"bound": None, "unit_amount": "600"},
]


class TestTiersValidation:
    def test_valid_multi_tier(self) -> None:
        tiers = _tiers_data(TierType.volume, SHARED_MULTI_TIER)
        assert len(tiers.tiers) == 3

    def test_valid_single_unbounded_tier(self) -> None:
        tiers = _tiers_data(
            TierType.graduated,
            [{"bound": None, "unit_amount": "500"}],
        )
        assert tiers.last_bound is None

    def test_valid_unsorted_input(self) -> None:
        tiers = _tiers_data(
            TierType.volume,
            list(reversed(SHARED_MULTI_TIER)),
        )
        assert [tier.bound for tier in tiers.tiers] == [10, 50, None]

    def test_valid_unit_bounds(self) -> None:
        tiers = _tiers_data(TierType.volume, SHARED_MULTI_TIER)
        tiers.validate_unit_bounds(
            minimum_units=5,
            maximum_units=100,
        )

    def test_empty_tiers_raises(self) -> None:
        with pytest.raises(ValidationError) as exc:
            _tiers_data(TierType.volume, [])
        assert exc.value.errors()[0]["type"] == "too_short"

    def test_missing_tier_type_raises(self) -> None:
        with pytest.raises(ValidationError) as exc:
            Tiers.model_validate({"tiers": SHARED_MULTI_TIER})
        assert exc.value.errors()[0]["type"] == "missing"

    def test_unknown_tier_type_raises(self) -> None:
        with pytest.raises(ValidationError) as exc:
            Tiers.model_validate({"type": "stepped", "tiers": SHARED_MULTI_TIER})
        assert exc.value.errors()[0]["type"] == "enum"

    def test_negative_price_raises(self) -> None:
        with pytest.raises(ValidationError) as exc:
            _tiers_data(
                TierType.volume,
                [{"bound": None, "unit_amount": "-500"}],
            )
        assert exc.value.errors()[0]["type"] == "greater_than_equal"

    @pytest.mark.parametrize("unit_amount", ["NaN", "Infinity", "-Infinity"])
    def test_non_finite_price_raises(self, unit_amount: str) -> None:
        with pytest.raises(ValidationError) as exc:
            _tiers_data(
                TierType.volume,
                [{"bound": None, "unit_amount": unit_amount}],
            )
        assert exc.value.errors()[0]["type"] == "finite_number"

    def test_zero_bound_raises(self) -> None:
        with pytest.raises(ValidationError) as exc:
            _tiers_data(
                TierType.volume,
                [
                    {"bound": 0, "unit_amount": "500"},
                    {"bound": None, "unit_amount": "300"},
                ],
            )
        assert exc.value.errors()[0]["type"] == "greater_than"

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

    def test_negative_minimum_units_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="minimum_units must be >= 0"):
            tiers.validate_unit_bounds(minimum_units=-1)

    def test_minimum_units_above_last_bounded_tier_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": 10, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="minimum_units must not exceed"):
            tiers.validate_unit_bounds(minimum_units=11)

    def test_minimum_units_with_unbounded_last_tier(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        tiers.validate_unit_bounds(minimum_units=1000)

    def test_zero_maximum_units_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="maximum_units must be > 0"):
            tiers.validate_unit_bounds(maximum_units=0)

    def test_maximum_units_below_minimum_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="maximum_units must be >= minimum_units"):
            tiers.validate_unit_bounds(
                minimum_units=10,
                maximum_units=5,
            )

    def test_maximum_units_above_last_bounded_tier_raises(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": 10, "unit_amount": "500"}])
        with pytest.raises(ValueError, match="maximum_units must not exceed"):
            tiers.validate_unit_bounds(maximum_units=11)

    def test_maximum_units_with_unbounded_last_tier(self) -> None:
        tiers = _tiers_data(TierType.volume, [{"bound": None, "unit_amount": "500"}])
        tiers.validate_unit_bounds(maximum_units=1000)


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

    def test_missing_max_seats_key(self) -> None:
        result = seat_tiers_to_tiers(
            {
                "seat_tier_type": SeatTierType.volume,
                "tiers": [{"min_seats": 1, "price_per_seat": 500}],  # type: ignore[typeddict-item]
            }
        )
        assert result.tiers[0].bound is None

    def test_gap_raises(self) -> None:
        # A gap cannot be represented with bound bounds, so translation must
        # reject it instead of silently swallowing it.
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

    def test_sorts_tiers(self) -> None:
        assert seat_tiers_unit_bounds(
            {
                "seat_tier_type": SeatTierType.volume,
                "tiers": [
                    {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
                    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                ],
            }
        ) == (1, None)

    def test_empty_tiers(self) -> None:
        assert seat_tiers_unit_bounds(
            {"seat_tier_type": SeatTierType.volume, "tiers": []}
        ) == (None, None)
