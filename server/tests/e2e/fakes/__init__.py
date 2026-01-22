"""
Stateful fakes for external dependencies in E2E tests.

These fakes maintain state to simulate realistic behavior and enable
assertions on what operations were performed during tests.
"""

from tests.e2e.fakes.stripe_fake import StripeStatefulFake
from tests.e2e.fakes.tax_fake import TaxStatefulFake

__all__ = ["StripeStatefulFake", "TaxStatefulFake"]
