from decimal import Decimal

import pytest
from pydantic import ValidationError

from polar.models.product_price import ProductPriceAmountType
from polar.product.schemas import ProductPriceMeteredUnitCreate
from tests.fixtures.random_objects import METER_ID

# PostgreSQL int4 range limit
INT_MAX_VALUE = 2_147_483_647


class TestProductPriceMeteredUnitCreate:
    """Test ProductPriceMeteredUnitCreate schema validation."""

    def test_valid_cap_amount_none(self) -> None:
        """Test that cap_amount can be None."""
        schema = ProductPriceMeteredUnitCreate(
            amount_type=ProductPriceAmountType.metered_unit,
            price_currency="usd",
            unit_amount=Decimal("1.0"),
            meter_id=METER_ID,
            cap_amount=None,
        )
        assert schema.cap_amount is None

    def test_valid_cap_amount_zero(self) -> None:
        """Test that cap_amount can be 0."""
        schema = ProductPriceMeteredUnitCreate(
            amount_type=ProductPriceAmountType.metered_unit,
            price_currency="usd",
            unit_amount=Decimal("1.0"),
            meter_id=METER_ID,
            cap_amount=0,
        )
        assert schema.cap_amount == 0

    def test_valid_cap_amount_positive(self) -> None:
        """Test that cap_amount can be a positive integer."""
        schema = ProductPriceMeteredUnitCreate(
            amount_type=ProductPriceAmountType.metered_unit,
            price_currency="usd",
            unit_amount=Decimal("1.0"),
            meter_id=METER_ID,
            cap_amount=100_000,
        )
        assert schema.cap_amount == 100_000

    def test_valid_cap_amount_max_value(self) -> None:
        """Test that cap_amount can be the maximum allowed value."""
        schema = ProductPriceMeteredUnitCreate(
            amount_type=ProductPriceAmountType.metered_unit,
            price_currency="usd",
            unit_amount=Decimal("1.0"),
            meter_id=METER_ID,
            cap_amount=INT_MAX_VALUE,
        )
        assert schema.cap_amount == INT_MAX_VALUE

    def test_invalid_cap_amount_negative(self) -> None:
        """Test that cap_amount cannot be negative."""
        with pytest.raises(ValidationError) as exc_info:
            ProductPriceMeteredUnitCreate(
                amount_type=ProductPriceAmountType.metered_unit,
                price_currency="usd",
                unit_amount=Decimal("1.0"),
                meter_id=METER_ID,
                cap_amount=-1,
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["type"] == "greater_than_equal"
        assert errors[0]["loc"] == ("cap_amount",)

    def test_invalid_cap_amount_exceeds_max(self) -> None:
        """Test that cap_amount cannot exceed INT_MAX_VALUE."""
        with pytest.raises(ValidationError) as exc_info:
            ProductPriceMeteredUnitCreate(
                amount_type=ProductPriceAmountType.metered_unit,
                price_currency="usd",
                unit_amount=Decimal("1.0"),
                meter_id=METER_ID,
                cap_amount=INT_MAX_VALUE + 1,
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["type"] == "less_than_equal"
        assert errors[0]["loc"] == ("cap_amount",)

    def test_invalid_cap_amount_way_too_large(self) -> None:
        """Test that cap_amount cannot be extremely large values like in the bug report."""
        with pytest.raises(ValidationError) as exc_info:
            ProductPriceMeteredUnitCreate(
                amount_type=ProductPriceAmountType.metered_unit,
                price_currency="usd",
                unit_amount=Decimal("1.0"),
                meter_id=METER_ID,
                cap_amount=100_000_000_000,  # The value from the bug report
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["type"] == "less_than_equal"
        assert errors[0]["loc"] == ("cap_amount",)
