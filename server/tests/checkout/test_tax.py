import pytest
from pydantic_extra_types.country import CountryAlpha2

from polar.checkout.tax import TaxID, TaxIDFormat, validate_tax_id


@pytest.mark.parametrize(
    "number, country, expected",
    [
        (
            "GB980780684",
            "GB",
            (
                "980780684",
                TaxIDFormat.gb_vat,
            ),
        ),
        ("FR61954506077", "FR", ("FR61954506077", TaxIDFormat.eu_vat)),
        (
            "91-1144442",
            "US",
            ("911144442", TaxIDFormat.us_ein),
        ),
    ],
)
def test_validate_tax_id_valid(
    number: str, country: CountryAlpha2, expected: TaxID
) -> None:
    validated_tax_id = validate_tax_id(number, country)
    assert validated_tax_id == expected


@pytest.mark.parametrize(
    "number, country",
    [
        ("123", "FR"),
        ("FR11111111111", "FR"),
        ("GB980780684", "FR"),
        ("GB980780684", "foo"),
    ],
)
def test_validate_tax_id_invalid(number: str, country: CountryAlpha2) -> None:
    with pytest.raises(ValueError):
        validate_tax_id(number, country)
