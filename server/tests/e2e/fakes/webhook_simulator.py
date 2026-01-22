"""
Webhook simulator for billing E2E tests.

Simulates Stripe webhooks by creating ExternalEvent records and
enqueuing the corresponding task handlers, enabling true E2E testing
of webhook-driven flows.
"""

import uuid
from typing import Any

import stripe as stripe_lib

from polar.kit.db.postgres import AsyncSession
from polar.models import ExternalEvent
from polar.models.external_event import ExternalEventSource
from polar.worker import enqueue_job

from .stripe_fake import StripeStatefulFake


class WebhookSimulator:
    """
    Simulator for Stripe webhooks in E2E tests.

    Instead of making actual HTTP requests to the webhook endpoint,
    this creates ExternalEvent records directly and enqueues the
    corresponding task handlers.

    Usage:
        simulator = WebhookSimulator(session, stripe_fake)

        # Simulate a successful charge
        await simulator.simulate_charge_succeeded(charge_id)

        # Then run tasks via TaskExecutor
        await task_executor.run_pending()
    """

    def __init__(
        self,
        session: AsyncSession,
        stripe_fake: StripeStatefulFake,
    ) -> None:
        self._session = session
        self._stripe_fake = stripe_fake
        self._event_counter = 0

    def _next_event_id(self) -> str:
        """Generate a unique Stripe event ID."""
        self._event_counter += 1
        return f"evt_test_{self._event_counter:08d}"

    async def _create_and_enqueue_event(
        self,
        event_type: str,
        task_name: str,
        data_object: dict[str, Any],
    ) -> ExternalEvent:
        """
        Create an ExternalEvent and enqueue the corresponding task.

        This mirrors what the Stripe webhook endpoint does:
        1. Creates an ExternalEvent record
        2. Enqueues the task handler
        """
        event_id = self._next_event_id()

        # Build Stripe event structure
        stripe_event_data = {
            "id": event_id,
            "object": "event",
            "type": event_type,
            "data": {
                "object": data_object,
            },
            "created": 1234567890,
            "livemode": False,
            "api_version": "2024-04-10",
        }

        # Create the external event record
        event = ExternalEvent(
            source=ExternalEventSource.stripe,
            task_name=task_name,
            external_id=event_id,
            data=stripe_event_data,
        )
        self._session.add(event)
        await self._session.flush()

        # Enqueue the task (will be picked up by test worker)
        enqueue_job(task_name, event.id)

        return event

    async def simulate_charge_succeeded(
        self,
        charge_id: str,
    ) -> ExternalEvent:
        """
        Simulate a Stripe charge.succeeded webhook.

        This creates an ExternalEvent and enqueues the
        stripe.webhook.charge.succeeded task.

        Args:
            charge_id: The ID of the charge in the stripe_fake

        Returns:
            The created ExternalEvent
        """
        if charge_id not in self._stripe_fake.charges:
            raise ValueError(f"Charge {charge_id} not found in stripe_fake")

        charge = self._stripe_fake.charges[charge_id]

        # Convert Stripe object to dict with proper structure
        charge_dict = self._stripe_object_to_dict(charge)

        return await self._create_and_enqueue_event(
            event_type="charge.succeeded",
            task_name="stripe.webhook.charge.succeeded",
            data_object=charge_dict,
        )

    def _stripe_object_to_dict(self, obj: Any) -> dict[str, Any]:
        """
        Convert a Stripe object to a dict preserving nested objects.

        Stripe objects have an 'object' attribute that indicates their type.
        We need to preserve this when converting to dict.
        """
        if hasattr(obj, "to_dict"):
            return obj.to_dict()
        elif hasattr(obj, "_values"):
            # Stripe StripeObject uses _values internally
            result = dict(obj._values) if hasattr(obj, "_values") else {}
            # Ensure 'object' field is set
            if hasattr(obj, "OBJECT_NAME"):
                result["object"] = obj.OBJECT_NAME
            return result
        elif isinstance(obj, dict):
            return obj
        else:
            # Convert using dict()
            result = dict(obj)
            if hasattr(obj, "OBJECT_NAME"):
                result["object"] = obj.OBJECT_NAME
            return result

    async def simulate_payment_and_charge_succeeded(
        self,
        payment_intent_id: str,
    ) -> ExternalEvent:
        """
        Create a charge for a payment intent and simulate charge.succeeded webhook.

        This is a convenience method that:
        1. Creates a successful charge for the payment intent
        2. Simulates the charge.succeeded webhook

        Args:
            payment_intent_id: The ID of the payment intent in the stripe_fake

        Returns:
            The created ExternalEvent
        """
        # Create the charge
        charge = self._stripe_fake.create_charge_for_payment_intent(
            payment_intent_id, status="succeeded"
        )

        # Simulate the webhook
        return await self.simulate_charge_succeeded(charge.id)

    async def simulate_charge_failed(
        self,
        charge_id: str,
    ) -> ExternalEvent:
        """
        Simulate a Stripe charge.failed webhook.

        Args:
            charge_id: The ID of the charge in the stripe_fake

        Returns:
            The created ExternalEvent
        """
        if charge_id not in self._stripe_fake.charges:
            raise ValueError(f"Charge {charge_id} not found in stripe_fake")

        charge = self._stripe_fake.charges[charge_id]
        charge_dict = dict(charge)

        return await self._create_and_enqueue_event(
            event_type="charge.failed",
            task_name="stripe.webhook.charge.failed",
            data_object=charge_dict,
        )

    async def simulate_payment_intent_succeeded(
        self,
        payment_intent_id: str,
    ) -> ExternalEvent:
        """
        Simulate a Stripe payment_intent.succeeded webhook.

        Args:
            payment_intent_id: The ID of the payment intent in the stripe_fake

        Returns:
            The created ExternalEvent
        """
        if payment_intent_id not in self._stripe_fake.payment_intents:
            raise ValueError(
                f"PaymentIntent {payment_intent_id} not found in stripe_fake"
            )

        pi = self._stripe_fake.payment_intents[payment_intent_id]
        pi_dict = dict(pi)

        return await self._create_and_enqueue_event(
            event_type="payment_intent.succeeded",
            task_name="stripe.webhook.payment_intent.succeeded",
            data_object=pi_dict,
        )

    async def simulate_setup_intent_succeeded(
        self,
        setup_intent_id: str,
        customer_id: str | None = None,
        payment_method_id: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> ExternalEvent:
        """
        Simulate a Stripe setup_intent.succeeded webhook.

        Since setup intents may not be stored in the fake,
        we construct the data directly.

        Args:
            setup_intent_id: The ID of the setup intent
            customer_id: Optional customer ID
            payment_method_id: Optional payment method ID
            metadata: Optional metadata dict

        Returns:
            The created ExternalEvent
        """
        setup_intent_data = {
            "id": setup_intent_id,
            "object": "setup_intent",
            "status": "succeeded",
            "customer": customer_id,
            "payment_method": payment_method_id,
            "metadata": metadata or {},
        }

        return await self._create_and_enqueue_event(
            event_type="setup_intent.succeeded",
            task_name="stripe.webhook.setup_intent.succeeded",
            data_object=setup_intent_data,
        )

    async def simulate_refund_created(
        self,
        refund_id: str,
    ) -> ExternalEvent:
        """
        Simulate a Stripe refund.created webhook.

        Args:
            refund_id: The ID of the refund in the stripe_fake

        Returns:
            The created ExternalEvent
        """
        if refund_id not in self._stripe_fake.refunds:
            raise ValueError(f"Refund {refund_id} not found in stripe_fake")

        refund = self._stripe_fake.refunds[refund_id]
        refund_dict = dict(refund)

        return await self._create_and_enqueue_event(
            event_type="refund.created",
            task_name="stripe.webhook.refund.created",
            data_object=refund_dict,
        )

    async def simulate_custom_event(
        self,
        event_type: str,
        task_name: str,
        data_object: dict[str, Any],
    ) -> ExternalEvent:
        """
        Simulate a custom Stripe webhook event.

        Use this for event types not covered by the specific methods.

        Args:
            event_type: The Stripe event type (e.g., "customer.updated")
            task_name: The task name to enqueue (e.g., "stripe.webhook.customer.updated")
            data_object: The event data object

        Returns:
            The created ExternalEvent
        """
        return await self._create_and_enqueue_event(
            event_type=event_type,
            task_name=task_name,
            data_object=data_object,
        )
