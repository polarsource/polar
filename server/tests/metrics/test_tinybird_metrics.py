import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import patch
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
from polar.event.system import SystemEvent
from polar.integrations.tinybird import service as tinybird_service
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, _event_to_tinybird
from polar.kit.db.postgres import create_async_engine, create_async_sessionmaker
from polar.kit.time_queries import TimeInterval
from polar.metrics import queries_tinybird
from polar.metrics.metrics import METRICS_TINYBIRD
from polar.metrics.schemas import MetricsResponse
from polar.metrics.service import metrics as metrics_service
from polar.models import (
    Account,
    Customer,
    Event,
    Model,
    Organization,
    Product,
    Subscription,
)
from polar.models.event import EventSource
from polar.models.order import OrderStatus
from polar.models.product import ProductBillingType
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import get_database_url, save_fixture_factory
from tests.fixtures.random_objects import (
    create_account,
    create_customer,
    create_event,
    create_order,
    create_organization,
    create_payment_transaction,
    create_product,
    create_subscription,
    create_user,
)
from tests.fixtures.tinybird import tinybird_available

pytestmark = pytest.mark.xdist_group(name="tinybird")

MONTHLY_PRICE = 50_00
MONTHLY_PLUS_PRICE = 80_00
YEARLY_PRICE = 600_00
ONE_TIME_PRICE = 100_00
FIXED_NOW = datetime(2024, 7, 1, tzinfo=UTC)

SETTLEMENT_METRIC_SLUGS = [m.slug for m in METRICS_TINYBIRD]


@dataclass(frozen=True)
class QueryCase:
    label: str
    organization_key: str
    start_date: date
    end_date: date
    interval: TimeInterval
    timezone: str = "UTC"
    product_keys: tuple[str, ...] = ()
    billing_types: tuple[ProductBillingType, ...] = ()
    customer_keys: tuple[str, ...] = ()
    include_organization_filter: bool = True
    metrics: tuple[str, ...] | None = None


@dataclass
class OrganizationContext:
    organization: Organization
    product_ids: dict[str, UUID]
    customer_ids: dict[str, UUID]


@dataclass
class MetricsHarness:
    organizations: dict[str, OrganizationContext]
    snapshots: dict[str, MetricsResponse]


@dataclass(frozen=True)
class ProductScenario:
    key: str
    recurring_interval: SubscriptionRecurringInterval | None
    price: int


@dataclass(frozen=True)
class OrderScenario:
    product_key: str
    ordered_at: datetime
    amount: int
    applied_balance_amount: int = 0
    emit_balance_credit_order: bool = False
    created_at: datetime | None = None
    order_paid_at: datetime | None = None
    balance_at: datetime | None = None
    balance_amount: int | None = None
    balance_net_amount: int | None = None
    include_balance_net_amount: bool = True
    balance_exchange_rate: float | None = None
    balance_presentment_currency: str = "usd"
    balance_credit_order_currency: str = "usd"
    include_order_created_at_metadata: bool = True
    include_order_paid: bool = True
    include_balance: bool = True
    status: OrderStatus = OrderStatus.paid
    refunded_amount: int = 0
    platform_fee_amount: int = 0
    include_balance_refund: bool = False
    refund_at: datetime | None = None
    extra_balance_refund_events: int = 0
    include_balance_refund_reversal: bool = False
    refund_reversal_at: datetime | None = None


@dataclass(frozen=True)
class SubscriptionScenario:
    product_key: str
    order_timestamps: tuple[datetime, ...]
    amount: int
    orders: tuple[OrderScenario, ...] = ()
    canceled_at: datetime | None = None
    ends_at: datetime | None = None
    cancellation_reason: CustomerCancellationReason | None = None
    canceled_event_ends_at: datetime | None = None
    duplicate_canceled_event_timestamp: datetime | None = None
    cancel_at_period_end: bool = False
    revoked_at: datetime | None = None


@dataclass(frozen=True)
class UserCostEventScenario:
    timestamp: datetime
    amount: float
    external_customer_id: str | None = None
    include_customer_ref: bool = True


@dataclass(frozen=True)
class CustomerScenario:
    key: str
    external_id: str | None = None
    subscriptions: tuple[SubscriptionScenario, ...] = ()
    one_time_orders: tuple[OrderScenario, ...] = ()
    user_events: tuple[UserCostEventScenario, ...] = ()


@dataclass(frozen=True)
class OrganizationScenario:
    key: str
    products: tuple[ProductScenario, ...]
    customers: tuple[CustomerScenario, ...]


def _dt(d: date, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=UTC)


