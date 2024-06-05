from datetime import UTC, date, datetime
from typing import NotRequired, TypedDict

import pytest
import pytest_asyncio

from polar.auth.models import AuthSubject
from polar.metrics.service import Interval
from polar.metrics.service import metrics as metrics_service
from polar.models import Order, Organization, Product, Subscription, User
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_subscription


class SubscriptionFixture(TypedDict):
    started_at: date


class OrderFixture(TypedDict):
    created_at: date
    amount: int
    subscription_id: NotRequired[str]


def _date_to_datetime(date: date) -> datetime:
    return datetime(date.year, date.month, date.day, tzinfo=UTC)


SUBSCRIPTIONS: dict[str, SubscriptionFixture] = {
    "subscription_1": {
        "started_at": date(2024, 1, 1),
    },
    "subscription_2": {
        "started_at": date(2024, 6, 1),
    },
}

ORDERS: dict[str, OrderFixture] = {
    "order_1": {
        "created_at": date(2024, 1, 1),
        "amount": 100_00,
    },
    "order_2": {
        "created_at": date(2024, 1, 1),
        "amount": 100_00,
        "subscription_id": "subscription_1",
    },
    "order_3": {
        "created_at": date(2024, 2, 1),
        "amount": 100_00,
        "subscription_id": "subscription_1",
    },
    "order_4": {
        "created_at": date(2024, 6, 1),
        "amount": 100_00,
        "subscription_id": "subscription_2",
    },
}


async def _create_orders_and_subscriptions(
    save_fixture: SaveFixture,
    user: User,
    product: Product,
    subscription_fixtures: dict[str, SubscriptionFixture],
    order_fixtures: dict[str, OrderFixture],
) -> tuple[dict[str, Subscription], dict[str, Order]]:
    subscriptions: dict[str, Subscription] = {}
    for key, subscription_fixture in subscription_fixtures.items():
        subscription = await create_subscription(
            save_fixture,
            product=product,
            user=user,
            status=SubscriptionStatus.active,
            started_at=_date_to_datetime(subscription_fixture["started_at"]),
        )
        subscriptions[key] = subscription

    orders: dict[str, Order] = {}
    for key, order_fixture in order_fixtures.items():
        order_subscription: Subscription | None = None
        if subscription_id := order_fixture.get("subscription_id"):
            order_subscription = subscriptions[subscription_id]
        order = await create_order(
            save_fixture,
            product=product,
            user=user,
            amount=order_fixture["amount"],
            created_at=_date_to_datetime(order_fixture["created_at"]),
            subscription=order_subscription,
        )
        orders[key] = order

    return subscriptions, orders


@pytest_asyncio.fixture
async def orders_and_subscriptions(
    save_fixture: SaveFixture,
    user: User,
    product: Product,
) -> tuple[dict[str, Subscription], dict[str, Order]]:
    return await _create_orders_and_subscriptions(
        save_fixture,
        user,
        product,
        SUBSCRIPTIONS,
        ORDERS,
    )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestGetMetrics:
    @pytest.mark.auth
    @pytest.mark.parametrize(
        "interval,expected_count",
        [
            (Interval.year, 1),
            (Interval.month, 12),
            (
                Interval.week,
                53,  # Last week of the year (Monday 30th) is partial, so +1
            ),
            (Interval.day, 366),  # Leap year!
            (Interval.hour, 8784),  # Leap year!
        ],
    )
    async def test_intervals(
        self,
        interval: Interval,
        expected_count: int,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=interval,
        )
        assert len(metrics.periods) == expected_count

    @pytest.mark.auth
    async def test_values(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        orders_and_subscriptions: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=Interval.day,
        )

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 2
        assert jan_1.revenue == 200_00
        assert jan_1.average_order_value == 100_00
        assert jan_1.one_time_products == 1
        assert jan_1.one_time_products_revenue == 100_00
        assert jan_1.new_subscriptions == 1
        assert jan_1.new_subscriptions_revenue == 100_00
        assert jan_1.renewed_subscriptions == 0
        assert jan_1.renewed_subscriptions_revenue == 0

        feb_1 = metrics.periods[31]
        assert feb_1.orders == 1
        assert feb_1.revenue == 100_00
        assert feb_1.average_order_value == 100_00
        assert feb_1.one_time_products == 0
        assert feb_1.one_time_products_revenue == 0
        assert feb_1.new_subscriptions == 0
        assert feb_1.new_subscriptions_revenue == 0
        assert feb_1.renewed_subscriptions == 1
        assert feb_1.renewed_subscriptions_revenue == 100_00

        jun_1 = metrics.periods[152]
        assert jun_1.orders == 1
        assert jun_1.revenue == 100_00
        assert jun_1.average_order_value == 100_00
        assert jun_1.one_time_products == 0
        assert jun_1.one_time_products_revenue == 0
        assert jun_1.new_subscriptions == 1
        assert jun_1.new_subscriptions_revenue == 100_00
        assert jun_1.renewed_subscriptions == 0
        assert jun_1.renewed_subscriptions_revenue == 0
