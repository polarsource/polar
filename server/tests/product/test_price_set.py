import pytest

from polar.exceptions import PolarRequestValidationError
from polar.models import ProductPriceCustom
from polar.product.price_set import validate_custom_price_amount


def _custom_price(
    *, minimum_amount: int = 0, maximum_amount: int | None = None
) -> ProductPriceCustom:
    return ProductPriceCustom(
        price_currency="usd",
        minimum_amount=minimum_amount,
        maximum_amount=maximum_amount,
        preset_amount=None,
    )


class TestValidateCustomPriceAmount:
    def test_negative_rejected_when_minimum_zero(self) -> None:
        with pytest.raises(PolarRequestValidationError):
            validate_custom_price_amount(_custom_price(minimum_amount=0), -100, "usd")

    def test_negative_rejected_when_minimum_positive(self) -> None:
        with pytest.raises(PolarRequestValidationError):
            validate_custom_price_amount(_custom_price(minimum_amount=500), -1, "usd")

    def test_zero_allowed_when_minimum_zero(self) -> None:
        validate_custom_price_amount(_custom_price(minimum_amount=0), 0, "usd")

    def test_positive_below_currency_minimum_rejected(self) -> None:
        # minimum_amount == 0 allows 0, but a positive amount below the
        # currency minimum (50 for USD) is rejected.
        with pytest.raises(PolarRequestValidationError):
            validate_custom_price_amount(_custom_price(minimum_amount=0), 1, "usd")

    def test_below_price_minimum_rejected(self) -> None:
        with pytest.raises(PolarRequestValidationError):
            validate_custom_price_amount(_custom_price(minimum_amount=500), 100, "usd")

    def test_above_maximum_rejected(self) -> None:
        with pytest.raises(PolarRequestValidationError):
            validate_custom_price_amount(
                _custom_price(minimum_amount=100, maximum_amount=1000), 2000, "usd"
            )

    def test_valid_amount_passes(self) -> None:
        validate_custom_price_amount(
            _custom_price(minimum_amount=100, maximum_amount=10000), 5000, "usd"
        )
