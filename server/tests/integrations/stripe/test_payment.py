from datetime import timedelta

import pytest
from freezegun import freeze_time

from polar.integrations.stripe.payment import handle_failure
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Product,
    Subscription,
)
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
)
from tests.fixtures.stripe import build_stripe_charge


@pytest.mark.asyncio
class TestHandleFailure:
    """Integration tests for the failed payment. If it's an order, the subscription
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
    ) -> None:
        """Test the complete dunning flow with actual repository calls"""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        order.next_payment_attempt_at = None
        assert order.subscription is not None
        await save_fixture(order)

        # Create stripe charge with order_id metadata
        stripe_charge = build_stripe_charge(
            status="failed",
            amount=2000,
            metadata={"order_id": str(order.id)},
            billing_details={"email": "test@example.com"},
            payment_method_details={
                "card": {"brand": "visa", "last4": "4242"},
                "type": "card",
            },
        )

        # When
        await handle_failure(session, stripe_charge)

        # Then
        order_repo = OrderRepository.from_session(session)
        subscription_repo = SubscriptionRepository.from_session(session)

        updated_order = await order_repo.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.next_payment_attempt_at is not None
        expected_retry_date = utc_now() + timedelta(days=2)
        assert updated_order.next_payment_attempt_at == expected_retry_date

        updated_subscription = await subscription_repo.get_by_id(subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.past_due
