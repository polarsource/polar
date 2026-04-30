from decimal import Decimal
from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError

from polar.enums import SubscriptionRecurringInterval
from polar.kit.currency import PresentmentCurrency
from polar.models.product_price import ProductPriceAmountType
from polar.product.schemas import (
    ProductCreate,
    ProductCreateOneTime,
    ProductCreateRecurring,
    ProductPriceFixedCreate,
    ProductPriceMeteredUnitCreate,
)
from tests.fixtures.random_objects import METER_ID

# PostgreSQL int4 range limit
INT_MAX_VALUE = 2_147_483_647


@pytest.mark.parametrize(
    "name",
    [
        pytest.param("", id="empty string"),
        pytest.param("   ", id="whitespace only"),
        pytest.param("AA", id="below min length"),
        pytest.param("A" * 256, id="exceeds max length"),
    ],
)
def test_invalid_product_name(name: str) -> None:
    with pytest.raises(ValidationError) as exc_info:
        ProductCreateRecurring(
            name=name,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency=PresentmentCurrency.usd,
                )
            ],
        )

    errors = exc_info.value.errors()
    assert len(errors) == 1
    assert errors[0]["type"] in ("too_short", "too_long")
    assert errors[0]["loc"] == ("name",)


@pytest.mark.parametrize(
    ("price_currency", "price_amount"),
    [
        (PresentmentCurrency.usd, 49),
        (PresentmentCurrency.inr, 5000),
    ],
)
def test_product_price_fixed_minimum_amount(
    price_currency: PresentmentCurrency, price_amount: int
) -> None:
    with pytest.raises(ValidationError) as exc_info:
        ProductPriceFixedCreate(
            amount_type=ProductPriceAmountType.fixed,
            price_amount=price_amount,
            price_currency=price_currency,
        )

    errors = exc_info.value.errors()
    assert len(errors) == 1


@pytest.mark.parametrize(
    "payload",
    [
        {"trial_interval_count": 1},
        {"trial_interval": SubscriptionRecurringInterval.month},
    ],
)
def test_incomplete_trial_configuration(payload: dict[str, Any]) -> None:
    with pytest.raises(ValidationError) as exc_info:
        ProductCreateRecurring(
            name="Product",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency=PresentmentCurrency.usd,
                )
            ],
            **payload,
        )

    errors = exc_info.value.errors()
    assert len(errors) == 1
    assert errors[0]["type"] == "missing"
    assert (
        errors[0]["msg"]
        == "Both trial_interval and trial_interval_count must be set together."
    )


