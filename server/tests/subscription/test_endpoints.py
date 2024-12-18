from datetime import datetime
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import Customer, Organization, Product, UserOrganization
from polar.models.subscription import SubscriptionStatus
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription
from tests.fixtures.stripe import (
    create_canceled_stripe_subscription,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.subscription.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestListSubscriptions:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get("/v1/subscriptions/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        response = await client.get("/v1/subscriptions/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" in item
            assert "customer" in item
            assert item["user"]["id"] == item["customer"]["id"]


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSubscriptionUpdateCancel:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
                customer_cancellation_reason="too_expensive",
                customer_cancellation_comment="Inflation be crazy",
            ),
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product_organization_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
                customer_cancellation_reason="too_expensive",
                customer_cancellation_comment="Inflation be crazy",
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )

        reason = "too_expensive"
        comment = "Inflation be crazy"

        canceled = create_canceled_stripe_subscription(subscription)
        stripe_service_mock.cancel_subscription.return_value = canceled
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
                customer_cancellation_reason=reason,
                customer_cancellation_comment=comment,
            ),
        )
        assert response.status_code == 200
        updated_subscription = response.json()

        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["cancel_at_period_end"]
        assert updated_subscription["ends_at"] == current_period_end
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["customer_cancellation_reason"] == reason
        assert updated_subscription["customer_cancellation_comment"] == comment


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSubscriptionUpdateRevoke:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                revoke=True,
                customer_cancellation_reason="too_expensive",
                customer_cancellation_comment="Inflation be crazy",
            ),
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product_organization_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                revoke=True,
                customer_cancellation_reason="too_expensive",
                customer_cancellation_comment="Inflation be crazy",
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )

        reason = "too_expensive"
        comment = "Inflation be crazy"

        canceled = create_canceled_stripe_subscription(subscription, revoke=True)
        stripe_service_mock.cancel_subscription.return_value = canceled
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                revoke=True,
                customer_cancellation_reason=reason,
                customer_cancellation_comment=comment,
            ),
        )
        assert response.status_code == 200
        updated_subscription = response.json()

        ended_at = updated_subscription["ended_at"]
        assert ended_at
        assert updated_subscription["status"] == SubscriptionStatus.canceled
        assert updated_subscription["cancel_at_period_end"] is False
        assert updated_subscription["ends_at"] == ended_at
        assert updated_subscription["customer_cancellation_reason"] == reason
        assert updated_subscription["customer_cancellation_comment"] == comment


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSubscriptionRevoke:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.delete(f"/v1/subscriptions/{subscription.id}")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product_organization_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.delete(f"/v1/subscriptions/{subscription.id}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )

        canceled = create_canceled_stripe_subscription(subscription, revoke=True)
        stripe_service_mock.cancel_subscription.return_value = canceled
        response = await client.delete(f"/v1/subscriptions/{subscription.id}")
        assert response.status_code == 200
        updated_subscription = response.json()

        assert updated_subscription["status"] == SubscriptionStatus.canceled
