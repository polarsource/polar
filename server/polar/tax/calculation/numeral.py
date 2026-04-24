import uuid
from datetime import datetime
from typing import Literal, NotRequired, TypedDict

import httpx
import logfire
import structlog
from opentelemetry import trace

from polar.config import settings
from polar.enums import TaxBehavior
from polar.kit.address import Address
from polar.logging import Logger

from ..tax_id import TaxID
from .base import (
    CalculationExpiredError,
    InvalidTaxIDError,
    TaxabilityReason,
    TaxBreakdownItem,
    TaxCalculation,
    TaxCalculationLogicalError,
    TaxCalculationTechnicalError,
    TaxCode,
    TaxRecordError,
    TaxServiceProtocol,
)

log: Logger = structlog.get_logger()

NUMERAL_API_VERSION = "2026-03-01"


class NumeralTaxJurisdiction(TypedDict):
    tax_rate: float
    rate_type: str
    fee_amount: int
    tax_due_decimal: int
    tax_authority_name: str
    tax_authority_type: str
    tax_type: str


class NumeralLineItemProduct(TypedDict):
    reference_product_id: str


class NumeralLineItem(TypedDict):
    product: NumeralLineItemProduct
    tax_jurisdictions: list[NumeralTaxJurisdiction]
    quantity: int
    tax_amount: int
    amount_excluding_tax: int
    amount_including_tax: int


class NumeralAddressUsed(TypedDict):
    address_line_1: str
    address_city: str
    address_province: str
    address_postal_code: str
    address_country: str


class NumeralTaxCalculationResponse(TypedDict):
    id: str
    object: Literal["tax.calculation"]
    customer_currency_code: str
    tax_included_in_amount: bool
    total_tax_amount: int
    total_amount_excluding_tax: int
    total_amount_including_tax: int
    line_items: list[NumeralLineItem]
    expires_at: int
    testmode: bool
    address_resolution_status: str
    address_used: NumeralAddressUsed
    location_source: NotRequired[str]
    resolution_precision: NotRequired[str]


class NumeralErrorResponse(TypedDict):
    code: int
    type: str
    message: str


class NumeralTaxTransactionResponse(TypedDict):
    id: str
    object: Literal["tax.transaction"]
    line_items: list[NumeralLineItem]


class NumeralTaxRefundResponse(TypedDict):
    id: str
    object: Literal["tax.refund"]
    line_items: list[NumeralLineItem]


def _numeral_jurisdiction_to_breakdown_item(
    jurisdiction: NumeralTaxJurisdiction,
    country: str,
    state: str | None,
    customer_exempt: bool,
) -> TaxBreakdownItem:
    taxability_reason = TaxabilityReason.from_numeral(
        jurisdiction["rate_type"], customer_exempt
    )

    is_fixed = jurisdiction["fee_amount"] > 0
    rate = None if is_fixed else jurisdiction["tax_rate"]

    subdivision: str | None = None
    if "general state" not in jurisdiction["rate_type"]:
        subdivision = jurisdiction["tax_authority_name"]

    return TaxBreakdownItem(
        rate_type="fixed" if is_fixed else "percentage",
        rate=rate,
        display_name=jurisdiction["tax_authority_name"],
        country=country,
        state=state,
        subdivision=subdivision,
        amount=jurisdiction["tax_due_decimal"],
        taxability_reason=taxability_reason,
    )


def _build_numeral_tax_breakdown(
    jurisdictions: list[NumeralTaxJurisdiction],
    *,
    country: str,
    state: str | None,
    customer_exempt: bool,
) -> list[TaxBreakdownItem]:
    tax_breakdown: list[TaxBreakdownItem] = []

    for jurisdiction in jurisdictions:
        tax_breakdown.append(
            _numeral_jurisdiction_to_breakdown_item(
                jurisdiction,
                country=country,
                state=state,
                customer_exempt=customer_exempt,
            )
        )

    return tax_breakdown


