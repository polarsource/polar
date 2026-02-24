import pytest

from polar.enums import PaymentProcessor
from polar.models import Customer, Product
from polar.models.payment import PaymentStatus
from polar.models.wallet import WalletType
from polar.payment.service import UnlinkedPaymentError
from polar.payment.service import payment as payment_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_order, create_wallet
from tests.fixtures.stripe import build_stripe_charge, build_stripe_payment_intent


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
            session, charge, checkout, None, None
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
            session, charge, None, None, order
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
            session, charge, checkout, None, order
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

    async def test_new_payment_with_wallet(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        wallet = await create_wallet(
            save_fixture, type=WalletType.usage, customer=customer
        )

        # Create a charge with wallet_id in metadata
        charge = build_stripe_charge(
            amount=1000,
            status="succeeded",
            metadata={"wallet_id": str(wallet.id)},
            payment_method_details={"card": {"brand": "visa"}, "type": "card"},
            billing_details={"email": "test@example.com"},
            outcome={
                "risk_level": "normal",
                "risk_score": 10,
            },
        )

        # Test upsert_from_stripe_charge
        payment = await payment_service.upsert_from_stripe_charge(
            session, charge, None, wallet, None
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
        assert payment.wallet == wallet
        assert payment.organization == customer.organization
        assert payment.risk_level == "normal"
        assert payment.risk_score == 10

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
            session, charge, checkout, None, None
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
            await payment_service.upsert_from_stripe_charge(
                session, charge, None, None, None
            )


@pytest.mark.asyncio
class TestUpsertFromStripePaymentIntent:
    async def test_new_payment_with_checkout(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create a checkout
        checkout = await create_checkout(save_fixture, products=[product])

        # Create a payment intent with last_payment_error
        payment_intent = build_stripe_payment_intent(
            id="pi_test123",
            amount=1000,
            currency="usd",
            receipt_email="test@example.com",
            metadata={"checkout_id": str(checkout.id)},
            latest_charge=None,
            last_payment_error={
                "code": "card_declined",
                "message": "Your card was declined",
                "payment_method": {
                    "id": "pm_test123",
                    "type": "card",
                    "card": {"brand": "visa", "last4": "4242"},
                },
            },
        )

        # Test upsert_from_stripe_payment_intent
        payment = await payment_service.upsert_from_stripe_payment_intent(
            session, payment_intent, checkout, None
        )

        # Verify payment was created correctly
        assert payment.processor == PaymentProcessor.stripe
        assert payment.processor_id == "pi_test123"
        assert payment.status == PaymentStatus.failed
        assert payment.amount == 1000
        assert payment.currency == "usd"
        assert payment.method == "card"
        assert payment.method_metadata == {"brand": "visa", "last4": "4242"}
        assert payment.customer_email == "test@example.com"
        assert payment.checkout == checkout
        assert payment.organization == checkout.organization
        assert payment.decline_reason == "card_declined"
        assert payment.decline_message == "Your card was declined"

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
        )

        # Create a payment intent with last_payment_error
        payment_intent = build_stripe_payment_intent(
            id="pi_test123",
            amount=1000,
            currency="usd",
            receipt_email="test@example.com",
            metadata={"order_id": str(order.id)},
            latest_charge=None,
            last_payment_error={
                "code": "card_declined",
                "message": "Your card was declined",
                "payment_method": {
                    "id": "pm_test123",
                    "type": "card",
                    "card": {"brand": "visa", "last4": "4242"},
                },
            },
        )

        # Test upsert_from_stripe_payment_intent
        payment = await payment_service.upsert_from_stripe_payment_intent(
            session, payment_intent, None, order
        )

        # Verify payment was created correctly
        assert payment.processor == PaymentProcessor.stripe
        assert payment.processor_id == "pi_test123"
        assert payment.status == PaymentStatus.failed
        assert payment.amount == 1000
        assert payment.currency == "usd"
        assert payment.method == "card"
        assert payment.method_metadata == {"brand": "visa", "last4": "4242"}
        assert payment.customer_email == "test@example.com"
        assert payment.order == order
        assert payment.organization == order.organization
        assert payment.decline_reason == "card_declined"
        assert payment.decline_message == "Your card was declined"

    async def test_update_existing_payment(
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
        )

        # Create first payment intent with one error
        payment_intent_1 = build_stripe_payment_intent(
            id="pi_test123",
            amount=1000,
            currency="usd",
            receipt_email="test@example.com",
            metadata={"order_id": str(order.id)},
            latest_charge=None,
            last_payment_error={
                "code": "card_declined",
                "message": "Your card was declined",
                "payment_method": {
                    "id": "pm_test123",
                    "type": "card",
                    "card": {"brand": "visa", "last4": "4242"},
                },
            },
        )

        # First call - creates the payment
        payment_1 = await payment_service.upsert_from_stripe_payment_intent(
            session, payment_intent_1, None, order
        )
        await session.flush()

        # Verify initial payment
        assert payment_1.processor_id == "pi_test123"
        assert payment_1.decline_reason == "card_declined"
        assert payment_1.decline_message == "Your card was declined"
        payment_id = payment_1.id

        # Create second payment intent with different error (simulating retry)
        payment_intent_2 = build_stripe_payment_intent(
            id="pi_test123",  # Same payment intent ID
            amount=1000,
            currency="usd",
            receipt_email="test@example.com",
            metadata={"order_id": str(order.id)},
            latest_charge=None,
            last_payment_error={
                "code": "authentication_required",
                "message": "3D Secure authentication failed",
                "payment_method": {
                    "id": "pm_test456",
                    "type": "card",
                    "card": {"brand": "mastercard", "last4": "5555"},
                },
            },
        )

        # Second call - updates the existing payment
        payment_2 = await payment_service.upsert_from_stripe_payment_intent(
            session, payment_intent_2, None, order
        )
        await session.flush()

        # Verify it's the same payment object updated
        assert payment_2.id == payment_id
        assert payment_2.processor_id == "pi_test123"
        assert payment_2.decline_reason == "authentication_required"
        assert payment_2.decline_message == "3D Secure authentication failed"
        assert payment_2.method == "card"
        assert payment_2.method_metadata == {"brand": "mastercard", "last4": "5555"}

    async def test_no_error_code(
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
        )

        # Create a payment intent with last_payment_error
        payment_intent = build_stripe_payment_intent(
            id="pi_test123",
            amount=1000,
            currency="usd",
            receipt_email="test@example.com",
            metadata={"order_id": str(order.id)},
            latest_charge=None,
            last_payment_error={
                "message": "Generic error",
                "type": "invalid_request_error",
                "payment_method": {
                    "id": "pm_test123",
                    "type": "card",
                    "card": {"brand": "visa", "last4": "4242"},
                },
            },
        )

        # Test upsert_from_stripe_payment_intent
        payment = await payment_service.upsert_from_stripe_payment_intent(
            session, payment_intent, None, order
        )

        # Verify payment was created correctly
        assert payment.processor == PaymentProcessor.stripe
        assert payment.decline_reason is None
        assert payment.decline_message == "Generic error"
