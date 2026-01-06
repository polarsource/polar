import uuid
from typing import Literal, NotRequired, TypedDict

import httpx

from polar.config import settings
from polar.kit.address import Address

from ..tax_id import TaxID
from .base import (
    TaxabilityReason,
    TaxCalculation,
    TaxCalculationError,
    TaxCode,
    TaxRate,
    TaxServiceProtocol,
)


class NumeralTaxId(TypedDict):
    type: Literal["VAT", "GST", "EIN"]
    value: str


class NumeralTaxJurisdiction(TypedDict):
    tax_rate: float
    rate_type: str
    jurisdiction_name: str
    fee_amount: int
    note: str


class NumeralLineItemProduct(TypedDict):
    reference_product_id: str


class NumeralLineItem(TypedDict):
    product: NumeralLineItemProduct
    tax_jurisdictions: list[NumeralTaxJurisdiction]


class NumeralTaxCalculationResponse(TypedDict):
    id: str
    object: Literal["tax.calculation"]
    customer_currency_code: str
    tax_included_in_amount: bool
    total_tax_amount: int
    total_amount_excluding_tax: int
    total_amount_including_tax: int
    line_items: list[NumeralLineItem]


class NumeralTaxCalculationErrorMeta(TypedDict):
    field: str


class NumeralTaxCalculationErrorObject(TypedDict):
    error_code: NotRequired[str]
    error_message: str
    error_meta: NotRequired[NumeralTaxCalculationErrorMeta]


class NumeralTaxCalculationErrorResponse(TypedDict):
    error: NumeralTaxCalculationErrorObject


class NumeralTaxTransactionResponse(TypedDict):
    id: str
    object: Literal["tax.transaction"]
    line_items: list[NumeralLineItem]


class NumeralTaxRefundResponse(TypedDict):
    id: str
    object: Literal["tax.refund"]
    line_items: list[NumeralLineItem]


def to_numeral_tax_id(tax_id: TaxID) -> NumeralTaxId:
    value, format = tax_id
    _, type = format.split("_", 1)
    match type:
        case "gst":
            return {"type": "GST", "value": value}
        case "ein":
            return {"type": "EIN", "value": value}
        case _:
            return {"type": "VAT", "value": value}


def from_numeral_tax_jurisdiction(
    jurisdiction: NumeralTaxJurisdiction,
    country: str,
    state: str | None,
    currency: str,
) -> TaxRate:
    rate_type: Literal["percentage", "fixed"] = (
        "fixed" if jurisdiction["fee_amount"] > 0 else "percentage"
    )
    basis_points = None
    amount = None
    amount_currency = None

    if rate_type == "percentage":
        basis_points = int(jurisdiction["tax_rate"] * 100 * 100)
    else:
        amount = jurisdiction["fee_amount"]
        amount_currency = currency

    display_name = jurisdiction["jurisdiction_name"]

    return TaxRate(
        rate_type=rate_type,
        basis_points=basis_points,
        amount=amount,
        amount_currency=amount_currency,
        display_name=display_name,
        country=country,
        state=state,
    )


class NumeralTaxService(TaxServiceProtocol):
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://api.numeralhq.com",
            headers={
                "X-API-Version": "2025-05-12",
                "Authorization": f"Bearer {settings.NUMERAL_API_KEY}",
            },
        )

    async def calculate(
        self,
        identifier: uuid.UUID | str,
        currency: str,
        amount: int,
        tax_code: TaxCode,
        address: Address,
        tax_ids: list[TaxID],
        customer_exempt: bool,
    ) -> TaxCalculation:
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
                "tax_ids": [to_numeral_tax_id(tax_id) for tax_id in tax_ids],
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
                "tax_included_in_amount": False,
            },
        }

        try:
            response = await self.client.post("/tax/calculations", json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            error_response: NumeralTaxCalculationErrorResponse = e.response.json()
            error_code = error_response["error"].get("error_code")
            if error_code == "invalid_country_code":
                return TaxCalculation(
                    processor_id=None,
                    amount=0,
                    taxability_reason=TaxabilityReason.not_supported,
                    tax_rate=TaxRate(
                        rate_type="percentage",
                        basis_points=0,
                        amount=None,
                        amount_currency=None,
                        display_name="",
                        country=address.country,
                        state=address.get_unprefixed_state(),
                    ),
                )
            error_meta = error_response["error"].get("error_meta")
            if error_meta is not None and error_meta["field"].startswith(
                "customer.address"
            ):
                raise TaxCalculationError("Invalid address provided") from e
            raise

        calculation: NumeralTaxCalculationResponse = response.json()

        tax_jurisdiction = calculation["line_items"][0]["tax_jurisdictions"][0]
        tax_rate = from_numeral_tax_jurisdiction(
            tax_jurisdiction,
            country=address.country,
            state=address.get_unprefixed_state(),
            currency=currency,
        )

        note = tax_jurisdiction["note"].lower()
        taxability_reason = TaxabilityReason.from_numeral(note, customer_exempt)

        return TaxCalculation(
            processor_id=calculation["id"],
            amount=calculation["total_tax_amount"],
            taxability_reason=taxability_reason,
            tax_rate=tax_rate,
        )

    async def record(self, calculation_id: str, reference: str) -> str:
        response = await self.client.post(
            "/tax/transactions",
            json={
                "calculation_id": calculation_id,
                "reference_order_id": reference,
            },
        )
        response.raise_for_status()

        transaction: NumeralTaxTransactionResponse = response.json()
        return transaction["id"]

    async def revert(
        self,
        transaction_id: str,
        reference: str,
        total_amount: int | None = None,
        tax_amount: int | None = None,
    ) -> str:
        refund: NumeralTaxRefundResponse

        if total_amount is None and tax_amount is None:
            response = await self.client.post(
                "/tax/refunds",
                json={
                    "transaction_id": transaction_id,
                    "type": "full",
                },
            )
            response.raise_for_status()
            refund = response.json()
            return refund["id"]

        assert total_amount is not None
        assert tax_amount is not None

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
                        "sales_amount_refunded": -(total_amount - tax_amount),
                        "tax_amount_refunded": -tax_amount,
                    }
                ],
            },
        )
        response.raise_for_status()

        refund = response.json()
        return refund["id"]


numeral_tax_service = NumeralTaxService()
