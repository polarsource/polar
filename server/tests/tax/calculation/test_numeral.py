import uuid

import pytest
import respx

from polar.enums import TaxBehavior
from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import TaxCode
from polar.tax.calculation.base import TaxabilityReason
from polar.tax.calculation.numeral import numeral_tax_service


@pytest.fixture
def sample_address() -> Address:
    return Address(
        line1="123 Main St",
        line2=None,
        postal_code="75763",
        city="Frankston",
        state="US-TX",
        country=CountryAlpha2("US"),
    )


@pytest.mark.asyncio
@pytest.mark.respx(base_url="https://api.numeralhq.com")
class TestNumeralCalculateTax:
    async def test_multiple_breakdown(
        self, sample_address: Address, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.post("/tax/calculations").respond(
            json={
                "id": "taxcalc_123",
                "object": "tax_calculation",
                "customer_currency_code": "USD",
                "tax_included_in_amount": False,
                "total_tax_amount": 813,
                "total_amount_excluding_tax": 100_00,
                "total_amount_including_tax": 108_13,
                "line_items": [
                    {
                        "product": {
                            "reference_product_id": "prod_123",
                        },
                        "tax_jurisdictions": [
                            {
                                "tax_rate": 0.0625,
                                "rate_type": "general state sales tax",
                                "jurisdiction_name": "Texas",
                                "fee_amount": 0,
                                "note": "RATE_FRAC",
                            },
                            {
                                "tax_rate": 0.015,
                                "rate_type": "general county local sales tax",
                                "jurisdiction_name": "Anderson",
                                "fee_amount": 0,
                                "note": "RATE_FRAC",
                            },
                            {
                                "tax_rate": 0.00375,
                                "rate_type": "test sales tax",
                                "jurisdiction_name": "Foobar",
                                "fee_amount": 0,
                                "note": "RATE_FRAC",
                            },
                        ],
                    }
                ],
            }
        )

        result = await numeral_tax_service.calculate(
            identifier=uuid.uuid4(),
            currency="usd",
            amount=100_00,
            tax_behavior=TaxBehavior.exclusive,
            tax_code=TaxCode.general_electronically_supplied_services,
            address=sample_address,
            tax_ids=[],
            customer_exempt=False,
        )

        assert result["amount"] == 813
        assert result["tax_breakdown"] == [
            {
                "rate_type": "percentage",
                "rate": 0.0625,
                "display_name": "Tax",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": None,
                "amount": 625,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
            {
                "rate_type": "percentage",
                "rate": 0.015,
                "display_name": "Tax",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": "Anderson",
                "amount": 150,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
            {
                "rate_type": "percentage",
                "rate": 0.00375,
                "display_name": "Tax",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": "Foobar",
                "amount": 38,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
        ]
        assert result["processor_id"] == "taxcalc_123"
        assert result["tax_behavior"] == TaxBehavior.exclusive