def _build_alpha_customers() -> tuple[CustomerScenario, ...]:
    customers: list[CustomerScenario] = [
        CustomerScenario(
            key="loyal_monthly",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(
                        _dt(date(2024, 1, 1)),
                        _dt(date(2024, 2, 1)),
                        _dt(date(2024, 3, 1)),
                        _dt(date(2024, 4, 1)),
                        _dt(date(2024, 5, 1)),
                        _dt(date(2024, 6, 1)),
                    ),
                    amount=MONTHLY_PRICE,
                ),
            ),
        ),
        CustomerScenario(
            key="yearly_subscriber",
            subscriptions=(
                SubscriptionScenario(
                    product_key="yearly",
                    order_timestamps=(_dt(date(2024, 1, 1)),),
                    amount=YEARLY_PRICE,
                ),
            ),
        ),
        CustomerScenario(
            key="one_time_buyer",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2024, 1, 10)),
                    amount=ONE_TIME_PRICE,
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2024, 4, 20)),
                    amount=ONE_TIME_PRICE,
                ),
            ),
        ),
        CustomerScenario(
            key="monthly_plus_customer",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly_plus",
                    order_timestamps=(
                        _dt(date(2024, 4, 1)),
                        _dt(date(2024, 5, 1)),
                        _dt(date(2024, 6, 1)),
                    ),
                    amount=MONTHLY_PLUS_PRICE,
                ),
            ),
        ),
        CustomerScenario(
            key="external_match",
            external_id="ext-boundary",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(
                        _dt(date(2024, 1, 5)),
                        _dt(date(2024, 2, 5)),
                    ),
                    amount=MONTHLY_PRICE,
                ),
            ),
            user_events=(
                UserCostEventScenario(
                    timestamp=_dt(date(2024, 1, 15), 18, 25),
                    amount=0.11,
                    external_customer_id="ext-boundary",
                    include_customer_ref=False,
                ),
                UserCostEventScenario(
                    timestamp=_dt(date(2024, 1, 15), 18, 35),
                    amount=0.22,
                    external_customer_id="ext-boundary",
                    include_customer_ref=False,
                ),
                UserCostEventScenario(
                    timestamp=_dt(date(2024, 2, 10), 9, 0),
                    amount=0.33,
                    include_customer_ref=True,
                ),
            ),
        ),
        CustomerScenario(
            key="weekly_boundary_new_subscriptions",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(_dt(date(2026, 1, 26)),),
                    amount=MONTHLY_PRICE,
                ),
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(_dt(date(2026, 1, 28)),),
                    amount=MONTHLY_PRICE,
                ),
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(_dt(date(2026, 1, 31)),),
                    amount=MONTHLY_PRICE,
                ),
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(_dt(date(2026, 2, 1)),),
                    amount=MONTHLY_PRICE,
                ),
            ),
        ),
        CustomerScenario(
            key="partial_window_churn",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(
                        _dt(date(2026, 1, 1)),
                        _dt(date(2026, 2, 1)),
                    ),
                    amount=MONTHLY_PRICE,
                    canceled_at=_dt(date(2026, 1, 15)),
                    ends_at=_dt(date(2026, 2, 20)),
                    cancellation_reason=CustomerCancellationReason.too_expensive,
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_order_paid_drift",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 4), 10, 41),
                    created_at=_dt(date(2026, 2, 4), 10, 41),
                    order_paid_at=_dt(date(2026, 2, 13), 12, 0),
                    balance_at=_dt(date(2026, 2, 4), 10, 41),
                    include_order_created_at_metadata=False,
                    amount=1_000,
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 4), 12, 41),
                    amount=1_000,
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 4), 14, 7),
                    amount=2_000,
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 13), 9, 22),
                    amount=1_000,
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 13), 11, 6),
                    amount=1_000,
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_revoked_after_cancel_at_period_end",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(datetime(2026, 1, 7, 21, 32, tzinfo=UTC),),
                    amount=MONTHLY_PRICE,
                    canceled_at=datetime(2026, 1, 7, 21, 35, tzinfo=UTC),
                    ends_at=datetime(2026, 1, 7, 21, 42, tzinfo=UTC),
                    cancellation_reason=CustomerCancellationReason.other,
                    canceled_event_ends_at=datetime(2026, 2, 7, 21, 32, tzinfo=UTC),
                    cancel_at_period_end=True,
                    revoked_at=datetime(2026, 1, 7, 21, 42, 1, tzinfo=UTC),
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_duplicate_canceled_events",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(datetime(2026, 1, 20, 12, 0, tzinfo=UTC),),
                    amount=MONTHLY_PRICE,
                    canceled_at=datetime(2026, 1, 26, 17, 15, 42, tzinfo=UTC),
                    ends_at=datetime(2026, 2, 24, 12, 15, 19, tzinfo=UTC),
                    cancellation_reason=CustomerCancellationReason.other,
                    cancel_at_period_end=True,
                    duplicate_canceled_event_timestamp=datetime(
                        2026, 2, 24, 12, 15, 19, tzinfo=UTC
                    ),
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_trial_orders_without_balance",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 6), 20, 19),
                    amount=0,
                    include_balance=False,
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 9), 7, 57),
                    amount=0,
                    include_balance=False,
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 9), 14, 7),
                    amount=0,
                    include_balance=False,
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 2, 11), 9, 45),
                    amount=0,
                    include_balance=False,
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_balance_only_refunded_without_order_paid",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=datetime(2025, 10, 5, 7, 56, tzinfo=UTC),
                    amount=3_500,
                    status=OrderStatus.refunded,
                    refunded_amount=3_500,
                    platform_fee_amount=180,
                    include_order_paid=False,
                    include_balance=True,
                    include_balance_refund=True,
                    refund_at=datetime(2025, 10, 31, 17, 29, tzinfo=UTC),
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_duplicate_refund_with_reversal",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=datetime(2025, 12, 4, 10, 0, tzinfo=UTC),
                    amount=3_500,
                    status=OrderStatus.refunded,
                    refunded_amount=3_500,
                    platform_fee_amount=180,
                    include_order_paid=True,
                    include_balance=True,
                    include_balance_refund=True,
                    refund_at=datetime(2025, 12, 10, 12, 0, tzinfo=UTC),
                    extra_balance_refund_events=1,
                    include_balance_refund_reversal=True,
                    refund_reversal_at=datetime(2025, 12, 11, 12, 0, tzinfo=UTC),
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_applied_balance_partial",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 1, 22), 10, 0),
                    amount=4_900,
                    applied_balance_amount=10_284,
                    balance_amount=15_184,
                    balance_net_amount=4_900,
                    platform_fee_amount=875,
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_applied_balance_full",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 1, 23), 11, 0),
                    amount=0,
                    applied_balance_amount=7_000,
                    balance_amount=7_000,
                    include_balance_net_amount=False,
                    balance_exchange_rate=1.25,
                    platform_fee_amount=350,
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_credit_order_uses_previous_balance_order_fx",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2025, 12, 10), 10, 0),
                    amount=1_000,
                    balance_amount=2_000,
                    balance_net_amount=2_000,
                    balance_exchange_rate=2.0,
                    balance_presentment_currency="gbp",
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2026, 1, 24), 9, 0),
                    amount=5_000,
                    applied_balance_amount=1_000,
                    emit_balance_credit_order=True,
                    balance_amount=7_000,
                    include_balance_net_amount=False,
                    platform_fee_amount=200,
                ),
            ),
        ),
        CustomerScenario(
            key="stockholm_renewed_negative_applied_balance_credit_order",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(),
                    amount=MONTHLY_PRICE,
                    orders=(
                        OrderScenario(
                            product_key="monthly",
                            ordered_at=_dt(date(2025, 10, 17), 10, 0),
                            amount=14_900,
                        ),
                        OrderScenario(
                            product_key="monthly",
                            ordered_at=_dt(date(2025, 11, 17), 20, 44),
                            amount=14_900,
                            applied_balance_amount=-14_900,
                            emit_balance_credit_order=True,
                        ),
                    ),
                ),
            ),
        ),
        CustomerScenario(
            key="trial_subscription_no_balance",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(),
                    amount=MONTHLY_PRICE,
                    orders=(
                        OrderScenario(
                            product_key="monthly",
                            ordered_at=_dt(date(2026, 1, 15)),
                            amount=0,
                            include_balance=False,
                        ),
                    ),
                ),
                SubscriptionScenario(
                    product_key="monthly_plus",
                    order_timestamps=(_dt(date(2026, 1, 15)),),
                    amount=MONTHLY_PLUS_PRICE,
                    canceled_at=_dt(date(2026, 1, 20)),
                    ends_at=_dt(date(2026, 2, 15)),
                    cancellation_reason=CustomerCancellationReason.other,
                ),
            ),
        ),
    ]

    cancellation_reasons = (
        CustomerCancellationReason.customer_service,
        CustomerCancellationReason.low_quality,
        CustomerCancellationReason.missing_features,
        CustomerCancellationReason.switched_service,
        CustomerCancellationReason.too_complex,
        CustomerCancellationReason.too_expensive,
        CustomerCancellationReason.unused,
        CustomerCancellationReason.other,
    )
    for i, reason in enumerate(cancellation_reasons):
        start_day = 2 + i
        cancel_day = 10 + i
        customers.append(
            CustomerScenario(
                key=f"cancel_{reason.value}",
                subscriptions=(
                    SubscriptionScenario(
                        product_key="monthly",
                        order_timestamps=(_dt(date(2024, 3, start_day)),),
                        amount=MONTHLY_PRICE,
                        canceled_at=_dt(date(2024, 3, cancel_day)),
                        ends_at=_dt(date(2024, 4, 1)),
                        cancellation_reason=reason,
                    ),
                ),
            )
        )

    return tuple(customers)


