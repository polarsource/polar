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
    mocker.patch("polar.subscription.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCustomerSubscriptionUpdateCancel:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer_second,
        )
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_id=True,
            ),
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_tampered(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer_second,
        )
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_id=True,
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_valid(
        self,
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

        reason = "too_complex"
        comment = "Too many settings"

        canceled = create_canceled_stripe_subscription(subscription)
        stripe_service_mock.cancel_subscription.return_value = canceled
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_id=True,
                cancellation_reason=reason,
                cancellation_comment=comment,
            ),
        )
        assert response.status_code == 200
        stripe_service_mock.cancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id,
            customer_reason=reason,
            customer_comment=comment,
            immediately=False,
        )

        updated_subscription = response.json()
        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["id"] == str(subscription.id)
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["cancel_at_period_end"]
        assert updated_subscription["ends_at"] == current_period_end
        assert updated_subscription["customer_cancellation_reason"] == reason
        assert updated_subscription["customer_cancellation_comment"] == comment


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCustomerSubscriptionCancel:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        response = await client.delete(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_tampered(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer_second,
        )

        response = await client.delete(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
        )
        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_valid(
        self,
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
        stripe_service_mock.cancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id,
            customer_reason=None,
            customer_comment=None,
            immediately=False,
        )

        updated_subscription = response.json()
        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["id"] == str(subscription.id)
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["cancel_at_period_end"]
        assert updated_subscription["ends_at"] == current_period_end
