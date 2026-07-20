import uuid

import pytest
import respx

from polar.enums import TaxBehavior
from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import TaxCode
from polar.tax.calculation.base import TaxabilityReason
from polar.tax.calculation.numeral import numeral_tax_service
from polar.tax.tax_id import TaxIDFormat


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
    @pytest.mark.parametrize(
        (
            "tax_rate",
            "rate_type",
            "tax_authority_type",
            "tax_type",
            "customer_exempt",
            "tax_ids",
            "expected_reason",
        ),
        [
            (
                0,
                "EXEMPT STATE SALES TAX",
                "",
                "SALES",
                False,
                [],
                TaxabilityReason.product_exempt,
            ),
            (
                0,
                "EXEMPT STATE SALES TAX",
                "",
                "SALES",
                False,
                [("911144442", TaxIDFormat.us_ein)],
                TaxabilityReason.product_exempt,
            ),
            (
                0,
                "VAT",
                "Country",
                "VAT",
                False,
                [("FR61954506077", TaxIDFormat.eu_vat)],
                TaxabilityReason.reverse_charge,
            ),
            (
                0,
                "EXEMPT STATE SALES TAX",
                "",
                "SALES",
                True,
                [],
                TaxabilityReason.customer_exempt,
            ),
            (
                0,
                "VAT",
                "",
                "VAT",
                False,
                [],
                TaxabilityReason.not_collecting,
            ),
            (
                0,
                "VAT",
                "",
                "VAT",
                False,
                [("123456789", TaxIDFormat.eg_tin)],
                TaxabilityReason.not_subject_to_tax,
            ),
            (
                0.2,
                "GENERAL STATE SALES TAX",
                "",
                "SALES",
                False,
                [],
                TaxabilityReason.standard_rated,
            ),
        ],
    )
    async def test_taxability_reason(
        self,
        sample_address: Address,
        respx_mock: respx.MockRouter,
        tax_rate: float,
        rate_type: str,
        tax_authority_type: str,
        tax_type: str,
        customer_exempt: bool,
        tax_ids: list[tuple[str, TaxIDFormat]],
        expected_reason: TaxabilityReason,
    ) -> None:
        tax_amount = round(100_00 * tax_rate)
        respx_mock.post("/tax/calculations").respond(
            json={
                "id": "taxcalc_123",
                "object": "tax.calculation",
                "customer_currency_code": "USD",
                "tax_included_in_amount": False,
                "total_tax_amount": tax_amount,
                "total_amount_excluding_tax": 100_00,
                "total_amount_including_tax": 100_00 + tax_amount,
                "line_items": [
                    {
                        "product": {"reference_product_id": "prod_123"},
                        "tax_jurisdictions": [
                            {
                                "tax_rate": tax_rate,
                                "rate_type": rate_type,
                                "fee_amount": 0,
                                "tax_due_decimal": tax_amount,
                                "tax_authority_name": "Texas",
                                "tax_authority_type": tax_authority_type,
                                "tax_type": tax_type,
                            }
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
            tax_ids=tax_ids,
            customer_exempt=customer_exempt,
        )

        assert result["tax_breakdown"][0]["taxability_reason"] == expected_reason

    @pytest.mark.parametrize(
        ("tax_ids", "expected_reason"),
        [
            ([], TaxabilityReason.not_collecting),
            (
                [("FR61954506077", TaxIDFormat.eu_vat)],
                TaxabilityReason.not_subject_to_tax,
            ),
        ],
    )
    async def test_taxability_reason_without_jurisdictions(
        self,
        sample_address: Address,
        respx_mock: respx.MockRouter,
        tax_ids: list[tuple[str, TaxIDFormat]],
        expected_reason: TaxabilityReason,
    ) -> None:
        respx_mock.post("/tax/calculations").respond(
            json={
                "id": "taxcalc_123",
                "object": "tax.calculation",
                "customer_currency_code": "USD",
                "tax_included_in_amount": False,
                "total_tax_amount": 0,
                "total_amount_excluding_tax": 100_00,
                "total_amount_including_tax": 100_00,
                "line_items": [
                    {
                        "product": {"reference_product_id": "prod_123"},
                        "tax_jurisdictions": [],
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
            tax_ids=tax_ids,
            customer_exempt=False,
        )

        assert result["tax_breakdown"][0]["taxability_reason"] == expected_reason

    async def test_inclusive(
        self, sample_address: Address, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.post("/tax/calculations").respond(
            json={
                "id": "taxcalc_123",
                "object": "tax_calculation",
                "customer_currency_code": "USD",
                "tax_included_in_amount": False,
                "total_tax_amount": 16_67,
                "total_amount_excluding_tax": 83_33,
                "total_amount_including_tax": 100_00,
                "line_items": [
                    {
                        "product": {
                            "reference_product_id": "prod_123",
                        },
                        "tax_jurisdictions": [
                            {
                                "tax_rate": 0.2,
                                "rate_type": "general state sales tax",
                                "fee_amount": 0,
                                "tax_due_decimal": 16_67,
                                "tax_authority_name": "Texas",
                                "tax_authority_type": "state",
                                "tax_type": "sales tax",
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
            tax_behavior=TaxBehavior.inclusive,
            tax_code=TaxCode.general_electronically_supplied_services,
            address=sample_address,
            tax_ids=[],
            customer_exempt=False,
        )

        assert result["amount"] == 16_67
        assert result["tax_breakdown"] == [
            {
                "rate_type": "percentage",
                "rate": 0.2,
                "display_name": "Texas",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": None,
                "amount": 16_67,
                "taxability_reason": TaxabilityReason.standard_rated,
            }
        ]
        assert result["processor_id"] == "taxcalc_123"
        assert result["tax_behavior"] == TaxBehavior.inclusive

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
                                "fee_amount": 0,
                                "tax_due_decimal": 625,
                                "tax_authority_name": "Texas",
                                "tax_authority_type": "state",
                                "tax_type": "sales tax",
                            },
                            {
                                "tax_rate": 0.015,
                                "rate_type": "general county local sales tax",
                                "fee_amount": 0,
                                "tax_due_decimal": 150,
                                "tax_authority_name": "Anderson",
                                "tax_authority_type": "county",
                                "tax_type": "sales tax",
                            },
                            {
                                "tax_rate": 0.00375,
                                "rate_type": "test sales tax",
                                "fee_amount": 0,
                                "tax_due_decimal": 38,
                                "tax_authority_name": "Foobar",
                                "tax_authority_type": "other",
                                "tax_type": "sales tax",
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
                "display_name": "Texas",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": None,
                "amount": 625,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
            {
                "rate_type": "percentage",
                "rate": 0.015,
                "display_name": "Anderson",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": "Anderson",
                "amount": 150,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
            {
                "rate_type": "percentage",
                "rate": 0.00375,
                "display_name": "Foobar",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": "Foobar",
                "amount": 38,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
        ]
        assert result["processor_id"] == "taxcalc_123"
        assert result["tax_behavior"] == TaxBehavior.exclusive
