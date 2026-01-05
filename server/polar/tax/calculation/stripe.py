import hashlib
import uuid
from typing import Literal

import stripe as stripe_lib
import structlog

from polar.config import settings
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.address import Address
from polar.logging import Logger

from ..tax_id import TaxID, to_stripe_tax_id
from .base import (
    TaxabilityReason,
    TaxCalculation,
    TaxCalculationError,
    TaxCode,
    TaxRate,
)

log: Logger = structlog.get_logger()


class StripeTaxCalculationError(TaxCalculationError):
    def __init__(
        self,
        stripe_error: stripe_lib.StripeError,
        message: str = "An error occurred while calculating tax.",
    ) -> None:
        self.stripe_error = stripe_error
        self.message = message
        super().__init__(message)


class IncompleteTaxLocation(StripeTaxCalculationError):
    def __init__(self, stripe_error: stripe_lib.InvalidRequestError) -> None:
        super().__init__(stripe_error, "Required tax location information is missing.")


class InvalidTaxLocation(StripeTaxCalculationError):
    def __init__(self, stripe_error: stripe_lib.StripeError) -> None:
        super().__init__(
            stripe_error,
            (
                "We could not determine the customer's tax location "
                "based on the provided customer address."
            ),
        )


def from_stripe_tax_rate(tax_rate: stripe_lib.TaxRate) -> TaxRate | None:
    rate_type = tax_rate.rate_type
    if rate_type is None:
        return None

    return {
        "rate_type": "fixed" if rate_type == "flat_amount" else "percentage",
        "basis_points": int(tax_rate.percentage * 100)
        if tax_rate.percentage is not None
        else None,
        "amount": tax_rate.flat_amount.amount if tax_rate.flat_amount else None,
        "amount_currency": tax_rate.flat_amount.currency
        if tax_rate.flat_amount
        else None,
        "display_name": tax_rate.display_name,
        "country": tax_rate.country,
        "state": tax_rate.state,
    }


def from_stripe_tax_rate_details(
    tax_rate_details: stripe_lib.tax.Calculation.TaxBreakdown.TaxRateDetails,
) -> TaxRate | None:
    rate_type = tax_rate_details.rate_type
    if rate_type is None:
        return None

    basis_points = None
    amount = None
    amount_currency = None

    if tax_rate_details.percentage_decimal is not None:
        basis_points = int(float(tax_rate_details.percentage_decimal) * 100)
    elif tax_rate_details.flat_amount is not None:
        amount = tax_rate_details.flat_amount.amount
        amount_currency = tax_rate_details.flat_amount.currency

    tax_type = tax_rate_details.tax_type
    display_name = "Tax"
    if tax_type is not None:
        if tax_type in {"gst", "hst", "igst", "jct", "pst", "qct", "rst", "vat"}:
            display_name = tax_type.upper()
        else:
            display_name = tax_type.replace("_", " ").title()

    return {
        "rate_type": "fixed" if rate_type == "flat_amount" else "percentage",
        "basis_points": basis_points,
        "amount": amount,
        "amount_currency": amount_currency,
        "display_name": display_name,
        "country": tax_rate_details.country,
        "state": tax_rate_details.state,
    }


async def calculate_tax(
    identifier: uuid.UUID | str,
    currency: str,
    amount: int,
    tax_code: TaxCode,
    address: Address,
    tax_ids: list[TaxID],
    customer_exempt: bool,
) -> TaxCalculation:
    # Compute an idempotency key based on the input parameters to work as a sort of cache
    address_str = address.model_dump_json()
    tax_ids_str = ",".join(f"{tax_id[0]}:{tax_id[1]}" for tax_id in tax_ids)
    taxability_override: Literal["customer_exempt", "none"] = (
        "customer_exempt" if customer_exempt else "none"
    )
    idempotency_key_str = f"{identifier}:{currency}:{amount}:{tax_code}:{address_str}:{tax_ids_str}:{taxability_override}"
    idempotency_key = hashlib.sha256(idempotency_key_str.encode()).hexdigest()

    try:
        calculation = await stripe_service.create_tax_calculation(
            currency=currency,
            line_items=[
                {
                    "amount": amount,
                    "tax_code": tax_code.to_stripe(),
                    "quantity": 1,
                    "reference": str(identifier),
                }
            ],
            customer_details={
                "address": address.to_dict(),
                "address_source": "billing",
                "tax_ids": [to_stripe_tax_id(tax_id) for tax_id in tax_ids],
                "taxability_override": taxability_override,
            },
            idempotency_key=idempotency_key,
        )
    except stripe_lib.RateLimitError:
        if settings.is_sandbox():
            log.warning(
                "Stripe Tax API rate limit exceeded in sandbox mode, returning zero tax",
                identifier=str(identifier),
                currency=currency,
                amount=amount,
            )
            return {
                "processor_id": f"taxcalc_sandbox_{uuid.uuid4().hex}",
                "amount": 0,
                "taxability_reason": None,
                "tax_rate": None,
            }
        raise
    except stripe_lib.InvalidRequestError as e:
        if (
            e.error is not None
            and e.error.param is not None
            and e.error.param.startswith("customer_details[address]")
        ):
            raise IncompleteTaxLocation(e) from e
        raise
    except stripe_lib.StripeError as e:
        if e.error is None or e.error.code != "customer_tax_location_invalid":
            raise
        raise InvalidTaxLocation(e) from e
    else:
        assert calculation.id is not None
        amount = calculation.tax_amount_exclusive
        breakdown = calculation.tax_breakdown[0]
        return {
            "processor_id": calculation.id,
            "amount": amount,
            "taxability_reason": TaxabilityReason.from_stripe(
                breakdown.taxability_reason, amount
            ),
            "tax_rate": from_stripe_tax_rate_details(breakdown.tax_rate_details),
        }
