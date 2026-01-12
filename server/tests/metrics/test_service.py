from datetime import UTC, date, datetime
from typing import NotRequired, TypedDict

import pytest
import pytest_asyncio
from apscheduler.util import ZoneInfo
from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.enums import SubscriptionRecurringInterval
from polar.kit.time_queries import TimeInterval
from polar.metrics.service import metrics as metrics_service
from polar.models import (
    Customer,
    Discount,
    Order,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.event import EventSource
from polar.models.order import OrderStatus
from polar.models.product import ProductBillingType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_discount,
    create_event,
    create_order,
    create_product,
    create_subscription,
)


class ProductFixture(TypedDict):
    recurring_interval: SubscriptionRecurringInterval | None
    prices: list[tuple[int] | tuple[None]]


class DiscountFixture(TypedDict):
    basis_points: int
    duration: DiscountDuration
    duration_in_months: NotRequired[int]


class SubscriptionFixture(TypedDict):
    started_at: date
    ended_at: NotRequired[date]
    ends_at: NotRequired[date]
    product: str
    discount: NotRequired[str]


class OrderFixture(TypedDict):
    created_at: date
    amount: int
    product: str
    status: OrderStatus
    subscription: NotRequired[str]


def _date_to_datetime(date: date) -> datetime:
    return datetime(date.year, date.month, date.day, tzinfo=UTC)


PRODUCTS: dict[str, ProductFixture] = {
    "one_time_product": {
        "recurring_interval": None,
        "prices": [(100_00,)],
    },
    "monthly_subscription": {
        "recurring_interval": SubscriptionRecurringInterval.month,
        "prices": [(100_00,)],
    },
    "yearly_subscription": {
        "recurring_interval": SubscriptionRecurringInterval.year,
        "prices": [(1000_00,)],
    },
    "free_subscription": {
        "recurring_interval": SubscriptionRecurringInterval.month,
        "prices": [(None,)],
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
        "created_at": date(2023, 6, 1),
        "amount": 100_00,
        "product": "one_time_product",
        "status": OrderStatus.paid,
    },
    "order_2": {
        "created_at": date(2024, 1, 1),
        "amount": 100_00,
        "product": "one_time_product",
        "status": OrderStatus.paid,
    },
    "order_3": {
        "created_at": date(2024, 1, 1),
        "amount": 100_00,
        "product": "monthly_subscription",
        "status": OrderStatus.paid,
        "subscription": "subscription_1",
    },
    "order_4": {
        "created_at": date(2024, 2, 1),
        "amount": 100_00,
        "product": "monthly_subscription",
        "status": OrderStatus.paid,
        "subscription": "subscription_1",
    },
    "order_5": {
        "created_at": date(2024, 1, 1),
        "amount": 1000_00,
        "product": "yearly_subscription",
        "status": OrderStatus.paid,
        "subscription": "subscription_3",
    },
    "order_6": {
        "created_at": date(2024, 6, 1),
        "amount": 100_00,
        "product": "monthly_subscription",
        "status": OrderStatus.paid,
        "subscription": "subscription_2",
    },
}


async def _create_fixtures(
    save_fixture: SaveFixture,
    customer: Customer,
    organization: Organization,
    product_fixtures: dict[str, ProductFixture],
    subscription_fixtures: dict[str, SubscriptionFixture],
    order_fixtures: dict[str, OrderFixture],
    discount_fixtures: dict[str, DiscountFixture] | None = None,
) -> tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]]:
    products: dict[str, Product] = {}
    for key, product_fixture in product_fixtures.items():
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=product_fixture["recurring_interval"],
            prices=product_fixture["prices"],
        )
        products[key] = product

    discounts: dict[str, Discount] = {}
    if discount_fixtures is not None:
        for key, discount_fixture in discount_fixtures.items():
            discount = await create_discount(
                save_fixture,
                type=DiscountType.percentage,
                basis_points=discount_fixture["basis_points"],
                duration=discount_fixture["duration"],
                duration_in_months=discount_fixture.get("duration_in_months"),
                organization=organization,
            )
            discounts[key] = discount

    subscriptions: dict[str, Subscription] = {}
    for key, subscription_fixture in subscription_fixtures.items():
        subscription = await create_subscription(
            save_fixture,
            product=products[subscription_fixture["product"]],
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=_date_to_datetime(subscription_fixture["started_at"]),
            ended_at=(
                _date_to_datetime(subscription_fixture["ended_at"])
                if "ended_at" in subscription_fixture
                else None
            ),
            ends_at=(
                _date_to_datetime(subscription_fixture["ends_at"])
                if "ends_at" in subscription_fixture
                else None
            ),
            discount=discounts[subscription_fixture["discount"]]
            if "discount" in subscription_fixture
            else None,
        )
        subscriptions[key] = subscription

    orders: dict[str, Order] = {}
    for key, order_fixture in order_fixtures.items():
        order_subscription: Subscription | None = None
        if subscription_id := order_fixture.get("subscription"):
            order_subscription = subscriptions[subscription_id]
        order = await create_order(
            save_fixture,
            status=order_fixture["status"],
            product=products[order_fixture["product"]],
            customer=customer,
            subtotal_amount=order_fixture["amount"],
            created_at=_date_to_datetime(order_fixture["created_at"]),
            subscription=order_subscription,
        )
        orders[key] = order

    return products, subscriptions, orders


