import pytest

from polar.kit.currency import get_presentment_currency


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
