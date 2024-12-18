from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import (
    Customer,
    Product,
)
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
)
from tests.fixtures.stripe import (
    create_canceled_stripe_subscription,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.customer_portal.service.subscription.stripe_service", new=mock)
    mocker.patch("polar.subscription.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCustomerSubscriptionCancelEndpoints:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_delete_endpoint(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        canceled = create_canceled_stripe_subscription(subscription)
        stripe_service_mock.cancel_subscription.return_value = canceled
        response = await client.delete(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
        )
        assert response.status_code == 200
        updated_subscription = response.json()

        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["id"] == str(subscription.id)
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["cancel_at_period_end"]
        assert updated_subscription["ends_at"] == current_period_end

        stripe_service_mock.cancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id,
            customer_reason=None,
            customer_comment=None,
            immediately=False,
        )
