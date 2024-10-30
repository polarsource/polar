from datetime import UTC, date, datetime
from typing import NotRequired, TypedDict

import pytest
import pytest_asyncio

from polar.auth.models import AuthSubject
from polar.enums import SubscriptionRecurringInterval
from polar.metrics.queries import Interval
from polar.metrics.service import metrics as metrics_service
from polar.models import (
    Order,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.product_price import ProductPriceType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_product,
    create_subscription,
)


class ProductFixture(TypedDict):
    prices: list[
        tuple[int, ProductPriceType, SubscriptionRecurringInterval | None]
        | tuple[ProductPriceType, SubscriptionRecurringInterval | None]
    ]


class SubscriptionFixture(TypedDict):
    started_at: date
    ended_at: NotRequired[date]
    product: str


class OrderFixture(TypedDict):
    created_at: date
    amount: int
    product: str
    subscription: NotRequired[str]


def _date_to_datetime(date: date) -> datetime:
    return datetime(date.year, date.month, date.day, tzinfo=UTC)


PRODUCTS: dict[str, ProductFixture] = {
    "one_time_product": {
        "prices": [(100_00, ProductPriceType.one_time, None)],
    },
    "monthly_subscription": {
        "prices": [
            (100_00, ProductPriceType.recurring, SubscriptionRecurringInterval.month)
        ],
    },
    "yearly_subscription": {
        "prices": [
            (1000_00, ProductPriceType.recurring, SubscriptionRecurringInterval.year)
        ],
    },
    "free_subscription": {
        "prices": [(ProductPriceType.recurring, SubscriptionRecurringInterval.month)]
    },
}

SUBSCRIPTIONS: dict[str, SubscriptionFixture] = {
    "subscription_1": {
        "started_at": date(2024, 1, 1),
        "product": "monthly_subscription",
    },
    "subscription_2": {
        "started_at": date(2024, 6, 1),
        "product": "monthly_subscription",
    },
    "subscription_3": {
        "started_at": date(2024, 1, 1),
        "product": "yearly_subscription",
    },
}

ORDERS: dict[str, OrderFixture] = {
    "order_1": {
        "created_at": date(2024, 1, 1),
        "amount": 100_00,
        "product": "one_time_product",
    },
    "order_2": {
        "created_at": date(2024, 1, 1),
        "amount": 100_00,
        "product": "monthly_subscription",
        "subscription": "subscription_1",
    },
    "order_3": {
        "created_at": date(2024, 2, 1),
        "amount": 100_00,
        "product": "monthly_subscription",
        "subscription": "subscription_1",
    },
    "order_4": {
        "created_at": date(2024, 1, 1),
        "amount": 1000_00,
        "product": "yearly_subscription",
        "subscription": "subscription_3",
    },
    "order_5": {
        "created_at": date(2024, 6, 1),
        "amount": 100_00,
        "product": "monthly_subscription",
        "subscription": "subscription_2",
    },
}


async def _create_fixtures(
    save_fixture: SaveFixture,
    user: User,
    organization: Organization,
    product_fixtures: dict[str, ProductFixture],
    subscription_fixtures: dict[str, SubscriptionFixture],
    order_fixtures: dict[str, OrderFixture],
) -> tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]]:
    products: dict[str, Product] = {}
    for key, product_fixture in product_fixtures.items():
        product = await create_product(
            save_fixture, organization=organization, prices=product_fixture["prices"]
        )
        products[key] = product

    subscriptions: dict[str, Subscription] = {}
    for key, subscription_fixture in subscription_fixtures.items():
        subscription = await create_subscription(
            save_fixture,
            product=products[subscription_fixture["product"]],
            user=user,
            status=SubscriptionStatus.active,
            started_at=_date_to_datetime(subscription_fixture["started_at"]),
            ended_at=(
                _date_to_datetime(subscription_fixture["ended_at"])
                if "ended_at" in subscription_fixture
                else None
            ),
        )
        subscriptions[key] = subscription

    orders: dict[str, Order] = {}
    for key, order_fixture in order_fixtures.items():
        order_subscription: Subscription | None = None
        if subscription_id := order_fixture.get("subscription"):
            order_subscription = subscriptions[subscription_id]
        order = await create_order(
            save_fixture,
            product=products[order_fixture["product"]],
            user=user,
            amount=order_fixture["amount"],
            created_at=_date_to_datetime(order_fixture["created_at"]),
            subscription=order_subscription,
            stripe_invoice_id=None,
        )
        orders[key] = order

    return products, subscriptions, orders


