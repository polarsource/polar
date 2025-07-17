import uuid
from datetime import timedelta

import pytest
import stripe as stripe_lib
from freezegun import freeze_time
from pytest_mock import MockerFixture

from polar.integrations.stripe.payment import handle_failure
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Product,
    Subscription,
)
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
)


@pytest.fixture
def stripe_charge() -> stripe_lib.Charge:
    return stripe_lib.Charge(
        id="ch_test_123",
        object="charge",
        amount=2000,
        currency="usd",
        status="failed",
        metadata={"checkout_id": str(uuid.uuid4())},
    )


@pytest.fixture
def stripe_payment_intent() -> stripe_lib.PaymentIntent:
    return stripe_lib.PaymentIntent(
        id="pi_test_123",
        object="payment_intent",
        amount=2000,
        currency="usd",
        status="requires_payment_method",
        metadata={"checkout_id": str(uuid.uuid4())},
    )


@pytest.mark.asyncio
class TestDunningIntegration:
    """Integration tests for dunning functionality.
    Dunning is the process of retrying failed payments for subscriptions. The subscription
    will be marked as past due, benefits will be revoked, and the order will have its next
    payment attempt scheduled."""

    @freeze_time("2024-01-01 12:00:00")
    async def test_full_dunning_flow_with_repositories(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
        stripe_charge: stripe_lib.Charge,
        mocker: MockerFixture,
    ) -> None:
        """Test the complete dunning flow with actual repository calls"""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
        )

        order.next_payment_attempt_at = None
        order.subscription.stripe_subscription_id = None
        await save_fixture(order)

        mocker.patch(
            "polar.integrations.stripe.payment.resolve_checkout", return_value=None
        )
        mocker.patch(
            "polar.integrations.stripe.payment.resolve_order", return_value=order
        )
        mocker.patch(
            "polar.integrations.stripe.payment.payment_service.upsert_from_stripe_charge"
        )

        # When
        await handle_failure(session, stripe_charge)

        # Then
        order_repo = OrderRepository.from_session(session)
        subscription_repo = SubscriptionRepository.from_session(session)

        updated_order = await order_repo.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.next_payment_attempt_at is not None
        expected_retry_date = utc_now() + timedelta(days=3)
        assert updated_order.next_payment_attempt_at == expected_retry_date

        updated_subscription = await subscription_repo.get_by_id(subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.past_due