@pytest_asyncio.fixture
async def fixtures(
    save_fixture: SaveFixture, customer: Customer, organization: Organization
) -> tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]]:
    return await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, SUBSCRIPTIONS, ORDERS
    )


@pytest.mark.asyncio
class TestGetMetrics:
    @pytest.mark.auth
    @pytest.mark.parametrize(
        ("interval", "expected_count"),
        [
            (TimeInterval.year, 1),
            (TimeInterval.month, 12),
            (
                TimeInterval.week,
                53,
            ),
            (TimeInterval.day, 366),
            (TimeInterval.hour, 8784),
        ],
    )
    async def test_intervals(
        self,
        interval: TimeInterval,
        expected_count: int,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            timezone=ZoneInfo("UTC"),
            interval=interval,
        )
        assert len(metrics.periods) == expected_count

    async def test_timezones(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        fixtures: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 30),
            timezone=ZoneInfo("Europe/Paris"),
            interval=TimeInterval.day,
        )

        for period in metrics.periods:
            assert period.timestamp.tzinfo == UTC

        assert len(metrics.periods) == 30
        assert metrics.periods[0].timestamp.date() == date(2023, 12, 31)

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 3

        jan_2 = metrics.periods[1]
        assert jan_2.orders == 0

        jan_3 = metrics.periods[2]
        assert jan_3.orders == 0

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
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
        )

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 3
        assert jan_1.revenue == 1200_00
        assert jan_1.cumulative_revenue == 1300_00  # Includes $100 order from earlier
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
        assert feb_1.cumulative_revenue == 1400_00
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
        assert jun_1.cumulative_revenue == 1500_00
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
        assert dec_31.cumulative_revenue == 1500_00
        assert dec_31.average_order_value == 0
        assert dec_31.one_time_products == 0
        assert dec_31.one_time_products_revenue == 0
        assert dec_31.new_subscriptions == 0
        assert dec_31.new_subscriptions_revenue == 0
        assert dec_31.renewed_subscriptions == 0
        assert dec_31.renewed_subscriptions_revenue == 0
        assert dec_31.active_subscriptions == 3
        assert dec_31.monthly_recurring_revenue == 283_33

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_values_month_interval_mid_month_start(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """
        Test that metrics correctly filter by date range bounds.
        When querying from Jan 11 to Jun 15, orders from Jan 1-10 should not be
        included in the January period, but they should be included in the
        historical baseline for cumulative metrics.
        """
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 11),
            end_date=date(2024, 6, 15),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 6

        jan = metrics.periods[0]
        # Orders from Jan 1 are before the start date (Jan 11), so excluded from period
        assert jan.orders == 0
        assert jan.revenue == 0
        # But they ARE included in cumulative (historical baseline)
        assert jan.cumulative_revenue == 1300_00  # Includes all orders before Jan 11

        feb = metrics.periods[1]
        assert feb.orders == 1
        assert feb.revenue == 100_00
        assert feb.cumulative_revenue == 1400_00

        jun = metrics.periods[5]
        assert jun.orders == 1
        assert jun.revenue == 100_00
        assert jun.cumulative_revenue == 1500_00

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_values_year_interval_mid_year_start(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Subscription], dict[str, Order]],
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2023, 6, 15),
            end_date=date(2024, 12, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.year,
        )

        assert len(metrics.periods) == 2

        year_2023 = metrics.periods[0]
        # Order from 2023-06-01 is before the start date (2023-06-15), so excluded
        assert year_2023.orders == 0
        assert year_2023.revenue == 0
        # But it IS included in cumulative (historical baseline)
        assert year_2023.cumulative_revenue == 100_00

        year_2024 = metrics.periods[1]
        assert year_2024.orders == 5
        assert year_2024.revenue == 1400_00
        assert year_2024.cumulative_revenue == 1500_00

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
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
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
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            product_id=[fixtures[0]["one_time_product"].id],
        )

        jan = metrics.periods[0]
        assert jan.orders == 1
        assert jan.revenue == 100_00
        assert jan.cumulative_revenue == 200_00  # Includes $100 order from earlier
        assert jan.average_order_value == 100_00
        assert jan.one_time_products == 1
        assert jan.one_time_products_revenue == 100_00
        assert jan.new_subscriptions == 0
        assert jan.new_subscriptions_revenue == 0
        assert jan.renewed_subscriptions == 0
        assert jan.renewed_subscriptions_revenue == 0
        assert jan.active_subscriptions == 0
        assert jan.monthly_recurring_revenue == 0

        feb = metrics.periods[31]
        assert feb.orders == 0
        assert feb.revenue == 0
        assert feb.cumulative_revenue == 200_00
        assert feb.average_order_value == 0
        assert feb.one_time_products == 0
        assert feb.one_time_products_revenue == 0
        assert feb.new_subscriptions == 0
        assert feb.new_subscriptions_revenue == 0
        assert feb.renewed_subscriptions == 0
        assert feb.renewed_subscriptions_revenue == 0
        assert feb.active_subscriptions == 0
        assert feb.monthly_recurring_revenue == 0

        jun_1 = metrics.periods[152]
        assert jun_1.orders == 0
        assert jun_1.revenue == 0
        assert jun_1.cumulative_revenue == 200_00
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
        assert dec_31.cumulative_revenue == 200_00
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
    async def test_billing_type_filter(
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
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            billing_type=[ProductBillingType.one_time],
        )

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 1
        assert jan_1.revenue == 100_00
        assert jan_1.cumulative_revenue == 200_00  # Includes $100 order from earlier
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
        assert feb_1.cumulative_revenue == 200_00
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
        assert jun_1.cumulative_revenue == 200_00
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
        assert dec_31.cumulative_revenue == 200_00
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
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.year,
        )

        assert len(metrics.periods) == 1

        period = metrics.periods[0]
        assert period.orders == 5
        assert period.revenue == 1400_00
        assert period.cumulative_revenue == 1500_00  # Includes $100 order from earlier
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
        customer: Customer,
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
            save_fixture, customer, organization, PRODUCTS, subscriptions, {}
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
        )

        assert len(metrics.periods) == 366

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 0
        assert jan_1.revenue == 0
        assert jan_1.cumulative_revenue == 0
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
        assert jun_1.cumulative_revenue == 0
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
        assert jun_15.cumulative_revenue == 0
        assert jun_15.average_order_value == 0
        assert jun_15.one_time_products == 0
        assert jun_15.one_time_products_revenue == 0
        assert jun_15.new_subscriptions == 0
        assert jun_15.new_subscriptions_revenue == 0
        assert jun_15.renewed_subscriptions == 0
        assert jun_15.renewed_subscriptions_revenue == 0
        assert jun_15.active_subscriptions == 1
        assert jun_15.monthly_recurring_revenue == 0

        jun_16 = metrics.periods[167]
        assert jun_16.orders == 0
        assert jun_16.revenue == 0
        assert jun_16.cumulative_revenue == 0
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
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Tricky case: how a subscription that was canceled during the interval should be
        counted?

        In the current implementation, the subscription is not counted if it was canceled
        during the interval.

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
            save_fixture, customer, organization, PRODUCTS, subscriptions, {}
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 2, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 2

        jan = metrics.periods[0]
        assert jan.orders == 0
        assert jan.revenue == 0
        assert jan.cumulative_revenue == 0
        assert jan.average_order_value == 0
        assert jan.one_time_products == 0
        assert jan.one_time_products_revenue == 0
        assert jan.new_subscriptions == 0
        assert jan.new_subscriptions_revenue == 0
        assert jan.renewed_subscriptions == 0
        assert jan.renewed_subscriptions_revenue == 0
        assert jan.active_subscriptions == 0
        assert jan.monthly_recurring_revenue == 0

        feb = metrics.periods[1]
        assert feb.orders == 0
        assert feb.revenue == 0
        assert feb.cumulative_revenue == 0
        assert feb.average_order_value == 0
        assert feb.one_time_products == 0
        assert feb.one_time_products_revenue == 0
        assert feb.new_subscriptions == 0
        assert feb.new_subscriptions_revenue == 0
        assert feb.renewed_subscriptions == 0
        assert feb.renewed_subscriptions_revenue == 0
        assert feb.active_subscriptions == 0
        assert feb.monthly_recurring_revenue == 0

    @pytest.mark.auth
    async def test_values_subscription_due_cancellation(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        user: User,
        customer: Customer,
        organization: Organization,
    ) -> None:
        subscriptions: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "ends_at": date(2024, 3, 15),
                "product": "free_subscription",
            }
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, subscriptions, {}
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 3

        jan = metrics.periods[0]
        assert jan.orders == 0
        assert jan.revenue == 0
        assert jan.cumulative_revenue == 0
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
        assert feb.cumulative_revenue == 0
        assert feb.average_order_value == 0
        assert feb.one_time_products == 0
        assert feb.one_time_products_revenue == 0
        assert feb.new_subscriptions == 0
        assert feb.new_subscriptions_revenue == 0
        assert feb.renewed_subscriptions == 0
        assert feb.renewed_subscriptions_revenue == 0
        assert feb.active_subscriptions == 1
        assert feb.monthly_recurring_revenue == 0

        mar = metrics.periods[2]
        assert mar.orders == 0
        assert mar.revenue == 0
        assert mar.cumulative_revenue == 0
        assert mar.average_order_value == 0
        assert mar.one_time_products == 0
        assert mar.one_time_products_revenue == 0
        assert mar.new_subscriptions == 0
        assert mar.new_subscriptions_revenue == 0
        assert mar.renewed_subscriptions == 0
        assert mar.renewed_subscriptions_revenue == 0
        assert mar.active_subscriptions == 0
        assert mar.monthly_recurring_revenue == 0

    @pytest.mark.auth
    async def test_committed_mrr(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        user: User,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        We have two flavors of MRR:
        * MRR considers the active subscriptions on the given date
        * Committed MRR (CMRR) considers only the active subscriptions that are not due to cancel in the future
        """
        subscriptions: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            },
            "subscription_2": {
                "started_at": date(2024, 2, 1),
                "ends_at": date(2024, 3, 1),
                "product": "monthly_subscription",
            },
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, subscriptions, {}
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
            now=datetime(2024, 2, 15, tzinfo=UTC),
        )

        assert len(metrics.periods) == 3

        jan = metrics.periods[0]
        assert jan.monthly_recurring_revenue == 100_00
        assert jan.committed_monthly_recurring_revenue == 100_00

        feb = metrics.periods[1]
        assert feb.monthly_recurring_revenue == 200_00
        assert feb.committed_monthly_recurring_revenue == 100_00

        mar = metrics.periods[2]
        assert mar.monthly_recurring_revenue == 100_00
        assert mar.committed_monthly_recurring_revenue == 100_00

    @pytest.mark.auth
    async def test_mrr_subscription_forever_discount(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        user: User,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        The MRR of a subscription with a forever discount should be the discounted price.
        """
        discounts: dict[str, DiscountFixture] = {
            "discount": {
                "basis_points": 5_000,
                "duration": DiscountDuration.forever,
                "duration_in_months": 3,
            }
        }
        subscriptions: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
                "discount": "discount",
            }
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, subscriptions, {}, discounts
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 2, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 2

        jan = metrics.periods[0]
        assert jan.monthly_recurring_revenue == 50_00

        feb = metrics.periods[1]
        assert feb.monthly_recurring_revenue == 50_00

    @pytest.mark.auth
    async def test_values_unpaid_orders(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        orders: dict[str, OrderFixture] = {
            "order_1": {
                "created_at": date(2024, 1, 1),
                "amount": 100_00,
                "product": "one_time_product",
                "status": OrderStatus.paid,
            },
            "order_2": {
                "created_at": date(2024, 1, 1),
                "amount": 100_00,
                "product": "one_time_product",
                "status": OrderStatus.refunded,
            },
            "order_3": {
                "created_at": date(2024, 1, 1),
                "amount": 100_00,
                "product": "one_time_product",
                "status": OrderStatus.pending,
            },
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, {}, orders
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
        )

        assert len(metrics.periods) == 1

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 2
        assert jan_1.revenue == 200_00
        assert jan_1.cumulative_revenue == 200_00
        assert jan_1.average_order_value == 100_00
        assert jan_1.one_time_products == 2
        assert jan_1.one_time_products_revenue == 200_00
        assert jan_1.new_subscriptions == 0
        assert jan_1.new_subscriptions_revenue == 0
        assert jan_1.renewed_subscriptions == 0
        assert jan_1.renewed_subscriptions_revenue == 0
        assert jan_1.active_subscriptions == 0
        assert jan_1.monthly_recurring_revenue == 0

    @pytest.mark.auth
    async def test_values_costs(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                timestamp=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
                organization=organization,
                customer=customer,
                metadata={
                    "_cost": {
                        "amount": 0.000001,
                        "currency": "usd",
                    }
                },
            )
        ]

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
        )

        assert len(metrics.periods) == 1

        jan_1 = metrics.periods[0]
        assert jan_1.costs == 0.000001
        assert jan_1.cumulative_costs == 0.000001

    @pytest.mark.auth
    async def test_average_revenue_per_user(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        customer_second: Customer,
        organization: Organization,
    ) -> None:
        subscriptions_customer_1: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            }
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, subscriptions_customer_1, {}
        )

        subscriptions_customer_2: dict[str, SubscriptionFixture] = {
            "subscription_2": {
                "started_at": date(2024, 1, 1),
                "product": "yearly_subscription",
            }
        }
        await _create_fixtures(
            save_fixture,
            customer_second,
            organization,
            PRODUCTS,
            subscriptions_customer_2,
            {},
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 3

        jan = metrics.periods[0]
        assert jan.active_subscriptions == 2
        assert jan.monthly_recurring_revenue == 183_33
        assert jan.average_revenue_per_user == 91_66

        feb = metrics.periods[1]
        assert feb.active_subscriptions == 2
        assert feb.monthly_recurring_revenue == 183_33
        assert feb.average_revenue_per_user == 91_66

        mar = metrics.periods[2]
        assert mar.active_subscriptions == 2
        assert mar.monthly_recurring_revenue == 183_33
        assert mar.average_revenue_per_user == 91_66

        assert metrics.totals.average_revenue_per_user == 91_66

    @pytest.mark.auth
    async def test_average_revenue_per_user_no_customers(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 1

        jan = metrics.periods[0]
        assert jan.active_subscriptions == 0
        assert jan.monthly_recurring_revenue == 0
        assert jan.average_revenue_per_user == 0

    @pytest.mark.auth
    async def test_cost_per_user(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        customer_second: Customer,
        organization: Organization,
    ) -> None:
        subscriptions_customer_1: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            }
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, subscriptions_customer_1, {}
        )

        subscriptions_customer_2: dict[str, SubscriptionFixture] = {
            "subscription_2": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            }
        }
        await _create_fixtures(
            save_fixture,
            customer_second,
            organization,
            PRODUCTS,
            subscriptions_customer_2,
            {},
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=customer,
            metadata={
                "_cost": {
                    "amount": 0.50,
                    "currency": "usd",
                }
            },
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 14, 0, tzinfo=UTC),
            organization=organization,
            customer=customer_second,
            metadata={
                "_cost": {
                    "amount": 0.30,
                    "currency": "usd",
                }
            },
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 2, 1, 10, 0, tzinfo=UTC),
            organization=organization,
            customer=customer,
            metadata={
                "_cost": {
                    "amount": 0.20,
                    "currency": "usd",
                }
            },
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 2, 1, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=customer_second,
            metadata={
                "_cost": {
                    "amount": 0.00,
                    "currency": "usd",
                }
            },
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 3

        jan = metrics.periods[0]
        assert jan.costs == 0.80
        assert jan.active_subscriptions == 2
        assert jan.cost_per_user == 0.4

        feb = metrics.periods[1]
        assert feb.costs == 0.20
        assert feb.active_subscriptions == 2
        assert feb.cost_per_user == 0.1

        mar = metrics.periods[2]
        assert mar.costs == 0
        assert mar.active_subscriptions == 2
        assert mar.cost_per_user == 0

        assert metrics.totals.cost_per_user == 0.5

    @pytest.mark.auth
    async def test_gross_margin(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        customer_second: Customer,
        organization: Organization,
    ) -> None:
        subscriptions_customer_1: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            }
        }
        orders_customer_1: dict[str, OrderFixture] = {
            "order_1": {
                "created_at": date(2024, 1, 1),
                "product": "monthly_subscription",
                "subscription": "subscription_1",
                "amount": 10000,
                "status": OrderStatus.paid,
            }
        }
        await _create_fixtures(
            save_fixture,
            customer,
            organization,
            PRODUCTS,
            subscriptions_customer_1,
            orders_customer_1,
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 10, 0, tzinfo=UTC),
            organization=organization,
            customer=customer,
            name="order.paid",
            source=EventSource.system,
            metadata={
                "amount": 10000,
            },
        )

        subscriptions_customer_2: dict[str, SubscriptionFixture] = {
            "subscription_2": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            }
        }
        orders_customer_2: dict[str, OrderFixture] = {
            "order_2": {
                "created_at": date(2024, 2, 1),
                "product": "monthly_subscription",
                "subscription": "subscription_2",
                "amount": 10000,
                "status": OrderStatus.paid,
            }
        }
        await _create_fixtures(
            save_fixture,
            customer_second,
            organization,
            PRODUCTS,
            subscriptions_customer_2,
            orders_customer_2,
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 2, 1, 10, 0, tzinfo=UTC),
            organization=organization,
            customer=customer_second,
            name="order.paid",
            source=EventSource.system,
            metadata={
                "amount": 10000,
            },
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 15, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=customer,
            metadata={
                "_cost": {
                    "amount": 25.00,
                    "currency": "usd",
                }
            },
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 2, 10, 10, 0, tzinfo=UTC),
            organization=organization,
            customer=customer_second,
            metadata={
                "_cost": {
                    "amount": 15.00,
                    "currency": "usd",
                }
            },
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 3

        jan = metrics.periods[0]
        assert jan.revenue == 10000
        assert jan.costs == 25.00
        assert jan.gross_margin == 9975.00

        feb = metrics.periods[1]
        assert feb.revenue == 10000
        assert feb.costs == 15.00
        assert feb.gross_margin == 19960.00

        mar = metrics.periods[2]
        assert mar.revenue == 0
        assert mar.costs == 0
        assert mar.gross_margin == 19960.00

        assert metrics.totals.gross_margin == 19960.00

    @pytest.mark.auth
    async def test_cost_per_user_no_costs(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
    ) -> None:
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 1

        jan = metrics.periods[0]
        assert jan.costs == 0
        assert jan.cost_per_user == 0

    @pytest.mark.auth
    async def test_churn_rate(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        subscriptions: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            },
            "subscription_2": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            },
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, subscriptions, {}
        )

        subscription_1 = (
            await session.execute(
                select(Subscription)
                .where(
                    Subscription.customer_id == customer.id,
                    Subscription.started_at == _date_to_datetime(date(2024, 1, 1)),
                )
                .limit(1)
            )
        ).scalar_one()
        subscription_1.canceled_at = _date_to_datetime(date(2024, 2, 15))
        subscription_1.ended_at = _date_to_datetime(date(2024, 3, 1))
        await save_fixture(subscription_1)

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
        )

        assert len(metrics.periods) == 3

        jan = metrics.periods[0]
        assert jan.active_subscriptions == 2
        assert jan.new_subscriptions == 2
        assert jan.canceled_subscriptions == 0
        assert jan.churned_subscriptions == 0
        assert jan.churn_rate == 0.0

        feb = metrics.periods[1]
        assert feb.active_subscriptions == 2
        assert feb.new_subscriptions == 0
        assert feb.canceled_subscriptions == 1
        assert feb.churned_subscriptions == 0
        assert feb.churn_rate == 0.5

        mar = metrics.periods[2]
        assert mar.active_subscriptions == 1
        assert mar.new_subscriptions == 0
        assert mar.canceled_subscriptions == 0
        assert mar.churned_subscriptions == 1
        assert mar.churn_rate == 0.0

    @pytest.mark.auth
    async def test_customer_filter_with_external_customer_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        customer_second: Customer,
        organization: Organization,
    ) -> None:
        # Set external_id on the first customer
        customer.external_id = "external_123"
        await save_fixture(customer)

        # Create cost events for customer via external_customer_id (NOT customer_id)
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=None,  # No direct customer_id link
            external_customer_id=customer.external_id,
            metadata={
                "_cost": {
                    "amount": 0.25,
                    "currency": "usd",
                }
            },
        )

        # Create another cost event via external_customer_id
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 2, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=None,  # No direct customer_id link
            external_customer_id=customer.external_id,
            metadata={
                "_cost": {
                    "amount": 0.35,
                    "currency": "usd",
                }
            },
        )

        # Create cost event for second customer via direct customer_id
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 14, 0, tzinfo=UTC),
            organization=organization,
            customer=customer_second,
            metadata={
                "_cost": {
                    "amount": 0.50,
                    "currency": "usd",
                }
            },
        )

        # Test filtering by first customer - should include external_customer_id events
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            customer_id=[customer.id],
        )

        assert len(metrics.periods) == 2

        jan_1 = metrics.periods[0]
        assert jan_1.costs == 0.25  # Only first customer's event

        jan_2 = metrics.periods[1]
        assert jan_2.costs == 0.35  # Only first customer's event

        # Test filtering by second customer - should only include direct FK events
        metrics_second = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            customer_id=[customer_second.id],
        )

        assert len(metrics_second.periods) == 2

        jan_1_second = metrics_second.periods[0]
        assert jan_1_second.costs == 0.50  # Only second customer's event

        jan_2_second = metrics_second.periods[1]
        assert jan_2_second.costs == 0  # No events on this day

        # Test without customer filter - should include all events
        metrics_all = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
        )

        assert len(metrics_all.periods) == 2

        jan_1_all = metrics_all.periods[0]
        assert jan_1_all.costs == 0.75  # 0.25 + 0.50

        jan_2_all = metrics_all.periods[1]
        assert jan_2_all.costs == 0.35

    @pytest.mark.auth
    async def test_customer_filter_null_external_id_safety(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        customer_second: Customer,
        organization: Organization,
    ) -> None:
        # Ensure both customers have NO external_id (NULL)
        customer.external_id = None
        customer_second.external_id = None
        await save_fixture(customer)
        await save_fixture(customer_second)

        # Create event with NULL external_customer_id for first customer
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=customer,
            external_customer_id=None,
            metadata={
                "_cost": {
                    "amount": 0.10,
                    "currency": "usd",
                }
            },
        )

        # Create another event with NULL external_customer_id, no customer_id link
        # This is an "orphaned" event that shouldn't match ANY customer filter
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 14, 0, tzinfo=UTC),
            organization=organization,
            customer=None,  # No direct link
            external_customer_id=None,  # NULL external_customer_id
            metadata={
                "_cost": {
                    "amount": 0.50,
                    "currency": "usd",
                }
            },
        )

        # Filter by first customer
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            customer_id=[customer.id],
        )

        assert len(metrics.periods) == 1

        jan_1 = metrics.periods[0]
        # Should ONLY include the event with direct customer_id link (0.10)
        # Should NOT include the orphaned event (0.50) even though both have NULL external_customer_id
        assert jan_1.costs == 0.10

        # Filter by second customer - should get nothing
        metrics_second = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            customer_id=[customer_second.id],
        )

        assert len(metrics_second.periods) == 1
        jan_1_second = metrics_second.periods[0]
        assert jan_1_second.costs == 0  # No events for this customer

        # Without filter should include all events
        metrics_all = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
        )

        assert len(metrics_all.periods) == 1
        jan_1_all = metrics_all.periods[0]
        assert jan_1_all.costs == 0.60  # Both events: 0.10 + 0.50