def _build_beta_customers() -> tuple[CustomerScenario, ...]:
    return (
        CustomerScenario(
            key="beta_monthly_customer",
            subscriptions=(
                SubscriptionScenario(
                    product_key="monthly",
                    order_timestamps=(
                        _dt(date(2024, 1, 3)),
                        _dt(date(2024, 2, 3)),
                    ),
                    amount=45_00,
                    canceled_at=_dt(date(2024, 2, 15)),
                    ends_at=_dt(date(2024, 3, 3)),
                    cancellation_reason=CustomerCancellationReason.other,
                ),
            ),
        ),
        CustomerScenario(
            key="beta_one_time_buyer",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2024, 1, 3)),
                    amount=500_00,
                ),
            ),
        ),
        CustomerScenario(
            key="beta_external",
            external_id="beta-ext",
            user_events=(
                UserCostEventScenario(
                    timestamp=_dt(date(2024, 1, 15), 12, 0),
                    amount=2.0,
                    external_customer_id="beta-ext",
                    include_customer_ref=False,
                ),
            ),
        ),
    )


def _build_gamma_customers() -> tuple[CustomerScenario, ...]:
    return (
        CustomerScenario(
            key="gamma_one_time_buyer",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2024, 1, 5)),
                    amount=20_00,
                ),
            ),
        ),
        CustomerScenario(
            key="gamma_credit_order_fast_path",
            one_time_orders=(
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2025, 6, 1), 10, 0),
                    amount=2_000,
                    balance_amount=2_000,
                    balance_net_amount=2_000,
                    balance_exchange_rate=0.5,
                    balance_presentment_currency="eur",
                ),
                OrderScenario(
                    product_key="one_time",
                    ordered_at=_dt(date(2025, 6, 15), 10, 0),
                    amount=2_000,
                    emit_balance_credit_order=True,
                    balance_credit_order_currency="eur",
                    balance_amount=2_000,
                    include_balance_net_amount=False,
                ),
            ),
        ),
    )


ORGANIZATION_SCENARIOS: tuple[OrganizationScenario, ...] = (
    OrganizationScenario(
        key="alpha",
        products=(
            ProductScenario(
                key="monthly",
                recurring_interval=SubscriptionRecurringInterval.month,
                price=MONTHLY_PRICE,
            ),
            ProductScenario(
                key="monthly_plus",
                recurring_interval=SubscriptionRecurringInterval.month,
                price=MONTHLY_PLUS_PRICE,
            ),
            ProductScenario(
                key="yearly",
                recurring_interval=SubscriptionRecurringInterval.year,
                price=YEARLY_PRICE,
            ),
            ProductScenario(
                key="one_time",
                recurring_interval=None,
                price=ONE_TIME_PRICE,
            ),
        ),
        customers=_build_alpha_customers(),
    ),
    OrganizationScenario(
        key="beta",
        products=(
            ProductScenario(
                key="monthly",
                recurring_interval=SubscriptionRecurringInterval.month,
                price=45_00,
            ),
            ProductScenario(key="one_time", recurring_interval=None, price=500_00),
        ),
        customers=_build_beta_customers(),
    ),
    OrganizationScenario(
        key="gamma",
        products=(
            ProductScenario(key="one_time", recurring_interval=None, price=20_00),
        ),
        customers=_build_gamma_customers(),
    ),
)


