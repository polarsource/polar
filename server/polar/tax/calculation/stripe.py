import hashlib
import uuid
from datetime import datetime
from typing import Literal

import stripe as stripe_lib
import structlog

from polar.config import settings
from polar.enums import TaxBehavior
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.address import Address
from polar.logging import Logger

from ..tax_id import TaxID, to_stripe_tax_id
from .base import (
    AlreadyRevertedError,
    TaxabilityReason,
    TaxBreakdownItem,
    TaxCalculation,
    TaxCalculationLogicalError,
    TaxCalculationTechnicalError,
    TaxCode,
    TaxRevertError,
    TaxServiceProtocol,
)

log: Logger = structlog.get_logger()


class StripeTaxCalculationLogicalError(TaxCalculationLogicalError):
    def __init__(
        self,
        stripe_error: stripe_lib.StripeError,
        message: str = "An error occurred while calculating tax.",
    ) -> None:
        self.stripe_error = stripe_error
        self.message = message
        super().__init__(message)


class IncompleteTaxLocation(StripeTaxCalculationLogicalError):
    def __init__(self, stripe_error: stripe_lib.InvalidRequestError) -> None:
        super().__init__(stripe_error, "Required tax location information is missing.")


class InvalidTaxLocation(StripeTaxCalculationLogicalError):
    def __init__(self, stripe_error: stripe_lib.StripeError) -> None:
        super().__init__(
            stripe_error,
            (
                "We could not determine the customer's tax location "
                "based on the provided customer address."
            ),
        )


def _get_stripe_tax_display_name(
    tax_rate_details: stripe_lib.tax.Calculation.TaxBreakdown.TaxRateDetails,
) -> str:
    tax_type = tax_rate_details.tax_type
    if tax_type is None:
        return "Tax"
    if tax_type in {"gst", "hst", "igst", "jct", "pst", "qct", "rst", "vat"}:
        return tax_type.upper()
    return tax_type.replace("_", " ").title()


def _from_stripe_breakdown_item(
    breakdown: stripe_lib.tax.Calculation.TaxBreakdown,
) -> TaxBreakdownItem | None:
    rate_details = breakdown.tax_rate_details
    if rate_details is None or rate_details.rate_type is None:
        return None

    rate_type: Literal["percentage", "fixed"] = (
        "fixed" if rate_details.rate_type == "flat_amount" else "percentage"
    )
    rate = None
    if rate_details.percentage_decimal is not None:
        rate = float(rate_details.percentage_decimal) / 100

    taxability_reason = TaxabilityReason.from_stripe(
        breakdown.taxability_reason, breakdown.amount
    )
    if taxability_reason is None:
        taxability_reason = TaxabilityReason.not_collecting

    return TaxBreakdownItem(
        rate_type=rate_type,
        rate=rate,
        display_name=_get_stripe_tax_display_name(rate_details),
        country=rate_details.country,
        state=rate_details.state,
        subdivision=None,  # Stripe bundles regional taxes (e.g. state + local) into a single tax rate, so we don't have subdivision-level detail
        amount=breakdown.amount,
        taxability_reason=taxability_reason,
    )


class StripeTaxService(TaxServiceProtocol):
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
        # Compute an idempotency key based on the input parameters to work as a sort of cache
        address_str = address.model_dump_json()
        tax_ids_str = ",".join(f"{tax_id[0]}:{tax_id[1]}" for tax_id in tax_ids)
        taxability_override: Literal["customer_exempt", "none"] = (
            "customer_exempt" if customer_exempt else "none"
        )
        idempotency_key_str = f"{identifier}:{currency}:{amount}:{tax_code}:{address_str}:{tax_ids_str}:{taxability_override}:{tax_behavior}"
        idempotency_key = hashlib.sha256(idempotency_key_str.encode()).hexdigest()

        try:
            calculation = await stripe_service.create_tax_calculation(
                currency=currency,
                line_items=[
                    {
                        "amount": amount,
                        "tax_behavior": tax_behavior.to_stripe(),
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
        except stripe_lib.RateLimitError as e:
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
                    "currency": currency,
                    "tax_behavior": tax_behavior,
                    "tax_breakdown": [],
                }
            raise TaxCalculationTechnicalError("Rate limit exceeded") from e
        except stripe_lib.InvalidRequestError as e:
            if (
                e.error is not None
                and e.error.param is not None
                and e.error.param.startswith("customer_details[address]")
            ):
                raise IncompleteTaxLocation(e) from e
            raise TaxCalculationTechnicalError(str(e)) from e
        except stripe_lib.StripeError as e:
            if e.error is None or e.error.code != "customer_tax_location_invalid":
                raise
            raise InvalidTaxLocation(e) from e
        else:
            assert calculation.id is not None
            total_amount = (
                calculation.tax_amount_exclusive + calculation.tax_amount_inclusive
            )
            tax_breakdown: list[TaxBreakdownItem] = []
            for breakdown_item in calculation.tax_breakdown:
                item = _from_stripe_breakdown_item(breakdown_item)
                if item is not None:
                    tax_breakdown.append(item)
            return {
                "processor_id": calculation.id,
                "amount": total_amount,
                "currency": currency,
                "tax_behavior": tax_behavior,
                "tax_breakdown": tax_breakdown,
            }

    async def record(self, calculation_id: str, reference: str) -> str:
        transaction = await stripe_service.create_tax_transaction(
            calculation_id, reference
        )
        return transaction.id

    async def revert(
        self,
        transaction_id: str,
        reference: str,
        reverted_amount: int | None = None,
        reverted_tax_amount: int | None = None,
    ) -> str:
        try:
            if reverted_amount is None and reverted_tax_amount is None:
                transaction = await stripe_service.revert_tax_transaction(
                    transaction_id, "full", reference
                )
            else:
                assert reverted_amount is not None
                transaction = await stripe_service.revert_tax_transaction(
                    transaction_id, "partial", reference, -reverted_amount
                )
        except stripe_lib.InvalidRequestError as e:
            error = e.error
            if error and error.message and "fully reversed" in error.message.lower():
                raise AlreadyRevertedError() from e
            log.error(
                "Failed to revert tax transaction",
                transaction_id=transaction_id,
                reference=reference,
                reverted_amount=reverted_amount,
                reverted_tax_amount=reverted_tax_amount,
                error=str(e),
            )
            raise TaxRevertError() from e
        return transaction.id

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
        raise NotImplementedError(
            "Backfilling tax calculations is not supported for StripeTaxService."
        )


stripe_tax_service = StripeTaxService()
