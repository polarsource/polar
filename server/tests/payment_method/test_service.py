from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import PaymentProcessor
from polar.integrations.stripe.service import StripeService
from polar.models import Customer, PaymentMethod, Product
from polar.models.subscription import SubscriptionStatus
from polar.payment_method.service import (
    PaymentMethodInUseByActiveSubscription,
)
from polar.payment_method.service import (
    payment_method as payment_method_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_subscription,
)
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


@pytest.mark.asyncio
class TestDelete:
    @pytest.fixture(autouse=True)
    def stripe_service_mock(self, mocker: MockerFixture) -> MagicMock:
        mock = MagicMock(spec=StripeService)
        mocker.patch("polar.payment_method.service.stripe_service", new=mock)
        return mock

    async def test_delete_payment_method_with_no_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_123",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method)

        await payment_method_service.delete(session, payment_method)

        await session.flush()
        await session.refresh(payment_method)
        assert payment_method.deleted_at is not None

    @pytest.mark.parametrize(
        "status",
        [
            SubscriptionStatus.trialing,
            SubscriptionStatus.active,
            SubscriptionStatus.past_due,
        ],
    )
    async def test_delete_payment_method_with_billable_subscription_raises_exception(
        self,
        status: SubscriptionStatus,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_456",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method)

        subscription = await create_subscription(
            save_fixture,
            status=status,
            product=product,
            customer=customer,
        )
        subscription.payment_method = payment_method
        await save_fixture(subscription)

        with pytest.raises(PaymentMethodInUseByActiveSubscription) as exc_info:
            await payment_method_service.delete(session, payment_method)

        assert subscription.id in exc_info.value.subscription_ids
        assert "Cannot delete payment method" in str(exc_info.value)

        await session.refresh(payment_method)
        assert payment_method.deleted_at is None

    async def test_delete_payment_method_with_canceled_subscription_succeeds(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_789",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method)

        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )
        subscription.payment_method = payment_method
        await save_fixture(subscription)

        await payment_method_service.delete(session, payment_method)

        await session.flush()
        await session.refresh(payment_method)
        assert payment_method.deleted_at is not None

    async def test_delete_payment_method_with_active_subscription_and_alternative_succeeds(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method_1 = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_primary",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method_1)

        payment_method_2 = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_alternative",
            type="card",
            method_metadata={"brand": "mastercard", "last4": "9999"},
            customer=customer,
        )
        await save_fixture(payment_method_2)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.payment_method = payment_method_1
        await save_fixture(subscription)

        await payment_method_service.delete(session, payment_method_1)

        # Payment method should be soft deleted
        await session.flush()
        await session.refresh(payment_method_1)
        assert payment_method_1.deleted_at is not None

        # Subscription should be reassigned to the alternative payment method
        await session.refresh(subscription)
        assert subscription.payment_method_id == payment_method_2.id

    async def test_delete_payment_method_prefers_default_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method_1 = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_primary",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method_1)

        payment_method_2 = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_alternative1",
            type="card",
            method_metadata={"brand": "mastercard", "last4": "9999"},
            customer=customer,
        )
        await save_fixture(payment_method_2)

        payment_method_default = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_default",
            type="card",
            method_metadata={"brand": "amex", "last4": "1234"},
            customer=customer,
        )
        await save_fixture(payment_method_default)

        customer.default_payment_method = payment_method_default
        await save_fixture(customer)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.payment_method = payment_method_1
        await save_fixture(subscription)

        await payment_method_service.delete(session, payment_method_1)

        await session.flush()
        await session.refresh(payment_method_1)
        assert payment_method_1.deleted_at is not None

        # Subscription should be reassigned to the default payment method
        await session.refresh(subscription)
        assert subscription.payment_method_id == payment_method_default.id
