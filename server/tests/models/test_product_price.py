from decimal import Decimal
from typing import Any

import pytest

from polar.models import Meter, Product
from polar.models.product_price import (
    MeteredTierType,
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
    SeatTierType,
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


def _make_metered_tiered_price(
    tiers: list[dict[str, Any]],
    metered_tier_type: MeteredTierType = MeteredTierType.volume,
    cap_amount: int | None = None,
) -> ProductPriceMeteredUnit:
    return ProductPriceMeteredUnit(
        metered_tiers={"metered_tier_type": metered_tier_type, "tiers": tiers},
        cap_amount=cap_amount,
        price_currency="usd",
    )


# The example from the feature request:
#   1 - 50 units:   flat fee of $999
#   51 - 100 units: $20/unit
#   101 - 200 units: $17.50/unit
#   201+ units:     $15/unit
GOAL_TIERS: list[dict[str, Any]] = [
    {"min_units": 1, "max_units": 50, "unit_amount": "0", "flat_amount": 999_00},
    {"min_units": 51, "max_units": 100, "unit_amount": "2000", "flat_amount": None},
    {"min_units": 101, "max_units": 200, "unit_amount": "1750", "flat_amount": None},
    {"min_units": 201, "max_units": None, "unit_amount": "1500", "flat_amount": None},
]


class TestMeteredVolumeTiers:
    def test_goal_example(self) -> None:
        price = _make_metered_tiered_price(GOAL_TIERS, MeteredTierType.volume)
        # 25 units fall in the flat tier → $999 flat.
        assert price.get_amount_and_label(25)[0] == 999_00
        # 50 units (boundary) still flat tier.
        assert price.get_amount_and_label(50)[0] == 999_00
        # 75 units → 75 × $20.
        assert price.get_amount_and_label(75)[0] == 75 * 2000
        # 100 units (boundary) → 100 × $20.
        assert price.get_amount_and_label(100)[0] == 100 * 2000
        # 150 units → 150 × $17.50.
        assert price.get_amount_and_label(150)[0] == 150 * 1750
        # 300 units → 300 × $15.
        assert price.get_amount_and_label(300)[0] == 300 * 1500

    def test_zero_units_is_free(self) -> None:
        price = _make_metered_tiered_price(GOAL_TIERS, MeteredTierType.volume)
        assert price.get_amount_and_label(0)[0] == 0

    def test_fractional_units_between_boundaries(self) -> None:
        price = _make_metered_tiered_price(GOAL_TIERS, MeteredTierType.volume)
        # 50.5 units exceeds the first tier's max (50) → priced in the $20 tier.
        assert price.get_amount_and_label(50.5)[0] == round(50.5 * 2000)

    def test_unit_plus_flat(self) -> None:
        price = _make_metered_tiered_price(
            [
                {
                    "min_units": 1,
                    "max_units": None,
                    "unit_amount": "1000",
                    "flat_amount": 500_00,
                }
            ],
            MeteredTierType.volume,
        )
        # 10 × $10 + $500 flat.
        assert price.get_amount_and_label(10)[0] == 10 * 1000 + 500_00

    def test_label_describes_applied_tier(self) -> None:
        price = _make_metered_tiered_price(GOAL_TIERS, MeteredTierType.volume)
        _, label = price.get_amount_and_label(75)
        assert "75 consumed units" in label
        assert "$20.00" in label

    def test_cap_applies(self) -> None:
        price = _make_metered_tiered_price(
            GOAL_TIERS, MeteredTierType.volume, cap_amount=1000_00
        )
        amount, label = price.get_amount_and_label(300)  # would be $4500
        assert amount == 1000_00
        assert "Capped at" in label


class TestMeteredGraduatedTiers:
    def test_spans_flat_then_unit(self) -> None:
        price = _make_metered_tiered_price(GOAL_TIERS, MeteredTierType.graduated)
        # 75 units: first 50 units → $999 flat, next 25 units → 25 × $20.
        assert price.get_amount_and_label(75)[0] == 999_00 + 25 * 2000

    def test_spans_all_tiers(self) -> None:
        price = _make_metered_tiered_price(GOAL_TIERS, MeteredTierType.graduated)
        # 250 units: 50 (flat $999) + 50 × $20 + 100 × $17.50 + 50 × $15.
        expected = 999_00 + 50 * 2000 + 100 * 1750 + 50 * 1500
        assert price.get_amount_and_label(250)[0] == expected

    def test_within_first_tier(self) -> None:
        price = _make_metered_tiered_price(GOAL_TIERS, MeteredTierType.graduated)
        # 30 units stay in the first (flat) tier.
        assert price.get_amount_and_label(30)[0] == 999_00

    def test_zero_units_is_free(self) -> None:
        price = _make_metered_tiered_price(GOAL_TIERS, MeteredTierType.graduated)
        assert price.get_amount_and_label(0)[0] == 0

    def test_decimal_unit_amounts(self) -> None:
        price = _make_metered_tiered_price(
            [
                {
                    "min_units": 1,
                    "max_units": 100,
                    "unit_amount": "0.5",
                    "flat_amount": None,
                },
                {
                    "min_units": 101,
                    "max_units": None,
                    "unit_amount": "0.25",
                    "flat_amount": None,
                },
            ],
            MeteredTierType.graduated,
        )
        # 200 units: 100 × $0.005 + 100 × $0.0025 = 50 + 25 = 75 cents.
        assert price.get_amount_and_label(200)[0] == 75
