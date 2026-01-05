from enum import StrEnum
from typing import Literal, TypedDict

from polar.exceptions import PolarError


class TaxCalculationError(PolarError):
    def __init__(
        self,
        message: str = "An error occurred while calculating tax.",
    ) -> None:
        super().__init__(message)


class TaxCode(StrEnum):
    general_electronically_supplied_services = (
        "general_electronically_supplied_services"
    )

    def to_stripe(self) -> str:
        match self:
            case TaxCode.general_electronically_supplied_services:
                return "txcd_10000000"

    def to_numeral(self) -> str:
        match self:
            case TaxCode.general_electronically_supplied_services:
                return "SAAS_GENERAL"


class TaxabilityReason(StrEnum):
    standard_rated = "standard_rated"
    """Purchases that are subject to the standard rate of tax."""

    not_collecting = "not_collecting"
    """Purchases for countries where we don't collect tax."""

    product_exempt = "product_exempt"
    """Purchases for products that are exempt from tax."""

    reverse_charge = "reverse_charge"
    """Purchases where the customer is responsible for paying tax, e.g. B2B transactions with provided tax ID."""

    not_subject_to_tax = "not_subject_to_tax"
    """Purchases where the customer provided a tax ID, but on countries where we don't collect tax."""

    not_supported = "not_supported"
    """Purchases from countries where we don't support tax."""

    customer_exempt = "customer_exempt"
    """Purchases where the customer is exempt from tax, e.g. if the subscription was created before our tax registration."""

    @classmethod
    def from_stripe(
        cls, stripe_reason: str | None, tax_amount: int
    ) -> "TaxabilityReason | None":
        if stripe_reason is None or stripe_reason == "not_available":
            # Stripe sometimes returns `None` or `not_available` even if taxes are collected.
            if tax_amount != 0:
                return TaxabilityReason.standard_rated
            return None

        return cls(stripe_reason)


class TaxRate(TypedDict):
    rate_type: Literal["percentage"] | Literal["fixed"]
    basis_points: int | None
    amount: int | None
    amount_currency: str | None
    display_name: str
    country: str | None
    state: str | None


class TaxCalculation(TypedDict):
    processor_id: str | None
    amount: int
    taxability_reason: TaxabilityReason | None
    tax_rate: TaxRate | None
