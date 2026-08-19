import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.meter.aggregation import CountAggregation
from polar.meter.filter import Filter, FilterConjunction
from polar.meter_period.repository import MeterPeriodRepository
from polar.models import Customer, Organization, Product, Subscription, User
from polar.models.meter_period import MeterPeriodStatus
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_meter,
    create_order,
    create_product,
    create_subscription,
)

PERIOD_START = datetime(2026, 7, 1, tzinfo=UTC)
PERIOD_END = datetime(2026, 8, 1, tzinfo=UTC)


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


@pytest_asyncio.fixture
async def metered_subscription(
    save_fixture: SaveFixture, customer: Customer, organization: Organization
) -> Subscription:
    meter = await create_meter(
        save_fixture,
        organization=organization,
        name="Tool Calls",
        filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
        aggregation=CountAggregation(),
    )
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None, "usd")],
    )
    return await create_active_subscription(
        save_fixture,
        customer=customer,
        product=product,
        current_period_start=PERIOD_START,
        current_period_end=PERIOD_END,
    )


@pytest_asyncio.fixture
async def static_subscription(
    save_fixture: SaveFixture, customer: Customer, product: Product
) -> Subscription:
    return await create_active_subscription(
        save_fixture, customer=customer, product=product
    )


@pytest.mark.asyncio
class TestOpenMeterPeriod:
    async def test_returns_404_for_unknown_subscription(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get(
            f"/subscriptions/{uuid.uuid4()}/open_meter_period"
        )

        assert response.status_code == 404

    async def test_opens_one_period_per_metered_price(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        metered_subscription: Subscription,
    ) -> None:
        response = await backoffice_client.post(
            f"/subscriptions/{metered_subscription.id}/open_meter_period",
            data={
                "starts_at": "2026-07-01T00:00",
                "ends_at": "2026-08-01T00:00",
            },
        )

        assert response.status_code == 303
        repository = MeterPeriodRepository.from_session(session)
        periods = await repository.get_by_subscription(metered_subscription.id)
        assert len(periods) == 1
        assert periods[0].starts_at == PERIOD_START
        assert periods[0].ends_at == PERIOD_END
        assert periods[0].status == MeterPeriodStatus.accruing

    async def test_rejects_a_window_that_ends_before_it_starts(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        metered_subscription: Subscription,
    ) -> None:
        response = await backoffice_client.post(
            f"/subscriptions/{metered_subscription.id}/open_meter_period",
            data={
                "starts_at": "2026-08-01T00:00",
                "ends_at": "2026-07-01T00:00",
            },
        )

        assert response.status_code == 200
        repository = MeterPeriodRepository.from_session(session)
        assert await repository.get_by_subscription(metered_subscription.id) == []

    async def test_declines_a_subscription_with_no_metered_price(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        static_subscription: Subscription,
    ) -> None:
        response = await backoffice_client.get(
            f"/subscriptions/{static_subscription.id}/open_meter_period"
        )

        assert response.status_code == 200
        repository = MeterPeriodRepository.from_session(session)
        assert await repository.get_by_subscription(static_subscription.id) == []


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
