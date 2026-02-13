import uuid
from typing import overload

import structlog

from polar.config import settings
from polar.enums import TaxProcessor
from polar.kit.address import Address
from polar.logging import Logger
from polar.observability import TAX_CALCULATION_TOTAL

from ..tax_id import TaxID
from .base import (
    InvalidTaxIDError,
    TaxabilityReason,
    TaxCalculation,
    TaxCalculationLogicalError,
    TaxCalculationTechnicalError,
    TaxCode,
    TaxRate,
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


class TaxCalculationService:
    async def calculate(
        self,
        identifier: uuid.UUID | str,
        currency: str,
        amount: int,
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
        self, processor: TaxProcessor, calculation_id: str, reference: str
    ) -> str:
        tax_processor_service = _get_tax_service(processor)
        return await tax_processor_service.record(calculation_id, reference)

    @overload
    async def revert(
        self,
        processor: TaxProcessor,
        transaction_id: str,
        reference: str,
        total_amount: int,
        tax_amount: int,
    ) -> str: ...

    @overload
    async def revert(
        self, processor: TaxProcessor, transaction_id: str, reference: str
    ) -> str: ...

    async def revert(
        self,
        processor: TaxProcessor,
        transaction_id: str,
        reference: str,
        total_amount: int | None = None,
        tax_amount: int | None = None,
    ) -> str:
        tax_processor_service = _get_tax_service(processor)
        if total_amount is None or tax_amount is None:
            return await tax_processor_service.revert(transaction_id, reference)

        return await tax_processor_service.revert(
            transaction_id, reference, total_amount, tax_amount
        )


tax_calculation = TaxCalculationService()

__all__ = [
    "InvalidTaxIDError",
    "TaxCalculation",
    "TaxCalculationLogicalError",
    "TaxCalculationTechnicalError",
    "TaxCode",
    "TaxRate",
    "TaxabilityReason",
    "tax_calculation",
]
