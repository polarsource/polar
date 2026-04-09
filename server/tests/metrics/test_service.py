from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, NotRequired, TypedDict
from uuid import UUID
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import registry as entities_registry
from sqlalchemy.schema import CreateSequence
from sqlalchemy_utils import create_database, database_exists, drop_database

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.config import settings
from polar.enums import SubscriptionRecurringInterval
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, _event_to_tinybird
from polar.kit.db.postgres import create_async_engine, create_async_sessionmaker
from polar.kit.time_queries import TimeInterval
from polar.metrics.service import metrics as metrics_service
from polar.models import (
    Customer,
    Discount,
    Event,
    Model,
    Order,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.event import EventSource
from polar.models.order import OrderStatus
from polar.models.product import ProductBillingType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture, get_database_url, save_fixture_factory
from tests.fixtures.random_objects import (
    create_account,
    create_checkout,
    create_customer,
    create_discount,
    create_event,
    create_order,
    create_organization,
    create_payment_transaction,
    create_product,
    create_subscription,
    create_user,
)
from tests.fixtures.tinybird import tinybird_available
from tests.metrics.conftest import create_events_for_fixtures

pytestmark = pytest.mark.xdist_group(name="tinybird")


class ProductFixture(TypedDict):
    recurring_interval: SubscriptionRecurringInterval | None
    prices: list[tuple[int, str] | tuple[None, str]]


class DiscountFixture(TypedDict):
    basis_points: int
    duration: DiscountDuration
    duration_in_months: NotRequired[int]


class SubscriptionFixture(TypedDict):
    started_at: date
    ended_at: NotRequired[date]
    ends_at: NotRequired[date]
    trial_start: NotRequired[date]
    trial_end: NotRequired[date]
    product: str
    discount: NotRequired[str]


class OrderFixture(TypedDict):
    created_at: date
    amount: int
    product: str
    status: OrderStatus
    subscription: NotRequired[str]


def _date_to_datetime(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=UTC)


PRODUCTS: dict[str, ProductFixture] = {
    "one_time_product": {
        "recurring_interval": None,
        "prices": [(100_00, "usd")],
    },
    "monthly_subscription": {
        "recurring_interval": SubscriptionRecurringInterval.month,
        "prices": [(100_00, "usd")],
    },
    "yearly_subscription": {
        "recurring_interval": SubscriptionRecurringInterval.year,
        "prices": [(1000_00, "usd")],
    },
    "free_subscription": {
        "recurring_interval": SubscriptionRecurringInterval.month,
        "prices": [(None, "usd")],
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
        trial_start = (
            _date_to_datetime(subscription_fixture["trial_start"])
            if "trial_start" in subscription_fixture
            else None
        )
        trial_end = (
            _date_to_datetime(subscription_fixture["trial_end"])
            if "trial_end" in subscription_fixture
            else None
        )
        status = (
            SubscriptionStatus.trialing
            if trial_end is not None
            else SubscriptionStatus.active
        )
        subscription = await create_subscription(
            save_fixture,
            product=products[subscription_fixture["product"]],
            customer=customer,
            status=status,
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
            trial_start=trial_start,
            trial_end=trial_end,
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


async def _create_payment_transaction_with_fx(
    save_fixture: SaveFixture,
    *,
    order: Order,
    amount: int,
    presentment_amount: int,
    presentment_currency: str,
    exchange_rate: float | None = None,
) -> None:
    transaction = await create_payment_transaction(
        save_fixture,
        order=order,
        amount=amount,
        currency="usd",
    )
    transaction.presentment_amount = presentment_amount
    transaction.presentment_currency = presentment_currency
    transaction.exchange_rate = exchange_rate
    await save_fixture(transaction)


async def _append_fixture_events(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    products: dict[str, Product],
    subscriptions: dict[str, Subscription],
    orders: dict[str, Order],
    *,
    events: list[Event],
) -> None:
    events.extend(
        await create_events_for_fixtures(
            save_fixture, organization, customer, products, subscriptions, orders
        )
    )


@dataclass(frozen=True)
class QueryCase:
    label: str
    org_key: str
    start_date: date
    end_date: date
    interval: TimeInterval
    timezone: str = "UTC"
    auth_type: str = "user"
    product_keys: tuple[str, ...] = ()
    billing_types: tuple[ProductBillingType, ...] = ()
    customer_keys: tuple[str, ...] = ()
    metrics: tuple[str, ...] | None = None
    now: datetime | None = None
    organization_id_filter: bool = False


@dataclass
class OrganizationContext:
    organization: Organization
    product_ids: dict[str, UUID]
    customer_ids: dict[str, UUID]


@dataclass
class MetricsHarness:
    sessionmaker: Any
    organizations: dict[str, OrganizationContext]
    user: User
    unauthorized_user: User


@dataclass
class CheckoutMetricsContext:
    organization: Organization
    user: User


@dataclass
class CheckoutMetricsHarness:
    sessionmaker: Any
    scenarios: dict[str, CheckoutMetricsContext]


QUERY_CASES: tuple[QueryCase, ...] = (
    # --- shared org: intervals (user auth only) ---
    QueryCase(
        label="intervals_year",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.year,
        auth_type="user",
    ),
    QueryCase(
        label="intervals_month",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="intervals_week",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.week,
        auth_type="user",
    ),
    QueryCase(
        label="intervals_day",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        auth_type="user",
    ),
    QueryCase(
        label="intervals_hour",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.hour,
        auth_type="user",
    ),
    # --- shared org: timezones (user + org) ---
    QueryCase(
        label="timezones__user",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 30),
        interval=TimeInterval.day,
        timezone="Europe/Paris",
        auth_type="user",
    ),
    QueryCase(
        label="timezones__org",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 30),
        interval=TimeInterval.day,
        timezone="Europe/Paris",
        auth_type="organization",
    ),
    # --- shared org: values (user + org) ---
    QueryCase(
        label="values__user",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        auth_type="user",
    ),
    QueryCase(
        label="values__org",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        auth_type="organization",
    ),
    # --- shared org: values_mid_month (user + org) ---
    QueryCase(
        label="values_mid_month__user",
        org_key="shared",
        start_date=date(2024, 1, 11),
        end_date=date(2024, 6, 15),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="values_mid_month__org",
        org_key="shared",
        start_date=date(2024, 1, 11),
        end_date=date(2024, 6, 15),
        interval=TimeInterval.month,
        auth_type="organization",
    ),
    # --- shared org: values_mid_year (user + org) ---
    QueryCase(
        label="values_mid_year__user",
        org_key="shared",
        start_date=date(2023, 6, 15),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.year,
        auth_type="user",
    ),
    QueryCase(
        label="values_mid_year__org",
        org_key="shared",
        start_date=date(2023, 6, 15),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.year,
        auth_type="organization",
    ),
    # --- shared org: not_authorized ---
    QueryCase(
        label="not_authorized",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        auth_type="user_unauthorized",
    ),
    # --- shared org: product_filter (user + org) ---
    QueryCase(
        label="product_filter__user",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        product_keys=("one_time_product",),
        auth_type="user",
    ),
    QueryCase(
        label="product_filter__org",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        product_keys=("one_time_product",),
        auth_type="organization",
    ),
    # --- shared org: billing_type_filter (user + org) ---
    QueryCase(
        label="billing_type_filter__user",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        billing_types=(ProductBillingType.one_time,),
        auth_type="user",
    ),
    QueryCase(
        label="billing_type_filter__org",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        billing_types=(ProductBillingType.one_time,),
        auth_type="organization",
    ),
    # --- shared org: values_year (user only) ---
    QueryCase(
        label="values_year__user",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.year,
        auth_type="user",
    ),
    # --- custom orgs ---
    QueryCase(
        label="free_subscription",
        org_key="free_subscription",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        interval=TimeInterval.day,
        auth_type="user",
    ),
    QueryCase(
        label="canceled_during_interval",
        org_key="canceled_during_interval",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 1),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="due_cancellation",
        org_key="due_cancellation",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 1),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="committed_mrr",
        org_key="committed_mrr",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 1),
        interval=TimeInterval.month,
        now=datetime(2024, 2, 15, tzinfo=UTC),
        auth_type="user",
    ),
    QueryCase(
        label="trial_excluded_from_mrr",
        org_key="trial_excluded_from_mrr",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 1),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="mrr_forever_discount",
        org_key="mrr_forever_discount",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 1),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="unpaid_orders",
        org_key="unpaid_orders",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 1),
        interval=TimeInterval.day,
        auth_type="user",
    ),
    QueryCase(
        label="costs",
        org_key="costs",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 1),
        interval=TimeInterval.day,
        auth_type="user",
    ),
    QueryCase(
        label="arpu",
        org_key="arpu",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 1),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="mrr_interval_count_3mo",
        org_key="mrr_interval_count_3mo",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="mrr_interval_count_2yr",
        org_key="mrr_interval_count_2yr",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="mrr_interval_count_2wk",
        org_key="mrr_interval_count_2wk",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="fx_multi_currency",
        org_key="fx_multi_currency",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 29),
        interval=TimeInterval.month,
        metrics=(
            "monthly_recurring_revenue",
            "committed_monthly_recurring_revenue",
            "average_revenue_per_user",
        ),
        now=datetime(2024, 2, 15, tzinfo=UTC),
        auth_type="user",
    ),
    QueryCase(
        label="fx_identity",
        org_key="fx_identity",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 29),
        interval=TimeInterval.month,
        metrics=(
            "monthly_recurring_revenue",
            "committed_monthly_recurring_revenue",
            "average_revenue_per_user",
        ),
        now=datetime(2024, 2, 15, tzinfo=UTC),
        auth_type="user",
    ),
    QueryCase(
        label="arpu_no_customers",
        org_key="arpu_no_customers",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="cost_per_user",
        org_key="cost_per_user",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 1),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="gross_margin",
        org_key="gross_margin",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 1),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="cost_per_user_no_costs",
        org_key="cost_per_user_no_costs",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="churn_rate",
        org_key="churn_rate",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 1),
        interval=TimeInterval.month,
        auth_type="user",
    ),
    QueryCase(
        label="churn_rate_rolling",
        org_key="churn_rate_rolling",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 15),
        interval=TimeInterval.day,
        auth_type="user",
    ),
    QueryCase(
        label="churn_rate_yearly",
        org_key="churn_rate_rolling",
        start_date=date(2024, 1, 1),
        end_date=date(2025, 12, 31),
        interval=TimeInterval.year,
        auth_type="user",
    ),
    QueryCase(
        label="customer_filter_external_c1",
        org_key="customer_filter_external",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 2),
        interval=TimeInterval.day,
        customer_keys=("c1",),
        auth_type="user",
    ),
    QueryCase(
        label="customer_filter_external_c2",
        org_key="customer_filter_external",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 2),
        interval=TimeInterval.day,
        customer_keys=("c2",),
        auth_type="user",
    ),
    QueryCase(
        label="customer_filter_external_all",
        org_key="customer_filter_external",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 2),
        interval=TimeInterval.day,
        auth_type="user",
    ),
    QueryCase(
        label="customer_filter_null_c1",
        org_key="customer_filter_null",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 1),
        interval=TimeInterval.day,
        customer_keys=("c1",),
        auth_type="user",
    ),
    QueryCase(
        label="customer_filter_null_c2",
        org_key="customer_filter_null",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 1),
        interval=TimeInterval.day,
        customer_keys=("c2",),
        auth_type="user",
    ),
    QueryCase(
        label="customer_filter_null_all",
        org_key="customer_filter_null",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 1),
        interval=TimeInterval.day,
        auth_type="user",
    ),
    QueryCase(
        label="hourly_orders__user",
        org_key="hourly_orders",
        start_date=date(2024, 1, 15),
        end_date=date(2024, 1, 15),
        interval=TimeInterval.hour,
        auth_type="user",
    ),
    QueryCase(
        label="hourly_orders__org",
        org_key="hourly_orders",
        start_date=date(2024, 1, 15),
        end_date=date(2024, 1, 15),
        interval=TimeInterval.hour,
        auth_type="organization",
    ),
    QueryCase(
        label="sub_after_bounds",
        org_key="sub_after_bounds",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 11),
        interval=TimeInterval.month,
        organization_id_filter=True,
        auth_type="user",
    ),
)

