import pytest

from polar.tax.tax_id import InvalidTaxID, TaxID, TaxIDFormat, validate_tax_id


@pytest.mark.parametrize(
    ("number", "country", "expected"),
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
        ("213.123.432-1", "CO", ("2131234321", TaxIDFormat.co_nit)),
        ("213-123-432-1", "CO", ("2131234321", TaxIDFormat.co_nit)),
        ("213 123 432 1", "CO", ("2131234321", TaxIDFormat.co_nit)),
        ("2131234321", "CO", ("2131234321", TaxIDFormat.co_nit)),
        ("800.197.268-4", "CO", ("8001972684", TaxIDFormat.co_nit)),
        ("4540536920", "TR", ("4540536920", TaxIDFormat.tr_tin)),
        ("27AAPFU0939F1ZV", "IN", ("27AAPFU0939F1ZV", TaxIDFormat.in_gst)),
        ("0100233488", "VN", ("0100233488", TaxIDFormat.vn_tin)),
        ("104479084600003", "AE", ("104479084600003", TaxIDFormat.ae_trn)),
        ("104 479 084 600 003", "AE", ("104479084600003", TaxIDFormat.ae_trn)),
        ("104-479-084-600-003", "AE", ("104479084600003", TaxIDFormat.ae_trn)),
        ("516179157", "IL", ("516179157", TaxIDFormat.il_vat)),
        ("000000018", "IL", ("000000018", TaxIDFormat.il_vat)),
        ("039337423", "IL", ("039337423", TaxIDFormat.il_vat)),
        ("3933742-3", "IL", ("039337423", TaxIDFormat.il_vat)),
    ],
)
def test_validate_tax_id_valid(number: str, country: str, expected: TaxID) -> None:
    validated_tax_id = validate_tax_id(number, country)
    assert validated_tax_id == expected


@pytest.mark.parametrize(
    ("number", "country"),
    [
        ("123", "FR"),
        ("FR11111111111", "FR"),
        ("GB980780684", "FR"),
        ("GB980780684", "foo"),
        ("10447908460000A", "AE"),
        ("10447908460000", "AE"),
        ("1044790846000000", "AE"),
        ("12345678", "IL"),
        ("1234567890", "IL"),
        ("123456789", "IL"),
        ("516179150", "IL"),
        ("213123432", "CO"),  # Missing check digit
        ("2131234325", "CO"),  # Wrong check digit
        ("1234567", "CO"),  # Too short
    ],
)
def test_validate_tax_id_invalid(number: str, country: str) -> None:
    with pytest.raises(InvalidTaxID):
        validate_tax_id(number, country)
