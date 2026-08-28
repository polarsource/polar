from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Meter, Product
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceFixed,
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
    ProductPriceUnit,
    TieredPrice,
)
from polar.product.tiers import (
    SeatTierType,
    Tiers,
    TierType,
    seat_tiers_to_tiers,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_product_price_metered_unit,
    create_product_price_seat_unit,
)


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


def _make_metered_price(
    *,
    unit_amount: Decimal | None = None,
    tiers: Tiers | None = None,
    cap_amount: int | None = None,
) -> ProductPriceMeteredUnit:
    return ProductPriceMeteredUnit(
        unit_amount=unit_amount,
        tiers=tiers,
        cap_amount=cap_amount,
        price_currency="usd",
    )


class TestMeteredTieredAmountAndLabel:
    def test_uses_tiers(self) -> None:
        price = _make_metered_price(
            tiers=Tiers.model_validate(
                {
                    "type": TierType.volume,
                    "tiers": [
                        {"bound": 100, "unit_amount": "10"},
                        {"bound": None, "unit_amount": "8"},
                    ],
                }
            )
        )
        amount, label = price.get_amount_and_label(500)
        assert amount == 4_000
        assert label == "(500 consumed units, volume pricing)"

    def test_total_rounded_once_not_per_tier(self) -> None:
        price = _make_metered_price(
            tiers=Tiers.model_validate(
                {
                    "type": TierType.graduated,
                    "tiers": [
                        {"bound": 2, "unit_amount": "0.2"},
                        {"bound": None, "unit_amount": "0.2"},
                    ],
                }
            )
        )
        assert price.get_amount_and_label(4)[0] == 1

    def test_is_never_free(self) -> None:
        assert _make_metered_price(unit_amount=Decimal(100)).is_free is False

    def test_fractional_units_round_at_half_cent(self) -> None:
        # 0.7 units × 5¢ = 3.5¢ must round to 4, not 3. Passing the float
        # straight to Decimal would carry binary noise (3.4999…) and round down.
        price = _make_metered_price(unit_amount=Decimal(5))
        assert price.get_amount_and_label(0.7)[0] == 4


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


class TestCalculateAmountIntegralityGuard:
    def test_fractional_stored_rate_raises(self) -> None:
        with pytest.raises(ValueError, match="smallest currency unit"):
            _make_seat_price(
                [{"min_seats": 1, "max_seats": None, "price_per_seat": 500.5}],
                SeatTierType.volume,
            )


class TestSeatBillingReadsSharedTiers:
    """Billing and bounds come from the shared columns, not `_seat_tiers`."""

    def test_amount_ignores_legacy_column(self) -> None:
        price = _make_seat_price(MULTI_TIER)
        price._seat_tiers = {
            "seat_tier_type": SeatTierType.volume,
            "tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 1}],
        }
        assert price.calculate_amount(10) == 10_000
        assert price.calculate_amount(11) == 11 * 800

    def test_bounds_from_shared_columns(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 5, "max_seats": 20, "price_per_seat": 250}],
        )
        assert price.get_minimum_seats() == 5
        assert price.get_maximum_seats() == 20

    def test_maximum_seats_falls_back_to_last_tier_bound(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": 20, "price_per_seat": 250}],
        )
        price.maximum_units = None
        assert price.get_maximum_seats() == 20

    def test_is_free_from_shared_tiers(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 0}],
        )
        assert price.is_free is True

    def test_is_free_without_tiers(self) -> None:
        price = _make_seat_price(
            [{"min_seats": 1, "max_seats": None, "price_per_seat": 250}],
        )
        price.tiers = None  # type: ignore[assignment]
        assert price.is_free is True


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
        # A merchant enforcing a 10-seat minimum sets the
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


def _tiers_data(tier_type: TierType, tiers: list[dict[str, Any]]) -> Tiers:
    return Tiers.model_validate({"type": tier_type, "tiers": tiers})


def _make_tiered_price(
    tiers: Tiers,
    minimum_units: int | None = None,
    maximum_units: int | None = None,
) -> TieredPrice:
    price = object.__new__(TieredPrice)
    price.tiers = tiers
    price.minimum_units = minimum_units
    price.maximum_units = maximum_units
    return price


SHARED_MULTI_TIER: list[dict[str, Any]] = [
    {"bound": 10, "unit_amount": "1000"},
    {"bound": 50, "unit_amount": "800"},
    {"bound": None, "unit_amount": "600"},
]


class TestGetTieredAmount:
    def test_ignores_minimum_units(self) -> None:
        # Purchase floors live on the price; billing is a pass-through to the engine.
        price = _make_tiered_price(
            _tiers_data(
                TierType.graduated,
                [
                    {"bound": 10, "unit_amount": "20000"},
                    {"bound": None, "unit_amount": "6000"},
                ],
            ),
            minimum_units=10,
        )
        assert price.get_tiered_amount(5) == price.tiers.calculate(5)