QUERY_CASES_BY_LABEL: dict[str, QueryCase] = {case.label: case for case in QUERY_CASES}

FILTERING_AUTH_CASES: tuple[tuple[str, str], ...] = (
    ("user", "user"),
    ("org", "organization"),
)

FILTERING_META_METRICS: tuple[str, ...] = (
    "gross_margin",
    "gross_margin_percentage",
    "cashflow",
    "churn_rate",
    "ltv",
)

FILTERING_SQL_METRICS: tuple[str, ...] = (
    "revenue",
    "orders",
    "active_subscriptions",
    "checkouts",
    "canceled_subscriptions",
    "churned_subscriptions",
)

METRICS_FILTERING_QUERY_CASES: tuple[QueryCase, ...] = (
    *(
        QueryCase(
            label=f"metrics_filters_response__{auth_label}",
            org_key="shared",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            interval=TimeInterval.day,
            metrics=("revenue", "orders"),
            auth_type=auth_type,
        )
        for auth_label, auth_type in FILTERING_AUTH_CASES
    ),
    *(
        QueryCase(
            label=f"metrics_single_metric__{auth_label}",
            org_key="shared",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            interval=TimeInterval.day,
            metrics=("active_subscriptions",),
            auth_type=auth_type,
        )
        for auth_label, auth_type in FILTERING_AUTH_CASES
    ),
    *(
        QueryCase(
            label=f"metrics_meta_{metric_slug}__{auth_label}",
            org_key="shared",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            interval=TimeInterval.month,
            metrics=(metric_slug,),
            auth_type=auth_type,
        )
        for metric_slug in FILTERING_META_METRICS
        for auth_label, auth_type in FILTERING_AUTH_CASES
    ),
    *(
        QueryCase(
            label=f"metrics_churn_rate_dependencies__{auth_label}",
            org_key="filtering_churn_rate",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            interval=TimeInterval.month,
            metrics=("churn_rate",),
            auth_type=auth_type,
        )
        for auth_label, auth_type in FILTERING_AUTH_CASES
    ),
    *(
        QueryCase(
            label=f"metrics_none_returns_all__{auth_label}",
            org_key="shared",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            interval=TimeInterval.day,
            metrics=None,
            auth_type=auth_type,
        )
        for auth_label, auth_type in FILTERING_AUTH_CASES
    ),
    *(
        QueryCase(
            label=f"metrics_ltv_recursive_dependencies__{auth_label}",
            org_key="filtering_ltv",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            interval=TimeInterval.month,
            metrics=("ltv",),
            auth_type=auth_type,
        )
        for auth_label, auth_type in FILTERING_AUTH_CASES
    ),
    *(
        QueryCase(
            label=f"metrics_sql_{metric_slug}__{auth_label}",
            org_key="shared",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            interval=TimeInterval.day,
            metrics=(metric_slug,),
            auth_type=auth_type,
        )
        for metric_slug in FILTERING_SQL_METRICS
        for auth_label, auth_type in FILTERING_AUTH_CASES
    ),
    *(
        QueryCase(
            label=f"metrics_multiple_queries__{auth_label}",
            org_key="shared",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            interval=TimeInterval.day,
            metrics=("revenue", "active_subscriptions", "checkouts"),
            auth_type=auth_type,
        )
        for auth_label, auth_type in FILTERING_AUTH_CASES
    ),
    QueryCase(
        label="metrics_cumulative_cost_per_user",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.day,
        metrics=("cost_per_user",),
        auth_type="user",
    ),
    QueryCase(
        label="metrics_cumulative_average_order_value",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.day,
        metrics=("average_order_value",),
        auth_type="user",
    ),
    QueryCase(
        label="metrics_cumulative_checkouts_conversion",
        org_key="shared",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.day,
        metrics=("checkouts_conversion",),
        auth_type="user",
    ),
)

METRICS_FILTERING_QUERY_CASES_BY_LABEL: dict[str, QueryCase] = {
    case.label: case for case in METRICS_FILTERING_QUERY_CASES
}


async def _seed_shared(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    products, subscriptions, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, SUBSCRIPTIONS, ORDERS
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subscriptions,
        orders,
        events=events,
    )
    return (
        {k: v.id for k, v in products.items()},
        {"customer": customer.id},
    )


