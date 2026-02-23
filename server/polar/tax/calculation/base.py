import uuid
from enum import StrEnum
from typing import Literal, Protocol, TypedDict, overload

from polar.exceptions import PolarError
from polar.kit.address import Address

from ..tax_id import TaxID


class TaxError(PolarError): ...


class TaxCalculationError(TaxError): ...


class TaxCalculationTechnicalError(TaxCalculationError):
    def __init__(
        self,
        message: str = "A technical error occurred while calculating tax.",
    ) -> None:
        super().__init__(message)


class TaxCalculationLogicalError(TaxError):
    def __init__(
        self,
        message: str = "A logical error occurred while calculating tax.",
    ) -> None:
        super().__init__(message)


class InvalidTaxIDError(TaxCalculationLogicalError):
    def __init__(self) -> None:
        message = "The provided tax ID is invalid."
        super().__init__(message)


class TaxRecordError(TaxError):
    def __init__(self) -> None:
        message = "An error occurred while recording the tax calculation."
        super().__init__(message)


class CalculationExpiredError(TaxError):
    def __init__(self) -> None:
        message = "The tax calculation has expired and cannot be recorded."
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

    @classmethod
    def from_numeral(cls, note: str, customer_exempt: bool) -> "TaxabilityReason":
        if customer_exempt:
            return TaxabilityReason.customer_exempt
        elif "reverse charge" in note:
            return TaxabilityReason.reverse_charge
        elif "no_collection" in note:
            return TaxabilityReason.not_collecting

        return TaxabilityReason.standard_rated


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


class TaxServiceProtocol(Protocol):
    async def calculate(
        self,
        identifier: uuid.UUID | str,
        currency: str,
        amount: int,
        tax_code: TaxCode,
        address: Address,
        tax_ids: list[TaxID],
        customer_exempt: bool,
    ) -> TaxCalculation: ...

    async def record(self, calculation_id: str, reference: str) -> str: ...

    @overload
    async def revert(
        self, transaction_id: str, reference: str, total_amount: int, tax_amount: int
    ) -> str: ...

    @overload
    async def revert(self, transaction_id: str, reference: str) -> str: ...

    async def revert(
        self,
        transaction_id: str,
        reference: str,
        total_amount: int | None = None,
        tax_amount: int | None = None,
    ) -> str: ...
