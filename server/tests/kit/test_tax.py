import uuid
from unittest.mock import patch

import pytest
import stripe as stripe_lib

from polar.kit.address import Address, CountryAlpha2
from polar.kit.tax import (
    InvalidTaxID,
    TaxCode,
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


class TestValidateTaxID:
    def test_valid_uae_trn(self) -> None:
        # 15-digit UAE TRN
        result = validate_tax_id("104479084600003", "AE")
        assert result == ("104479084600003", TaxIDFormat.ae_trn)

    def test_valid_uae_trn_with_separators(self) -> None:
        # UAE TRN with spaces and dashes should be normalized
        result = validate_tax_id("104 479 084 600 003", "AE")
        assert result == ("104479084600003", TaxIDFormat.ae_trn)

        result = validate_tax_id("104-479-084-600-003", "AE")
        assert result == ("104479084600003", TaxIDFormat.ae_trn)

    def test_invalid_uae_trn_wrong_length(self) -> None:
        # Too short
        with pytest.raises(InvalidTaxID):
            validate_tax_id("12345678901234", "AE")

        # Too long
        with pytest.raises(InvalidTaxID):
            validate_tax_id("1234567890123456", "AE")

    def test_invalid_uae_trn_non_numeric(self) -> None:
        with pytest.raises(InvalidTaxID):
            validate_tax_id("10447908460000A", "AE")

    def test_valid_eu_vat(self) -> None:
        # French VAT number
        result = validate_tax_id("FR61954506077", "FR")
        assert result == ("FR61954506077", TaxIDFormat.eu_vat)

    def test_invalid_country(self) -> None:
        # Country not in COUNTRY_TAX_ID_MAP
        with pytest.raises(InvalidTaxID):
            validate_tax_id("123456789", "XX")
