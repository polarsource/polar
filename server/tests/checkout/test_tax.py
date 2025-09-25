import pytest

from polar.kit.tax import InvalidTaxID, TaxID, TaxIDFormat, validate_tax_id


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
        ("234567899RT0001", "CA", ("234567899RT0001", TaxIDFormat.ca_gst_hst)),
        ("234567899 RT0001", "CA", ("234567899RT0001", TaxIDFormat.ca_gst_hst)),
        ("234567899", "CA", ("234567899", TaxIDFormat.ca_bn)),
        ("12.531.909-2", "CL", ("125319092", TaxIDFormat.cl_tin)),
        ("12531909-2", "CL", ("125319092", TaxIDFormat.cl_tin)),
    ],
)
def test_validate_tax_id_valid(number: str, country: str, expected: TaxID) -> None:
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
def test_validate_tax_id_invalid(number: str, country: str) -> None:
    with pytest.raises(InvalidTaxID):
        validate_tax_id(number, country)
