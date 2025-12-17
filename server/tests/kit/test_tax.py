import uuid
from unittest.mock import patch

import pytest
import stripe as stripe_lib

from polar.kit.address import Address, CountryAlpha2
from polar.kit.tax import (
    InvalidTaxID,
    TaxCode,
    TaxID,
    TaxIDFormat,
    calculate_tax,
    validate_tax_id,
)


@pytest.fixture
def sample_address() -> Address:
    return Address(
        line1="123 Main St",
        line2=None,
        postal_code="10001",
        city="New York",
        state="US-NY",
        country=CountryAlpha2("US"),
    )


@pytest.mark.asyncio
class TestCalculateTaxRateLimit:
    async def test_rate_limit_swallowed_in_sandbox(
        self, sample_address: Address
    ) -> None:
        rate_limit_error = stripe_lib.RateLimitError(
            message="You have exceeded the Calculate Tax API rate limit in test mode.",
            http_status=429,
        )

        with (
            patch(
                "polar.kit.tax.stripe_service.create_tax_calculation",
                side_effect=rate_limit_error,
            ),
            patch("polar.kit.tax.settings.is_sandbox", return_value=True),
        ):
            result = await calculate_tax(
                identifier=uuid.uuid4(),
                currency="usd",
                amount=1000,
                tax_code=TaxCode.general_electronically_supplied_services,
                address=sample_address,
                tax_ids=[],
                customer_exempt=False,
            )

            assert result["amount"] == 0
            assert result["taxability_reason"] is None
            assert result["tax_rate"] is None
            assert result["processor_id"].startswith("taxcalc_sandbox_")

    async def test_rate_limit_raised_in_production(
        self, sample_address: Address
    ) -> None:
        rate_limit_error = stripe_lib.RateLimitError(
            message="You have exceeded the Calculate Tax API rate limit.",
            http_status=429,
        )

        with (
            patch(
                "polar.kit.tax.stripe_service.create_tax_calculation",
                side_effect=rate_limit_error,
            ),
            patch("polar.kit.tax.settings.is_sandbox", return_value=False),
        ):
            with pytest.raises(stripe_lib.RateLimitError):
                await calculate_tax(
                    identifier=uuid.uuid4(),
                    currency="usd",
                    amount=1000,
                    tax_code=TaxCode.general_electronically_supplied_services,
                    address=sample_address,
                    tax_ids=[],
                    customer_exempt=False,
                )


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
        ("4540536920", "TR", ("4540536920", TaxIDFormat.tr_tin)),
        ("27AAPFU0939F1ZV", "IN", ("27AAPFU0939F1ZV", TaxIDFormat.in_gst)),
        ("0100233488", "VN", ("0100233488", TaxIDFormat.vn_tin)),
        ("104479084600003", "AE", ("104479084600003", TaxIDFormat.ae_trn)),
        ("104 479 084 600 003", "AE", ("104479084600003", TaxIDFormat.ae_trn)),
        ("104-479-084-600-003", "AE", ("104479084600003", TaxIDFormat.ae_trn)),
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
    ],
)
def test_validate_tax_id_invalid(number: str, country: str) -> None:
    with pytest.raises(InvalidTaxID):
        validate_tax_id(number, country)
