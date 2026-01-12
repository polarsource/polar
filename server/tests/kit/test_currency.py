import pytest

from polar.kit.currency import PresentmentCurrency, get_presentment_currency


@pytest.mark.parametrize(
    ("country", "expected_currency"),
    [
        pytest.param("US", "usd", id="supported country US"),
        pytest.param("GB", "gbp", id="supported country GB"),
        pytest.param("FR", "eur", id="supported country FR"),
        pytest.param("SE", "sek", id="supported country SE"),
        pytest.param("CN", "usd", id="unsupported country default"),
        pytest.param("KK", "usd", id="invalid country code default"),
    ],
)
def test_get_presentment_currency(country: str, expected_currency: str) -> None:
    assert (
        get_presentment_currency(country, PresentmentCurrency.usd) == expected_currency
    )