@pytest_asyncio.fixture
async def fixtures(
    save_fixture: SaveFixture, user: User, organization: Organization
) -> tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]]:
    return await _create_fixtures(
        save_fixture, user, organization, PRODUCTS, SUBSCRIPTIONS, ORDERS
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

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_values(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=Interval.day,
        )

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 3
        assert jan_1.revenue == 1200_00
        assert jan_1.average_order_value == 400_00
        assert jan_1.one_time_products == 1
        assert jan_1.one_time_products_revenue == 100_00
        assert jan_1.new_subscriptions == 2
        assert jan_1.new_subscriptions_revenue == 1100_00
        assert jan_1.renewed_subscriptions == 0
        assert jan_1.renewed_subscriptions_revenue == 0
        assert jan_1.active_subscriptions == 2
        assert jan_1.monthly_recurring_revenue == 183_33

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
        assert feb_1.active_subscriptions == 2
        assert feb_1.monthly_recurring_revenue == 183_33

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
        assert jun_1.active_subscriptions == 3
        assert jun_1.monthly_recurring_revenue == 283_33

        dec_31 = metrics.periods[-1]
        assert dec_31.orders == 0
        assert dec_31.revenue == 0
        assert dec_31.average_order_value == 0
        assert dec_31.one_time_products == 0
        assert dec_31.one_time_products_revenue == 0
        assert dec_31.new_subscriptions == 0
        assert dec_31.new_subscriptions_revenue == 0
        assert dec_31.renewed_subscriptions == 0
        assert dec_31.renewed_subscriptions_revenue == 0
        assert dec_31.active_subscriptions == 3
        assert dec_31.monthly_recurring_revenue == 283_33

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_not_authorized(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        fixtures: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=Interval.day,
        )

        for period in metrics.periods:
            assert period.orders == 0
            assert period.revenue == 0
            assert period.average_order_value == 0
            assert period.one_time_products == 0
            assert period.one_time_products_revenue == 0
            assert period.new_subscriptions == 0
            assert period.new_subscriptions_revenue == 0
            assert period.renewed_subscriptions == 0
            assert period.renewed_subscriptions_revenue == 0
            assert period.active_subscriptions == 0
            assert period.monthly_recurring_revenue == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_product_filter(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=Interval.day,
            product_id=[fixtures[0]["one_time_product"].id],
        )

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 1
        assert jan_1.revenue == 100_00
        assert jan_1.average_order_value == 100_00
        assert jan_1.one_time_products == 1
        assert jan_1.one_time_products_revenue == 100_00
        assert jan_1.new_subscriptions == 0
        assert jan_1.new_subscriptions_revenue == 0
        assert jan_1.renewed_subscriptions == 0
        assert jan_1.renewed_subscriptions_revenue == 0
        assert jan_1.active_subscriptions == 0
        assert jan_1.monthly_recurring_revenue == 0

        feb_1 = metrics.periods[31]
        assert feb_1.orders == 0
        assert feb_1.revenue == 0
        assert feb_1.average_order_value == 0
        assert feb_1.one_time_products == 0
        assert feb_1.one_time_products_revenue == 0
        assert feb_1.new_subscriptions == 0
        assert feb_1.new_subscriptions_revenue == 0
        assert feb_1.renewed_subscriptions == 0
        assert feb_1.renewed_subscriptions_revenue == 0
        assert feb_1.active_subscriptions == 0
        assert feb_1.monthly_recurring_revenue == 0

        jun_1 = metrics.periods[152]
        assert jun_1.orders == 0
        assert jun_1.revenue == 0
        assert jun_1.average_order_value == 0
        assert jun_1.one_time_products == 0
        assert jun_1.one_time_products_revenue == 0
        assert jun_1.new_subscriptions == 0
        assert jun_1.new_subscriptions_revenue == 0
        assert jun_1.renewed_subscriptions == 0
        assert jun_1.renewed_subscriptions_revenue == 0
        assert jun_1.active_subscriptions == 0
        assert jun_1.monthly_recurring_revenue == 0

        dec_31 = metrics.periods[-1]
        assert dec_31.orders == 0
        assert dec_31.revenue == 0
        assert dec_31.average_order_value == 0
        assert dec_31.one_time_products == 0
        assert dec_31.one_time_products_revenue == 0
        assert dec_31.new_subscriptions == 0
        assert dec_31.new_subscriptions_revenue == 0
        assert dec_31.renewed_subscriptions == 0
        assert dec_31.renewed_subscriptions_revenue == 0
        assert dec_31.active_subscriptions == 0
        assert dec_31.monthly_recurring_revenue == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_product_type_filter(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=Interval.day,
            product_price_type=[ProductPriceType.one_time],
        )

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 1
        assert jan_1.revenue == 100_00
        assert jan_1.average_order_value == 100_00
        assert jan_1.one_time_products == 1
        assert jan_1.one_time_products_revenue == 100_00
        assert jan_1.new_subscriptions == 0
        assert jan_1.new_subscriptions_revenue == 0
        assert jan_1.renewed_subscriptions == 0
        assert jan_1.renewed_subscriptions_revenue == 0
        assert jan_1.active_subscriptions == 0
        assert jan_1.monthly_recurring_revenue == 0

        feb_1 = metrics.periods[31]
        assert feb_1.orders == 0
        assert feb_1.revenue == 0
        assert feb_1.average_order_value == 0
        assert feb_1.one_time_products == 0
        assert feb_1.one_time_products_revenue == 0
        assert feb_1.new_subscriptions == 0
        assert feb_1.new_subscriptions_revenue == 0
        assert feb_1.renewed_subscriptions == 0
        assert feb_1.renewed_subscriptions_revenue == 0
        assert feb_1.active_subscriptions == 0
        assert feb_1.monthly_recurring_revenue == 0

        jun_1 = metrics.periods[152]
        assert jun_1.orders == 0
        assert jun_1.revenue == 0
        assert jun_1.average_order_value == 0
        assert jun_1.one_time_products == 0
        assert jun_1.one_time_products_revenue == 0
        assert jun_1.new_subscriptions == 0
        assert jun_1.new_subscriptions_revenue == 0
        assert jun_1.renewed_subscriptions == 0
        assert jun_1.renewed_subscriptions_revenue == 0
        assert jun_1.active_subscriptions == 0
        assert jun_1.monthly_recurring_revenue == 0

        dec_31 = metrics.periods[-1]
        assert dec_31.orders == 0
        assert dec_31.revenue == 0
        assert dec_31.average_order_value == 0
        assert dec_31.one_time_products == 0
        assert dec_31.one_time_products_revenue == 0
        assert dec_31.new_subscriptions == 0
        assert dec_31.new_subscriptions_revenue == 0
        assert dec_31.renewed_subscriptions == 0
        assert dec_31.renewed_subscriptions_revenue == 0
        assert dec_31.active_subscriptions == 0
        assert dec_31.monthly_recurring_revenue == 0

    @pytest.mark.auth
    async def test_values_year_interval(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=Interval.year,
        )

        assert len(metrics.periods) == 1

        period = metrics.periods[0]
        assert period.orders == 5
        assert period.revenue == 1400_00
        assert period.average_order_value == 280_00
        assert period.one_time_products == 1
        assert period.one_time_products_revenue == 100_00
        assert period.new_subscriptions == 3
        assert period.new_subscriptions_revenue == 1300_00
        assert period.renewed_subscriptions == 0
        assert period.renewed_subscriptions_revenue == 0
        assert period.active_subscriptions == 3
        assert period.monthly_recurring_revenue == 283_33

    @pytest.mark.auth
    async def test_values_free_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        user: User,
        organization: Organization,
    ) -> None:
        subscriptions: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "ended_at": date(2024, 6, 15),
                "product": "free_subscription",
            },
            "subscription_2": {
                "started_at": date(2024, 6, 1),
                "product": "free_subscription",
            },
        }
        await _create_fixtures(
            save_fixture, user, organization, PRODUCTS, subscriptions, {}
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=Interval.day,
        )

        assert len(metrics.periods) == 366

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 0
        assert jan_1.revenue == 0
        assert jan_1.average_order_value == 0
        assert jan_1.one_time_products == 0
        assert jan_1.one_time_products_revenue == 0
        assert jan_1.new_subscriptions == 1
        assert jan_1.new_subscriptions_revenue == 0
        assert jan_1.renewed_subscriptions == 0
        assert jan_1.renewed_subscriptions_revenue == 0
        assert jan_1.active_subscriptions == 1
        assert jan_1.monthly_recurring_revenue == 0

        jun_1 = metrics.periods[152]
        assert jun_1.orders == 0
        assert jun_1.revenue == 0
        assert jun_1.average_order_value == 0
        assert jun_1.one_time_products == 0
        assert jun_1.one_time_products_revenue == 0
        assert jun_1.new_subscriptions == 1
        assert jun_1.new_subscriptions_revenue == 0
        assert jun_1.renewed_subscriptions == 0
        assert jun_1.renewed_subscriptions_revenue == 0
        assert jun_1.active_subscriptions == 2
        assert jun_1.monthly_recurring_revenue == 0

        jun_15 = metrics.periods[166]
        assert jun_15.orders == 0
        assert jun_15.revenue == 0
        assert jun_15.average_order_value == 0
        assert jun_15.one_time_products == 0
        assert jun_15.one_time_products_revenue == 0
        assert jun_15.new_subscriptions == 0
        assert jun_15.new_subscriptions_revenue == 0
        assert jun_15.renewed_subscriptions == 0
        assert jun_15.renewed_subscriptions_revenue == 0
        assert jun_15.active_subscriptions == 2
        assert jun_15.monthly_recurring_revenue == 0

        jun_16 = metrics.periods[167]
        assert jun_16.orders == 0
        assert jun_16.revenue == 0
        assert jun_16.average_order_value == 0
        assert jun_16.one_time_products == 0
        assert jun_16.one_time_products_revenue == 0
        assert jun_16.new_subscriptions == 0
        assert jun_16.new_subscriptions_revenue == 0
        assert jun_16.renewed_subscriptions == 0
        assert jun_16.renewed_subscriptions_revenue == 0
        assert jun_16.active_subscriptions == 1
        assert jun_16.monthly_recurring_revenue == 0

    @pytest.mark.auth
    async def test_values_subscription_canceled_during_interval(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        user: User,
        organization: Organization,
    ) -> None:
        """
        Tricky case: how a subscription that was canceled during the interval should be
        counted?

        In the current implementation, the subscription is counted as if it was active
        the whole interval.

        This behavior can be tweaked by changing the comparison from `>` to `>=` in the
        `get_active_subscriptions_cte` query.
        """
        subscriptions: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "ended_at": date(2024, 1, 15),
                "product": "free_subscription",
            }
        }
        await _create_fixtures(
            save_fixture, user, organization, PRODUCTS, subscriptions, {}
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 2, 1),
            interval=Interval.month,
        )

        assert len(metrics.periods) == 2

        jan = metrics.periods[0]
        assert jan.orders == 0
        assert jan.revenue == 0
        assert jan.average_order_value == 0
        assert jan.one_time_products == 0
        assert jan.one_time_products_revenue == 0
        assert jan.new_subscriptions == 1
        assert jan.new_subscriptions_revenue == 0
        assert jan.renewed_subscriptions == 0
        assert jan.renewed_subscriptions_revenue == 0
        assert jan.active_subscriptions == 1
        assert jan.monthly_recurring_revenue == 0

        feb = metrics.periods[1]
        assert feb.orders == 0
        assert feb.revenue == 0
        assert feb.average_order_value == 0
        assert feb.one_time_products == 0
        assert feb.one_time_products_revenue == 0
        assert feb.new_subscriptions == 0
        assert feb.new_subscriptions_revenue == 0
        assert feb.renewed_subscriptions == 0
        assert feb.renewed_subscriptions_revenue == 0
        assert feb.active_subscriptions == 0
        assert feb.monthly_recurring_revenue == 0