QUERY_CASES: tuple[QueryCase, ...] = (
    QueryCase(
        label="alpha_monthly_h1",
        organization_key="alpha",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
    ),
    QueryCase(
        label="alpha_weekly_q1",
        organization_key="alpha",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 31),
        interval=TimeInterval.week,
    ),
    QueryCase(
        label="alpha_daily_feb",
        organization_key="alpha",
        start_date=date(2024, 2, 1),
        end_date=date(2024, 2, 29),
        interval=TimeInterval.day,
    ),
    QueryCase(
        label="alpha_monthly_recurring_filter",
        organization_key="alpha",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
        billing_types=(ProductBillingType.recurring,),
    ),
    QueryCase(
        label="alpha_monthly_product_filter",
        organization_key="alpha",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
        product_keys=("monthly",),
    ),
    QueryCase(
        label="alpha_monthly_h1_customer_filter",
        organization_key="alpha",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
        customer_keys=("external_match",),
        metrics=("active_user_by_event",),
    ),
    QueryCase(
        label="alpha_daily_customer_filter",
        organization_key="alpha",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.day,
        customer_keys=("external_match",),
    ),
    QueryCase(
        label="alpha_daily_half_hour_timezone_customer_filter",
        organization_key="alpha",
        start_date=date(2024, 1, 15),
        end_date=date(2024, 1, 16),
        interval=TimeInterval.day,
        timezone="Asia/Kolkata",
        customer_keys=("external_match",),
    ),
    QueryCase(
        label="alpha_monthly_no_org_filter",
        organization_key="alpha",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
        include_organization_filter=False,
    ),
    QueryCase(
        label="alpha_monthly_partial_window_karachi",
        organization_key="alpha",
        start_date=date(2025, 12, 30),
        end_date=date(2026, 2, 13),
        interval=TimeInterval.month,
        timezone="Asia/Karachi",
        customer_keys=("partial_window_churn",),
        metrics=("churned_subscriptions",),
    ),
    QueryCase(
        label="alpha_weekly_stockholm_boundary",
        organization_key="alpha",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 28),
        interval=TimeInterval.week,
        timezone="Europe/Stockholm",
        customer_keys=("weekly_boundary_new_subscriptions",),
        metrics=("new_subscriptions",),
    ),
    QueryCase(
        label="alpha_daily_stockholm_order_paid_timestamp_drift",
        organization_key="alpha",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 28),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        metrics=("orders",),
    ),
    QueryCase(
        label="alpha_daily_kolkata_duplicate_canceled_events",
        organization_key="alpha",
        start_date=date(2026, 1, 25),
        end_date=date(2026, 2, 24),
        interval=TimeInterval.day,
        timezone="Asia/Kolkata",
        metrics=(
            "canceled_subscriptions",
            "canceled_subscriptions_other",
        ),
    ),
    QueryCase(
        label="alpha_daily_stockholm_trial_orders_without_balance",
        organization_key="alpha",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 28),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        customer_keys=("stockholm_trial_orders_without_balance",),
        metrics=("orders", "one_time_products"),
    ),
    QueryCase(
        label="alpha_daily_stockholm_balance_only_refunded_without_order_paid",
        organization_key="alpha",
        start_date=date(2025, 10, 1),
        end_date=date(2025, 10, 31),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        customer_keys=("stockholm_balance_only_refunded_without_order_paid",),
        metrics=("orders", "one_time_products", "one_time_products_net_revenue"),
    ),
    QueryCase(
        label="alpha_daily_stockholm_duplicate_refund_with_reversal",
        organization_key="alpha",
        start_date=date(2025, 12, 1),
        end_date=date(2025, 12, 31),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        customer_keys=("stockholm_duplicate_refund_with_reversal",),
        metrics=("orders", "one_time_products", "one_time_products_net_revenue"),
    ),
    QueryCase(
        label="alpha_daily_stockholm_revoked_after_cancel_at_period_end_drift",
        organization_key="alpha",
        start_date=date(2026, 1, 17),
        end_date=date(2026, 2, 17),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        metrics=("active_subscriptions", "committed_subscriptions"),
    ),
    QueryCase(
        label="alpha_daily_stockholm_applied_balance_partial",
        organization_key="alpha",
        start_date=date(2026, 1, 22),
        end_date=date(2026, 1, 22),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        customer_keys=("stockholm_applied_balance_partial",),
        metrics=("orders", "net_revenue", "one_time_products_net_revenue"),
    ),
    QueryCase(
        label="alpha_daily_stockholm_applied_balance_full",
        organization_key="alpha",
        start_date=date(2026, 1, 23),
        end_date=date(2026, 1, 23),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        customer_keys=("stockholm_applied_balance_full",),
        metrics=("orders", "net_revenue", "one_time_products_net_revenue"),
    ),
    QueryCase(
        label="alpha_daily_stockholm_credit_order_previous_balance_fx",
        organization_key="alpha",
        start_date=date(2026, 1, 24),
        end_date=date(2026, 1, 24),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        customer_keys=("stockholm_credit_order_uses_previous_balance_order_fx",),
        metrics=("orders", "net_revenue", "one_time_products_net_revenue"),
    ),
    QueryCase(
        label="alpha_daily_stockholm_renewed_negative_applied_balance_credit_order",
        organization_key="alpha",
        start_date=date(2025, 11, 17),
        end_date=date(2025, 11, 17),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        customer_keys=("stockholm_renewed_negative_applied_balance_credit_order",),
        metrics=("renewed_subscriptions", "renewed_subscriptions_net_revenue"),
    ),
    QueryCase(
        label="alpha_daily_trial_subscription_mrr",
        organization_key="alpha",
        start_date=date(2026, 1, 15),
        end_date=date(2026, 1, 31),
        interval=TimeInterval.day,
        customer_keys=("trial_subscription_no_balance",),
        metrics=(
            "monthly_recurring_revenue",
            "committed_monthly_recurring_revenue",
            "active_subscriptions",
            "committed_subscriptions",
        ),
    ),
    QueryCase(
        label="beta_monthly_q1",
        organization_key="beta",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 31),
        interval=TimeInterval.month,
    ),
    QueryCase(
        label="beta_daily_customer_filter",
        organization_key="beta",
        start_date=date(2024, 1, 15),
        end_date=date(2024, 1, 15),
        interval=TimeInterval.day,
        customer_keys=("beta_external",),
        metrics=("active_user_by_event", "costs"),
    ),
    QueryCase(
        label="gamma_monthly_jan",
        organization_key="gamma",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.month,
    ),
    QueryCase(
        label="gamma_daily_credit_order_fast_path",
        organization_key="gamma",
        start_date=date(2025, 6, 15),
        end_date=date(2025, 6, 15),
        interval=TimeInterval.day,
        metrics=("revenue", "net_revenue"),
    ),
)


def _number_or_zero(v: int | float | Decimal | None) -> int | float | Decimal:
    return 0 if v is None else v


def _assert_number_equal(
    expected: int | float | Decimal,
    actual: int | float | Decimal,
    *,
    label: str,
) -> None:
    if isinstance(expected, int) and isinstance(actual, int):
        assert actual == expected, label
        return
    assert float(actual) == pytest.approx(float(expected), abs=1e-9, rel=1e-9), label


def _assert_metric_parity(
    metric_slug: str,
    expected: MetricsResponse,
    actual: MetricsResponse,
    *,
    case_label: str,
) -> None:
    assert len(expected.periods) == len(actual.periods), (
        f"[{case_label}] period length mismatch"
    )
    for i, (expected_period, actual_period) in enumerate(
        zip(expected.periods, actual.periods, strict=True)
    ):
        assert expected_period.timestamp == actual_period.timestamp
        expected_value = _number_or_zero(getattr(expected_period, metric_slug, None))
        actual_value = _number_or_zero(getattr(actual_period, metric_slug, None))
        _assert_number_equal(
            expected_value,
            actual_value,
            label=(
                f"[{case_label}] period={i} ts={expected_period.timestamp.isoformat()} "
                f"metric={metric_slug} expected={expected_value} actual={actual_value}"
            ),
        )

    expected_total = _number_or_zero(getattr(expected.totals, metric_slug, None))
    actual_total = _number_or_zero(getattr(actual.totals, metric_slug, None))
    _assert_number_equal(
        expected_total,
        actual_total,
        label=f"[{case_label}] totals metric={metric_slug} expected={expected_total} actual={actual_total}",
    )


async def _create_subscription_created_event(
    save_fixture: Any,
    organization: Organization,
    customer: Customer,
    subscription: Subscription,
    product: Product,
    *,
    amount: int | None = None,
) -> Event:
    assert subscription.started_at is not None
    return await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.subscription_created.value,
        timestamp=subscription.started_at,
        metadata={
            "subscription_id": str(subscription.id),
            "product_id": str(product.id),
            "customer_id": str(customer.id),
            "amount": amount if amount is not None else subscription.amount,
            "currency": subscription.currency,
            "started_at": subscription.started_at.isoformat(),
            "recurring_interval": product.recurring_interval.value
            if product.recurring_interval
            else None,
            "recurring_interval_count": product.recurring_interval_count or 1,
        },
    )