class TestSeatTiersApiView:
    def test_constructor_populates_shared_columns(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.graduated)
        assert price.tiers == seat_tiers_to_tiers(price.seat_tiers)
        assert price.minimum_units == 1
        assert price.maximum_units is None
        assert price._seat_tiers is None

    def test_updating_seat_tiers_updates_shared_columns(self) -> None:
        price = _make_seat_price(MULTI_TIER, SeatTierType.volume)
        price.seat_tiers = {
            "seat_tier_type": SeatTierType.volume,
            "tiers": [{"min_seats": 5, "max_seats": 20, "price_per_seat": 250}],
        }
        assert price.tiers == _tiers_data(
            TierType.volume,
            [{"bound": 20, "unit_amount": "250"}],
        )
        assert price.minimum_units == 5
        assert price.maximum_units == 20
        assert price.seat_tiers["tiers"] == [
            {"min_seats": 5, "max_seats": 20, "price_per_seat": 250}
        ]
        assert price._seat_tiers is None

    @pytest.mark.asyncio
    async def test_database_round_trip_returns_tiers_model(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
    ) -> None:
        price = await create_product_price_seat_unit(
            save_fixture,
            product=product,
            tiers=MULTI_TIER,
            seat_tier_type=SeatTierType.graduated,
        )

        result = (
            (
                await session.execute(
                    select(
                        ProductPriceSeatUnit.tiers,
                        ProductPriceSeatUnit._seat_tiers,
                    ).where(ProductPriceSeatUnit.id == price.id)
                )
            )
            .tuples()
            .one()
        )
        tiers, legacy_seat_tiers = result

        assert isinstance(tiers, Tiers)
        assert tiers.type == TierType.graduated
        assert [tier.unit_amount for tier in tiers.tiers] == [
            Decimal(1000),
            Decimal(800),
            Decimal(600),
        ]
        assert legacy_seat_tiers is None


class TestMinimumMaximumUnits:
    def test_minimum_units_from_column(self) -> None:
        price = _make_tiered_price(
            _tiers_data(TierType.volume, SHARED_MULTI_TIER), minimum_units=5
        )
        assert price.get_minimum_units() == 5

    def test_minimum_units_defaults_to_zero(self) -> None:
        price = _make_tiered_price(_tiers_data(TierType.volume, SHARED_MULTI_TIER))
        assert price.get_minimum_units() == 0

    def test_maximum_units_from_column(self) -> None:
        price = _make_tiered_price(
            _tiers_data(TierType.volume, SHARED_MULTI_TIER), maximum_units=100
        )
        assert price.get_maximum_units() == 100

    def test_maximum_units_falls_back_to_last_tier(self) -> None:
        price = _make_tiered_price(
            _tiers_data(
                TierType.volume,
                [
                    {"bound": 10, "unit_amount": "500"},
                    {"bound": 20, "unit_amount": "300"},
                ],
            )
        )
        assert price.get_maximum_units() == 20

    def test_maximum_units_unbounded(self) -> None:
        price = _make_tiered_price(_tiers_data(TierType.volume, SHARED_MULTI_TIER))
        assert price.get_maximum_units() is None


def _make_unit_price(tiers: list[dict[str, Any]]) -> ProductPriceUnit:
    return ProductPriceUnit(
        tiers=_tiers_data(TierType.volume, tiers),
        price_currency="usd",
    )


class TestUnitBasedPrice:
    def test_identity(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        assert price.amount_type == ProductPriceAmountType.unit_based
        assert price.is_static is True
        assert price.is_metered is False
        assert price.is_free is False

    def test_non_integral_amount_raises(self) -> None:
        price = _make_unit_price([{"bound": None, "unit_amount": "10.5"}])
        with pytest.raises(ValueError, match="non-integral"):
            price.calculate_amount(3)

    def test_is_free(self) -> None:
        price = _make_unit_price([{"bound": None, "unit_amount": "0"}])
        assert price.is_free is True

    def test_is_free_without_tiers(self) -> None:
        price = _make_unit_price([{"bound": None, "unit_amount": "100"}])
        price.tiers = None  # type: ignore[assignment]
        assert price.is_free is True

    def test_unit_noun_defaults(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        assert price.get_unit_noun(1) == "unit"
        assert price.get_unit_noun(3) == "units"

    def test_unit_noun_custom_label(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        price.unit_label = {"en": {"=1": "device", "other": "devices"}}
        assert price.get_unit_noun(1) == "device"
        assert price.get_unit_noun(3) == "devices"

    def test_unit_noun_falls_back_to_other(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        price.unit_label = {"en": {"other": "seats"}}
        assert price.get_unit_noun(1) == "seats"
        assert price.get_unit_noun(2) == "seats"

    def test_unit_noun_requested_locale(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        price.unit_label = {
            "en": {"=1": "device", "other": "devices"},
            "fr": {"=1": "appareil", "other": "appareils"},
        }
        assert price.get_unit_noun(1, "fr") == "appareil"
        assert price.get_unit_noun(12, "fr") == "appareils"

    def test_unit_noun_regional_locale_falls_back_to_language(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        price.unit_label = {"fr": {"=1": "appareil", "other": "appareils"}}
        assert price.get_unit_noun(2, "fr-CA") == "appareils"

    def test_unit_noun_exact_locale_wins_over_language(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        price.unit_label = {
            "en": {"=1": "seat", "other": "seats"},
            "en-GB": {"=1": "place", "other": "places"},
        }
        assert price.get_unit_noun(1, "en-GB") == "place"
        assert price.get_unit_noun(1, "en-US") == "seat"

    def test_unit_noun_missing_locale_falls_back_to_english(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        price.unit_label = {"en": {"=1": "device", "other": "devices"}}
        assert price.get_unit_noun(1, "fr") == "device"

    def test_unit_noun_non_english_only_label(self) -> None:
        price = _make_unit_price(SHARED_MULTI_TIER)
        price.unit_label = {"fr": {"=1": "siège", "other": "sièges"}}
        assert price.get_unit_noun(1) == "siège"
        assert price.get_unit_noun(2, "de") == "sièges"