async def _seed_free_subscription(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    sub_fixtures: dict[str, SubscriptionFixture] = {
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
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, sub_fixtures, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_canceled_during_interval(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    sub_fixtures: dict[str, SubscriptionFixture] = {
        "subscription_1": {
            "started_at": date(2024, 1, 1),
            "ended_at": date(2024, 1, 15),
            "product": "free_subscription",
        },
    }
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, sub_fixtures, {}
    )
    subs["subscription_1"].canceled_at = datetime(2024, 1, 1, 0, 1, tzinfo=UTC)
    subs["subscription_1"].ends_at = _date_to_datetime(date(2024, 1, 15))
    await save_fixture(subs["subscription_1"])
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_due_cancellation(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    sub_fixtures: dict[str, SubscriptionFixture] = {
        "subscription_1": {
            "started_at": date(2024, 1, 1),
            "ends_at": date(2024, 3, 15),
            "product": "free_subscription",
        },
    }
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, sub_fixtures, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_committed_mrr(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    sub_fixtures: dict[str, SubscriptionFixture] = {
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
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, sub_fixtures, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_trial_excluded_from_mrr(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    sub_fixtures: dict[str, SubscriptionFixture] = {
        "active_subscription": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        },
        "trialing_subscription": {
            "started_at": date(2024, 1, 1),
            "trial_start": date(2024, 1, 1),
            "trial_end": date(2024, 3, 1),
            "product": "monthly_subscription",
        },
    }
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, sub_fixtures, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_mrr_forever_discount(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    discount_fixtures: dict[str, DiscountFixture] = {
        "discount": {
            "basis_points": 5_000,
            "duration": DiscountDuration.forever,
            "duration_in_months": 3,
        }
    }
    sub_fixtures: dict[str, SubscriptionFixture] = {
        "subscription_1": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
            "discount": "discount",
        }
    }
    products, subs, orders = await _create_fixtures(
        save_fixture,
        customer,
        organization,
        PRODUCTS,
        sub_fixtures,
        {},
        discount_fixtures,
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_unpaid_orders(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    order_fixtures: dict[str, OrderFixture] = {
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
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, {}, order_fixtures
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_costs(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    event = await create_event(
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
    events.append(event)
    return {}, {"customer": customer.id}


async def _seed_arpu(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    c1 = await create_customer(save_fixture, organization=organization)
    c2 = await create_customer(
        save_fixture, organization=organization, email="c2@example.com"
    )
    sub_c1: dict[str, SubscriptionFixture] = {
        "subscription_1": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        }
    }
    products1, subs1, orders1 = await _create_fixtures(
        save_fixture, c1, organization, PRODUCTS, sub_c1, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        c1,
        products1,
        subs1,
        orders1,
        events=events,
    )

    sub_c2: dict[str, SubscriptionFixture] = {
        "subscription_2": {
            "started_at": date(2024, 1, 1),
            "product": "yearly_subscription",
        }
    }
    products2, subs2, orders2 = await _create_fixtures(
        save_fixture, c2, organization, PRODUCTS, sub_c2, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        c2,
        products2,
        subs2,
        orders2,
        events=events,
    )
    all_product_ids = {k: v.id for k, v in products1.items()}
    all_product_ids.update({k: v.id for k, v in products2.items()})
    return all_product_ids, {"c1": c1.id, "c2": c2.id}


async def _seed_mrr_interval_count(
    save_fixture: SaveFixture,
    organization: Organization,
    recurring_interval: SubscriptionRecurringInterval,
    recurring_interval_count: int,
    amount: int,
    currency: str,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=recurring_interval,
        recurring_interval_count=recurring_interval_count,
        prices=[(amount, currency)],
    )
    subscription = await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        status=SubscriptionStatus.active,
        started_at=_date_to_datetime(date(2024, 1, 1)),
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        {"product": product},
        {"subscription": subscription},
        {},
        events=events,
    )
    return {"product": product.id}, {"customer": customer.id}


async def _seed_fx_multi_currency(
    save_fixture: SaveFixture,
    organization: Organization,
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    c1 = await create_customer(save_fixture, organization=organization)
    c2 = await create_customer(
        save_fixture, organization=organization, email="c2fx@example.com"
    )

    product_eur = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(100_00, "eur")],
    )
    product_gbp = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(100_00, "gbp")],
    )

    subscription_eur = await create_subscription(
        save_fixture,
        product=product_eur,
        currency="eur",
        customer=c1,
        status=SubscriptionStatus.active,
        started_at=_date_to_datetime(date(2024, 1, 1)),
    )
    subscription_gbp = await create_subscription(
        save_fixture,
        product=product_gbp,
        currency="gbp",
        customer=c2,
        status=SubscriptionStatus.active,
        started_at=_date_to_datetime(date(2024, 1, 1)),
    )

    order_eur_jan_a = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product_eur,
        customer=c1,
        subscription=subscription_eur,
        subtotal_amount=100_00,
        created_at=_date_to_datetime(date(2024, 1, 5)),
    )
    order_eur_jan_b = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product_eur,
        customer=c1,
        subscription=subscription_eur,
        subtotal_amount=100_00,
        created_at=_date_to_datetime(date(2024, 1, 7)),
    )
    order_gbp_jan = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product_gbp,
        customer=c2,
        subscription=subscription_gbp,
        subtotal_amount=100_00,
        created_at=_date_to_datetime(date(2024, 1, 6)),
    )
    order_eur_feb = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product_eur,
        customer=c1,
        subscription=subscription_eur,
        subtotal_amount=100_00,
        created_at=_date_to_datetime(date(2024, 2, 5)),
    )
    order_gbp_feb = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product_gbp,
        customer=c2,
        subscription=subscription_gbp,
        subtotal_amount=100_00,
        created_at=_date_to_datetime(date(2024, 2, 6)),
    )

    await _create_payment_transaction_with_fx(
        save_fixture,
        order=order_eur_jan_a,
        amount=200_00,
        presentment_amount=100_00,
        presentment_currency="eur",
        exchange_rate=2.0,
    )
    await _create_payment_transaction_with_fx(
        save_fixture,
        order=order_eur_jan_b,
        amount=400_00,
        presentment_amount=100_00,
        presentment_currency="eur",
        exchange_rate=4.0,
    )
    await _create_payment_transaction_with_fx(
        save_fixture,
        order=order_gbp_jan,
        amount=500_00,
        presentment_amount=100_00,
        presentment_currency="gbp",
        exchange_rate=5.0,
    )
    await _create_payment_transaction_with_fx(
        save_fixture,
        order=order_eur_feb,
        amount=100_00,
        presentment_amount=100_00,
        presentment_currency="eur",
        exchange_rate=1.0,
    )
    await _create_payment_transaction_with_fx(
        save_fixture,
        order=order_gbp_feb,
        amount=200_00,
        presentment_amount=100_00,
        presentment_currency="gbp",
        exchange_rate=2.0,
    )

    return (
        {"product_eur": product_eur.id, "product_gbp": product_gbp.id},
        {"c1": c1.id, "c2": c2.id},
    )


async def _seed_fx_identity(
    save_fixture: SaveFixture,
    organization: Organization,
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(100_00, "eur")],
    )
    subscription = await create_subscription(
        save_fixture,
        product=product,
        currency="eur",
        customer=customer,
        status=SubscriptionStatus.active,
        started_at=_date_to_datetime(date(2024, 1, 1)),
    )
    january_order = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product,
        customer=customer,
        subscription=subscription,
        subtotal_amount=100_00,
        created_at=_date_to_datetime(date(2024, 1, 5)),
    )
    await _create_payment_transaction_with_fx(
        save_fixture,
        order=january_order,
        amount=200_00,
        presentment_amount=100_00,
        presentment_currency="eur",
        exchange_rate=2.0,
    )
    return {"product": product.id}, {"customer": customer.id}


async def _seed_cost_per_user(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    c1 = await create_customer(save_fixture, organization=organization)
    c2 = await create_customer(
        save_fixture, organization=organization, email="cpu2@example.com"
    )

    sub_c1: dict[str, SubscriptionFixture] = {
        "subscription_1": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        }
    }
    products1, subs1, orders1 = await _create_fixtures(
        save_fixture, c1, organization, PRODUCTS, sub_c1, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        c1,
        products1,
        subs1,
        orders1,
        events=events,
    )

    sub_c2: dict[str, SubscriptionFixture] = {
        "subscription_2": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        }
    }
    products2, subs2, orders2 = await _create_fixtures(
        save_fixture, c2, organization, PRODUCTS, sub_c2, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        c2,
        products2,
        subs2,
        orders2,
        events=events,
    )

    cost_events = [
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=c1,
            metadata={"_cost": {"amount": 0.50, "currency": "usd"}},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 14, 0, tzinfo=UTC),
            organization=organization,
            customer=c2,
            metadata={"_cost": {"amount": 0.30, "currency": "usd"}},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 2, 1, 10, 0, tzinfo=UTC),
            organization=organization,
            customer=c1,
            metadata={"_cost": {"amount": 0.20, "currency": "usd"}},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 2, 1, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=c2,
            metadata={"_cost": {"amount": 0.00, "currency": "usd"}},
        ),
    ]
    events.extend(cost_events)

    all_product_ids = {k: v.id for k, v in products1.items()}
    all_product_ids.update({k: v.id for k, v in products2.items()})
    return all_product_ids, {"c1": c1.id, "c2": c2.id}


async def _seed_gross_margin(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    c1 = await create_customer(save_fixture, organization=organization)
    c2 = await create_customer(
        save_fixture, organization=organization, email="gm2@example.com"
    )

    sub_c1: dict[str, SubscriptionFixture] = {
        "subscription_1": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        }
    }
    order_c1: dict[str, OrderFixture] = {
        "order_1": {
            "created_at": date(2024, 1, 1),
            "product": "monthly_subscription",
            "subscription": "subscription_1",
            "amount": 10000,
            "status": OrderStatus.paid,
        }
    }
    products1, subs1, ords1 = await _create_fixtures(
        save_fixture, c1, organization, PRODUCTS, sub_c1, order_c1
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        c1,
        products1,
        subs1,
        ords1,
        events=events,
    )

    sub_c2: dict[str, SubscriptionFixture] = {
        "subscription_2": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        }
    }
    order_c2: dict[str, OrderFixture] = {
        "order_2": {
            "created_at": date(2024, 2, 1),
            "product": "monthly_subscription",
            "subscription": "subscription_2",
            "amount": 10000,
            "status": OrderStatus.paid,
        }
    }
    products2, subs2, ords2 = await _create_fixtures(
        save_fixture, c2, organization, PRODUCTS, sub_c2, order_c2
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        c2,
        products2,
        subs2,
        ords2,
        events=events,
    )

    extra_events = [
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 10, 0, tzinfo=UTC),
            organization=organization,
            customer=c1,
            name="order.paid",
            source=EventSource.system,
            metadata={"amount": 10000},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 2, 1, 10, 0, tzinfo=UTC),
            organization=organization,
            customer=c2,
            name="order.paid",
            source=EventSource.system,
            metadata={"amount": 10000},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 15, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=c1,
            metadata={"_cost": {"amount": 25.00, "currency": "usd"}},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 2, 10, 10, 0, tzinfo=UTC),
            organization=organization,
            customer=c2,
            metadata={"_cost": {"amount": 15.00, "currency": "usd"}},
        ),
    ]
    events.extend(extra_events)

    all_product_ids = {k: v.id for k, v in products1.items()}
    all_product_ids.update({k: v.id for k, v in products2.items()})
    return all_product_ids, {"c1": c1.id, "c2": c2.id}


async def _seed_churn_rate(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    sub_fixtures: dict[str, SubscriptionFixture] = {
        "subscription_1": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        },
        "subscription_2": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        },
    }
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, sub_fixtures, {}
    )
    subscription_1 = subs["subscription_1"]
    subscription_1.canceled_at = _date_to_datetime(date(2024, 2, 15))
    subscription_1.ends_at = _date_to_datetime(date(2024, 3, 1))
    subscription_1.ended_at = _date_to_datetime(date(2024, 3, 1))
    await save_fixture(subscription_1)
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_churn_rate_rolling(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    sub_fixtures: dict[str, SubscriptionFixture] = {
        "subscription_1": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        },
        "subscription_2": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        },
        "subscription_3": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        },
        "subscription_4": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        },
        "subscription_5": {
            "started_at": date(2024, 1, 1),
            "product": "monthly_subscription",
        },
    }
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, sub_fixtures, {}
    )
    subscription_1 = subs["subscription_1"]
    subscription_1.canceled_at = _date_to_datetime(date(2024, 2, 1))
    subscription_1.ends_at = _date_to_datetime(date(2024, 3, 1))
    subscription_1.ended_at = _date_to_datetime(date(2024, 3, 1))
    await save_fixture(subscription_1)
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_customer_filter_external(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    c1 = await create_customer(
        save_fixture, organization=organization, external_id="external_123"
    )
    c2 = await create_customer(
        save_fixture, organization=organization, email="cfe2@example.com"
    )

    cost_events = [
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=None,
            external_customer_id=c1.external_id,
            metadata={"_cost": {"amount": 0.25, "currency": "usd"}},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 2, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=None,
            external_customer_id=c1.external_id,
            metadata={"_cost": {"amount": 0.35, "currency": "usd"}},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 14, 0, tzinfo=UTC),
            organization=organization,
            customer=c2,
            metadata={"_cost": {"amount": 0.50, "currency": "usd"}},
        ),
    ]
    events.extend(cost_events)
    return {}, {"c1": c1.id, "c2": c2.id}