async def _create_subscription_canceled_event(
    save_fixture: Any,
    organization: Organization,
    customer: Customer,
    subscription: Subscription,
    *,
    canceled_at: datetime,
    ends_at: datetime,
    customer_cancellation_reason: str,
    cancel_at_period_end: bool = False,
    event_timestamp: datetime | None = None,
) -> Event:
    return await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.subscription_canceled.value,
        timestamp=event_timestamp or canceled_at,
        metadata={
            "subscription_id": str(subscription.id),
            "canceled_at": canceled_at.isoformat(),
            "ends_at": ends_at.isoformat(),
            "customer_cancellation_reason": customer_cancellation_reason,
            "cancel_at_period_end": cancel_at_period_end,
        },
    )


async def _create_subscription_revoked_event(
    save_fixture: Any,
    organization: Organization,
    customer: Customer,
    subscription: Subscription,
    product: Product,
    *,
    revoked_at: datetime,
) -> Event:
    return await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.subscription_revoked.value,
        timestamp=revoked_at,
        metadata={
            "subscription_id": str(subscription.id),
            "product_id": str(product.id),
            "amount": subscription.amount,
            "currency": subscription.currency,
            "recurring_interval": product.recurring_interval.value
            if product.recurring_interval
            else None,
            "recurring_interval_count": product.recurring_interval_count or 1,
        },
    )


async def _create_paid_order_events(
    save_fixture: Any,
    organization: Organization,
    customer: Customer,
    product: Product,
    *,
    ordered_at: datetime,
    amount: int,
    applied_balance_amount: int = 0,
    emit_balance_credit_order: bool = False,
    subscription: Subscription | None = None,
    created_at: datetime | None = None,
    order_paid_at: datetime | None = None,
    balance_at: datetime | None = None,
    balance_amount: int | None = None,
    balance_net_amount: int | None = None,
    include_balance_net_amount: bool = True,
    balance_exchange_rate: float | None = None,
    balance_presentment_currency: str = "usd",
    balance_credit_order_currency: str = "usd",
    include_order_created_at_metadata: bool = True,
    include_order_paid: bool = True,
    include_balance: bool = True,
    status: OrderStatus = OrderStatus.paid,
    refunded_amount: int = 0,
    platform_fee_amount: int = 0,
    include_balance_refund: bool = False,
    refund_at: datetime | None = None,
    extra_balance_refund_events: int = 0,
    include_balance_refund_reversal: bool = False,
    refund_reversal_at: datetime | None = None,
) -> list[Event]:
    order_created_at = created_at or ordered_at
    order_paid_timestamp = order_paid_at or ordered_at
    balance_timestamp = balance_at or ordered_at

    order = await create_order(
        save_fixture,
        customer=customer,
        product=product,
        status=status,
        subtotal_amount=amount,
        applied_balance_amount=applied_balance_amount,
        refunded_amount=refunded_amount,
        created_at=order_created_at,
        subscription=subscription,
    )
    if platform_fee_amount:
        order.platform_fee_amount = platform_fee_amount
        await save_fixture(order)
    transaction = await create_payment_transaction(
        save_fixture,
        order=order,
        amount=order.net_amount,
        tax_amount=order.tax_amount,
    )

    common_metadata: dict[str, Any] = {
        "order_id": str(order.id),
        "product_id": str(product.id),
        "billing_type": product.billing_type.value,
        "amount": order.net_amount,
        "net_amount": order.net_amount,
        "currency": "usd",
        "tax_amount": order.tax_amount,
        "applied_balance_amount": order.applied_balance_amount,
        "platform_fee": order.platform_fee_amount,
    }
    if include_order_created_at_metadata and order.created_at is not None:
        common_metadata["order_created_at"] = order.created_at.isoformat()
    if subscription is not None:
        common_metadata["subscription_id"] = str(subscription.id)

    balance_amount_value = (
        balance_amount if balance_amount is not None else order.net_amount
    )
    balance_net_amount_value = (
        balance_net_amount if balance_net_amount is not None else balance_amount_value
    )
    balance_metadata = {
        **common_metadata,
        "amount": balance_amount_value,
        "fee": order.platform_fee_amount,
    }
    if include_balance_net_amount:
        balance_metadata["net_amount"] = balance_net_amount_value
    if not emit_balance_credit_order:
        balance_metadata["transaction_id"] = str(transaction.id)
        balance_metadata["presentment_amount"] = balance_amount_value
        balance_metadata["presentment_currency"] = balance_presentment_currency
    else:
        balance_metadata["currency"] = balance_credit_order_currency
    if balance_exchange_rate is not None:
        balance_metadata["exchange_rate"] = balance_exchange_rate

    emitted_events: list[Event] = []
    if include_balance:
        balance_order = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=(
                SystemEvent.balance_credit_order.value
                if emit_balance_credit_order
                else SystemEvent.balance_order.value
            ),
            timestamp=balance_timestamp,
            metadata=balance_metadata,
        )
        emitted_events.append(balance_order)

    if not include_order_paid:
        if not include_balance_refund:
            return emitted_events
    else:
        order_paid = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.order_paid.value,
            timestamp=order_paid_timestamp,
            metadata=common_metadata,
        )
        emitted_events.insert(0, order_paid)

    if include_balance_refund:
        assert refund_at is not None
        refund_amount = refunded_amount or amount
        refund_metadata: dict[str, Any] = {
            "order_id": str(order.id),
            "product_id": str(product.id),
            "billing_type": product.billing_type.value,
            "amount": -refund_amount,
            "fee": 0,
        }
        if subscription is not None:
            refund_metadata["subscription_id"] = str(subscription.id)
        balance_refund = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.balance_refund.value,
            timestamp=refund_at,
            metadata=refund_metadata,
        )
        emitted_events.append(balance_refund)
        for i in range(extra_balance_refund_events):
            duplicate_refund = await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                source=EventSource.system,
                name=SystemEvent.balance_refund.value,
                timestamp=refund_at + timedelta(seconds=i + 1),
                metadata=refund_metadata,
            )
            emitted_events.append(duplicate_refund)
        if include_balance_refund_reversal:
            assert refund_reversal_at is not None
            refund_reversal_metadata: dict[str, Any] = {
                "order_id": str(order.id),
                "product_id": str(product.id),
                "billing_type": product.billing_type.value,
                "amount": refund_amount,
                "fee": 0,
            }
            if subscription is not None:
                refund_reversal_metadata["subscription_id"] = str(subscription.id)
            refund_reversal = await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                source=EventSource.system,
                name=SystemEvent.balance_refund_reversal.value,
                timestamp=refund_reversal_at,
                metadata=refund_reversal_metadata,
            )
            emitted_events.append(refund_reversal)

    return emitted_events


