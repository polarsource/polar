import pytest

from polar.enums import PaymentProcessor
from polar.models import Customer, Product
from polar.models.payment import PaymentStatus
from polar.payment.service import UnlinkedPaymentError
from polar.payment.service import payment as payment_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_order
from tests.fixtures.stripe import build_stripe_charge


@pytest.mark.asyncio
class TestUpsertFromStripeCharge:
    async def test_new_payment_with_checkout(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create a checkout
        checkout = await create_checkout(save_fixture, products=[product])

        # Create a charge with checkout_id in metadata
        charge = build_stripe_charge(
            amount=1000,
            status="succeeded",
            metadata={"checkout_id": str(checkout.id)},
            payment_method_details={"card": {"brand": "visa"}, "type": "card"},
            billing_details={"email": "test@example.com"},
            outcome={
                "risk_level": "normal",
                "risk_score": 10,
            },
        )

        # Test upsert_from_stripe_charge
        payment = await payment_service.upsert_from_stripe_charge(
            session, charge, checkout, None
        )

        # Verify payment was created correctly
        assert payment.processor == PaymentProcessor.stripe
        assert payment.processor_id == charge.id
        assert payment.status == PaymentStatus.succeeded
        assert payment.amount == 1000
        assert payment.currency == "usd"
        assert payment.method == "card"
        assert payment.method_metadata == {"brand": "visa"}
        assert payment.customer_email == "test@example.com"
        assert payment.checkout == checkout
        assert payment.organization == checkout.organization
        assert payment.risk_level == "normal"
        assert payment.risk_score == 10

    async def test_new_payment_with_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create an order
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id="INVOICE_ID",
        )

        # Create a charge with invoice
        charge = build_stripe_charge(
            amount=1000,
            status="succeeded",
            invoice="INVOICE_ID",
            payment_method_details={"card": {"brand": "visa"}, "type": "card"},
            billing_details={"email": "test@example.com"},
        )

        # Test upsert_from_stripe_charge
        payment = await payment_service.upsert_from_stripe_charge(
            session, charge, None, order
        )

        # Verify payment was created correctly
        assert payment.processor == PaymentProcessor.stripe
        assert payment.processor_id == charge.id
        assert payment.status == PaymentStatus.succeeded
        assert payment.amount == 1000
        assert payment.currency == "usd"
        assert payment.method == "card"
        assert payment.method_metadata == {"brand": "visa"}
        assert payment.customer_email == "test@example.com"
        assert payment.order == order
        assert payment.organization == order.organization

    async def test_new_payment_with_checkout_and_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create a checkout
        checkout = await create_checkout(
            save_fixture,
            products=[product],
        )

        # Create an order from the checkout
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            checkout=checkout,
        )

        # Create a charge with checkout_id in metadata
        charge = build_stripe_charge(
            amount=1000,
            status="succeeded",
            metadata={"checkout_id": str(checkout.id)},
            payment_method_details={"card": {"brand": "visa"}, "type": "card"},
            billing_details={"email": "test@example.com"},
        )

        # Test upsert_from_stripe_charge
        payment = await payment_service.upsert_from_stripe_charge(
            session, charge, checkout, order
        )

        # Verify payment was created correctly
        assert payment.processor == PaymentProcessor.stripe
        assert payment.processor_id == charge.id
        assert payment.status == PaymentStatus.succeeded
        assert payment.amount == 1000
        assert payment.currency == "usd"
        assert payment.method == "card"
        assert payment.method_metadata == {"brand": "visa"}
        assert payment.customer_email == "test@example.com"
        assert payment.checkout == checkout
        assert payment.order == order
        assert payment.organization == checkout.organization

    async def test_failed_payment(
        self, session: AsyncSession, save_fixture: SaveFixture, product: Product
    ) -> None:
        # Create a checkout
        checkout = await create_checkout(
            save_fixture,
            products=[product],
        )

        # Create a charge with checkout_id in metadata
        charge = build_stripe_charge(
            amount=1000,
            status="failed",
            metadata={"checkout_id": str(checkout.id)},
            payment_method_details={"card": {"brand": "visa"}, "type": "card"},
            billing_details={"email": "test@example.com"},
            outcome={
                "risk_level": "high",
                "risk_score": 90,
                "reason": "fraud",
                "seller_message": "This payment was declined due to suspected fraud",
            },
        )

        # Test upsert_from_stripe_charge
        payment = await payment_service.upsert_from_stripe_charge(
            session, charge, checkout, None
        )

        # Verify payment was created correctly
        assert payment.processor == PaymentProcessor.stripe
        assert payment.processor_id == charge.id
        assert payment.status == PaymentStatus.failed
        assert payment.amount == 1000
        assert payment.currency == "usd"
        assert payment.method == "card"
        assert payment.method_metadata == {"brand": "visa"}
        assert payment.customer_email == "test@example.com"
        assert payment.checkout == checkout
        assert payment.organization == checkout.organization
        assert payment.risk_level == "high"
        assert payment.risk_score == 90
        assert payment.decline_reason == "fraud"
        assert (
            payment.decline_message
            == "This payment was declined due to suspected fraud"
        )

    async def test_unlinked_payment_error(self, session: AsyncSession) -> None:
        # Create a charge without checkout_id or invoice
        charge = build_stripe_charge(
            amount=1000,
            status="succeeded",
            payment_method_details={"card": {"brand": "visa"}, "type": "card"},
            billing_details={"email": "test@example.com"},
        )

        # Test upsert_from_stripe_charge should raise UnlinkedPaymentError
        with pytest.raises(UnlinkedPaymentError) as excinfo:
            await payment_service.upsert_from_stripe_charge(session, charge, None, None)
