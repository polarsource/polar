from decimal import Decimal

import pytest

from polar.models import (
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
)
from polar.product.price_set import PriceSet, calculate_upfront_amount


def _fixed(amount: int = 1000) -> ProductPriceFixed:
    return ProductPriceFixed(price_currency="usd", price_amount=amount)


def _custom(
    *, minimum_amount: int = 500, preset_amount: int | None = None
) -> ProductPriceCustom:
    return ProductPriceCustom(
        price_currency="usd",
        minimum_amount=minimum_amount,
        maximum_amount=None,
        preset_amount=preset_amount,
    )


def _free() -> ProductPriceFixed:
    return ProductPriceFixed(price_currency="usd", price_amount=0)


def _metered() -> ProductPriceMeteredUnit:
    return ProductPriceMeteredUnit(
        price_currency="usd", unit_amount=Decimal("0.5"), cap_amount=None
    )


def _seat(
    *, price_per_seat: int = 1000, minimum_seats: int = 1
) -> ProductPriceSeatUnit:
    return ProductPriceSeatUnit(
        price_currency="usd",
        seat_tiers={
            "tiers": [
                {
                    "min_seats": minimum_seats,
                    "max_seats": None,
                    "price_per_seat": price_per_seat,
                }
            ]
        },
    )


class TestGetStaticPrices:
    def test_excludes_metered(self) -> None:
        fixed = _fixed()
        price_set = PriceSet("usd", [fixed, _metered()])
        assert price_set.get_static_prices() == [fixed]

    def test_includes_seat(self) -> None:
        seat = _seat()
        price_set = PriceSet("usd", [seat])
        assert price_set.get_static_prices() == [seat]


class TestGetSeatPrice:
    def test_present(self) -> None:
        seat = _seat()
        price_set = PriceSet("usd", [_fixed(), seat])
        assert price_set.get_seat_price() is seat

    def test_absent(self) -> None:
        price_set = PriceSet("usd", [_fixed()])
        assert price_set.get_seat_price() is None


class TestGetCustomPrice:
    def test_present(self) -> None:
        custom = _custom()
        price_set = PriceSet("usd", [custom])
        assert price_set.get_custom_price() is custom

    def test_absent(self) -> None:
        price_set = PriceSet("usd", [_fixed()])
        assert price_set.get_custom_price() is None


class TestCalculateUpfrontAmount:
    def test_fixed(self) -> None:
        amount = calculate_upfront_amount(
            [_fixed(1500)], custom_amount=None, seats=None
        )
        assert amount == 1500

    def test_custom_with_amount(self) -> None:
        amount = calculate_upfront_amount([_custom()], custom_amount=2000, seats=None)
        assert amount == 2000

    def test_custom_falls_back_to_preset(self) -> None:
        amount = calculate_upfront_amount(
            [_custom(preset_amount=700)], custom_amount=None, seats=None
        )
        assert amount == 700

    def test_custom_falls_back_to_minimum(self) -> None:
        amount = calculate_upfront_amount(
            [_custom(minimum_amount=500)], custom_amount=None, seats=None
        )
        assert amount == 500

    def test_custom_zero_is_honored(self) -> None:
        # Pay-what-you-want 0 must NOT fall through to preset/minimum.
        amount = calculate_upfront_amount(
            [_custom(minimum_amount=0, preset_amount=700)],
            custom_amount=0,
            seats=None,
        )
        assert amount == 0

    def test_custom_preset_zero_is_honored(self) -> None:
        # A configured preset of 0 ("show $0 default") must NOT fall back to the
        # minimum; only a missing preset does.
        amount = calculate_upfront_amount(
            [_custom(minimum_amount=500, preset_amount=0)],
            custom_amount=None,
            seats=None,
        )
        assert amount == 0

    def test_seat(self) -> None:
        seat = _seat(price_per_seat=1000)
        amount = calculate_upfront_amount([seat], custom_amount=None, seats=5)
        assert amount == seat.calculate_amount(5) == 5000

    def test_free_contributes_nothing(self) -> None:
        amount = calculate_upfront_amount([_free()], custom_amount=None, seats=None)
        assert amount == 0

    def test_metered_contributes_nothing(self) -> None:
        amount = calculate_upfront_amount([_metered()], custom_amount=None, seats=None)
        assert amount == 0

    def test_seat_price_without_seats_raises(self) -> None:
        with pytest.raises(ValueError, match="seats must be provided"):
            calculate_upfront_amount([_seat()], custom_amount=None, seats=None)

    def test_sums_fixed_and_seat(self) -> None:
        # Forward-looking: a base fee combined with seat-based pricing sums both.
        fixed = _fixed(2000)
        seat = _seat(price_per_seat=1000)
        amount = calculate_upfront_amount([fixed, seat], custom_amount=None, seats=3)
        assert amount == 2000 + seat.calculate_amount(3) == 5000
