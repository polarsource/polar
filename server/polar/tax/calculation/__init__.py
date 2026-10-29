import uuid
from datetime import datetime

import structlog

from polar.config import settings
from polar.enums import TaxBehavior, TaxBehaviorOption, TaxProcessor
from polar.kit.address import Address
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.observability import TAX_CALCULATION_TOTAL

from ..tax_id import TaxID
from .base import (
    AlreadyRevertedError,
    CalculationExpiredError,
    InvalidTaxIDError,
    TaxabilityReason,
    TaxBreakdownItem,
    TaxCalculation,
    TaxCalculationLogicalError,
    TaxCalculationTechnicalError,
    TaxCode,
    TaxRevertError,
    TaxServiceProtocol,
)
from .numeral import numeral_tax_service
from .stripe import stripe_tax_service

log: Logger = structlog.get_logger(__name__)


def _get_tax_service(processor: TaxProcessor) -> TaxServiceProtocol:
    match processor:
        case TaxProcessor.stripe:
            return stripe_tax_service
        case TaxProcessor.numeral:
            return numeral_tax_service


TAX_EXCLUSIVE_COUNTRIES = {
    "CA",
    "IN",
    "US",
}


def get_tax_behavior_from_option(
    tax_behavior: TaxBehaviorOption, address: Address
) -> TaxBehavior:
    """Resolve a tax behavior option for the customer's location.

    Args:
        tax_behavior: Inclusive, exclusive, or location-based tax behavior.
        address: Customer address used to resolve location-based behavior.

    Returns:
        Exclusive behavior for location-based sales in CA, IN, or US;
        inclusive behavior for other locations, or the explicitly chosen behavior.
    """
    match tax_behavior:
        case TaxBehaviorOption.inclusive:
            return TaxBehavior.inclusive
        case TaxBehaviorOption.exclusive:
            return TaxBehavior.exclusive
        case TaxBehaviorOption.location:
            return (
                TaxBehavior.exclusive
                if address.country in TAX_EXCLUSIVE_COUNTRIES
                else TaxBehavior.inclusive
            )


_BACKFILL_REFERENCE_PREFIX = "backfill_"


