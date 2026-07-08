import uuid
from unittest.mock import AsyncMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy.orm import selectinload

from polar.enums import PaymentProcessor, SubscriptionRecurringInterval
from polar.integrations.stripe.tasks import payment_intent_succeeded
from polar.models import (
    Customer,
    Organization,
    PaymentMethod,
)
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_order,
    create_product,
)


def build_stripe_payment_intent(
    *,
    payment_method_id: str = "pm_test",
    customer_id: str = "cus_test",
    order_id: str | None = None,
    amount: int = 1000,
    status: str = "succeeded",
) -> stripe_lib.PaymentIntent:
    metadata = {}
    if order_id:
        metadata["order_id"] = order_id

    return stripe_lib.PaymentIntent.construct_from(
        {
            "id": "pi_test",
            "object": "payment_intent",
            "amount": amount,
            "amount_received": amount,
            "currency": "usd",
            "status": status,
            "payment_method": payment_method_id,
            "customer": customer_id,
            "metadata": metadata,
            "invoice": None,
            "latest_charge": "ch_test",
            "receipt_email": None,
        },
        stripe_lib.api_key,
    )


@pytest.mark.asyncio
class TestPaymentIntentSucceeded:
    async def test_retry_payment_saves_payment_method_and_updates_subscription(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with existing payment method
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )

        old_payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_old",
            type="card",
            customer=customer,
        )
        await save_fixture(old_payment_method)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.payment_method = old_payment_method
        await save_fixture(subscription)

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
        )

        payment_intent = build_stripe_payment_intent(
            payment_method_id="pm_new",
            customer_id=customer.stripe_customer_id,  # type: ignore
            order_id=str(order.id),
        )

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = payment_intent

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        # Mock Stripe API calls
        mocker.patch(
            "polar.integrations.stripe.tasks.payment.resolve_order", return_value=order
        )

        stripe_payment_method = stripe_lib.PaymentMethod.construct_from(
            {
                "id": "pm_new",
                "object": "payment_method",
                "type": "card",
                "customer": customer.stripe_customer_id,
                "card": {
                    "brand": "visa",
                    "last4": "4242",
                    "exp_month": 12,
                    "exp_year": 2025,
                },
            },
            stripe_lib.api_key,
        )
        mocker.patch(
            "polar.integrations.stripe.service.stripe.get_payment_method",
            return_value=stripe_payment_method,
        )

        # When: Process webhook
        event_id = uuid.uuid4()
        await payment_intent_succeeded(event_id)

        # Then: Subscription payment method is updated in database
        subscription_repo = SubscriptionRepository.from_session(session)
        updated_subscription = await subscription_repo.get_by_id(
            subscription.id,
            options=(selectinload(subscription_repo.model.payment_method),),
        )
        assert updated_subscription is not None
        assert updated_subscription.payment_method is not None
        assert updated_subscription.payment_method.processor_id == "pm_new"

    async def test_retry_payment_one_time_product_does_not_save_payment_method(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: One-time product (no subscription)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=None,
        )

        # Mock external services
        payment_intent = build_stripe_payment_intent(
            payment_method_id="pm_new",
            customer_id=customer.stripe_customer_id,  # type: ignore
            order_id=str(order.id),
        )

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = payment_intent

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        mocker.patch(
            "polar.integrations.stripe.tasks.payment.resolve_order", return_value=order
        )

        subscription_service_mock = mocker.patch(
            "polar.integrations.stripe.tasks.subscription_service.update_payment_method_from_retry"
        )

        # When: Process webhook
        event_id = uuid.uuid4()
        await payment_intent_succeeded(event_id)

        # Then: Subscription service is not called (no recurring product)
        subscription_service_mock.assert_not_called()

    async def test_payment_intent_without_order_metadata_ignored(
        self,
        mocker: MockerFixture,
    ) -> None:
        # Given: PaymentIntent without order metadata (not a retry payment)
        payment_intent = build_stripe_payment_intent()

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = payment_intent

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        payment_method_service_mock = mocker.patch(
            "polar.integrations.stripe.tasks.payment_method_service.upsert_from_stripe_payment_intent_for_order"
        )

        # When: Process webhook
        event_id = uuid.uuid4()
        await payment_intent_succeeded(event_id)

        # Then: Payment method service is not called (no retry metadata)
        payment_method_service_mock.assert_not_called()
