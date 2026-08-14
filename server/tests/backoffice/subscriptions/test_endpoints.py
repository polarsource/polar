import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.kit.utils import utc_now
from polar.models import Customer, Product, User
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_order,
    create_subscription,
)


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient, None]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_db_read_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_db_read_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.asyncio
class TestUpdateStatus:
    async def test_returns_404_for_unknown_subscription(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get(
            f"/subscriptions/{uuid.uuid4()}/update_status"
        )

        assert response.status_code == 404

    async def test_get_renders_modal_for_past_due_subscription(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            started_at=utc_now(),
            past_due_at=utc_now(),
        )

        response = await backoffice_client.get(
            f"/subscriptions/{subscription.id}/update_status"
        )

        assert response.status_code == 200
        assert "Update subscription status" in response.text
        assert 'value="active"' in response.text
        assert "Void pending orders" in response.text

    async def test_no_valid_targets(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        response = await backoffice_client.get(
            f"/subscriptions/{subscription.id}/update_status"
        )

        assert response.status_code == 200
        assert "cannot be updated" in response.text
        assert "Update subscription status" not in response.text

    async def test_post_past_due_to_active(
        self,
        mocker: MockerFixture,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            started_at=utc_now(),
            past_due_at=utc_now(),
        )

        response = await backoffice_client.post(
            f"/subscriptions/{subscription.id}/update_status",
            data={"status": "active"},
        )

        assert response.status_code == 303
        await session.refresh(subscription)
        assert subscription.status == SubscriptionStatus.active
        assert subscription.past_due_at is None
        enqueue_job_mock.assert_any_call(
            "customer.state_changed", subscription.customer_id
        )

    async def test_post_past_due_to_active_voids_pending_orders(
        self,
        mocker: MockerFixture,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        mocker.patch("polar.subscription.service.enqueue_job")
        mocker.patch("polar.order.service.enqueue_job")
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            started_at=utc_now(),
            past_due_at=utc_now(),
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subscription=subscription,
            status=OrderStatus.pending,
            next_payment_attempt_at=utc_now(),
        )

        response = await backoffice_client.post(
            f"/subscriptions/{subscription.id}/update_status",
            data={"status": "active", "void_pending_orders": "on"},
        )

        assert response.status_code == 303
        await session.refresh(subscription)
        assert subscription.status == SubscriptionStatus.active
        await session.refresh(order)
        assert order.status == OrderStatus.void
        assert order.next_payment_attempt_at is None

    async def test_post_invalid_target(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            started_at=utc_now(),
            past_due_at=utc_now(),
        )

        response = await backoffice_client.post(
            f"/subscriptions/{subscription.id}/update_status",
            data={"status": "canceled"},
        )

        assert response.status_code == 200
        assert "Cannot update this subscription to canceled." in response.text
        await session.refresh(subscription)
        assert subscription.status == SubscriptionStatus.past_due
