"""
StripeSimulator — a fake Stripe that configures mocks and generates
matching webhook objects with internally consistent IDs.

Usage in E2E tests:

    stripe_sim.expect_payment(amount=2500, customer_name="Jane Doe")
    # ... confirm checkout via API ...
    await stripe_sim.send_charge_webhook(session, organization_id=org.id, checkout_id=cid)
"""

import uuid
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import stripe as stripe_lib

from polar.kit.db.postgres import AsyncSession
from polar.models.external_event import ExternalEventSource
from tests.fixtures.stripe import build_stripe_charge


def _e2e_id(prefix: str) -> str:
    return f"{prefix}_e2e_{uuid.uuid4().hex[:8]}"


@dataclass
class StripeSimulator:
    """
    Configures a mocked StripeService for a single payment flow and
    generates the corresponding Stripe webhook objects.

    Ensures IDs (customer, payment intent, charge) are consistent
    between the mock return values and the webhook charge object.
    """

    mock: MagicMock

    # Payment details (set by expect_payment / expect_setup)
    customer_id: str = field(default_factory=lambda: _e2e_id("cus"))
    payment_intent_id: str = field(default_factory=lambda: _e2e_id("pi"))
    customer_name: str = "Test Buyer"
    customer_email: str = "buyer@example.com"
    billing_address: dict[str, Any] = field(
        default_factory=lambda: {
            "country": "US",
            "city": "San Francisco",
            "postal_code": "94105",
            "line1": "123 Market St",
            "state": "CA",
        }
    )
    amount: int = 0
    currency: str = "usd"

    def _configure_customer(
        self,
        customer_name: str,
        customer_email: str,
        billing_address: dict[str, Any] | None,
    ) -> None:
        self.customer_name = customer_name
        self.customer_email = customer_email
        if billing_address is not None:
            self.billing_address = billing_address

        self.mock.get_confirmation_token.return_value = SimpleNamespace(
            payment_method_preview=SimpleNamespace(
                billing_details=SimpleNamespace(name=customer_name)
            ),
        )
        self.mock.create_customer.return_value = SimpleNamespace(
            id=self.customer_id,
        )

    def expect_payment(
        self,
        *,
        amount: int,
        currency: str = "usd",
        customer_name: str = "Test Buyer",
        customer_email: str = "buyer@example.com",
        billing_address: dict[str, Any] | None = None,
        intent_status: str = "succeeded",
    ) -> "StripeSimulator":
        """
        Configure the mock for a successful payment intent flow.

        Call this BEFORE the checkout confirm API call.
        """
        self.amount = amount
        self.currency = currency
        self._configure_customer(customer_name, customer_email, billing_address)

        self.mock.create_payment_intent.return_value = SimpleNamespace(
            id=self.payment_intent_id,
            client_secret=f"{self.payment_intent_id}_secret",
            status=intent_status,
            payment_method=None,
        )

        return self

    def expect_setup(
        self,
        *,
        customer_name: str = "Test Buyer",
        customer_email: str = "buyer@example.com",
        billing_address: dict[str, Any] | None = None,
        intent_status: str = "succeeded",
    ) -> "StripeSimulator":
        """
        Configure the mock for a setup intent flow (free/trial checkouts).

        Call this BEFORE the checkout confirm API call.
        """
        self.amount = 0
        self._configure_customer(customer_name, customer_email, billing_address)

        setup_intent_id = _e2e_id("seti")
        self.mock.create_setup_intent.return_value = SimpleNamespace(
            id=setup_intent_id,
            client_secret=f"{setup_intent_id}_secret",
            status=intent_status,
            payment_method=None,
        )

        return self

    def build_charge(
        self,
        *,
        organization_id: uuid.UUID,
        checkout_id: str,
        tax_amount: int = 0,
        tax_country: str = "US",
    ) -> stripe_lib.Charge:
        """
        Build a Stripe Charge object matching the configured payment.

        IDs are automatically consistent with what expect_payment() configured.
        Call this AFTER checkout confirm to generate the webhook payload.
        """
        charge = build_stripe_charge(
            amount=self.amount,
            currency=self.currency,
            customer=self.customer_id,
            payment_intent=self.payment_intent_id,
            metadata={
                "type": "product",
                "organization_id": str(organization_id),
                "checkout_id": checkout_id,
                "tax_amount": str(tax_amount),
                "tax_country": tax_country,
            },
            billing_details={
                "name": self.customer_name,
                "email": self.customer_email,
                "address": self.billing_address,
            },
            payment_method_details={
                "type": "card",
                "card": {
                    "brand": "visa",
                    "last4": "4242",
                    "exp_month": 12,
                    "exp_year": 2030,
                    "country": "US",
                },
            },
        )
        # Fields required by payment.handle_success
        charge["object"] = "charge"
        charge["payment_method"] = "pm_e2e_test"
        return charge

    async def send_charge_webhook(
        self,
        session: AsyncSession,
        *,
        organization_id: uuid.UUID,
        checkout_id: str,
        tax_amount: int = 0,
        tax_country: str = "US",
    ) -> None:
        """
        Build a charge and simulate the ``charge.succeeded`` webhook in one call.

        Convenience method combining ``build_charge`` + ``simulate_webhook``.
        """
        charge = self.build_charge(
            organization_id=organization_id,
            checkout_id=checkout_id,
            tax_amount=tax_amount,
            tax_country=tax_country,
        )
        await simulate_webhook(session, "charge.succeeded", charge)


async def simulate_webhook(
    session: AsyncSession,
    event_type: str,
    data: Any,
) -> None:
    """
    Simulate a Stripe webhook by storing an external event (as the real
    webhook endpoint does) and enqueuing the corresponding task.

    Args:
        session: Database session.
        event_type: Stripe event type (e.g. "charge.succeeded").
        data: The Stripe object (e.g. a stripe.Charge).
    """
    from polar.external_event.service import external_event as external_event_service

    task_name = f"stripe.webhook.{event_type}"
    event_id = f"evt_e2e_{uuid.uuid4().hex[:8]}"
    stripe_event_data = {
        "id": event_id,
        "object": "event",
        "type": event_type,
        "data": {"object": data},
    }

    await external_event_service.enqueue(
        session,
        ExternalEventSource.stripe,
        task_name,
        event_id,
        stripe_event_data,
    )
    await session.flush()