@pytest.mark.asyncio
class TestMetricsFiltering:
    """Tests for the metrics parameter filtering functionality."""

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metrics_filters_response(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test that metrics filters the metrics in the response."""
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["revenue", "orders"],
        )

        assert len(metrics.periods) == 31

        # Requested metrics should have values
        jan_1 = metrics.periods[0]
        assert jan_1.orders == 3
        assert jan_1.revenue == 1200_00

        # Non-requested metrics should be None
        assert jan_1.checkouts is None
        assert jan_1.active_subscriptions is None

        # Totals: requested metrics have values, others are None
        assert metrics.totals.revenue is not None
        assert metrics.totals.orders is not None
        assert metrics.totals.checkouts is None

        # Metrics info should be populated for requested metrics
        assert metrics.metrics.revenue is not None
        assert metrics.metrics.orders is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metrics_single_metric(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test that a single metric works correctly."""
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["active_subscriptions"],
        )

        assert len(metrics.periods) == 31

        jan_1 = metrics.periods[0]
        assert jan_1.active_subscriptions == 2

        assert metrics.metrics.active_subscriptions is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    @pytest.mark.parametrize(
        ("metric_slugs", "expected_metric"),
        [
            (["gross_margin"], "gross_margin"),
            (["gross_margin_percentage"], "gross_margin_percentage"),
            (["cashflow"], "cashflow"),
            (["churn_rate"], "churn_rate"),
            (["ltv"], "ltv"),
        ],
    )
    async def test_metrics_meta_metrics(
        self,
        metric_slugs: list[str],
        expected_metric: str,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test that meta metrics (post-compute) can be requested and computed."""
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
            metrics=metric_slugs,
        )

        assert len(metrics.periods) == 12
        assert getattr(metrics.metrics, expected_metric) is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metrics_gross_margin_dependencies(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test that gross_margin properly resolves its dependencies (revenue, costs)."""
        # Using the standard fixtures which have orders with revenue
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
            metrics=["gross_margin"],
        )

        assert len(metrics.periods) == 12
        # gross_margin metric info should be populated
        assert metrics.metrics.gross_margin is not None
        # The first period should have gross_margin computed from fixtures
        jan = metrics.periods[0]
        # Requested metric should have value
        assert jan.gross_margin is not None
        # Dependencies are computed internally but should be None in response
        assert jan.cumulative_revenue is None
        # gross_margin should be positive (fixtures have revenue, no costs)
        assert jan.gross_margin > 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metrics_churn_rate_dependencies(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test that churn_rate properly resolves its dependencies."""
        subscriptions: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "product": "free_subscription",
            },
            "subscription_2": {
                "started_at": date(2024, 1, 1),
                "ended_at": date(2024, 1, 15),
                "product": "free_subscription",
            },
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, subscriptions, {}
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
            metrics=["churn_rate"],
        )

        assert len(metrics.periods) == 1
        assert metrics.metrics.churn_rate is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metrics_none_returns_all(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test that metrics=None returns all metrics (backward compatible)."""
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=None,
        )

        assert len(metrics.periods) == 31

        # All metrics should be populated
        assert metrics.metrics.revenue is not None
        assert metrics.metrics.orders is not None
        assert metrics.metrics.active_subscriptions is not None
        assert metrics.metrics.gross_margin is not None
        assert metrics.metrics.churn_rate is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metrics_ltv_recursive_dependencies(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Test that LTV properly resolves recursive dependencies.

        LTV depends on churn_rate (a meta metric), which depends on
        active_subscriptions, new_subscriptions, churned_subscriptions,
        and canceled_subscriptions.
        """
        subscriptions: dict[str, SubscriptionFixture] = {
            "subscription_1": {
                "started_at": date(2024, 1, 1),
                "product": "monthly_subscription",
            },
        }
        orders: dict[str, OrderFixture] = {
            "order_1": {
                "created_at": date(2024, 1, 1),
                "product": "monthly_subscription",
                "subscription": "subscription_1",
                "amount": 100_00,
                "status": OrderStatus.paid,
            }
        }
        await _create_fixtures(
            save_fixture, customer, organization, PRODUCTS, subscriptions, orders
        )

        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 15, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=customer,
            metadata={
                "_cost": {
                    "amount": 5.00,
                    "currency": "usd",
                }
            },
        )

        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
            metrics=["ltv"],
        )

        assert len(metrics.periods) == 1
        assert metrics.metrics.ltv is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    @pytest.mark.parametrize(
        "metric_slugs",
        [
            ["revenue"],
            ["orders"],
            ["active_subscriptions"],
            ["checkouts"],
            ["canceled_subscriptions"],
            ["churned_subscriptions"],
        ],
    )
    async def test_metrics_sql_metrics(
        self,
        metric_slugs: list[str],
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test that different SQL metrics can be individually requested."""
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=metric_slugs,
        )

        assert len(metrics.periods) == 31
        assert getattr(metrics.metrics, metric_slugs[0]) is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metrics_multiple_different_queries(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test requesting metrics from different query sources."""
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=[
                "revenue",  # orders query
                "active_subscriptions",  # subscriptions query
                "checkouts",  # checkouts query
            ],
        )

        assert len(metrics.periods) == 31

        # All requested metrics should be available
        assert metrics.metrics.revenue is not None
        assert metrics.metrics.active_subscriptions is not None
        assert metrics.metrics.checkouts is not None

        # Verify data is correct
        jan_1 = metrics.periods[0]
        assert jan_1.revenue == 1200_00
        assert jan_1.active_subscriptions == 2

    @pytest.mark.auth
    async def test_metrics_cumulative_with_none_values(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test that cumulative calculations handle None values from metrics filtering.

        When metrics filters out dependencies, cumulative functions must handle
        None values gracefully instead of raising TypeError.
        """
        # Test cost_per_user which depends on costs and active_subscriptions
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["cost_per_user"],
        )

        # Should not raise TypeError and should return valid totals
        assert metrics.totals.cost_per_user is not None

    @pytest.mark.auth
    async def test_metrics_average_order_value_cumulative(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test average_order_value cumulative handles None values."""
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["average_order_value"],
        )

        assert metrics.totals.average_order_value is not None

    @pytest.mark.auth
    async def test_metrics_checkouts_conversion_cumulative(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        fixtures: tuple[dict[str, Product], dict[str, Subscription], dict[str, Order]],
    ) -> None:
        """Test checkouts_conversion cumulative handles None values."""
        metrics = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["checkouts_conversion"],
        )

        assert metrics.totals.checkouts_conversion is not None