class TestProductPriceMeteredUnitCreate:
    """Test ProductPriceMeteredUnitCreate schema validation."""

    def test_valid_cap_amount_none(self) -> None:
        """Test that cap_amount can be None."""
        schema = ProductPriceMeteredUnitCreate(
            amount_type=ProductPriceAmountType.metered_unit,
            price_currency=PresentmentCurrency.usd,
            unit_amount=Decimal("1.0"),
            meter_id=METER_ID,
            cap_amount=None,
        )
        assert schema.cap_amount is None

    def test_valid_cap_amount_zero(self) -> None:
        """Test that cap_amount can be 0."""
        schema = ProductPriceMeteredUnitCreate(
            amount_type=ProductPriceAmountType.metered_unit,
            price_currency=PresentmentCurrency.usd,
            unit_amount=Decimal("1.0"),
            meter_id=METER_ID,
            cap_amount=0,
        )
        assert schema.cap_amount == 0

    def test_valid_cap_amount_positive(self) -> None:
        """Test that cap_amount can be a positive integer."""
        schema = ProductPriceMeteredUnitCreate(
            amount_type=ProductPriceAmountType.metered_unit,
            price_currency=PresentmentCurrency.usd,
            unit_amount=Decimal("1.0"),
            meter_id=METER_ID,
            cap_amount=100_000,
        )
        assert schema.cap_amount == 100_000

    def test_valid_cap_amount_max_value(self) -> None:
        """Test that cap_amount can be the maximum allowed value."""
        schema = ProductPriceMeteredUnitCreate(
            amount_type=ProductPriceAmountType.metered_unit,
            price_currency=PresentmentCurrency.usd,
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
                price_currency=PresentmentCurrency.usd,
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
                price_currency=PresentmentCurrency.usd,
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
                price_currency=PresentmentCurrency.usd,
                unit_amount=Decimal("1.0"),
                meter_id=METER_ID,
                cap_amount=100_000_000_000,  # The value from the bug report
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["type"] == "less_than_equal"
        assert errors[0]["loc"] == ("cap_amount",)


class TestProductPriceFixedCurrencyMinimums:
    """Test currency-specific minimum price validation on ProductPriceFixedCreate."""

    @pytest.mark.parametrize(
        ("currency", "amount", "expected_min"),
        [
            pytest.param(PresentmentCurrency.usd, 49, "$0.50", id="usd-below-min"),
            pytest.param(PresentmentCurrency.inr, 5999, "₹60.00", id="inr-below-min"),
            pytest.param(PresentmentCurrency.gbp, 39, "£0.40", id="gbp-below-min"),
            pytest.param(
                PresentmentCurrency.huf, 17499, "Ft17,500.00", id="huf-below-min"
            ),
            pytest.param(PresentmentCurrency.mxn, 899, "MX$9.00", id="mxn-below-min"),
        ],
    )
    def test_below_minimum_shows_currency_specific_error(
        self, currency: PresentmentCurrency, amount: int, expected_min: str
    ) -> None:
        with pytest.raises(ValidationError) as exc_info:
            ProductPriceFixedCreate(
                amount_type=ProductPriceAmountType.fixed,
                price_amount=amount,
                price_currency=currency,
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("price_amount",)
        assert errors[0]["type"] == "minimum_price"
        assert "Amount must be at least" in errors[0]["msg"]

    @pytest.mark.parametrize(
        ("currency", "amount"),
        [
            pytest.param(PresentmentCurrency.usd, 50, id="usd-at-min"),
            pytest.param(PresentmentCurrency.inr, 6000, id="inr-at-min"),
            pytest.param(PresentmentCurrency.gbp, 40, id="gbp-at-min"),
            pytest.param(PresentmentCurrency.mxn, 900, id="mxn-at-min"),
            pytest.param(PresentmentCurrency.usd, 1000, id="usd-above-min"),
            pytest.param(PresentmentCurrency.inr, 10000, id="inr-above-min"),
        ],
    )
    def test_at_or_above_minimum_succeeds(
        self, currency: PresentmentCurrency, amount: int
    ) -> None:
        price = ProductPriceFixedCreate(
            amount_type=ProductPriceAmountType.fixed,
            price_amount=amount,
            price_currency=currency,
        )
        assert price.price_amount == amount

    def test_error_loc_includes_price_amount(self) -> None:
        """Ensure the error loc targets price_amount so frontend can show inline error."""
        with pytest.raises(ValidationError) as exc_info:
            ProductPriceFixedCreate(
                amount_type=ProductPriceAmountType.fixed,
                price_amount=400,
                price_currency=PresentmentCurrency.inr,
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        # field_validator puts the field name in the loc
        assert errors[0]["loc"] == ("price_amount",)

    def test_error_type_is_custom(self) -> None:
        """Ensure the error type is PydanticCustomError, not ValueError."""
        with pytest.raises(ValidationError) as exc_info:
            ProductPriceFixedCreate(
                amount_type=ProductPriceAmountType.fixed,
                price_amount=30,
                price_currency=PresentmentCurrency.usd,
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        # PydanticCustomError produces clean messages without "Value error, " prefix
        assert errors[0]["type"] == "minimum_price"
        assert not errors[0]["msg"].startswith("Value error")


class TestProductCreateDiscriminator:
    """Test that ProductCreate discriminated union only validates the correct variant."""

    product_create_adapter: TypeAdapter[ProductCreate] = TypeAdapter(ProductCreate)

    def test_one_time_product_with_invalid_price_only_shows_price_error(
        self,
    ) -> None:
        """Key regression test: one-time product must NOT show recurring_interval errors."""
        with pytest.raises(ValidationError) as exc_info:
            self.product_create_adapter.validate_python(
                {
                    "name": "Test Product",
                    "recurring_interval": None,
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 30,
                            "price_currency": "usd",
                        }
                    ],
                }
            )

        errors = exc_info.value.errors()
        # Should only have price-related errors, NOT recurring_interval errors
        error_locs = [e["loc"] for e in errors]
        for loc in error_locs:
            assert "recurring_interval" not in loc, (
                f"One-time product should not have recurring_interval errors, got: {loc}"
            )

    def test_one_time_product_valid(self) -> None:
        result = self.product_create_adapter.validate_python(
            {
                "name": "Test Product",
                "recurring_interval": None,
                "prices": [
                    {
                        "amount_type": "fixed",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
            }
        )
        assert isinstance(result, ProductCreateOneTime)
        assert result.recurring_interval is None

    def test_one_time_product_without_recurring_interval_field(self) -> None:
        """When recurring_interval is omitted entirely, should default to one-time."""
        result = self.product_create_adapter.validate_python(
            {
                "name": "Test Product",
                "prices": [
                    {
                        "amount_type": "fixed",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
            }
        )
        assert isinstance(result, ProductCreateOneTime)

    def test_recurring_product_valid(self) -> None:
        result = self.product_create_adapter.validate_python(
            {
                "name": "Test Product",
                "recurring_interval": "month",
                "prices": [
                    {
                        "amount_type": "fixed",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
            }
        )
        assert isinstance(result, ProductCreateRecurring)
        assert result.recurring_interval == SubscriptionRecurringInterval.month

    def test_recurring_product_with_invalid_price(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            self.product_create_adapter.validate_python(
                {
                    "name": "Test Product",
                    "recurring_interval": "month",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 30,
                            "price_currency": "usd",
                        }
                    ],
                }
            )

        errors = exc_info.value.errors()
        # Should have price error but not a "wrong variant" error
        error_types = [e["type"] for e in errors]
        assert "minimum_price" in error_types

    def test_one_time_inr_below_minimum(self) -> None:
        """The original bug: INR below 60 on a one-time product."""
        with pytest.raises(ValidationError) as exc_info:
            self.product_create_adapter.validate_python(
                {
                    "name": "Test INR Product",
                    "recurring_interval": None,
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        },
                        {
                            "amount_type": "fixed",
                            "price_amount": 400,
                            "price_currency": "inr",
                        },
                    ],
                }
            )

        errors = exc_info.value.errors()
        # Only the INR price should error
        assert len(errors) == 1
        assert errors[0]["type"] == "minimum_price"
        assert "₹60.00" in errors[0]["msg"]
        # No recurring_interval error
        for e in errors:
            assert "recurring_interval" not in str(e["loc"])
