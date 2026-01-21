"""
Stateful Tax fake for E2E billing tests.

This fake provides deterministic tax calculations for testing,
tracking all calculations performed for verification.
"""

from dataclasses import dataclass, field
from typing import Any

from polar.kit.money import polar_round
from polar.tax.calculation import TaxabilityReason, TaxCalculation


@dataclass
class TaxCalculationRecord:
    """Record of a tax calculation for verification."""

    amount: int
    currency: str
    customer_id: str | None
    tax_amount: int
    processor_id: str


@dataclass
class TaxStatefulFake:
    """
    Stateful Tax fake that provides deterministic tax calculations.

    By default, calculates 10% tax on all amounts. Can be configured
    to use different rates or return specific results.

    Usage:
        fake = TaxStatefulFake(tax_rate=0.20)  # 20% tax
        # Or configure exempt status
        fake.set_customer_exempt("cus_123")
    """

    # Default tax rate (as decimal, e.g., 0.10 = 10%)
    tax_rate: float = 0.10

    # Storage for calculations
    calculations: list[TaxCalculationRecord] = field(default_factory=list)

    # Customers exempt from tax
    exempt_customers: set[str] = field(default_factory=set)

    # ID counter
    _id_counter: int = 0

    def _next_id(self) -> str:
        """Generate a unique tax processor ID."""
        self._id_counter += 1
        return f"tax_calc_{self._id_counter:08d}"

    def reset(self) -> None:
        """Reset all state."""
        self.calculations.clear()
        self.exempt_customers.clear()
        self._id_counter = 0

    def set_customer_exempt(self, customer_id: str) -> None:
        """Mark a customer as tax exempt."""
        self.exempt_customers.add(customer_id)

    def clear_customer_exempt(self, customer_id: str) -> None:
        """Remove tax exempt status from a customer."""
        self.exempt_customers.discard(customer_id)

    async def calculate(
        self,
        *,
        amount: int,
        currency: str,
        customer_id: str | None = None,
        product_id: str | None = None,
        **kwargs: Any,
    ) -> TaxCalculation:
        """
        Calculate tax for an amount.

        Returns a TaxCalculation dict matching the expected interface.
        """
        processor_id = self._next_id()

        # Check if customer is exempt
        is_exempt = customer_id in self.exempt_customers if customer_id else False

        if is_exempt:
            tax_amount = 0
            taxability_reason = TaxabilityReason.customer_exempt
        else:
            tax_amount = polar_round(amount * self.tax_rate)
            taxability_reason = TaxabilityReason.standard_rated

        # Record the calculation
        self.calculations.append(
            TaxCalculationRecord(
                amount=amount,
                currency=currency,
                customer_id=customer_id,
                tax_amount=tax_amount,
                processor_id=processor_id,
            )
        )

        return {
            "processor_id": processor_id,
            "amount": tax_amount,
            "taxability_reason": taxability_reason,
            "tax_rate": None,
        }

    async def record(
        self, calculation_id: str, reference: str
    ) -> str:
        """Record a tax transaction. Returns the transaction ID."""
        return f"tax_txn_{reference}"

    async def revert(
        self,
        transaction_id: str,
        amount: int | None = None,
    ) -> str:
        """Revert a tax transaction. Returns the reversal ID."""
        return f"tax_rev_{transaction_id}"

    # -------------------------------------------------------------------------
    # Verification helpers
    # -------------------------------------------------------------------------

    def get_total_tax_calculated(self) -> int:
        """Get the total tax amount across all calculations."""
        return sum(calc.tax_amount for calc in self.calculations)

    def assert_calculated(self, times: int | None = None) -> None:
        """Assert tax was calculated, optionally a specific number of times."""
        if times is not None:
            assert len(self.calculations) == times, (
                f"Expected {times} tax calculations, got {len(self.calculations)}"
            )
        else:
            assert len(self.calculations) > 0, "No tax calculations were performed"

    def assert_tax_for_amount(self, amount: int, expected_tax: int | None = None) -> None:
        """Assert a tax calculation was performed for a specific amount."""
        matching = [c for c in self.calculations if c.amount == amount]
        assert len(matching) > 0, f"No tax calculation found for amount {amount}"
        if expected_tax is not None:
            actual = matching[-1].tax_amount
            assert actual == expected_tax, (
                f"Expected tax {expected_tax} for amount {amount}, got {actual}"
            )