async def _seed_customer_filter_null(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    c1 = await create_customer(save_fixture, organization=organization)
    c1.external_id = None
    await save_fixture(c1)
    c2 = await create_customer(
        save_fixture, organization=organization, email="cfn2@example.com"
    )
    c2.external_id = None
    await save_fixture(c2)

    cost_events = [
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
            organization=organization,
            customer=c1,
            external_customer_id=None,
            metadata={"_cost": {"amount": 0.10, "currency": "usd"}},
        ),
        await create_event(
            save_fixture,
            timestamp=datetime(2024, 1, 1, 14, 0, tzinfo=UTC),
            organization=organization,
            customer=None,
            external_customer_id=None,
            metadata={"_cost": {"amount": 0.50, "currency": "usd"}},
        ),
    ]
    events.extend(cost_events)
    return {}, {"c1": c1.id, "c2": c2.id}


async def _seed_hourly_orders(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        prices=[(100_00, "usd")],
    )

    order1 = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product,
        customer=customer,
        subtotal_amount=100_00,
        created_at=datetime(2024, 1, 15, 6, 30, 0, tzinfo=UTC),
    )
    order2 = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product,
        customer=customer,
        subtotal_amount=200_00,
        created_at=datetime(2024, 1, 15, 22, 45, 0, tzinfo=UTC),
    )

    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        {"product": product},
        {},
        {"order1": order1, "order2": order2},
        events=events,
    )
    return {"product": product.id}, {"customer": customer.id}


async def _seed_sub_after_bounds(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
    sub_fixtures: dict[str, SubscriptionFixture] = {
        "subscription_within_bounds": {
            "started_at": date(2024, 2, 1),
            "product": "monthly_subscription",
        },
        "subscription_after_bounds": {
            "started_at": date(2024, 2, 15),
            "product": "monthly_subscription",
        },
    }
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, sub_fixtures, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {k: v.id for k, v in products.items()}, {"customer": customer.id}


async def _seed_filtering_churn_rate(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
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
    products, subs, orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, subscriptions, {}
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        orders,
        events=events,
    )
    return {key: product.id for key, product in products.items()}, {
        "customer": customer.id
    }


async def _seed_filtering_ltv(
    save_fixture: SaveFixture,
    organization: Organization,
    events: list[Event],
) -> tuple[dict[str, UUID], dict[str, UUID]]:
    customer = await create_customer(save_fixture, organization=organization)
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
        },
    }
    products, subs, seeded_orders = await _create_fixtures(
        save_fixture, customer, organization, PRODUCTS, subscriptions, orders
    )
    await _append_fixture_events(
        save_fixture,
        organization,
        customer,
        products,
        subs,
        seeded_orders,
        events=events,
    )
    events.append(
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
    )
    return {key: product.id for key, product in products.items()}, {
        "customer": customer.id
    }


async def _seed_checkout_historical(
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
    )
    await create_checkout(
        save_fixture,
        products=[product],
        analytics_metadata={},
        created_at=datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
    )
    await create_checkout(
        save_fixture,
        products=[product],
        analytics_metadata={},
        created_at=datetime(2024, 1, 20, 14, 0, tzinfo=UTC),
    )


async def _seed_checkout_after_cutoff(
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
    )
    await create_checkout(
        save_fixture,
        products=[product],
        created_at=datetime(2026, 2, 15, 9, 30, tzinfo=UTC),
        analytics_metadata={
            "opened_at": datetime(2026, 2, 15, 10, 0, tzinfo=UTC).isoformat()
        },
    )
    await create_checkout(
        save_fixture,
        products=[product],
        created_at=datetime(2026, 2, 15, 9, 0, tzinfo=UTC),
        analytics_metadata={},
    )
    await create_checkout(
        save_fixture,
        products=[product],
        created_at=datetime(2026, 2, 15, 8, 0, tzinfo=UTC),
    )


async def _seed_checkout_time_bucketing(
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
    )
    await create_checkout(
        save_fixture,
        products=[product],
        created_at=datetime(2026, 2, 20, 14, 0, tzinfo=UTC),
        analytics_metadata={
            "opened_at": datetime(2026, 2, 20, 14, 30, tzinfo=UTC).isoformat()
        },
    )


async def _seed_checkout_conversion_opened(
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
    )
    await create_checkout(
        save_fixture,
        products=[product],
        created_at=datetime(2026, 2, 15, 9, 30, tzinfo=UTC),
        analytics_metadata={
            "opened_at": datetime(2026, 2, 15, 10, 0, tzinfo=UTC).isoformat()
        },
    )
    await create_checkout(
        save_fixture,
        products=[product],
        status=CheckoutStatus.succeeded,
        created_at=datetime(2026, 2, 15, 10, 30, tzinfo=UTC),
        analytics_metadata={
            "opened_at": datetime(2026, 2, 15, 11, 0, tzinfo=UTC).isoformat()
        },
    )
    for i in range(3):
        await create_checkout(
            save_fixture,
            products=[product],
            created_at=datetime(2026, 2, 15, 12 + i, 0, tzinfo=UTC),
            analytics_metadata={},
        )


async def _seed_checkout_conversion_cumulative(
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
    )
    for _ in range(2):
        await create_checkout(
            save_fixture,
            products=[product],
            created_at=datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
            analytics_metadata={},
        )
    await create_checkout(
        save_fixture,
        products=[product],
        status=CheckoutStatus.succeeded,
        created_at=datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
        analytics_metadata={},
    )


async def _seed_checkout_outside_range(
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
    )
    await create_checkout(
        save_fixture,
        products=[product],
        created_at=datetime(2026, 2, 15, 9, 30, tzinfo=UTC),
        analytics_metadata={
            "opened_at": datetime(2026, 2, 15, 10, 0, tzinfo=UTC).isoformat()
        },
    )
    await create_checkout(
        save_fixture,
        products=[product],
        created_at=datetime(2026, 1, 25, 9, 30, tzinfo=UTC),
        analytics_metadata={
            "opened_at": datetime(2026, 1, 25, 10, 0, tzinfo=UTC).isoformat()
        },
    )
    await create_checkout(
        save_fixture,
        products=[product],
        created_at=datetime(2026, 3, 15, 9, 30, tzinfo=UTC),
        analytics_metadata={
            "opened_at": datetime(2026, 3, 15, 10, 0, tzinfo=UTC).isoformat()
        },
    )


def _checkout_auth_subject(
    context: CheckoutMetricsContext, auth: str
) -> AuthSubject[User | Organization]:
    if auth == "user":
        return AuthSubject(context.user, {Scope.metrics_read}, None)
    return AuthSubject(context.organization, {Scope.metrics_read}, None)


