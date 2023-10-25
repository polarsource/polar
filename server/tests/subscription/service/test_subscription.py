from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import SubscriptionTier, User
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.subscription.service.subscription import (
    SubscriptionDoesNotExist,
    SubscriptionTierDoesNotExist,
)
from polar.subscription.service.subscription import subscription as subscription_service
from polar.user.service import user as user_service

from ..conftest import create_subscription


def construct_stripe_subscription(
    *,
    customer_id: str = "CUSTOMER_ID",
    product_id: str = "PRODUCT_ID",
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
) -> stripe_lib.Subscription:
    now_timestamp = datetime.now(UTC).timestamp()
    return stripe_lib.Subscription.construct_from(
        {
            "id": "SUBSCRIPTION_ID",
            "customer": customer_id,
            "status": status,
            "items": {
                "data": [
                    {
                        "price": {
                            "product": product_id,
                            "currency": "USD",
                            "unit_amount": 1000,
                        }
                    }
                ]
            },
            "current_period_start": now_timestamp,
            "current_period_end": now_timestamp + timedelta(days=30).seconds,
            "cancel_at_period_end": False,
            "ended_at": None,
        },
        None,
    )


def construct_stripe_customer(
    *, id: str = "CUSTOMER_ID", email: str = "backer@example.com"
) -> stripe_lib.Customer:
    return stripe_lib.Customer.construct_from(
        {
            "id": id,
            "email": email,
        },
        None,
    )


@pytest.fixture(autouse=True)
def mock_stripe_service(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.subscription.service.subscription.stripe_service",
        spec=StripeService,
    )


@pytest.mark.asyncio
class TestCreateSubscription:
    async def test_not_existing_subscription_tier(self, session: AsyncSession) -> None:
        stripe_subscription = construct_stripe_subscription()
        with pytest.raises(SubscriptionTierDoesNotExist):
            await subscription_service.create_subscription(
                session, stripe_subscription=stripe_subscription
            )

    async def test_new_user(
        self,
        session: AsyncSession,
        mock_stripe_service: MagicMock,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = mock_stripe_service.get_customer
        get_customer_mock.return_value = stripe_customer

        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            product_id=subscription_tier_organization.stripe_product_id
        )

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.stripe_id
        assert subscription.subscription_tier_id == subscription_tier_organization.id

        user = await user_service.get(session, subscription.user_id)
        assert user is not None
        assert user.email == stripe_customer.email
        assert user.stripe_customer_id == stripe_subscription.customer

    async def test_existing_user(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            product_id=subscription_tier_organization.stripe_product_id
        )

        await user.update(session, stripe_customer_id=stripe_subscription.customer)

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.stripe_id
        assert subscription.subscription_tier_id == subscription_tier_organization.id

        assert subscription.user_id == user.id


@pytest.mark.asyncio
class TestUpdateSubscription:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        stripe_subscription = construct_stripe_subscription()
        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_service.update_subscription(
                session, stripe_subscription=stripe_subscription
            )

    async def test_valid(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active
        )
        await create_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            stripe_subscription_id=stripe_subscription.stripe_id,
        )

        updated_subscription = await subscription_service.update_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
