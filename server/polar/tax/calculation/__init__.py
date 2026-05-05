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
        """Calculate tax for the given parameters.

        Tries to calculate tax using the configured tax processors in order. If a
        processor fails with a technical error, it will try the next one until all
        processors have been tried.

        Args:
            identifier: Unique identifier for this tax calculation.
            currency: The currency code.
            amount: The amount in cents to calculate tax on.
            tax_behavior: The tax behavior option to determine if tax is inclusive, exclusive or location-based.
            tax_code: The tax code for the product/service.
            address: The address for tax calculation.
            tax_ids: List of tax IDs for the customer.
            customer_exempt: Whether the customer is tax exempt.

        Returns:
            The calculated tax information.

        Raises:
            TaxCalculationTechnicalError: If all tax processors fail to calculate tax.
        """
        for processor in settings.TAX_PROCESSORS:
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
        tax_processor_service = _get_tax_service(settings.TAX_RECORD_PROCESSOR)
        if calculation_processor != settings.TAX_RECORD_PROCESSOR:
            log.info(
                "Recording tax calculation with a different processor than the one used for calculation",
                calculation_processor=calculation_processor,
                record_processor=settings.TAX_RECORD_PROCESSOR,
                calculation_id=processor_id,
            )
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
                settings.TAX_RECORD_PROCESSOR,
            )

        assert processor_id is not None
        return await tax_processor_service.record(
            processor_id, reference
        ), settings.TAX_RECORD_PROCESSOR

    async def revert(
        self,
        processor: TaxProcessor,
        transaction_id: str,
        reference: str,
        address: Address,
        tax_code: TaxCode,
        currency: str,
        total_amount: int,
        reverted_amount: int,
        reverted_tax_amount: int,
    ) -> str:
        tax_processor_service = _get_tax_service(processor)

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
