import pytest
from pydantic import ValidationError

from polar.kit.address import Address


@pytest.mark.parametrize(
    ("country", "state"),
    [
        ("US", "NY"),
        ("CA", "QC"),
    ],
)
def test_valid_unprefixed_state(country: str, state: str) -> None:
    address = Address.model_validate({"state": state, "country": country})
    assert address.state == f"{country}-{state}"
    assert address.country == country


@pytest.mark.parametrize(
    ("country", "state"),
    [
        ("US", "US-NY"),
        ("CA", "CA-QC"),
    ],
)
def test_valid_prefixed_state(country: str, state: str) -> None:
    address = Address.model_validate({"state": state, "country": country})
    assert address.state == state
    assert address.country == country


@pytest.mark.parametrize(
    ("country", "state"),
    [
        ("US", "QC"),
        ("US", "US-QC"),
        ("CA", "NY"),
        ("CA", "CA-NY"),
    ],
)
def test_invalid_state(country: str, state: str) -> None:
    with pytest.raises(ValidationError):
        Address.model_validate({"state": state, "country": country})


@pytest.mark.parametrize(
    ("input", "expected"),
    [
        ({"country": "FR", "state": None}, {"country": "FR"}),
        ({"country": "FR", "state": ""}, {"country": "FR"}),
        ({"country": "FR", "state": "AURA"}, {"country": "FR", "state": "AURA"}),
        (
            {"country": "US", "state": "US-NY", "city": "New-York"},
            {"country": "US", "state": "US-NY", "city": "New-York"},
        ),
        (
            {"country": "US", "state": "NY", "city": "New-York"},
            {"country": "US", "state": "US-NY", "city": "New-York"},
        ),
    ],
)
def test_valid(input: dict[str, str], expected: dict[str, str]) -> None:
    address = Address.model_validate(input)
    assert address.to_dict() == expected
