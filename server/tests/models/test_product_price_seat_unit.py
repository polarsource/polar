import pytest

from polar.models.product_price import ProductPriceSeatUnit


class TestProductPriceSeatUnit:
    """Tests for seat-based pricing with flat fee support."""

    def test_calculate_amount_flat_fee_single_tier(self) -> None:
        """Test flat fee calculation with a single tier."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {
                        "min_seats": 1,
                        "max_seats": None,
                        "flat_fee": 20000,  # $200
                    }
                ]
            },
        )

        # Flat fee should be $200 regardless of seat count
        assert price.calculate_amount(1) == 20000
        assert price.calculate_amount(10) == 20000
        assert price.calculate_amount(25) == 20000
        assert price.calculate_amount(100) == 20000

    def test_calculate_amount_flat_fee_multiple_tiers(self) -> None:
        """Test flat fee calculation with multiple tiers."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {
                        "min_seats": 1,
                        "max_seats": 25,
                        "flat_fee": 20000,  # $200 for 1-25 seats
                    },
                    {
                        "min_seats": 26,
                        "max_seats": None,
                        "flat_fee": 50000,  # $500 for 26+ seats
                    },
                ]
            },
        )

        # Tier 1: 1-25 seats = $200 flat
        assert price.calculate_amount(1) == 20000
        assert price.calculate_amount(25) == 20000

        # Tier 2: 26+ seats = $500 flat
        assert price.calculate_amount(26) == 50000
        assert price.calculate_amount(100) == 50000

    def test_calculate_amount_backward_compatibility_per_seat(self) -> None:
        """Test that existing per-seat pricing still works."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {
                        "min_seats": 1,
                        "max_seats": None,
                        "price_per_seat": 1000,  # $10 per seat
                    }
                ]
            },
        )

        assert price.calculate_amount(1) == 1000
        assert price.calculate_amount(5) == 5000
        assert price.calculate_amount(10) == 10000

    def test_calculate_amount_per_seat_multiple_tiers(self) -> None:
        """Test per-seat pricing with volume discounts."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {
                        "min_seats": 1,
                        "max_seats": 10,
                        "price_per_seat": 1000,  # $10/seat for 1-10
                    },
                    {
                        "min_seats": 11,
                        "max_seats": None,
                        "price_per_seat": 800,  # $8/seat for 11+
                    },
                ]
            },
        )

        # Tier 1: 1-10 seats at $10/seat
        assert price.calculate_amount(5) == 5000
        assert price.calculate_amount(10) == 10000

        # Tier 2: 11+ seats at $8/seat
        assert price.calculate_amount(11) == 8800
        assert price.calculate_amount(15) == 12000

    def test_get_tier_for_seats(self) -> None:
        """Test finding the correct tier for a seat count."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                    {"min_seats": 11, "max_seats": 50, "flat_fee": 40000},
                    {"min_seats": 51, "max_seats": None, "flat_fee": 90000},
                ]
            },
        )

        tier_1 = price.get_tier_for_seats(5)
        assert tier_1["min_seats"] == 1
        assert tier_1["price_per_seat"] == 1000

        tier_2 = price.get_tier_for_seats(25)
        assert tier_2["min_seats"] == 11
        assert tier_2["flat_fee"] == 40000

        tier_3 = price.get_tier_for_seats(100)
        assert tier_3["min_seats"] == 51
        assert tier_3["flat_fee"] == 90000

    def test_get_tier_for_seats_no_match_raises_error(self) -> None:
        """Test that requesting seats below minimum raises an error."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {"min_seats": 5, "max_seats": None, "price_per_seat": 1000}
                ]
            },
        )

        with pytest.raises(ValueError, match="No tier found for 1 seats"):
            price.get_tier_for_seats(1)

    def test_get_price_per_seat_with_flat_fee(self) -> None:
        """Test get_price_per_seat returns 0 for flat fee tiers."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [{"min_seats": 1, "max_seats": None, "flat_fee": 20000}]
            },
        )

        # For flat fee tiers, price_per_seat should return 0
        assert price.get_price_per_seat(10) == 0

    def test_calculate_amount_combined_pricing(self) -> None:
        """Test combined pricing (flat_fee + price_per_seat)."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {
                        "min_seats": 1,
                        "max_seats": None,
                        "flat_fee": 20000,  # $200 base
                        "price_per_seat": 1000,  # + $10/seat
                    }
                ]
            },
        )

        # Combined: $200 + ($10 * seats)
        assert price.calculate_amount(1) == 21000  # $200 + $10
        assert price.calculate_amount(5) == 25000  # $200 + $50
        assert price.calculate_amount(10) == 30000  # $200 + $100

    def test_calculate_amount_combined_pricing_multiple_tiers(self) -> None:
        """Test combined pricing with multiple tiers."""
        price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {
                        "min_seats": 1,
                        "max_seats": 10,
                        "flat_fee": 10000,  # $100 base
                        "price_per_seat": 1000,  # + $10/seat
                    },
                    {
                        "min_seats": 11,
                        "max_seats": None,
                        "flat_fee": 20000,  # $200 base
                        "price_per_seat": 800,  # + $8/seat
                    },
                ]
            },
        )

        # Tier 1: $100 + ($10 * seats)
        assert price.calculate_amount(1) == 11000  # $100 + $10
        assert price.calculate_amount(5) == 15000  # $100 + $50
        assert price.calculate_amount(10) == 20000  # $100 + $100

        # Tier 2: $200 + ($8 * seats)
        assert price.calculate_amount(11) == 20880  # $200 + $88
        assert price.calculate_amount(20) == 21600  # $200 + $160
