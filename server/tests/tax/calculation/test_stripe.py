import uuid
from unittest.mock import patch

import pytest
import stripe as stripe_lib

from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import TaxCode
from polar.tax.calculation.stripe import stripe_tax_service


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
class TestStripeCalculateTax:
    async def test_rate_limit_swallowed_in_sandbox(
        self, sample_address: Address
    ) -> None:
        rate_limit_error = stripe_lib.RateLimitError(
            message="You have exceeded the Calculate Tax API rate limit in test mode.",
            http_status=429,
        )

        with (
            patch(
                "polar.tax.calculation.stripe.stripe_service.create_tax_calculation",
                side_effect=rate_limit_error,
            ),
            patch(
                "polar.tax.calculation.stripe.settings.is_sandbox", return_value=True
            ),
        ):
            result = await stripe_tax_service.calculate(
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
            assert result["processor_id"] is not None
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
                "polar.tax.calculation.stripe.stripe_service.create_tax_calculation",
                side_effect=rate_limit_error,
            ),
            patch(
                "polar.tax.calculation.stripe.settings.is_sandbox", return_value=False
            ),
        ):
            with pytest.raises(stripe_lib.RateLimitError):
                await stripe_tax_service.calculate(
                    identifier=uuid.uuid4(),
                    currency="usd",
                    amount=1000,
                    tax_code=TaxCode.general_electronically_supplied_services,
                    address=sample_address,
                    tax_ids=[],
                    customer_exempt=False,
                )
