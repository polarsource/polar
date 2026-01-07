from polar.enums import TaxProcessor

from .base import (
    InvalidTaxIDError,
    TaxabilityReason,
    TaxCalculation,
    TaxCalculationError,
    TaxCode,
    TaxRate,
    TaxServiceProtocol,
)
from .numeral import numeral_tax_service
from .stripe import stripe_tax_service


def get_tax_service(processor: TaxProcessor) -> TaxServiceProtocol:
    match processor:
        case TaxProcessor.stripe:
            return stripe_tax_service
        case TaxProcessor.numeral:
            return numeral_tax_service


__all__ = [
    "InvalidTaxIDError",
    "TaxCalculation",
    "TaxCalculationError",
    "TaxCode",
    "TaxRate",
    "TaxabilityReason",
    "get_tax_service",
]
