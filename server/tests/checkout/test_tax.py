import pytest

from polar.checkout.tax import TaxIdType, validate_tax_id


@pytest.mark.parametrize(
    "tax_id, tax_id_type, expected_tax_id",
    [
        (
            "GB980780684",
            TaxIdType.gb_vat,
            "980780684",
        ),
        ("FR61954506077", TaxIdType.eu_vat, "FR61954506077"),
        (
            "91-1144442",
            TaxIdType.us_ein,
            "911144442",
        ),
    ],
)
def test_validate_tax_id_valid(
    tax_id: str, tax_id_type: TaxIdType, expected_tax_id: str
) -> None:
    validated_tax_id, validated_tax_id_type = validate_tax_id((tax_id, tax_id_type))
    assert validated_tax_id == expected_tax_id
    assert validated_tax_id_type == tax_id_type


@pytest.mark.parametrize(
    "tax_id, tax_id_type",
    [
        ("123", TaxIdType.eu_vat),
        ("FR11111111111", TaxIdType.eu_vat),
        ("GB980780684", TaxIdType.eu_vat),
        ("GB980780684", "foo"),
    ],
)
def test_validate_tax_id_invalid(tax_id: str, tax_id_type: TaxIdType) -> None:
    with pytest.raises(ValueError):
        validate_tax_id((tax_id, tax_id_type))
