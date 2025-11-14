import pytest
from pydantic import ValidationError

from polar.product.schemas import ProductPriceSeatTier, ProductPriceSeatTiers


class TestProductPriceSeatTier:
    """Tests for seat tier schema validation."""

    def test_valid_per_seat_pricing(self) -> None:
        """Test valid per-seat pricing tier."""
        tier = ProductPriceSeatTier(
            min_seats=1, max_seats=10, price_per_seat=1000
        )
        assert tier.min_seats == 1
        assert tier.max_seats == 10
        assert tier.price_per_seat == 1000
        assert tier.flat_fee is None

    def test_valid_flat_fee_pricing(self) -> None:
        """Test valid flat fee pricing tier."""
        tier = ProductPriceSeatTier(
            min_seats=1, max_seats=25, flat_fee=20000
        )
        assert tier.min_seats == 1
        assert tier.max_seats == 25
        assert tier.flat_fee == 20000
        assert tier.price_per_seat is None

    def test_valid_combined_pricing(self) -> None:
        """Test valid combined pricing (flat_fee + price_per_seat)."""
        tier = ProductPriceSeatTier(
            min_seats=1,
            max_seats=10,
            price_per_seat=1000,
            flat_fee=20000,
        )
        assert tier.min_seats == 1
        assert tier.max_seats == 10
        assert tier.price_per_seat == 1000
        assert tier.flat_fee == 20000

    def test_invalid_neither_pricing_field(self) -> None:
        """Test that providing neither price_per_seat nor flat_fee is invalid."""
        with pytest.raises(
            ValidationError,
            match="At least one of price_per_seat or flat_fee must be provided",
        ):
            ProductPriceSeatTier(min_seats=1, max_seats=10)

    def test_flat_fee_zero_allowed(self) -> None:
        """Test that flat fee can be zero (free tier)."""
        tier = ProductPriceSeatTier(
            min_seats=1, max_seats=5, flat_fee=0
        )
        assert tier.flat_fee == 0

    def test_price_per_seat_zero_allowed(self) -> None:
        """Test that price_per_seat can be zero (free tier)."""
        tier = ProductPriceSeatTier(
            min_seats=1, max_seats=5, price_per_seat=0
        )
        assert tier.price_per_seat == 0


class TestProductPriceSeatTiers:
    """Tests for seat tiers collection validation."""

    def test_valid_single_flat_fee_tier(self) -> None:
        """Test valid single flat fee tier."""
        tiers = ProductPriceSeatTiers(
            tiers=[
                ProductPriceSeatTier(min_seats=1, max_seats=None, flat_fee=20000)
            ]
        )
        assert len(tiers.tiers) == 1
        assert tiers.tiers[0].flat_fee == 20000

    def test_valid_multiple_flat_fee_tiers(self) -> None:
        """Test valid multiple flat fee tiers."""
        tiers = ProductPriceSeatTiers(
            tiers=[
                ProductPriceSeatTier(min_seats=1, max_seats=25, flat_fee=20000),
                ProductPriceSeatTier(min_seats=26, max_seats=None, flat_fee=50000),
            ]
        )
        assert len(tiers.tiers) == 2
        assert tiers.tiers[0].flat_fee == 20000
        assert tiers.tiers[1].flat_fee == 50000

    def test_valid_mixed_pricing_types(self) -> None:
        """Test mixed per-seat and flat fee tiers."""
        tiers = ProductPriceSeatTiers(
            tiers=[
                ProductPriceSeatTier(min_seats=1, max_seats=10, price_per_seat=1000),
                ProductPriceSeatTier(min_seats=11, max_seats=None, flat_fee=40000),
            ]
        )
        assert len(tiers.tiers) == 2
        assert tiers.tiers[0].price_per_seat == 1000
        assert tiers.tiers[1].flat_fee == 40000

    def test_invalid_first_tier_not_starting_at_one(self) -> None:
        """Test that first tier must start at min_seats=1."""
        with pytest.raises(
            ValidationError, match="First tier must start at min_seats=1"
        ):
            ProductPriceSeatTiers(
                tiers=[
                    ProductPriceSeatTier(
                        min_seats=5, max_seats=None, flat_fee=20000
                    )
                ]
            )

    def test_invalid_gap_between_tiers(self) -> None:
        """Test that tiers cannot have gaps."""
        with pytest.raises(ValidationError, match="Gap or overlap between tiers"):
            ProductPriceSeatTiers(
                tiers=[
                    ProductPriceSeatTier(min_seats=1, max_seats=10, flat_fee=20000),
                    ProductPriceSeatTiers(
                        min_seats=15, max_seats=None, flat_fee=50000
                    ),
                ]
            )

    def test_invalid_overlap_between_tiers(self) -> None:
        """Test that tiers cannot overlap."""
        with pytest.raises(ValidationError, match="Gap or overlap between tiers"):
            ProductPriceSeatTiers(
                tiers=[
                    ProductPriceSeatTier(min_seats=1, max_seats=25, flat_fee=20000),
                    ProductPriceSeatTier(min_seats=20, max_seats=None, flat_fee=50000),
                ]
            )

    def test_invalid_last_tier_must_be_unlimited(self) -> None:
        """Test that last tier must have max_seats=None."""
        with pytest.raises(
            ValidationError, match="Last tier must have unlimited max_seats"
        ):
            ProductPriceSeatTiers(
                tiers=[
                    ProductPriceSeatTier(min_seats=1, max_seats=25, flat_fee=20000)
                ]
            )

    def test_invalid_only_last_tier_can_be_unlimited(self) -> None:
        """Test that only the last tier can have max_seats=None."""
        with pytest.raises(
            ValidationError,
            match="Only the last tier can have unlimited max_seats",
        ):
            ProductPriceSeatTiers(
                tiers=[
                    ProductPriceSeatTier(min_seats=1, max_seats=None, flat_fee=20000),
                    ProductPriceSeatTier(min_seats=26, max_seats=50, flat_fee=50000),
                ]
            )

    def test_tiers_sorted_automatically(self) -> None:
        """Test that tiers are sorted by min_seats."""
        tiers = ProductPriceSeatTiers(
            tiers=[
                ProductPriceSeatTier(min_seats=11, max_seats=None, flat_fee=50000),
                ProductPriceSeatTier(min_seats=1, max_seats=10, flat_fee=20000),
            ]
        )
        # Tiers should be sorted after validation
        assert tiers.tiers[0].min_seats == 1
        assert tiers.tiers[1].min_seats == 11

    def test_valid_combined_pricing_tiers(self) -> None:
        """Test combined pricing (flat_fee + price_per_seat) across multiple tiers."""
        tiers = ProductPriceSeatTiers(
            tiers=[
                ProductPriceSeatTier(
                    min_seats=1,
                    max_seats=10,
                    flat_fee=10000,
                    price_per_seat=1000,
                ),
                ProductPriceSeatTier(
                    min_seats=11,
                    max_seats=None,
                    flat_fee=20000,
                    price_per_seat=800,
                ),
            ]
        )
        assert len(tiers.tiers) == 2
        assert tiers.tiers[0].flat_fee == 10000
        assert tiers.tiers[0].price_per_seat == 1000
        assert tiers.tiers[1].flat_fee == 20000
        assert tiers.tiers[1].price_per_seat == 800
