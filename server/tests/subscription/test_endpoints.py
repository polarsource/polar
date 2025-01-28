import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import (
    Customer,
    Organization,
    Product,
    ProductPriceFree,
    Subscription,
    UserOrganization,
)
from polar.models.product_price import ProductPriceType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
    create_product,
    create_product_price_fixed,
)
from tests.fixtures.stripe import (
    cloned_stripe_canceled_subscription,
    cloned_stripe_subscription,
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
class TestSubscriptionPriceUpdate:
    async def test_anonymous(
        self, client: AsyncClient, session: AsyncSession, subscription: Subscription
    ) -> None:
        non_existing = uuid.uuid4()
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_price_id=str(non_existing)),
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_canceled_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        product: Product,
        product_second: Product,
        customer: Customer,
    ) -> None:
        new_price = product_second.prices[0]

        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_price_id=str(new_price.id)),
        )
        assert response.status_code == 403

    @pytest.mark.auth
    async def test_non_existing_product(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        non_existing = uuid.uuid4()
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_price_id=str(non_existing)),
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_non_recurring_price(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        product = await create_product(save_fixture, organization=organization)
        price = await create_product_price_fixed(
            save_fixture, product=product, type=ProductPriceType.one_time
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_price_id=str(price.id)),
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_extraneous_tier(
        self,
        client: AsyncClient,
        subscription: Subscription,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
        product_organization_second: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        price_id = product_organization_second.prices[0].id
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_price_id=str(price_id)),
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_non_existing_stripe_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
        product_second: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        price_id = product_second.prices[0].id
        subscription.stripe_subscription_id = None
        await save_fixture(subscription)

        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_price_id=str(price_id)),
        )
        assert response.status_code == 400

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        subscription: Subscription,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        customer: Customer,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        product_second: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        previous_price = subscription.price
        new_price = product_second.prices[0]
        new_price_id = new_price.id
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_price_id=str(new_price_id)),
        )
        assert response.status_code == 200
        assert stripe_service_mock.cancel_subscription.called is False
        assert stripe_service_mock.revoke_subscription.called is False
        previous_free = isinstance(previous_price, ProductPriceFree)
        stripe_service_mock.update_subscription_price.assert_called_once_with(
            subscription.stripe_subscription_id,
            old_price=previous_price.stripe_price_id,
            new_price=new_price.stripe_price_id,
            proration_behavior=organization.proration_behavior.to_stripe(),
            error_if_incomplete=previous_free,
        )

        updated_subscription = response.json()
        assert updated_subscription["product"]["id"] == str(product_second.id)
        assert updated_subscription["price"]["id"] == str(new_price_id)


@pytest.mark.asyncio
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

        canceled = cloned_stripe_canceled_subscription(subscription)
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
        assert stripe_service_mock.update_subscription_price.called is False
        stripe_service_mock.cancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id,
            customer_reason=reason,
            customer_comment=comment,
        )

        updated_subscription = response.json()
        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["cancel_at_period_end"]
        assert updated_subscription["ends_at"] == current_period_end
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["customer_cancellation_reason"] == reason
        assert updated_subscription["customer_cancellation_comment"] == comment


@pytest.mark.asyncio
class TestSubscriptionUpdateUncancel:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
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
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer,
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_uncancel_revoked(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture, product=product, customer=customer, revoke=True
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
            ),
        )
        assert response.status_code == 410

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
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        uncanceled = cloned_stripe_subscription(subscription)
        uncanceled.cancel_at_period_end = False
        uncanceled.canceled_at = None
        uncanceled.ended_at = None

        stripe_service_mock.uncancel_subscription.return_value = uncanceled
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
            ),
        )
        assert response.status_code == 200
        stripe_service_mock.uncancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id,
        )
        updated_subscription = response.json()
        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["cancel_at_period_end"] is False
        assert updated_subscription["ends_at"] is None
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["customer_cancellation_reason"] is None
        assert updated_subscription["customer_cancellation_comment"] is None


@pytest.mark.asyncio
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

        canceled = cloned_stripe_canceled_subscription(subscription, revoke=True)
        stripe_service_mock.revoke_subscription.return_value = canceled
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                revoke=True,
                customer_cancellation_reason=reason,
                customer_cancellation_comment=comment,
            ),
        )
        assert response.status_code == 200
        assert stripe_service_mock.update_subscription_price.called is False
        stripe_service_mock.revoke_subscription.assert_called_once_with(
            subscription.stripe_subscription_id,
            customer_reason=reason,
            customer_comment=comment,
        )

        updated_subscription = response.json()
        ended_at = updated_subscription["ended_at"]
        assert ended_at
        assert updated_subscription["status"] == SubscriptionStatus.canceled
        assert updated_subscription["cancel_at_period_end"] is False
        assert updated_subscription["ends_at"] == ended_at
        assert updated_subscription["customer_cancellation_reason"] == reason
        assert updated_subscription["customer_cancellation_comment"] == comment


@pytest.mark.asyncio
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

        canceled = cloned_stripe_canceled_subscription(subscription, revoke=True)
        stripe_service_mock.revoke_subscription.return_value = canceled
        response = await client.delete(f"/v1/subscriptions/{subscription.id}")
        assert response.status_code == 200
        assert stripe_service_mock.update_subscription_price.called is False
        stripe_service_mock.revoke_subscription.assert_called_once_with(
            subscription.stripe_subscription_id,
            customer_reason=None,
            customer_comment=None,
        )

        updated_subscription = response.json()
        assert updated_subscription["status"] == SubscriptionStatus.canceled
