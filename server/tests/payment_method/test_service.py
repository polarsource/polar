import pytest

from polar.enums import PaymentProcessor
from polar.models import Customer
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncSession
from tests.fixtures.stripe import build_stripe_payment_method


@pytest.mark.asyncio
class TestUpsertFromStripe:
    async def test_create_new_payment_method(
        self,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        # Build a stripe payment method
        stripe_payment_method = build_stripe_payment_method(
            type="card",
            details={"brand": "visa", "last4": "4242"},
        )

        # Test upsert_from_stripe
        payment_method = await payment_method_service.upsert_from_stripe(
            session, customer, stripe_payment_method
        )

        # Verify payment method was created correctly
        assert payment_method.processor == PaymentProcessor.stripe
        assert payment_method.processor_id == stripe_payment_method.id
        assert payment_method.type == "card"
        assert payment_method.method_metadata == {"brand": "visa", "last4": "4242"}
        assert payment_method.customer == customer

    async def test_update_existing_payment_method(
        self,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        # First create a payment method
        stripe_payment_method = build_stripe_payment_method(
            type="card",
            details={"brand": "visa", "last4": "4242"},
        )
        payment_method = await payment_method_service.upsert_from_stripe(
            session, customer, stripe_payment_method
        )

        # Now update it with new details
        updated_stripe_payment_method = build_stripe_payment_method(
            type="card",
            details={"brand": "mastercard", "last4": "9999"},
        )
        updated_payment_method = await payment_method_service.upsert_from_stripe(
            session, customer, updated_stripe_payment_method
        )

        # Verify it's the same payment method but with updated details
        assert updated_payment_method.id == payment_method.id
        assert updated_payment_method.processor == PaymentProcessor.stripe
        assert updated_payment_method.processor_id == updated_stripe_payment_method.id
        assert updated_payment_method.type == "card"
        assert updated_payment_method.method_metadata == {
            "brand": "mastercard",
            "last4": "9999",
        }
        assert updated_payment_method.customer == customer