class NumeralTaxService(TaxServiceProtocol):
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://api.numeralhq.com",
            headers={
                "X-API-Version": NUMERAL_API_VERSION,
                "Authorization": f"Bearer {settings.NUMERAL_API_KEY}",
            },
        )

    @logfire.instrument(
        "numeral.calculate",
        extract_args=[
            "identifier",
            "currency",
            "amount",
            "tax_behavior",
            "customer_exempt",
        ],
    )
    async def calculate(
        self,
        identifier: uuid.UUID | str,
        currency: str,
        amount: int,
        tax_behavior: TaxBehavior,
        tax_code: TaxCode,
        address: Address,
        tax_ids: list[TaxID],
        customer_exempt: bool,
    ) -> TaxCalculation:
        trace.get_current_span().set_attribute(
            "numeral.api_version", NUMERAL_API_VERSION
        )
        customer_type = "BUSINESS" if len(tax_ids) > 0 else "CONSUMER"
        product_category = "EXEMPT" if customer_exempt else tax_code.to_numeral()

        postal_code = address.postal_code or ""
        # Numeral requires a postal code for Canada, but a dummy one is fine
        if address.country == "CA" and not postal_code:
            postal_code = "A0A0A0"

        payload_address = {
            "address_type": "billing",
            "address_line_1": address.line1 or "",
            "address_city": address.city or "",
            "address_province": address.get_unprefixed_state() or "",
            "address_postal_code": postal_code,
            "address_country": address.country,
        }
        if address.line2:
            payload_address["address_line_2"] = address.line2

        payload = {
            "customer": {
                "address": payload_address,
                "type": customer_type,
                "tax_ids": [
                    {"type": format, "value": value} for value, format in tax_ids
                ],
            },
            "order_details": {
                "automatic_tax": "auto",
                "customer_currency_code": currency.upper(),
                "line_items": [
                    {
                        "amount": amount,
                        "product_category": product_category,
                        "quantity": 1,
                    }
                ],
                "tax_included_in_amount": tax_behavior == TaxBehavior.inclusive,
            },
        }

        try:
            response = await self.client.post("/tax/calculations", json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.is_server_error:
                log.debug(
                    "Numeral tax calculation server error",
                    status_code=e.response.status_code,
                    text=e.response.text,
                )
                raise TaxCalculationTechnicalError("Numeral server error") from e
            if e.response.status_code == 429:
                log.debug("Numeral rate limit exceeded")
                raise TaxCalculationTechnicalError("Rate limit exceeded") from e

            log.debug("Numeral tax calculation error: %s", e.response.text)
            error_response: NumeralErrorResponse = e.response.json()
            error_type = error_response.get("type", "")
            if error_type == "INVALID_COUNTRY_CODE":
                return TaxCalculation(
                    processor_id=None,
                    amount=0,
                    currency=currency,
                    tax_behavior=tax_behavior,
                    tax_breakdown=[
                        TaxBreakdownItem(
                            rate_type="percentage",
                            rate=0,
                            display_name="",
                            country=address.country,
                            state=address.get_unprefixed_state(),
                            subdivision=None,
                            amount=0,
                            taxability_reason=TaxabilityReason.not_supported,
                        )
                    ],
                )
            if error_type == "ZIP_STATE_MISMATCH":
                raise TaxCalculationLogicalError("Invalid postal code provided") from e
            if error_type == "MALFORMED_ADDRESS":
                raise TaxCalculationLogicalError("Invalid address provided") from e
            if error_type == "INVALID_TAX_ID":
                raise InvalidTaxIDError() from e

            log.warning("Unhandled Numeral tax calculation error: %s", e.response.text)
            raise
        except httpx.RequestError as e:
            log.debug("Numeral tax calculation request error: %s", str(e))
            raise TaxCalculationTechnicalError(str(e)) from e

        calculation: NumeralTaxCalculationResponse = response.json()
        trace.get_current_span().set_attribute(
            "numeral.calculation_id", calculation["id"]
        )

        jurisdictions = calculation["line_items"][0]["tax_jurisdictions"]
        total_tax_amount = calculation["total_tax_amount"]
        country = address.country
        state = address.get_unprefixed_state()

        tax_breakdown = _build_numeral_tax_breakdown(
            jurisdictions,
            country=country,
            state=state,
            customer_exempt=customer_exempt,
        )

        if sum(item["amount"] for item in tax_breakdown) != total_tax_amount:
            log.warning(
                "Numeral tax breakdown does not sum up to total tax amount",
                calculation_id=calculation["id"],
                total_tax_amount=total_tax_amount,
                breakdown_sum=sum(item["amount"] for item in tax_breakdown),
            )

        return TaxCalculation(
            processor_id=calculation["id"],
            amount=total_tax_amount,
            currency=currency,
            tax_behavior=tax_behavior,
            tax_breakdown=tax_breakdown,
        )

    @logfire.instrument("numeral.record")
    async def record(self, calculation_id: str, reference: str) -> str:
        trace.get_current_span().set_attribute(
            "numeral.api_version", NUMERAL_API_VERSION
        )
        try:
            response = await self.client.post(
                "/tax/transactions",
                json={
                    "calculation_id": calculation_id,
                    "reference_order_id": reference,
                },
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.is_server_error:
                log.warning(
                    "Numeral tax record server error",
                    status_code=e.response.status_code,
                    text=e.response.text,
                )
                raise TaxRecordError() from e
            error_response: NumeralErrorResponse = e.response.json()
            if error_response.get("type") == "CALCULATION_EXPIRED":
                raise CalculationExpiredError() from e
            log.warning("Numeral tax record error: %s", e.response.text)
            raise TaxRecordError() from e

        transaction: NumeralTaxTransactionResponse = response.json()
        trace.get_current_span().set_attribute(
            "numeral.transaction_id", transaction["id"]
        )
        return transaction["id"]

    @logfire.instrument("numeral.revert")
    async def revert(
        self,
        transaction_id: str,
        reference: str,
        reverted_amount: int | None = None,
        reverted_tax_amount: int | None = None,
    ) -> str:
        span = trace.get_current_span()
        span.set_attribute("numeral.api_version", NUMERAL_API_VERSION)
        refund: NumeralTaxRefundResponse

        if reverted_amount is None and reverted_tax_amount is None:
            span.set_attribute("numeral.refund_type", "full")
            response = await self.client.post(
                "/tax/refunds",
                json={
                    "transaction_id": transaction_id,
                    "type": "full",
                },
            )
            response.raise_for_status()
            refund = response.json()
            span.set_attribute("numeral.refund_id", refund["id"])
            return refund["id"]

        span.set_attribute("numeral.refund_type", "partial")

        assert reverted_amount is not None
        assert reverted_tax_amount is not None

        response = await self.client.get(f"/tax/transactions/{transaction_id}")
        response.raise_for_status()
        transaction: NumeralTaxTransactionResponse = response.json()

        item = transaction["line_items"][0]
        reference_product_id = item["product"]["reference_product_id"]
        response = await self.client.post(
            "/tax/refunds",
            json={
                "transaction_id": transaction_id,
                "type": "partial",
                "line_items": [
                    {
                        "reference_product_id": reference_product_id,
                        "quantity": 1,
                        "sales_amount_refunded": -(
                            reverted_amount - reverted_tax_amount
                        ),
                        "tax_amount_refunded": -reverted_tax_amount,
                    }
                ],
            },
        )
        response.raise_for_status()

        refund = response.json()
        span.set_attribute("numeral.refund_id", refund["id"])
        return refund["id"]

    @logfire.instrument("numeral.backfill")
    async def backfill(
        self,
        amount: int,
        tax_amount: int,
        currency: str,
        address: Address,
        tax_code: TaxCode,
        reference: str,
        transaction_date: datetime,
    ) -> str:
        trace.get_current_span().set_attribute(
            "numeral.api_version", NUMERAL_API_VERSION
        )
        response = await self.client.post(
            "/tax/manual_line_items",
            json={
                "order_id": reference,
                "address_postal_code": address.postal_code or "",
                "address_province": address.get_unprefixed_state() or "",
                "address_country": address.country,
                "transaction_date_time": int(transaction_date.timestamp()),
                "currency_code": currency,
                "line_items": [
                    {
                        "line_item_id": reference,
                        "sales": amount,
                        "total_taxes": tax_amount,
                        "product_category": tax_code.to_numeral(),
                    }
                ],
            },
        )
        response.raise_for_status()
        manual_line_item = response.json()
        trace.get_current_span().set_attribute(
            "numeral.line_item_id", manual_line_item["line_item_id"]
        )
        return manual_line_item["line_item_id"]


numeral_tax_service = NumeralTaxService()