def _metrics_auth_subject(
    user: User,
    unauthorized_user: User,
    organization: Organization,
    auth_type: str,
) -> AuthSubject[User | Organization]:
    if auth_type == "user":
        return AuthSubject(user, {Scope.metrics_read}, None)
    if auth_type == "organization":
        return AuthSubject(organization, {Scope.metrics_read}, None)
    return AuthSubject(unauthorized_user, {Scope.metrics_read}, None)


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def metrics_module_database_url(worker_id: str) -> AsyncIterator[str]:
    # The harness commits shared seed data once for speed, so it can't use the
    # worker database that regular tests rely on transaction rollbacks to isolate.
    database_id = f"{worker_id}_metrics_service"
    sync_database_url = get_database_url(database_id, "psycopg2")

    if database_exists(sync_database_url):
        drop_database(sync_database_url)

    create_database(sync_database_url)

    async_database_url = get_database_url(database_id)
    engine = create_async_engine(
        dsn=async_database_url,
        application_name=f"test_{worker_id}_metrics_service_database",
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )

    try:
        async with engine.begin() as conn:
            await conn.execute(CreateSequence(Customer.short_id_sequence))
            for entity in entities_registry.entities():
                if isinstance(entity, PGTrigger):
                    continue
                await conn.execute(entity.to_sql_statement_create())
            await conn.run_sync(Model.metadata.create_all)
            for entity in entities_registry.entities():
                if not isinstance(entity, PGTrigger):
                    continue
                await conn.execute(entity.to_sql_statement_create())

        yield async_database_url
    finally:
        await engine.dispose()
        drop_database(sync_database_url)


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def metrics_harness(
    metrics_module_database_url: str,
    worker_id: str,
    tinybird_workspace: str,
    tinybird_clickhouse_token: str,
) -> AsyncIterator[MetricsHarness]:
    engine = create_async_engine(
        dsn=metrics_module_database_url,
        application_name=f"test_{worker_id}_metrics_service_harness",
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )
    session = create_async_sessionmaker(engine)()
    save_fixture = save_fixture_factory(session)

    tinybird_client = TinybirdClient(
        api_url=settings.TINYBIRD_API_URL,
        clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
        api_token=tinybird_workspace,
        read_token=tinybird_workspace,
        clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
        clickhouse_token=tinybird_clickhouse_token,
    )

    from unittest.mock import patch

    from polar.integrations.tinybird import service as tinybird_service
    from polar.metrics import queries_tinybird

    events: list[Event] = []
    organizations: dict[str, OrganizationContext] = {}
    sessionmaker = create_async_sessionmaker(engine)

    try:
        with (
            patch.object(tinybird_service, "client", tinybird_client),
            patch.object(queries_tinybird, "tinybird_client", tinybird_client),
        ):
            user = await create_user(save_fixture)
            unauthorized_user = await create_user(save_fixture)
            account = await create_account(save_fixture, user)

            async def make_org(key: str) -> Organization:
                org = await create_organization(save_fixture, account)
                uo = UserOrganization(user=user, organization=org)
                await save_fixture(uo)
                return org

            # --- shared ---
            shared_org = await make_org("shared")
            shared_products, shared_customers = await _seed_shared(
                save_fixture, shared_org, events
            )
            organizations["shared"] = OrganizationContext(
                organization=shared_org,
                product_ids=shared_products,
                customer_ids=shared_customers,
            )

            # --- free_subscription ---
            free_sub_org = await make_org("free_subscription")
            p, c = await _seed_free_subscription(save_fixture, free_sub_org, events)
            organizations["free_subscription"] = OrganizationContext(
                organization=free_sub_org, product_ids=p, customer_ids=c
            )

            # --- canceled_during_interval ---
            cdi_org = await make_org("canceled_during_interval")
            p, c = await _seed_canceled_during_interval(save_fixture, cdi_org, events)
            organizations["canceled_during_interval"] = OrganizationContext(
                organization=cdi_org, product_ids=p, customer_ids=c
            )

            # --- due_cancellation ---
            dc_org = await make_org("due_cancellation")
            p, c = await _seed_due_cancellation(save_fixture, dc_org, events)
            organizations["due_cancellation"] = OrganizationContext(
                organization=dc_org, product_ids=p, customer_ids=c
            )

            # --- committed_mrr ---
            cmrr_org = await make_org("committed_mrr")
            p, c = await _seed_committed_mrr(save_fixture, cmrr_org, events)
            organizations["committed_mrr"] = OrganizationContext(
                organization=cmrr_org, product_ids=p, customer_ids=c
            )

            # --- trial_excluded_from_mrr ---
            tefm_org = await make_org("trial_excluded_from_mrr")
            p, c = await _seed_trial_excluded_from_mrr(save_fixture, tefm_org, events)
            organizations["trial_excluded_from_mrr"] = OrganizationContext(
                organization=tefm_org, product_ids=p, customer_ids=c
            )

            # --- mrr_forever_discount ---
            mfd_org = await make_org("mrr_forever_discount")
            p, c = await _seed_mrr_forever_discount(save_fixture, mfd_org, events)
            organizations["mrr_forever_discount"] = OrganizationContext(
                organization=mfd_org, product_ids=p, customer_ids=c
            )

            # --- unpaid_orders ---
            uo_org = await make_org("unpaid_orders")
            p, c = await _seed_unpaid_orders(save_fixture, uo_org, events)
            organizations["unpaid_orders"] = OrganizationContext(
                organization=uo_org, product_ids=p, customer_ids=c
            )

            # --- costs ---
            costs_org = await make_org("costs")
            p, c = await _seed_costs(save_fixture, costs_org, events)
            organizations["costs"] = OrganizationContext(
                organization=costs_org, product_ids=p, customer_ids=c
            )

            # --- arpu ---
            arpu_org = await make_org("arpu")
            p, c = await _seed_arpu(save_fixture, arpu_org, events)
            organizations["arpu"] = OrganizationContext(
                organization=arpu_org, product_ids=p, customer_ids=c
            )

            # --- mrr_interval_count_3mo ---
            mic3_org = await make_org("mrr_interval_count_3mo")
            p, c = await _seed_mrr_interval_count(
                save_fixture,
                mic3_org,
                SubscriptionRecurringInterval.month,
                3,
                300_00,
                "usd",
                events,
            )
            organizations["mrr_interval_count_3mo"] = OrganizationContext(
                organization=mic3_org, product_ids=p, customer_ids=c
            )

            # --- mrr_interval_count_2yr ---
            mic2y_org = await make_org("mrr_interval_count_2yr")
            p, c = await _seed_mrr_interval_count(
                save_fixture,
                mic2y_org,
                SubscriptionRecurringInterval.year,
                2,
                2400_00,
                "usd",
                events,
            )
            organizations["mrr_interval_count_2yr"] = OrganizationContext(
                organization=mic2y_org, product_ids=p, customer_ids=c
            )

            # --- mrr_interval_count_2wk ---
            mic2w_org = await make_org("mrr_interval_count_2wk")
            p, c = await _seed_mrr_interval_count(
                save_fixture,
                mic2w_org,
                SubscriptionRecurringInterval.week,
                2,
                50_00,
                "usd",
                events,
            )
            organizations["mrr_interval_count_2wk"] = OrganizationContext(
                organization=mic2w_org, product_ids=p, customer_ids=c
            )

            # --- fx_multi_currency (no tinybird events) ---
            fxmc_org = await make_org("fx_multi_currency")
            p, c = await _seed_fx_multi_currency(save_fixture, fxmc_org)
            organizations["fx_multi_currency"] = OrganizationContext(
                organization=fxmc_org, product_ids=p, customer_ids=c
            )

            # --- fx_identity (no tinybird events) ---
            fxi_org = await make_org("fx_identity")
            p, c = await _seed_fx_identity(save_fixture, fxi_org)
            organizations["fx_identity"] = OrganizationContext(
                organization=fxi_org, product_ids=p, customer_ids=c
            )

            # --- arpu_no_customers ---
            anc_org = await make_org("arpu_no_customers")
            organizations["arpu_no_customers"] = OrganizationContext(
                organization=anc_org, product_ids={}, customer_ids={}
            )

            # --- cost_per_user ---
            cpu_org = await make_org("cost_per_user")
            p, c = await _seed_cost_per_user(save_fixture, cpu_org, events)
            organizations["cost_per_user"] = OrganizationContext(
                organization=cpu_org, product_ids=p, customer_ids=c
            )

            # --- gross_margin ---
            gm_org = await make_org("gross_margin")
            p, c = await _seed_gross_margin(save_fixture, gm_org, events)
            organizations["gross_margin"] = OrganizationContext(
                organization=gm_org, product_ids=p, customer_ids=c
            )

            # --- cost_per_user_no_costs ---
            cpnc_org = await make_org("cost_per_user_no_costs")
            organizations["cost_per_user_no_costs"] = OrganizationContext(
                organization=cpnc_org, product_ids={}, customer_ids={}
            )

            # --- churn_rate ---
            cr_org = await make_org("churn_rate")
            p, c = await _seed_churn_rate(save_fixture, cr_org, events)
            organizations["churn_rate"] = OrganizationContext(
                organization=cr_org, product_ids=p, customer_ids=c
            )

            # --- churn_rate_rolling ---
            crr_org = await make_org("churn_rate_rolling")
            p, c = await _seed_churn_rate_rolling(save_fixture, crr_org, events)
            organizations["churn_rate_rolling"] = OrganizationContext(
                organization=crr_org, product_ids=p, customer_ids=c
            )

            # --- customer_filter_external ---
            cfe_org = await make_org("customer_filter_external")
            p, c = await _seed_customer_filter_external(save_fixture, cfe_org, events)
            organizations["customer_filter_external"] = OrganizationContext(
                organization=cfe_org, product_ids=p, customer_ids=c
            )

            # --- customer_filter_null ---
            cfn_org = await make_org("customer_filter_null")
            p, c = await _seed_customer_filter_null(save_fixture, cfn_org, events)
            organizations["customer_filter_null"] = OrganizationContext(
                organization=cfn_org, product_ids=p, customer_ids=c
            )

            # --- hourly_orders ---
            ho_org = await make_org("hourly_orders")
            p, c = await _seed_hourly_orders(save_fixture, ho_org, events)
            organizations["hourly_orders"] = OrganizationContext(
                organization=ho_org, product_ids=p, customer_ids=c
            )

            # --- sub_after_bounds ---
            sab_org = await make_org("sub_after_bounds")
            p, c = await _seed_sub_after_bounds(save_fixture, sab_org, events)
            organizations["sub_after_bounds"] = OrganizationContext(
                organization=sab_org, product_ids=p, customer_ids=c
            )

            # --- filtering_churn_rate ---
            fcr_org = await make_org("filtering_churn_rate")
            p, c = await _seed_filtering_churn_rate(save_fixture, fcr_org, events)
            organizations["filtering_churn_rate"] = OrganizationContext(
                organization=fcr_org, product_ids=p, customer_ids=c
            )

            # --- filtering_ltv ---
            fltv_org = await make_org("filtering_ltv")
            p, c = await _seed_filtering_ltv(save_fixture, fltv_org, events)
            organizations["filtering_ltv"] = OrganizationContext(
                organization=fltv_org, product_ids=p, customer_ids=c
            )

            if events:
                await tinybird_client.ingest(
                    DATASOURCE_EVENTS,
                    [_event_to_tinybird(event) for event in events],
                    wait=True,
                )

            await session.commit()

            harness = MetricsHarness(
                sessionmaker=sessionmaker,
                organizations=organizations,
                user=user,
                unauthorized_user=unauthorized_user,
            )

            await session.close()
            yield harness
    finally:
        await session.close()
        await engine.dispose()


