import json
import uuid

import httpx
import pytest
import respx

from polar.enums import TaxBehavior
from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import TaxCode
from polar.tax.calculation.base import (
    CalculationExpiredError,
    InvalidTaxIDError,
    TaxabilityReason,
    TaxCalculationLogicalError,
    TaxCalculationTechnicalError,
    TaxRecordError,
)
from polar.tax.calculation.numeral import (
    _numeral_jurisdiction_to_breakdown_item,
    numeral_tax_service,
)
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


@pytest.mark.anyio
@pytest.mark.respx(base_url="https://api.numeralhq.com")
class TestNumeralCalculateTax:
    @pytest.mark.parametrize(
        ("note", "customer_exempt", "tax_ids", "expected_reason"),
        [
            (
                "no_collection_exempt_customer",
                False,
                [],
                TaxabilityReason.customer_exempt,
            ),
            (
                "b2b_reverse_charge",
                False,
                [("FR40303265045", TaxIDFormat.eu_vat)],
                TaxabilityReason.reverse_charge,
            ),
            ("b2b reverse charge", False, [], TaxabilityReason.reverse_charge),
            (
                "no_collection",
                False,
                [("911144442", TaxIDFormat.us_ein)],
                TaxabilityReason.not_collecting,
            ),
            ("", True, [], TaxabilityReason.customer_exempt),
            ("", False, [], TaxabilityReason.standard_rated),
        ],
    )
    async def test_taxability_reason(
        self,
        sample_address: Address,
        respx_mock: respx.MockRouter,
        note: str,
        customer_exempt: bool,
        tax_ids: list[tuple[str, TaxIDFormat]],
        expected_reason: TaxabilityReason,
    ) -> None:
        route = respx_mock.post("/tax/calculations").respond(
            json={
                "id": "taxcalc_123",
                "object": "tax.calculation",
                "customer_currency_code": "USD",
                "tax_included_in_amount": False,
                "total_tax_amount": 0,
                "total_amount_excluding_tax": 100_00,
                "total_amount_including_tax": 100_00,
                "effective_tax_rate": 0,
                "line_items": [
                    {
                        "product": {"reference_product_id": "prod_123"},
                        "tax_jurisdictions": [
                            {
                                "tax_rate": 0,
                                "rate_type": "VAT",
                                "fee_amount": 0,
                                "tax_due_decimal": 0,
                                "tax_authority_name": "FR",
                                "tax_authority_type": "Country",
                                "tax_type": "VAT",
                                "note": note,
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
        assert result["tax_breakdown"][0]["display_name"] == "VAT"
        assert result["tax_breakdown"][0]["subdivision"] is None
        request = route.calls.last.request
        assert request.headers["X-API-Version"] == "2026-11-01"
        payload = json.loads(request.content)
        assert payload["customer"]["tax_ids"] == [
            {"type": format, "value": value} for value, format in tax_ids
        ]
        assert payload["customer"]["type"] == ("BUSINESS" if tax_ids else "CONSUMER")
        assert payload["order_details"]["line_items"][0]["product_category"] == (
            "EXEMPT" if customer_exempt else "SAAS_GENERAL"
        )

    @pytest.mark.parametrize(
        "rate_type",
        [
            "general state sales tax",
            "GENERAL STATE SALES TAX",
            "SINGLE_ARTICLE STATE SALES TAX",
        ],
    )
    async def test_inclusive(
        self, sample_address: Address, respx_mock: respx.MockRouter, rate_type: str
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
                                "rate_type": rate_type,
                                "fee_amount": 0,
                                "tax_due_decimal": 16_67,
                                "tax_authority_name": "Texas",
                                "tax_authority_type": "",
                                "tax_type": "SALES",
                                "note": "",
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
                "display_name": "Sales Tax",
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
                                "tax_type": "SALES",
                                "note": "",
                            },
                            {
                                "tax_rate": 0.015,
                                "rate_type": "general county local sales tax",
                                "fee_amount": 0,
                                "tax_due_decimal": 150,
                                "tax_authority_name": "Anderson",
                                "tax_authority_type": "county",
                                "tax_type": "SALES",
                                "note": "",
                            },
                            {
                                "tax_rate": 0.00375,
                                "rate_type": "test sales tax",
                                "fee_amount": 0,
                                "tax_due_decimal": 38,
                                "tax_authority_name": "Foobar",
                                "tax_authority_type": "other",
                                "tax_type": "SALES",
                                "note": "",
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
                "display_name": "Sales Tax",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": None,
                "amount": 625,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
            {
                "rate_type": "percentage",
                "rate": 0.015,
                "display_name": "Sales Tax",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": "Anderson",
                "amount": 150,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
            {
                "rate_type": "percentage",
                "rate": 0.00375,
                "display_name": "Sales Tax",
                "country": CountryAlpha2("US"),
                "state": "TX",
                "subdivision": "Foobar",
                "amount": 38,
                "taxability_reason": TaxabilityReason.standard_rated,
            },
        ]
        assert result["processor_id"] == "taxcalc_123"
        assert result["tax_behavior"] == TaxBehavior.exclusive

    @pytest.mark.parametrize(
        (
            "tax_rate",
            "tax_due_decimal",
            "fee_amount",
            "expected_jurisdiction_amount",
            "expected_total_amount",
        ),
        [
            (0.07, 724.9275, 0, 724.9275, 725),
            (0, 0, 50, 50, 50),
            (0.0275, 4400, 0, 4400, 4400),
        ],
    )
    async def test_jurisdiction_amount(
        self,
        sample_address: Address,
        respx_mock: respx.MockRouter,
        tax_rate: float,
        tax_due_decimal: float,
        fee_amount: float,
        expected_jurisdiction_amount: float,
        expected_total_amount: int,
    ) -> None:
        respx_mock.post("/tax/calculations").respond(
            json={
                "id": "taxcalc_123",
                "total_tax_amount": expected_total_amount,
                "line_items": [
                    {
                        "tax_jurisdictions": [
                            {
                                "tax_rate": tax_rate,
                                "tax_due_decimal": tax_due_decimal,
                                "fee_amount": fee_amount,
                                "rate_type": "Sales Tax",
                                "tax_authority_name": "State Tax",
                                "tax_authority_type": "STATE",
                                "tax_type": "SALES",
                                "note": "",
                            }
                        ]
                    }
                ],
            }
        )
        result = await numeral_tax_service.calculate(
            identifier=uuid.uuid4(),
            currency="usd",
            amount=100_0000,
            tax_behavior=TaxBehavior.exclusive,
            tax_code=TaxCode.general_electronically_supplied_services,
            address=sample_address,
            tax_ids=[],
            customer_exempt=False,
        )
        assert result["amount"] == expected_total_amount
        item = result["tax_breakdown"][0]
        assert item["amount"] == expected_jurisdiction_amount
        assert item["rate"] == (None if fee_amount else tax_rate)
        assert item["rate_type"] == ("fixed" if fee_amount else "percentage")

    @pytest.mark.parametrize(
        ("status", "error_type", "expected_error"),
        [
            (400, "ZIP_STATE_MISMATCH", TaxCalculationLogicalError),
            (400, "MALFORMED_ADDRESS", TaxCalculationLogicalError),
            (400, "INVALID_TAX_ID", InvalidTaxIDError),
            (429, "ERROR", TaxCalculationTechnicalError),
            (500, "ERROR", TaxCalculationTechnicalError),
            (400, "ERROR", httpx.HTTPStatusError),
        ],
    )
    async def test_error(
        self,
        sample_address: Address,
        respx_mock: respx.MockRouter,
        status: int,
        error_type: str,
        expected_error: type[Exception],
    ) -> None:
        respx_mock.post("/tax/calculations").respond(
            status, json={"code": status, "type": error_type, "message": "Error"}
        )
        with pytest.raises(expected_error):
            await numeral_tax_service.calculate(
                identifier=uuid.uuid4(),
                currency="usd",
                amount=100_00,
                tax_behavior=TaxBehavior.exclusive,
                tax_code=TaxCode.general_electronically_supplied_services,
                address=sample_address,
                tax_ids=[],
                customer_exempt=False,
            )

    async def test_unsupported_country(
        self, sample_address: Address, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.post("/tax/calculations").respond(
            400, json={"code": 400, "type": "INVALID_COUNTRY_CODE", "message": "Error"}
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
        assert result["processor_id"] is None
        assert result["amount"] == 0
        assert (
            result["tax_breakdown"][0]["taxability_reason"]
            == TaxabilityReason.not_supported
        )

    @pytest.mark.parametrize(
        (
            "rate_type",
            "authority_type",
            "tax_type",
            "authority_name",
            "expected_subdivision",
            "expected_display_name",
        ),
        [
            ("STANDARD COUNTRY LOCAL VAT TAX", "", "VAT", "FR", None, "VAT"),
            ("GST", "Country", "GST", "SG", None, "GST"),
            (
                "GENERAL COUNTY LOCAL SALES TAX",
                "",
                "SALES",
                "Erie",
                "Erie",
                "Sales Tax",
            ),
            (
                "GENERAL CITY LOCAL USE TAX",
                "",
                "USE",
                "New York",
                "New York",
                "Use Tax",
            ),
            (
                "GENERAL DISTRICT LOCAL SALES TAX",
                "",
                "SALES",
                "Transportation District",
                "Transportation District",
                "Sales Tax",
            ),
        ],
    )
    def test_label_and_subdivision(
        self,
        rate_type: str,
        authority_type: str,
        tax_type: str,
        authority_name: str,
        expected_subdivision: str | None,
        expected_display_name: str,
    ) -> None:
        item = _numeral_jurisdiction_to_breakdown_item(
            {
                "tax_rate": 0.00375,
                "tax_due_decimal": 0.375,
                "fee_amount": 0,
                "rate_type": rate_type,
                "tax_authority_name": authority_name,
                "tax_authority_type": authority_type,
                "tax_type": tax_type,
                "note": "",
            },
            amount=0.375,
            country="US",
            state="NY",
            customer_exempt=False,
        )

        assert item["display_name"] == expected_display_name
        assert item["subdivision"] == expected_subdivision
        assert item["amount"] == 0.375


@pytest.mark.anyio
@pytest.mark.respx(base_url="https://api.numeralhq.com")
class TestNumeralRecord:
    async def test_record(self, respx_mock: respx.MockRouter) -> None:
        route = respx_mock.post("/tax/transactions").respond(json={"id": "tr_123"})
        assert await numeral_tax_service.record("calc_123", "order_123") == "tr_123"
        assert json.loads(route.calls.last.request.content) == {
            "calculation_id": "calc_123",
            "reference_order_id": "order_123",
        }

    @pytest.mark.parametrize(
        ("error_type", "expected_error"),
        [("CALCULATION_EXPIRED", CalculationExpiredError), ("ERROR", TaxRecordError)],
    )
    async def test_error(
        self,
        respx_mock: respx.MockRouter,
        error_type: str,
        expected_error: type[Exception],
    ) -> None:
        respx_mock.post("/tax/transactions").respond(
            400, json={"code": 400, "type": error_type, "message": "Error"}
        )
        with pytest.raises(expected_error):
            await numeral_tax_service.record("calc_123", "order_123")


@pytest.mark.anyio
@pytest.mark.respx(base_url="https://api.numeralhq.com")
class TestNumeralRevert:
    async def test_full(self, respx_mock: respx.MockRouter) -> None:
        route = respx_mock.post("/tax/refunds").respond(json={"id": "ref_123"})
        assert await numeral_tax_service.revert("tr_123", "refund_123") == "ref_123"
        assert json.loads(route.calls.last.request.content) == {
            "transaction_id": "tr_123",
            "type": "full",
        }

    async def test_partial(self, respx_mock: respx.MockRouter) -> None:
        respx_mock.get("/tax/transactions/tr_123").respond(
            json={
                "id": "tr_123",
                "line_items": [{"product": {"reference_product_id": "prod_123"}}],
            }
        )
        route = respx_mock.post("/tax/refunds").respond(json={"id": "ref_123"})
        assert (
            await numeral_tax_service.revert("tr_123", "refund_123", 1200, 200)
            == "ref_123"
        )
        assert json.loads(route.calls.last.request.content) == {
            "transaction_id": "tr_123",
            "type": "partial",
            "line_items": [
                {
                    "reference_product_id": "prod_123",
                    "quantity": 1,
                    "sales_amount_refunded": -1000,
                    "tax_amount_refunded": -200,
                }
            ],
        }