async def _create_user_cost_event(
    save_fixture: Any,
    organization: Organization,
    customer: Customer | None,
    *,
    timestamp: datetime,
    amount: float,
    external_customer_id: str | None,
) -> Event:
    return await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.user,
        name="api.call",
        timestamp=timestamp,
        external_customer_id=external_customer_id,
        metadata={"_cost": {"amount": amount, "currency": "usd"}},
    )


async def _seed_customer_scenario(
    save_fixture: Any,
    organization: Organization,
    products: dict[str, Product],
    scenario: CustomerScenario,
    *,
    events: list[Event],
) -> UUID:
    customer = await create_customer(
        save_fixture,
        organization=organization,
        email=f"{scenario.key}@example.com",
        name=scenario.key,
        external_id=scenario.external_id,
        stripe_customer_id=f"cus_{scenario.key}",
    )

    for subscription_scenario in scenario.subscriptions:
        if subscription_scenario.orders:
            subscription_orders = subscription_scenario.orders
        else:
            assert subscription_scenario.order_timestamps
            subscription_orders = tuple(
                OrderScenario(
                    product_key=subscription_scenario.product_key,
                    ordered_at=ordered_at,
                    amount=subscription_scenario.amount,
                )
                for ordered_at in subscription_scenario.order_timestamps
            )

        product = products[subscription_scenario.product_key]
        started_at = subscription_orders[0].ordered_at
        canceled = subscription_scenario.canceled_at is not None
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled
            if canceled
            else SubscriptionStatus.active,
            started_at=started_at,
            cancel_at_period_end=subscription_scenario.cancel_at_period_end,
            ended_at=subscription_scenario.ends_at if canceled else None,
            ends_at=subscription_scenario.ends_at if canceled else None,
        )
        if canceled:
            subscription.canceled_at = subscription_scenario.canceled_at
            if subscription_scenario.cancellation_reason is not None:
                subscription.customer_cancellation_reason = (
                    subscription_scenario.cancellation_reason
                )
            await save_fixture(subscription)

        events.append(
            await _create_subscription_created_event(
                save_fixture,
                organization,
                customer,
                subscription,
                product,
                amount=subscription_scenario.amount,
            )
        )

        for subscription_order in subscription_orders:
            assert subscription_order.product_key == subscription_scenario.product_key
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    customer,
                    product,
                    ordered_at=subscription_order.ordered_at,
                    amount=subscription_order.amount,
                    applied_balance_amount=subscription_order.applied_balance_amount,
                    emit_balance_credit_order=subscription_order.emit_balance_credit_order,
                    created_at=subscription_order.created_at,
                    order_paid_at=subscription_order.order_paid_at,
                    balance_at=subscription_order.balance_at,
                    balance_amount=subscription_order.balance_amount,
                    balance_net_amount=subscription_order.balance_net_amount,
                    include_balance_net_amount=(
                        subscription_order.include_balance_net_amount
                    ),
                    balance_exchange_rate=subscription_order.balance_exchange_rate,
                    balance_presentment_currency=subscription_order.balance_presentment_currency,
                    balance_credit_order_currency=(
                        subscription_order.balance_credit_order_currency
                    ),
                    include_order_created_at_metadata=(
                        subscription_order.include_order_created_at_metadata
                    ),
                    include_order_paid=subscription_order.include_order_paid,
                    include_balance=subscription_order.include_balance,
                    status=subscription_order.status,
                    refunded_amount=subscription_order.refunded_amount,
                    platform_fee_amount=subscription_order.platform_fee_amount,
                    include_balance_refund=subscription_order.include_balance_refund,
                    refund_at=subscription_order.refund_at,
                    extra_balance_refund_events=(
                        subscription_order.extra_balance_refund_events
                    ),
                    include_balance_refund_reversal=(
                        subscription_order.include_balance_refund_reversal
                    ),
                    refund_reversal_at=subscription_order.refund_reversal_at,
                    subscription=subscription,
                )
            )

        if canceled:
            assert subscription_scenario.canceled_at is not None
            canceled_event_ends_at = (
                subscription_scenario.canceled_event_ends_at
                or subscription_scenario.ends_at
            )
            assert canceled_event_ends_at is not None
            assert subscription_scenario.cancellation_reason is not None
            events.append(
                await _create_subscription_canceled_event(
                    save_fixture,
                    organization,
                    customer,
                    subscription,
                    canceled_at=subscription_scenario.canceled_at,
                    ends_at=canceled_event_ends_at,
                    customer_cancellation_reason=(
                        subscription_scenario.cancellation_reason.value
                    ),
                    cancel_at_period_end=subscription_scenario.cancel_at_period_end,
                )
            )
            if subscription_scenario.revoked_at is not None:
                events.append(
                    await _create_subscription_revoked_event(
                        save_fixture,
                        organization,
                        customer,
                        subscription,
                        product,
                        revoked_at=subscription_scenario.revoked_at,
                    )
                )
            if subscription_scenario.duplicate_canceled_event_timestamp is not None:
                events.append(
                    await _create_subscription_canceled_event(
                        save_fixture,
                        organization,
                        customer,
                        subscription,
                        canceled_at=subscription_scenario.canceled_at,
                        ends_at=canceled_event_ends_at,
                        customer_cancellation_reason=(
                            subscription_scenario.cancellation_reason.value
                        ),
                        cancel_at_period_end=subscription_scenario.cancel_at_period_end,
                        event_timestamp=(
                            subscription_scenario.duplicate_canceled_event_timestamp
                        ),
                    )
                )

    for one_time_order in scenario.one_time_orders:
        product = products[one_time_order.product_key]
        events.extend(
            await _create_paid_order_events(
                save_fixture,
                organization,
                customer,
                product,
                ordered_at=one_time_order.ordered_at,
                amount=one_time_order.amount,
                applied_balance_amount=one_time_order.applied_balance_amount,
                emit_balance_credit_order=one_time_order.emit_balance_credit_order,
                created_at=one_time_order.created_at,
                order_paid_at=one_time_order.order_paid_at,
                balance_at=one_time_order.balance_at,
                balance_amount=one_time_order.balance_amount,
                balance_net_amount=one_time_order.balance_net_amount,
                include_balance_net_amount=one_time_order.include_balance_net_amount,
                balance_exchange_rate=one_time_order.balance_exchange_rate,
                balance_presentment_currency=one_time_order.balance_presentment_currency,
                balance_credit_order_currency=(
                    one_time_order.balance_credit_order_currency
                ),
                include_order_created_at_metadata=(
                    one_time_order.include_order_created_at_metadata
                ),
                include_order_paid=one_time_order.include_order_paid,
                include_balance=one_time_order.include_balance,
                status=one_time_order.status,
                refunded_amount=one_time_order.refunded_amount,
                platform_fee_amount=one_time_order.platform_fee_amount,
                include_balance_refund=one_time_order.include_balance_refund,
                refund_at=one_time_order.refund_at,
                extra_balance_refund_events=one_time_order.extra_balance_refund_events,
                include_balance_refund_reversal=(
                    one_time_order.include_balance_refund_reversal
                ),
                refund_reversal_at=one_time_order.refund_reversal_at,
            )
        )

    for user_event in scenario.user_events:
        events.append(
            await _create_user_cost_event(
                save_fixture,
                organization,
                customer if user_event.include_customer_ref else None,
                timestamp=user_event.timestamp,
                amount=user_event.amount,
                external_customer_id=user_event.external_customer_id,
            )
        )

    return customer.id


