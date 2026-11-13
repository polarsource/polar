import pytest
from pydantic import ValidationError

from polar.kit.address import Address, AddressInput


@pytest.mark.parametrize(
    ("country", "state"),
    [
        ("US", "NY"),
        ("CA", "QC"),
        ("BR", "SP"),
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
        ("BR", "BR-SP"),
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


def test_stored_free_text_state_is_kept() -> None:
    address = Address.model_validate({"country": "BR", "state": "São Paulo"})
    assert address.state == "São Paulo"


class TestAddressInput:
    def test_lowercase_country_is_normalized_to_uppercase(self) -> None:
        address = AddressInput.model_validate({"country": "us"})
        assert address.country == "US"

    def test_mixed_case_country_is_normalized_to_uppercase(self) -> None:
        address = AddressInput.model_validate({"country": "fR"})
        assert address.country == "FR"

    def test_null_country_raises_validation_error(self) -> None:
        with pytest.raises(ValidationError):
            AddressInput.model_validate({"country": None})

    def test_non_string_country_raises_validation_error(self) -> None:
        with pytest.raises(ValidationError):
            AddressInput.model_validate({"country": 42})

    def test_missing_country_raises_validation_error(self) -> None:
        with pytest.raises(ValidationError):
            AddressInput.model_validate({})

    @pytest.mark.parametrize(("country", "state"), [("BR", "São Paulo")])
    def test_invalid_state_raises_validation_error(
        self, country: str, state: str
    ) -> None:
        with pytest.raises(ValidationError):
            AddressInput.model_validate({"country": country, "state": state})
