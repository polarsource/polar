import pytest

from polar.kit.currency import (
    adjust_payout_amount_for_zero_decimal_currency,
    get_presentment_currency,
    is_payout_zero_decimal_currency,
)


@pytest.mark.parametrize(
    ("country", "expected_currency"),
    [
        pytest.param("US", "usd", id="supported country US"),
        pytest.param("GB", "gbp", id="supported country GB"),
        pytest.param("FR", "eur", id="supported country FR"),
        pytest.param("SE", "sek", id="supported country SE"),
        pytest.param("CN", None, id="unsupported country"),
        pytest.param("KK", None, id="invalid country code"),
    ],
)
def test_get_presentment_currency(country: str, expected_currency: str | None) -> None:
    assert get_presentment_currency(country) == expected_currency


class TestIsPayoutZeroDecimalCurrency:
    @pytest.mark.parametrize(
        "currency",
        [
            pytest.param("isk", id="ISK lowercase"),
            pytest.param("ISK", id="ISK uppercase"),
            pytest.param("huf", id="HUF lowercase"),
            pytest.param("HUF", id="HUF uppercase"),
            pytest.param("twd", id="TWD lowercase"),
            pytest.param("TWD", id="TWD uppercase"),
            pytest.param("ugx", id="UGX lowercase"),
            pytest.param("UGX", id="UGX uppercase"),
        ],
    )
    def test_zero_decimal_currencies(self, currency: str) -> None:
        assert is_payout_zero_decimal_currency(currency) is True

    @pytest.mark.parametrize(
        "currency",
        [
            pytest.param("usd", id="USD"),
            pytest.param("eur", id="EUR"),
            pytest.param("gbp", id="GBP"),
            pytest.param("jpy", id="JPY - regular zero-decimal, not special"),
        ],
    )
    def test_non_zero_decimal_currencies(self, currency: str) -> None:
        assert is_payout_zero_decimal_currency(currency) is False


class TestAdjustPayoutAmountForZeroDecimalCurrency:
    @pytest.mark.parametrize(
        ("amount", "currency", "expected_amount", "expected_remainder"),
        [
            # Zero-decimal currencies - amounts must be multiples of 100
            pytest.param(12345, "isk", 12300, 45, id="ISK with remainder"),
            pytest.param(12300, "isk", 12300, 0, id="ISK no remainder"),
            pytest.param(99, "isk", 0, 99, id="ISK less than 100"),
            pytest.param(100, "isk", 100, 0, id="ISK exactly 100"),
            pytest.param(0, "isk", 0, 0, id="ISK zero amount"),
            pytest.param(50000, "huf", 50000, 0, id="HUF no remainder"),
            pytest.param(50099, "huf", 50000, 99, id="HUF with remainder"),
            pytest.param(12345, "twd", 12300, 45, id="TWD with remainder"),
            pytest.param(12345, "ugx", 12300, 45, id="UGX with remainder"),
            # Case insensitive
            pytest.param(12345, "ISK", 12300, 45, id="ISK uppercase"),
            pytest.param(12345, "HUF", 12300, 45, id="HUF uppercase"),
        ],
    )
    def test_zero_decimal_currencies(
        self,
        amount: int,
        currency: str,
        expected_amount: int,
        expected_remainder: int,
    ) -> None:
        adjusted_amount, remainder = adjust_payout_amount_for_zero_decimal_currency(
            amount, currency
        )
        assert adjusted_amount == expected_amount
        assert remainder == expected_remainder

    @pytest.mark.parametrize(
        ("amount", "currency"),
        [
            pytest.param(12345, "usd", id="USD"),
            pytest.param(12345, "eur", id="EUR"),
            pytest.param(12345, "gbp", id="GBP"),
            pytest.param(12345, "jpy", id="JPY"),
            pytest.param(99, "usd", id="USD small amount"),
        ],
    )
    def test_non_zero_decimal_currencies_unchanged(
        self, amount: int, currency: str
    ) -> None:
        adjusted_amount, remainder = adjust_payout_amount_for_zero_decimal_currency(
            amount, currency
        )
        assert adjusted_amount == amount
        assert remainder == 0