@pytest_asyncio.fixture(loop_scope="module")
async def metrics_session(
    metrics_harness: MetricsHarness,
) -> AsyncIterator[AsyncSession]:
    async with metrics_harness.sessionmaker() as session:
        yield session


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def checkout_metrics_harness(
    metrics_module_database_url: str,
    worker_id: str,
) -> AsyncIterator[CheckoutMetricsHarness]:
    engine = create_async_engine(
        dsn=metrics_module_database_url,
        application_name=f"test_{worker_id}_checkout_metrics_harness",
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )
    session = create_async_sessionmaker(engine)()
    save_fixture = save_fixture_factory(session)
    sessionmaker = create_async_sessionmaker(engine)
    scenarios: dict[str, CheckoutMetricsContext] = {}

    try:

        async def make_context(key: str) -> CheckoutMetricsContext:
            user = await create_user(save_fixture)
            account = await create_account(save_fixture, user)
            organization = await create_organization(save_fixture, account)
            await save_fixture(UserOrganization(user=user, organization=organization))
            context = CheckoutMetricsContext(organization=organization, user=user)
            scenarios[key] = context
            return context

        historical = await make_context("historical")
        await _seed_checkout_historical(save_fixture, historical.organization)

        after_cutoff = await make_context("after_cutoff")
        await _seed_checkout_after_cutoff(save_fixture, after_cutoff.organization)

        time_bucketing = await make_context("time_bucketing")
        await _seed_checkout_time_bucketing(save_fixture, time_bucketing.organization)

        conversion_opened = await make_context("conversion_opened")
        await _seed_checkout_conversion_opened(
            save_fixture, conversion_opened.organization
        )

        conversion_cumulative = await make_context("conversion_cumulative")
        await _seed_checkout_conversion_cumulative(
            save_fixture, conversion_cumulative.organization
        )

        outside_range = await make_context("outside_range")
        await _seed_checkout_outside_range(save_fixture, outside_range.organization)

        await session.commit()
        harness = CheckoutMetricsHarness(
            sessionmaker=sessionmaker,
            scenarios=scenarios,
        )
    finally:
        await session.close()

    try:
        yield harness
    finally:
        await engine.dispose()