class TaxCalculationService:
    """Coordinate tax calculations, recording, and reversals across processors."""

    async def calculate(
        self,
        identifier: uuid.UUID | str,
        currency: str,
        amount: int,
        tax_behavior: TaxBehaviorOption,
        tax_code: TaxCode,
        address: Address,
        tax_ids: list[TaxID],
        customer_exempt: bool,
    ) -> tuple[TaxCalculation, TaxProcessor]:
        """Calculate tax using the configured processors in priority order.

        Technical failures fall back to the next processor. Logical errors,
        such as invalid customer tax details, propagate to the caller.

        Args:
            identifier: Unique identifier for this tax calculation.
            currency: Currency code for the calculation.
            amount: Sale amount in currency minor units. This method resolves
                whether tax is included or added according to tax_behavior
                and the customer address.
            tax_behavior: Inclusive, exclusive, or location-based tax behavior.
            tax_code: Tax category of the product or service.
            address: Customer address used to determine tax jurisdiction.
            tax_ids: Customer tax IDs used to determine tax treatment.
            customer_exempt: Whether the customer is tax exempt.

        Returns:
            The calculation and the processor that produced it.

        Raises:
            TaxCalculationTechnicalError: If all tax processors fail to calculate tax.
        """
        for processor in settings.tax_processors:
            log.debug("Attempting tax calculation with processor", processor=processor)
            tax_processor_service = _get_tax_service(processor)
            try:
                result = await tax_processor_service.calculate(
                    identifier=identifier,
                    currency=currency,
                    amount=amount,
                    tax_behavior=get_tax_behavior_from_option(tax_behavior, address),
                    tax_code=tax_code,
                    address=address,
                    tax_ids=tax_ids,
                    customer_exempt=customer_exempt,
                )
                TAX_CALCULATION_TOTAL.labels(
                    provider=processor.value, success="true"
                ).inc()
                return result, processor
            except TaxCalculationTechnicalError as e:
                log.warning(
                    "Tax calculation failed with technical error, trying next processor",
                    processor=processor,
                    error=str(e),
                )
                TAX_CALCULATION_TOTAL.labels(
                    provider=processor.value, success="false"
                ).inc()
                continue

        raise TaxCalculationTechnicalError("All tax processors failed to calculate tax")

    async def record(
        self,
        calculation_processor: TaxProcessor,
        processor_id: str,
        *,
        amount: int,
        tax_amount: int,
        currency: str,
        address: Address,
        tax_code: TaxCode,
        reference: str,
        transaction_date: datetime,
    ) -> tuple[str, TaxProcessor]:
        """Record a completed sale with the configured recording processor.

        Reuse the calculation when its processor matches the recording processor.
        Otherwise, record the explicit amounts without recalculating tax.

        Args:
            calculation_processor: Processor that produced the calculation.
            processor_id: Calculation ID returned by that processor.
            amount: Sale amount excluding tax, in currency minor units. Used
                when recording through a different processor.
            tax_amount: Tax amount in currency minor units. Used when recording
                through a different processor.
            currency: Currency code for the sale.
            address: Customer billing address.
            tax_code: Tax category of the product or service.
            reference: Internal reference identifying the sale.
            transaction_date: Original sale timestamp, used when recording
                explicit amounts through a different processor.

        Returns:
            The recorded transaction ID and its processor. Transactions recorded
            from explicit amounts have a ``backfill_``-prefixed ID.
        """
        record_processor = settings.tax_record_processor
        tax_processor_service = _get_tax_service(record_processor)
        if calculation_processor != record_processor:
            log.info(
                "Recording tax calculation with a different processor than the one used for calculation",
                calculation_processor=calculation_processor,
                record_processor=record_processor,
                calculation_id=processor_id,
            )
            return await self.record_amounts(
                amount=amount,
                tax_amount=tax_amount,
                currency=currency,
                address=address,
                tax_code=tax_code,
                reference=reference,
                transaction_date=transaction_date,
            )

        assert processor_id is not None
        return await tax_processor_service.record(
            processor_id, reference
        ), record_processor

    async def record_amounts(
        self,
        *,
        amount: int,
        tax_amount: int,
        currency: str,
        address: Address,
        tax_code: TaxCode,
        reference: str,
        transaction_date: datetime,
    ) -> tuple[str, TaxProcessor]:
        """Record explicit sale and tax amounts without recalculating tax.

        Args:
            amount: Sale amount excluding tax, in currency minor units.
            tax_amount: Tax amount in currency minor units.
            currency: Currency code for both amounts.
            address: Customer billing address.
            tax_code: Tax category of the product or service.
            reference: Internal reference identifying the sale.
            transaction_date: Original sale timestamp to preserve in the record.

        Returns:
            A ``backfill_``-prefixed record ID and the recording processor.
            Returning an ID does not verify completion of asynchronous processing.
        """
        record_processor = settings.tax_record_processor
        tax_processor_service = _get_tax_service(record_processor)
        backfill_reference = await tax_processor_service.backfill(
            amount,
            tax_amount,
            currency,
            address,
            tax_code,
            reference,
            transaction_date,
        )
        return (
            f"{_BACKFILL_REFERENCE_PREFIX}{backfill_reference}",
            record_processor,
        )

    async def revert(
        self,
        processor: TaxProcessor,
        transaction_id: str,
        reference: str,
        address: Address,
        tax_code: TaxCode,
        currency: str,
        total_amount: int,
        tax_amount: int,
        reverted_amount: int,
        reverted_tax_amount: int,
        previous_reverted_tax_amount: int = 0,
        previous_reverted_amount: int = 0,
    ) -> str | None:
        """Reverse a recorded tax transaction for a customer refund.

        Cumulative refunded tax determines the target reversal using the original
        tax-to-total ratio. Only the increase from the previous target is reversed.
        Refunding 10 tax on a 100 sale plus 20 tax reverses 60 in the processor's
        ledger; refunding the remaining 10 tax reverses the remaining 60.
        This includes synthetic sale reversals for backfilled transactions and
        does not change the amount refunded to the customer.

        Args:
            processor: Processor holding the original transaction.
            transaction_id: Recorded transaction ID, including any ``backfill_``
                prefix returned when recording explicit amounts.
            reference: Internal reference identifying the refund.
            address: Customer billing address, used for backfilled reversals.
            tax_code: Product or service tax category, used for backfilled
                reversals.
            currency: Currency code, used for backfilled reversals.
            total_amount: Original sale total including tax, in currency minor
                units.
            tax_amount: Original sale tax in currency minor units. Must be
                positive.
            reverted_amount: Total customer refund including tax, in currency
                minor units. Pass ``Refund.total_amount``, not ``Refund.amount``.
            reverted_tax_amount: Tax portion of the customer refund, in currency
                minor units. Pass ``Refund.tax_amount``.
            previous_reverted_tax_amount: Tax on other succeeded refunds with a
                recorded processor reversal, in currency minor units.
            previous_reverted_amount: Total including tax of those same refunds,
                in currency minor units. Reversals recorded before cumulative
                targets reversed exactly this amount, so the reversal is capped
                at what remains of ``total_amount`` after it.

        Returns:
            The processor's reversal ID, or a ``backfill_``-prefixed record ID
            for a negative manual entry. None if the cumulative target does not
            increase, including refunds with zero tax.
        """
        tax_processor_service = _get_tax_service(processor)

        previous_target = round(
            min(previous_reverted_tax_amount, tax_amount) * total_amount / tax_amount
        )
        cumulative_tax_amount = min(
            previous_reverted_tax_amount + reverted_tax_amount, tax_amount
        )
        target = round(cumulative_tax_amount * total_amount / tax_amount)
        reverted_amount = min(
            target - previous_target, total_amount - previous_reverted_amount
        )
        if reverted_amount <= 0:
            return None
        reverted_tax_amount = cumulative_tax_amount - previous_reverted_tax_amount

        if transaction_id.startswith(_BACKFILL_REFERENCE_PREFIX):
            backfill_reference = await tax_processor_service.backfill(
                -(reverted_amount - reverted_tax_amount),
                -reverted_tax_amount,
                currency,
                address,
                tax_code,
                reference,
                utc_now(),
            )
            return f"{_BACKFILL_REFERENCE_PREFIX}{backfill_reference}"

        if reverted_amount >= total_amount:
            return await tax_processor_service.revert(transaction_id, reference)

        return await tax_processor_service.revert(
            transaction_id, reference, reverted_amount, reverted_tax_amount
        )


tax_calculation = TaxCalculationService()

__all__ = [
    "AlreadyRevertedError",
    "CalculationExpiredError",
    "InvalidTaxIDError",
    "TaxBreakdownItem",
    "TaxCalculation",
    "TaxCalculationLogicalError",
    "TaxCalculationTechnicalError",
    "TaxCode",
    "TaxRevertError",
    "TaxabilityReason",
    "tax_calculation",
]