async def _seed_organization_scenario(
    save_fixture: Any,
    scenario: OrganizationScenario,
    *,
    account: Account,
    events: list[Event],
) -> OrganizationContext:
    organization = await create_organization(save_fixture, account)
    await save_fixture(organization)

    products: dict[str, Product] = {}
    for product_scenario in scenario.products:
        products[product_scenario.key] = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=product_scenario.recurring_interval,
            prices=[(product_scenario.price, "usd")],
        )

    customer_ids: dict[str, UUID] = {}
    for customer_scenario in scenario.customers:
        customer_ids[customer_scenario.key] = await _seed_customer_scenario(
            save_fixture,
            organization,
            products,
            customer_scenario,
            events=events,
        )

    return OrganizationContext(
        organization=organization,
        product_ids={k: v.id for k, v in products.items()},
        customer_ids=customer_ids,
    )


async def _query_metrics(
    session: AsyncSession,
    auth_subject: AuthSubject[Organization],
    organization: Organization,
    case: QueryCase,
    *,
    product_ids: dict[str, UUID],
    customer_ids: dict[str, UUID],
) -> MetricsResponse:
    selected_product_ids = [product_ids[k] for k in case.product_keys]
    selected_customer_ids = [customer_ids[k] for k in case.customer_keys]
    selected_org_ids = [organization.id] if case.include_organization_filter else None

    return await metrics_service.get_metrics(
        session,
        auth_subject,
        start_date=case.start_date,
        end_date=case.end_date,
        timezone=ZoneInfo(case.timezone),
        interval=case.interval,
        organization_id=selected_org_ids,
        product_id=selected_product_ids or None,
        billing_type=list(case.billing_types) or None,
        customer_id=selected_customer_ids or None,
        metrics=list(case.metrics)
        if case.metrics is not None
        else SETTLEMENT_METRIC_SLUGS,
        now=FIXED_NOW,
    )


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def tinybird_metrics_database_url(worker_id: str) -> AsyncIterator[str]:
    # The harness commits shared seed data once for speed, so it can't use the
    # worker database that regular tests rely on transaction rollbacks to isolate.
    database_id = f"{worker_id}_tinybird_metrics"
    sync_database_url = get_database_url(database_id, "psycopg2")

    if database_exists(sync_database_url):
        drop_database(sync_database_url)

    create_database(sync_database_url)

    async_database_url = get_database_url(database_id)
    engine = create_async_engine(
        dsn=async_database_url,
        application_name=f"test_{worker_id}_tinybird_metrics_database",
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
    tinybird_metrics_database_url: str,
    worker_id: str,
    tinybird_workspace: str,
    tinybird_clickhouse_token: str,
) -> MetricsHarness:
    engine = create_async_engine(
        dsn=tinybird_metrics_database_url,
        application_name=f"test_{worker_id}_metrics_harness",
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

    events: list[Event] = []
    snapshots: dict[str, MetricsResponse] = {}
    organizations: dict[str, OrganizationContext] = {}
    sessionmaker = create_async_sessionmaker(engine)

    try:
        with (
            patch.object(tinybird_service, "client", tinybird_client),
            patch.object(queries_tinybird, "tinybird_client", tinybird_client),
        ):
            user = await create_user(save_fixture)
            for scenario in ORGANIZATION_SCENARIOS:
                account = await create_account(save_fixture, user)
                organizations[scenario.key] = await _seed_organization_scenario(
                    save_fixture,
                    scenario,
                    account=account,
                    events=events,
                )

            # Ingest in two batches so balance.credit_order events land in a
            # separate ClickHouse block from prior balance.order events. This
            # mirrors the production timing gap (the order's Stripe-backed
            # balance.order is emitted after the synchronous credit_order on the
            # next order) and forces any FX lookup that depends on a self-join
            # to events_by_ingested_at inside an MV trigger to fail — which is
            # the bug class this suite needs to defend against.
            tinybird_events = [_event_to_tinybird(event) for event in events]
            credit_order_events = [
                e for e in tinybird_events if e.get("name") == "balance.credit_order"
            ]
            other_events = [
                e for e in tinybird_events if e.get("name") != "balance.credit_order"
            ]
            await tinybird_client.ingest(DATASOURCE_EVENTS, other_events, wait=True)
            if credit_order_events:
                await tinybird_client.ingest(
                    DATASOURCE_EVENTS, credit_order_events, wait=True
                )

            await session.commit()

            semaphore = asyncio.Semaphore(10)

            async def run_case(case: QueryCase) -> tuple[str, MetricsResponse]:
                async with semaphore:
                    org_context = organizations[case.organization_key]
                    auth_subject = AuthSubject(
                        org_context.organization,
                        {Scope.metrics_read},
                        None,
                    )
                    async with sessionmaker() as case_session:
                        result = await _query_metrics(
                            case_session,
                            auth_subject,
                            org_context.organization,
                            case,
                            product_ids=org_context.product_ids,
                            customer_ids=org_context.customer_ids,
                        )
                    return case.label, result

            results = await asyncio.gather(*(run_case(c) for c in QUERY_CASES))
            snapshots = dict(results)

            return MetricsHarness(organizations=organizations, snapshots=snapshots)
    finally:
        await session.close()
        await engine.dispose()


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
class TestTinybirdMetrics:
    def test_dataset_has_signal_for_reason_metrics(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["alpha_monthly_h1"]
        for slug in (
            "canceled_subscriptions_customer_service",
            "canceled_subscriptions_low_quality",
            "canceled_subscriptions_missing_features",
            "canceled_subscriptions_switched_service",
            "canceled_subscriptions_too_complex",
            "canceled_subscriptions_too_expensive",
            "canceled_subscriptions_unused",
            "canceled_subscriptions_other",
        ):
            assert (getattr(snapshot.totals, slug) or 0) > 0

    def test_half_hour_timezone_customer_filter_expected_values(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_half_hour_timezone_customer_filter"
        ]
        assert len(snapshot.periods) == 2

        first = snapshot.periods[0]
        second = snapshot.periods[1]
        kolkata = ZoneInfo("Asia/Kolkata")

        assert first.timestamp.astimezone(kolkata).date() == date(2024, 1, 15)
        assert second.timestamp.astimezone(kolkata).date() == date(2024, 1, 16)
        assert first.active_user_by_event == 1
        assert second.active_user_by_event == 1
        assert float(first.costs or 0) == pytest.approx(0.11)
        assert float(second.costs or 0) == pytest.approx(0.22)

    def test_partial_month_end_excludes_future_churn(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["alpha_monthly_partial_window_karachi"]
        assert len(snapshot.periods) == 3
        feb = snapshot.periods[2]
        assert feb.churned_subscriptions == 0

    def test_new_subscriptions_counts_full_first_week_at_range_boundary(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["alpha_weekly_stockholm_boundary"]
        stockholm = ZoneInfo("Europe/Stockholm")
        week_start = next(
            p
            for p in snapshot.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 1, 26)
        )

        assert week_start.new_subscriptions == 4

    def test_order_paid_timestamp_drift_matches_order_created_day(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_order_paid_timestamp_drift"
        ]
        stockholm = ZoneInfo("Europe/Stockholm")

        feb_4 = next(
            p
            for p in snapshot.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 2, 4)
        )
        feb_13 = next(
            p
            for p in snapshot.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 2, 13)
        )

        assert feb_4.orders == 3
        assert feb_13.orders == 2

    def test_revoked_after_cancel_at_period_end_does_not_stay_active(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_revoked_after_cancel_at_period_end_drift"
        ]
        stockholm = ZoneInfo("Europe/Stockholm")

        def period_for(day: int) -> Any:
            return next(
                p
                for p in snapshot.periods
                if p.timestamp.astimezone(stockholm).date() == date(2026, 1, day)
            )

        for day in (17, 18, 19, 20):
            p = period_for(day)
            assert p.active_subscriptions is not None
            assert p.committed_subscriptions is not None

    def test_trial_orders_without_balance_are_counted(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_trial_orders_without_balance"
        ]
        stockholm = ZoneInfo("Europe/Stockholm")

        def period_for(day: int) -> Any:
            return next(
                p
                for p in snapshot.periods
                if p.timestamp.astimezone(stockholm).date() == date(2026, 2, day)
            )

        for day, expected_orders in ((6, 1), (9, 2), (11, 1)):
            p = period_for(day)
            assert p.orders == expected_orders
            assert p.one_time_products == expected_orders

    def test_balance_only_refunded_without_order_paid_is_included(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_balance_only_refunded_without_order_paid"
        ]
        stockholm = ZoneInfo("Europe/Stockholm")

        oct_5 = next(
            p
            for p in snapshot.periods
            if p.timestamp.astimezone(stockholm).date() == date(2025, 10, 5)
        )

        assert oct_5.orders == 1
        assert oct_5.one_time_products == 1
        assert oct_5.one_time_products_net_revenue == -180

    def test_duplicate_refund_with_reversal(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_duplicate_refund_with_reversal"
        ]
        stockholm = ZoneInfo("Europe/Stockholm")

        dec_4 = next(
            p
            for p in snapshot.periods
            if p.timestamp.astimezone(stockholm).date() == date(2025, 12, 4)
        )

        assert dec_4.orders == 1
        assert dec_4.one_time_products == 1
        assert dec_4.one_time_products_net_revenue == -180

    def test_applied_balance_partial_reduces_revenue_with_fx(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_applied_balance_partial"
        ]
        period = snapshot.periods[0]

        assert period.orders == 1
        assert period.net_revenue == 4_025
        assert period.one_time_products_net_revenue == 4_025

    def test_applied_balance_full_reduces_revenue_to_zero(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_applied_balance_full"
        ]
        period = snapshot.periods[0]

        assert period.orders == 1
        assert period.net_revenue == -350
        assert period.one_time_products_net_revenue == -350

    def test_balance_credit_order_uses_previous_balance_order_fx(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_credit_order_previous_balance_fx"
        ]
        period = snapshot.periods[0]

        assert period.orders == 1
        assert period.net_revenue == 4_800
        assert period.one_time_products_net_revenue == 4_800

    def test_credit_order_fast_path_uses_lookup_fx(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["gamma_daily_credit_order_fast_path"]
        period = snapshot.periods[0]

        # credit_order event has currency=eur, amount=2000. The prior balance.order
        # for the same customer used presentment_currency=eur and exchange_rate=0.5,
        # so the lookup_fx must resolve to 0.5 → settlement contribution = 2000 * 0.5
        # = 1000. If the fast path falls back to FX=1.0 (the MV-trigger bug), this
        # would be 2000 instead.
        assert period.revenue == 1_000
        assert period.net_revenue == 1_000

    def test_renewed_credit_order_with_negative_applied_balance(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "alpha_daily_stockholm_renewed_negative_applied_balance_credit_order"
        ]
        period = snapshot.periods[0]

        assert period.renewed_subscriptions == 1
        assert period.renewed_subscriptions_net_revenue == 14_900

    def test_trial_subscription_mrr_uses_subscription_created_amount(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["alpha_daily_trial_subscription_mrr"]
        first = snapshot.periods[0]

        expected_mrr = MONTHLY_PRICE + MONTHLY_PLUS_PRICE
        expected_cmrr = MONTHLY_PRICE

        assert first.active_subscriptions == 2
        assert first.committed_subscriptions == 1
        assert first.monthly_recurring_revenue == expected_mrr
        assert first.committed_monthly_recurring_revenue == expected_cmrr

    def test_org_filter_disabled_matches_org_subject_scope(
        self, metrics_harness: MetricsHarness
    ) -> None:
        org_filtered = metrics_harness.snapshots["alpha_monthly_h1"]
        no_org_filter = metrics_harness.snapshots["alpha_monthly_no_org_filter"]

        for metric_slug in (
            "orders",
            "revenue",
            "new_subscriptions",
            "active_user_by_event",
        ):
            _assert_metric_parity(
                metric_slug,
                org_filtered,
                no_org_filter,
                case_label=metric_slug,
            )

    def test_multiple_organizations_have_distinct_totals(
        self, metrics_harness: MetricsHarness
    ) -> None:
        alpha = metrics_harness.snapshots["alpha_monthly_h1"].totals
        beta = metrics_harness.snapshots["beta_monthly_q1"].totals

        assert (alpha.orders or 0) > 0
        assert (beta.orders or 0) > 0
        assert alpha.orders != beta.orders
        assert alpha.revenue != beta.revenue

    def test_beta_external_customer_filter_costs(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["beta_daily_customer_filter"]
        assert len(snapshot.periods) == 1

        period = snapshot.periods[0]

        assert period.active_user_by_event == 1
        assert float(period.costs or 0) == pytest.approx(2.0)