@pytest_asyncio.fixture(loop_scope="module")
async def checkout_metrics_session(
    checkout_metrics_harness: CheckoutMetricsHarness,
) -> AsyncIterator[AsyncSession]:
    async with checkout_metrics_harness.sessionmaker() as session:
        yield session


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio(loop_scope="module")
class TestGetMetrics:
    @pytest.mark.parametrize(
        ("label", "expected_count"),
        [
            ("intervals_year", 1),
            ("intervals_month", 12),
            ("intervals_week", 53),
            ("intervals_day", 366),
            ("intervals_hour", 8784),
        ],
    )
    async def test_intervals(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        label: str,
        expected_count: int,
    ) -> None:
        case = QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )
        assert len(metrics.periods) == expected_count

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_timezones(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        label = f"timezones__{auth}"
        case = QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_values(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        label = f"values__{auth}"
        case = QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        jan_1 = metrics.periods[0]
        assert jan_1.orders == 3
        assert jan_1.revenue == 1200_00
        assert jan_1.cumulative_revenue == 1300_00
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

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_values_month_interval_mid_month_start(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        label = f"values_mid_month__{auth}"
        case = QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 6

        jan = metrics.periods[0]
        assert jan.orders == 0
        assert jan.revenue == 0
        assert jan.cumulative_revenue == 1300_00

        feb = metrics.periods[1]
        assert feb.orders == 1
        assert feb.revenue == 100_00
        assert feb.cumulative_revenue == 1400_00

        jun = metrics.periods[5]
        assert jun.orders == 1
        assert jun.revenue == 100_00
        assert jun.cumulative_revenue == 1500_00

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_values_year_interval_mid_year_start(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        label = f"values_mid_year__{auth}"
        case = QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 2

        year_2023 = metrics.periods[0]
        assert year_2023.orders == 0
        assert year_2023.revenue == 0
        assert year_2023.cumulative_revenue == 100_00

        year_2024 = metrics.periods[1]
        assert year_2024.orders == 5
        assert year_2024.revenue == 1400_00
        assert year_2024.cumulative_revenue == 1500_00

    async def test_not_authorized(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["not_authorized"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_product_filter(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        label = f"product_filter__{auth}"
        case = QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_billing_type_filter(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        label = f"billing_type_filter__{auth}"
        case = QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_values_year_interval(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["values_year__user"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_values_free_subscription(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["free_subscription"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_values_subscription_canceled_during_interval(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["canceled_during_interval"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_values_subscription_due_cancellation(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["due_cancellation"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_committed_mrr(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["committed_mrr"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_trial_excluded_from_mrr(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["trial_excluded_from_mrr"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 3

        # Jan & Feb: only the active sub counts; trialing sub excluded
        jan = metrics.periods[0]
        assert jan.monthly_recurring_revenue == 100_00

        feb = metrics.periods[1]
        assert feb.monthly_recurring_revenue == 100_00

        # Mar: trial ends in this bucket so both subs count
        mar = metrics.periods[2]
        assert mar.monthly_recurring_revenue == 200_00

    async def test_mrr_subscription_forever_discount(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["mrr_forever_discount"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 2

        jan = metrics.periods[0]
        assert jan.monthly_recurring_revenue == 50_00

        feb = metrics.periods[1]
        assert feb.monthly_recurring_revenue == 50_00

    async def test_values_unpaid_orders(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["unpaid_orders"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_values_costs(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["costs"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 1

        jan_1 = metrics.periods[0]
        assert jan_1.costs == 0.000001
        assert jan_1.cumulative_costs == 0.000001

    async def test_average_revenue_per_user(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["arpu"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 3

        jan = metrics.periods[0]
        assert jan.active_subscriptions == 2
        assert jan.monthly_recurring_revenue == 183_33
        assert jan.average_revenue_per_user == 91_67

        feb = metrics.periods[1]
        assert feb.active_subscriptions == 2
        assert feb.monthly_recurring_revenue == 183_33
        assert feb.average_revenue_per_user == 91_67

        mar = metrics.periods[2]
        assert mar.active_subscriptions == 2
        assert mar.monthly_recurring_revenue == 183_33
        assert mar.average_revenue_per_user == 91_67

        assert metrics.totals.average_revenue_per_user == 91_67

    async def test_mrr_with_recurring_interval_count_3mo(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["mrr_interval_count_3mo"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 1

        jan = metrics.periods[0]
        assert jan.active_subscriptions == 1
        assert jan.monthly_recurring_revenue == 100_00
        assert jan.average_revenue_per_user == 100_00

    async def test_mrr_with_recurring_interval_count_2yr(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["mrr_interval_count_2yr"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 1

        jan = metrics.periods[0]
        assert jan.active_subscriptions == 1
        assert jan.monthly_recurring_revenue == 100_00
        assert jan.average_revenue_per_user == 100_00

    async def test_mrr_with_recurring_interval_count_2wk(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["mrr_interval_count_2wk"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 1

        jan = metrics.periods[0]
        assert jan.active_subscriptions == 1
        assert jan.monthly_recurring_revenue == 108_33
        assert jan.average_revenue_per_user == 108_33

    async def test_mrr_uses_per_currency_per_bucket_average_exchange_rate(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["fx_multi_currency"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 2

        jan = metrics.periods[0]
        assert jan.monthly_recurring_revenue == 800_00
        assert jan.committed_monthly_recurring_revenue == 800_00
        assert jan.average_revenue_per_user == 400_00

        feb = metrics.periods[1]
        assert feb.monthly_recurring_revenue == 300_00
        assert feb.committed_monthly_recurring_revenue == 300_00
        assert feb.average_revenue_per_user == 150_00

    async def test_mrr_bucket_without_fx_uses_identity_multiplier(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["fx_identity"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 2

        jan = metrics.periods[0]
        assert jan.monthly_recurring_revenue == 200_00
        assert jan.committed_monthly_recurring_revenue == 200_00
        assert jan.average_revenue_per_user == 200_00

        feb = metrics.periods[1]
        assert feb.monthly_recurring_revenue == 100_00
        assert feb.committed_monthly_recurring_revenue == 100_00
        assert feb.average_revenue_per_user == 100_00

    async def test_average_revenue_per_user_no_customers(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["arpu_no_customers"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 1

        jan = metrics.periods[0]
        assert jan.active_subscriptions == 0
        assert jan.monthly_recurring_revenue == 0
        assert jan.average_revenue_per_user == 0

    async def test_cost_per_user(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["cost_per_user"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_gross_margin(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["gross_margin"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_cost_per_user_no_costs(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["cost_per_user_no_costs"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 1

        jan = metrics.periods[0]
        assert jan.costs == 0
        assert jan.cost_per_user == 0

    async def test_churn_rate(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case = QUERY_CASES_BY_LABEL["churn_rate"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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
        assert feb.churn_rate == 0.0

        mar = metrics.periods[2]
        assert mar.active_subscriptions == 1
        assert mar.new_subscriptions == 0
        assert mar.canceled_subscriptions == 0
        assert mar.churned_subscriptions == 1
        assert mar.churn_rate == 0.5

    async def test_churn_rate_rolling_window(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        """Test that churn rate uses a rolling 30-day window.

        Setup: 5 subs started Jan 1, 1 canceled on Feb 1.
        The cancellation should affect churn_rate for exactly 30 days,
        then fall out of the window.
        """
        case = QUERY_CASES_BY_LABEL["churn_rate_rolling"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id],
            now=case.now,
        )

        periods_by_date = {p.timestamp.date(): p for p in metrics.periods}

        periods_by_date = {p.timestamp.date(): p for p in metrics.periods}

        # Before cancellation: window [t-30d, t) has no cancellations
        assert periods_by_date[date(2024, 2, 1)].churn_rate == 0.0

        # Next day: canceled_at (Feb 1) is now in [Jan 3, Feb 2)
        assert periods_by_date[date(2024, 2, 2)].churn_rate == pytest.approx(0.2)

        # Still in window: [Jan 31, Mar 1) includes Feb 1
        assert periods_by_date[date(2024, 3, 1)].churn_rate == pytest.approx(0.2)

        # Last day in window: [Feb 1, Mar 2) includes Feb 1 (>= Feb 1)
        assert periods_by_date[date(2024, 3, 2)].churn_rate == pytest.approx(0.2)

        # Falls out: [Feb 2, Mar 3) does not include Feb 1
        assert periods_by_date[date(2024, 3, 3)].churn_rate == 0.0

    async def test_churn_rate_yearly(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        """Test that yearly churn uses the full year, not a 30-day window.

        Setup: 5 subs started Jan 1 2024, 1 canceled Feb 1 2024.
        Yearly should count all cancellations in [t, t+1year) / active at t.
        """
        case = QUERY_CASES_BY_LABEL["churn_rate_yearly"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id],
            now=case.now,
        )

        periods_by_date = {p.timestamp.date(): p for p in metrics.periods}

        # 2024: 1 canceled in [Jan 1, Jan 1 2025) / 5 active at Jan 1
        assert periods_by_date[date(2024, 1, 1)].churn_rate == pytest.approx(0.2)

        # 2025: 0 canceled in [Jan 1, Jan 1 2026) / 4 active at Jan 1
        assert periods_by_date[date(2025, 1, 1)].churn_rate == 0.0

    async def test_customer_filter_with_external_customer_id(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case_c1 = QUERY_CASES_BY_LABEL["customer_filter_external_c1"]
        org_ctx = metrics_harness.organizations[case_c1.org_key]
        auth_subject_c1 = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case_c1.auth_type,
        )

        metrics_c1 = await metrics_service.get_metrics(
            metrics_session,
            auth_subject_c1,
            start_date=case_c1.start_date,
            end_date=case_c1.end_date,
            timezone=ZoneInfo(case_c1.timezone),
            interval=case_c1.interval,
            organization_id=[org_ctx.organization.id]
            if case_c1.organization_id_filter or case_c1.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case_c1.product_keys] or None,
            billing_type=list(case_c1.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case_c1.customer_keys]
            or None,
            metrics=list(case_c1.metrics) if case_c1.metrics is not None else None,
            now=case_c1.now,
        )

        assert len(metrics_c1.periods) == 2

        jan_1 = metrics_c1.periods[0]
        assert jan_1.costs == 0.25

        jan_2 = metrics_c1.periods[1]
        assert jan_2.costs == 0.35

        case_c2 = QUERY_CASES_BY_LABEL["customer_filter_external_c2"]
        auth_subject_c2 = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case_c2.auth_type,
        )

        metrics_c2 = await metrics_service.get_metrics(
            metrics_session,
            auth_subject_c2,
            start_date=case_c2.start_date,
            end_date=case_c2.end_date,
            timezone=ZoneInfo(case_c2.timezone),
            interval=case_c2.interval,
            organization_id=[org_ctx.organization.id]
            if case_c2.organization_id_filter or case_c2.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case_c2.product_keys] or None,
            billing_type=list(case_c2.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case_c2.customer_keys]
            or None,
            metrics=list(case_c2.metrics) if case_c2.metrics is not None else None,
            now=case_c2.now,
        )

        assert len(metrics_c2.periods) == 2

        jan_1_second = metrics_c2.periods[0]
        assert jan_1_second.costs == 0.50

        jan_2_second = metrics_c2.periods[1]
        assert jan_2_second.costs == 0

        case_all = QUERY_CASES_BY_LABEL["customer_filter_external_all"]
        auth_subject_all = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case_all.auth_type,
        )

        metrics_all = await metrics_service.get_metrics(
            metrics_session,
            auth_subject_all,
            start_date=case_all.start_date,
            end_date=case_all.end_date,
            timezone=ZoneInfo(case_all.timezone),
            interval=case_all.interval,
            organization_id=[org_ctx.organization.id]
            if case_all.organization_id_filter or case_all.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case_all.product_keys] or None,
            billing_type=list(case_all.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case_all.customer_keys]
            or None,
            metrics=list(case_all.metrics) if case_all.metrics is not None else None,
            now=case_all.now,
        )

        assert len(metrics_all.periods) == 2

        jan_1_all = metrics_all.periods[0]
        assert jan_1_all.costs == 0.75

        jan_2_all = metrics_all.periods[1]
        assert jan_2_all.costs == 0.35

    async def test_customer_filter_null_external_id_safety(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        case_c1 = QUERY_CASES_BY_LABEL["customer_filter_null_c1"]
        org_ctx = metrics_harness.organizations[case_c1.org_key]
        auth_subject_c1 = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case_c1.auth_type,
        )

        metrics_c1 = await metrics_service.get_metrics(
            metrics_session,
            auth_subject_c1,
            start_date=case_c1.start_date,
            end_date=case_c1.end_date,
            timezone=ZoneInfo(case_c1.timezone),
            interval=case_c1.interval,
            organization_id=[org_ctx.organization.id]
            if case_c1.organization_id_filter or case_c1.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case_c1.product_keys] or None,
            billing_type=list(case_c1.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case_c1.customer_keys]
            or None,
            metrics=list(case_c1.metrics) if case_c1.metrics is not None else None,
            now=case_c1.now,
        )

        assert len(metrics_c1.periods) == 1

        jan_1 = metrics_c1.periods[0]
        assert jan_1.costs == 0.10

        case_c2 = QUERY_CASES_BY_LABEL["customer_filter_null_c2"]
        auth_subject_c2 = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case_c2.auth_type,
        )

        metrics_c2 = await metrics_service.get_metrics(
            metrics_session,
            auth_subject_c2,
            start_date=case_c2.start_date,
            end_date=case_c2.end_date,
            timezone=ZoneInfo(case_c2.timezone),
            interval=case_c2.interval,
            organization_id=[org_ctx.organization.id]
            if case_c2.organization_id_filter or case_c2.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case_c2.product_keys] or None,
            billing_type=list(case_c2.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case_c2.customer_keys]
            or None,
            metrics=list(case_c2.metrics) if case_c2.metrics is not None else None,
            now=case_c2.now,
        )

        assert len(metrics_c2.periods) == 1
        jan_1_second = metrics_c2.periods[0]
        assert jan_1_second.costs == 0

        case_all = QUERY_CASES_BY_LABEL["customer_filter_null_all"]
        auth_subject_all = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case_all.auth_type,
        )

        metrics_all = await metrics_service.get_metrics(
            metrics_session,
            auth_subject_all,
            start_date=case_all.start_date,
            end_date=case_all.end_date,
            timezone=ZoneInfo(case_all.timezone),
            interval=case_all.interval,
            organization_id=[org_ctx.organization.id]
            if case_all.organization_id_filter or case_all.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case_all.product_keys] or None,
            billing_type=list(case_all.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case_all.customer_keys]
            or None,
            metrics=list(case_all.metrics) if case_all.metrics is not None else None,
            now=case_all.now,
        )

        assert len(metrics_all.periods) == 1
        jan_1_all = metrics_all.periods[0]
        assert jan_1_all.costs == 0.60

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_hourly_interval_order_placement(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        label = f"hourly_orders__{auth}"
        case = QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 24

        hour_6 = metrics.periods[6]
        assert hour_6.timestamp == datetime(2024, 1, 15, 6, 0, 0, tzinfo=UTC)
        assert hour_6.orders == 1
        assert hour_6.revenue == 100_00

        hour_22 = metrics.periods[22]
        assert hour_22.timestamp == datetime(2024, 1, 15, 22, 0, 0, tzinfo=UTC)
        assert hour_22.orders == 1
        assert hour_22.revenue == 200_00

        for i, period in enumerate(metrics.periods):
            if i not in (6, 22):
                assert period.orders == 0, f"Expected 0 orders at hour {i}"

    async def test_subscription_started_after_bounds_end_not_counted(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        """Test that subscriptions starting after bounds end_date are not counted.

        This tests the bounds filtering behavior: when querying with end_date=Feb 11
        and interval=month, a subscription that started on Feb 15 should NOT be
        counted in the February period, even though date_trunc('month', Feb 15) = Feb 1.

        The bounds filter (started_at <= end_timestamp) should exclude it.
        """
        case = QUERY_CASES_BY_LABEL["sub_after_bounds"]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=[org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None,
            product_id=[org_ctx.product_ids[k] for k in case.product_keys] or None,
            billing_type=list(case.billing_types) or None,
            customer_id=[org_ctx.customer_ids[k] for k in case.customer_keys] or None,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 2

        jan = metrics.periods[0]
        assert jan.timestamp == datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        assert jan.active_subscriptions == 0
        assert jan.committed_subscriptions == 0

        feb = metrics.periods[1]
        assert feb.timestamp == datetime(2024, 2, 1, 0, 0, 0, tzinfo=UTC)
        assert feb.active_subscriptions == 1
        assert feb.committed_subscriptions == 1


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio(loop_scope="module")
class TestMetricsFiltering:
    """Tests for the metrics parameter filtering functionality."""

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_metrics_filters_response(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """Test that metrics filters the metrics in the response."""
        label = f"metrics_filters_response__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_metrics_single_metric(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """Test that a single metric works correctly."""
        label = f"metrics_single_metric__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 31
        assert metrics.periods[0].active_subscriptions == 2
        assert metrics.metrics.active_subscriptions is not None

    @pytest.mark.parametrize("auth", ["user", "org"])
    @pytest.mark.parametrize("metric_slug", FILTERING_META_METRICS)
    async def test_metrics_meta_metrics(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
        metric_slug: str,
    ) -> None:
        """Test that meta metrics (post-compute) can be requested and computed."""
        label = f"metrics_meta_{metric_slug}__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 12
        assert getattr(metrics.metrics, metric_slug) is not None

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_metrics_gross_margin_dependencies(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """Test that gross_margin properly resolves its dependencies (revenue, costs)."""
        label = f"metrics_meta_gross_margin__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_metrics_churn_rate_dependencies(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """Test that churn_rate properly resolves its dependencies."""
        label = f"metrics_churn_rate_dependencies__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 1
        assert metrics.metrics.churn_rate is not None

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_metrics_none_returns_all(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """Test that metrics=None returns all metrics (backward compatible)."""
        label = f"metrics_none_returns_all__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 31

        # All metrics should be populated
        assert metrics.metrics.revenue is not None
        assert metrics.metrics.orders is not None
        assert metrics.metrics.active_subscriptions is not None
        assert metrics.metrics.gross_margin is not None
        assert metrics.metrics.churn_rate is not None

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_metrics_ltv_recursive_dependencies(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """
        Test that LTV properly resolves recursive dependencies.

        LTV depends on churn_rate (a meta metric), which depends on
        active_subscriptions, new_subscriptions, churned_subscriptions,
        and canceled_subscriptions.
        """
        label = f"metrics_ltv_recursive_dependencies__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 1
        assert metrics.metrics.ltv is not None

    @pytest.mark.parametrize("auth", ["user", "org"])
    @pytest.mark.parametrize("metric_slug", FILTERING_SQL_METRICS)
    async def test_metrics_sql_metrics(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
        metric_slug: str,
    ) -> None:
        """Test that different SQL metrics can be individually requested."""
        label = f"metrics_sql_{metric_slug}__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )

        assert len(metrics.periods) == 31
        assert getattr(metrics.metrics, metric_slug) is not None

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_metrics_multiple_different_queries(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """Test requesting metrics from different query sources."""
        label = f"metrics_multiple_queries__{auth}"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
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

    async def test_metrics_cumulative_with_none_values(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        """Test that cumulative calculations handle None values from metrics filtering.

        When metrics filters out dependencies, cumulative functions must handle
        None values gracefully instead of raising TypeError.
        """
        label = "metrics_cumulative_cost_per_user"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )
        # Should not raise TypeError and should return valid totals
        assert metrics.totals.cost_per_user is not None

    async def test_metrics_average_order_value_cumulative(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        """Test average_order_value cumulative handles None values."""
        label = "metrics_cumulative_average_order_value"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )
        assert metrics.totals.average_order_value is not None

    async def test_metrics_checkouts_conversion_cumulative(
        self,
        metrics_harness: MetricsHarness,
        metrics_session: AsyncSession,
    ) -> None:
        """Test checkouts_conversion cumulative handles None values."""
        label = "metrics_cumulative_checkouts_conversion"
        case = METRICS_FILTERING_QUERY_CASES_BY_LABEL[label]
        org_ctx = metrics_harness.organizations[case.org_key]
        auth_subject = _metrics_auth_subject(
            metrics_harness.user,
            metrics_harness.unauthorized_user,
            org_ctx.organization,
            case.auth_type,
        )
        selected_product_ids = [
            org_ctx.product_ids[k] for k in case.product_keys
        ] or None
        selected_customer_ids = [
            org_ctx.customer_ids[k] for k in case.customer_keys
        ] or None
        selected_org_ids = (
            [org_ctx.organization.id]
            if case.organization_id_filter or case.auth_type == "user"
            else None
        )

        metrics = await metrics_service.get_metrics(
            metrics_session,
            auth_subject,
            start_date=case.start_date,
            end_date=case.end_date,
            timezone=ZoneInfo(case.timezone),
            interval=case.interval,
            organization_id=selected_org_ids,
            product_id=selected_product_ids,
            billing_type=list(case.billing_types) or None,
            customer_id=selected_customer_ids,
            metrics=list(case.metrics) if case.metrics is not None else None,
            now=case.now,
        )
        assert metrics.totals.checkouts_conversion is not None


@pytest.mark.asyncio(loop_scope="module")
class TestCheckoutMetrics:
    """Tests for checkout metrics using opened_at tracking.

    The cutoff date for opened_at tracking is 2026-01-22T12:13:00Z.
    - Before cutoff: all checkouts counted using created_at (historical behavior)
    - After cutoff: only checkouts with opened_at are counted

    See: https://github.com/polarsource/polar/pull/9071
    """

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_historical_checkouts_without_opened_at_counted(
        self,
        checkout_metrics_harness: CheckoutMetricsHarness,
        checkout_metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """
        Test that historical checkouts (before cutoff) are counted even without opened_at.

        This preserves historical data for checkouts created before the
        opened_at tracking feature was shipped (2026-01-22T12:13:00Z).
        """
        context = checkout_metrics_harness.scenarios["historical"]
        auth_subject = _checkout_auth_subject(context, auth)

        # Query for historical date range (2024, before cutoff)
        metrics = await metrics_service.get_metrics(
            checkout_metrics_session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.year,
            metrics=["checkouts"],
        )

        # Both checkouts should be counted (historical behavior)
        total_checkouts = sum(p.checkouts or 0 for p in metrics.periods)
        assert total_checkouts == 2

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_only_opened_checkouts_counted_after_cutoff(
        self,
        checkout_metrics_harness: CheckoutMetricsHarness,
        checkout_metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """
        Test that only checkouts with opened_at are counted after the cutoff.

        API-created checkouts without opened_at should NOT appear in metrics
        for dates after 2026-01-22T12:13:00Z.
        """
        context = checkout_metrics_harness.scenarios["after_cutoff"]
        auth_subject = _checkout_auth_subject(context, auth)

        metrics = await metrics_service.get_metrics(
            checkout_metrics_session,
            auth_subject,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["checkouts"],
        )

        # Only the 1 opened checkout should be counted
        total_checkouts = sum(p.checkouts or 0 for p in metrics.periods)
        assert total_checkouts == 1

        # Verify it appears on the correct day (Feb 15)
        feb_15 = metrics.periods[14]  # 0-indexed, day 15 is index 14
        assert feb_15.checkouts == 1

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_time_bucketing_uses_opened_at(
        self,
        checkout_metrics_harness: CheckoutMetricsHarness,
        checkout_metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """
        Test that checkout metrics use opened_at for time bucketing.

        A checkout with opened_at on Feb 20 should appear in Feb 20 metrics.
        """
        context = checkout_metrics_harness.scenarios["time_bucketing"]
        auth_subject = _checkout_auth_subject(context, auth)

        metrics = await metrics_service.get_metrics(
            checkout_metrics_session,
            auth_subject,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["checkouts"],
        )

        # Checkout should appear on Feb 20 (opened_at date)
        feb_20 = metrics.periods[19]  # 0-indexed, day 20 is index 19
        assert feb_20.checkouts == 1

        # All other days should have 0 checkouts
        for i, period in enumerate(metrics.periods):
            if i != 19:
                assert period.checkouts == 0

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_checkouts_conversion_uses_opened_checkouts(
        self,
        checkout_metrics_harness: CheckoutMetricsHarness,
        checkout_metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """
        Test that conversion rate uses opened checkouts as denominator.

        If 2 checkouts are opened and 1 succeeds, conversion should be 50%,
        NOT based on total created checkouts.
        """
        context = checkout_metrics_harness.scenarios["conversion_opened"]
        auth_subject = _checkout_auth_subject(context, auth)

        metrics = await metrics_service.get_metrics(
            checkout_metrics_session,
            auth_subject,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["checkouts", "succeeded_checkouts", "checkouts_conversion"],
        )

        # Should count 2 opened checkouts
        total_checkouts = sum(p.checkouts or 0 for p in metrics.periods)
        assert total_checkouts == 2

        # Should count 1 succeeded checkout
        total_succeeded = sum(p.succeeded_checkouts or 0 for p in metrics.periods)
        assert total_succeeded == 1

        # Conversion should be 50% (1/2), not ~20% (1/5)
        assert metrics.totals.checkouts_conversion == 0.5

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_checkouts_conversion_cumulative_without_sibling_metrics(
        self,
        checkout_metrics_harness: CheckoutMetricsHarness,
        checkout_metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """
        Test that requesting only checkouts_conversion (without checkouts
        or succeeded_checkouts) still computes a correct cumulative total.
        """
        context = checkout_metrics_harness.scenarios["conversion_cumulative"]
        auth_subject = _checkout_auth_subject(context, auth)

        metrics = await metrics_service.get_metrics(
            checkout_metrics_session,
            auth_subject,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
            metrics=["checkouts_conversion"],
        )

        assert metrics.totals.checkouts_conversion is not None
        assert metrics.totals.checkouts_conversion > 0
        assert abs(metrics.totals.checkouts_conversion - 1 / 3) < 0.01

        jan = metrics.periods[0]
        assert jan.checkouts is None
        assert jan.succeeded_checkouts is None

    @pytest.mark.parametrize("auth", ["user", "org"])
    async def test_checkouts_outside_date_range_excluded(
        self,
        checkout_metrics_harness: CheckoutMetricsHarness,
        checkout_metrics_session: AsyncSession,
        auth: str,
    ) -> None:
        """
        Test that checkouts opened outside the date range are excluded.

        Uses opened_at for filtering, not created_at.
        """
        context = checkout_metrics_harness.scenarios["outside_range"]
        auth_subject = _checkout_auth_subject(context, auth)

        metrics = await metrics_service.get_metrics(
            checkout_metrics_session,
            auth_subject,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            metrics=["checkouts"],
        )

        # Only the checkout opened within range should be counted
        total_checkouts = sum(p.checkouts or 0 for p in metrics.periods)
        assert total_checkouts == 1
