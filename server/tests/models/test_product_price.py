from decimal import Decimal
from typing import Any

import pytest

from polar.models import Meter, Product
from polar.models.product_price import ProductPriceSeatUnit, SeatTierType
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


class TestVolumePricingLabel:
    def test_single_tier_no_range_shown(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}],
            SeatTierType.volume,
        )
        amount, label = price.get_amount_and_label(5)
        assert amount == 2500
        assert label == "5 seats × $5.00/seat"

    def test_singular_seat(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        amount, label = price.get_amount_and_label(1)
        assert amount == 1000
        assert label == "1 seat × $10.00/seat (1–10 seats tier)"

    def test_first_tier(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        amount, label = price.get_amount_and_label(5)
        assert amount == 5000
        assert label == "5 seats × $10.00/seat (1–10 seats tier)"

    def test_second_tier(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        amount, label = price.get_amount_and_label(25)
        assert amount == 20_000
        assert label == "25 seats × $8.00/seat (11–50 seats tier)"

    def test_open_ended_last_tier(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        amount, label = price.get_amount_and_label(60)
        assert amount == 36_000
        assert label == "60 seats × $6.00/seat (51+ seats tier)"

    def test_free_tier(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 0}],
            SeatTierType.volume,
        )
        amount, label = price.get_amount_and_label(10)
        assert amount == 0
        assert label == "10 seats × $0.00/seat"


class TestGraduatedPricingLabel:
    def test_single_tier_no_range_shown(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 500}],
            SeatTierType.graduated,
        )
        amount, label = price.get_amount_and_label(5)
        assert amount == 2500
        assert label == "5 seats × $5.00/seat"

    def test_singular_seat(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        amount, label = price.get_amount_and_label(1)
        assert amount == 1000
        assert label == "1 seat × $10.00/seat (1–10 seats tier)"

    def test_within_first_tier(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        amount, label = price.get_amount_and_label(5)
        assert amount == 5000
        assert label == "5 seats × $10.00/seat (1–10 seats tier)"

    def test_spans_two_tiers(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        amount, label = price.get_amount_and_label(15)
        assert amount == 10 * 1000 + 5 * 800
        assert label == (
            "10 seats × $10.00/seat (1–10 seats tier)\n"
            "+ 5 seats × $8.00/seat (11–50 seats tier)"
        )

    def test_spans_all_tiers(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        amount, label = price.get_amount_and_label(100)
        assert amount == 10 * 1000 + 40 * 800 + 50 * 600
        assert label == (
            "10 seats × $10.00/seat (1–10 seats tier)\n"
            "+ 40 seats × $8.00/seat (11–50 seats tier)\n"
            "+ 50 seats × $6.00/seat (51+ seats tier)"
        )

    def test_one_seat_into_last_tier(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        amount, label = price.get_amount_and_label(51)
        assert amount == 10 * 1000 + 40 * 800 + 1 * 600
        assert label == (
            "10 seats × $10.00/seat (1–10 seats tier)\n"
            "+ 40 seats × $8.00/seat (11–50 seats tier)\n"
            "+ 1 seat × $6.00/seat (51+ seats tier)"
        )

    def test_free_first_tier_then_paid(self) -> None:
        price = _make_seat_price(
            [
                {"min_seats": 1, "max_seats": 5, "price_per_seat": 0},
                {"min_seats": 6, "max_seats": None, "price_per_seat": 1000},
            ],
            SeatTierType.graduated,
        )
        amount, label = price.get_amount_and_label(8)
        assert amount == 3 * 1000
        assert label == (
            "5 seats × $0.00/seat (1–5 seats tier)\n"
            "+ 3 seats × $10.00/seat (6+ seats tier)"
        )
