from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import patch
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio

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
from polar.metrics.metrics import METRICS_TINYBIRD_SETTLEMENT
from polar.metrics.schemas import MetricsResponse
from polar.metrics.service import metrics as metrics_service
from polar.models import Customer, Event, Organization, Product, Subscription
from polar.models.event import EventSource
from polar.models.order import OrderStatus
from polar.models.product import ProductBillingType
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import get_database_url, save_fixture_factory
from tests.fixtures.random_objects import (
    create_customer,
    create_event,
    create_order,
    create_organization,
    create_payment_transaction,
    create_product,
    create_subscription,
)
from tests.fixtures.tinybird import tinybird_available

MONTHLY_PRICE = 50_00
MONTHLY_PLUS_PRICE = 80_00
YEARLY_PRICE = 600_00
ONE_TIME_PRICE = 100_00
FIXED_NOW = datetime(2024, 7, 1, tzinfo=UTC)

SETTLEMENT_METRIC_SLUGS = [m.slug for m in METRICS_TINYBIRD_SETTLEMENT]


@dataclass(frozen=True)
class QueryCase:
    label: str
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
class CaseSnapshot:
    pg: MetricsResponse
    tinybird: MetricsResponse


@dataclass
class MetricsHarness:
    organization_id: UUID
    product_ids: dict[str, UUID]
    customer_ids: dict[str, UUID]
    snapshots: dict[str, CaseSnapshot]


QUERY_CASES: tuple[QueryCase, ...] = (
    QueryCase(
        label="monthly_h1",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
    ),
    QueryCase(
        label="weekly_q1",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 31),
        interval=TimeInterval.week,
    ),
    QueryCase(
        label="daily_feb",
        start_date=date(2024, 2, 1),
        end_date=date(2024, 2, 29),
        interval=TimeInterval.day,
    ),
    QueryCase(
        label="monthly_recurring_filter",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
        billing_types=(ProductBillingType.recurring,),
    ),
    QueryCase(
        label="monthly_product_filter",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
        product_keys=("monthly",),
    ),
    QueryCase(
        label="daily_customer_filter",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        interval=TimeInterval.day,
        customer_keys=("external_match",),
    ),
    QueryCase(
        label="daily_half_hour_timezone_customer_filter",
        start_date=date(2024, 1, 15),
        end_date=date(2024, 1, 16),
        interval=TimeInterval.day,
        timezone="Asia/Kolkata",
        customer_keys=("external_match",),
    ),
    QueryCase(
        label="monthly_no_org_filter",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 6, 30),
        interval=TimeInterval.month,
        include_organization_filter=False,
    ),
    QueryCase(
        label="monthly_partial_month_karachi_customer",
        start_date=date(2025, 12, 30),
        end_date=date(2026, 2, 13),
        interval=TimeInterval.month,
        timezone="Asia/Karachi",
        customer_keys=("partial_window_churn",),
    ),
    QueryCase(
        label="monthly_paris_orders_fallback",
        start_date=date(2025, 8, 10),
        end_date=date(2026, 2, 13),
        interval=TimeInterval.month,
        timezone="Europe/Paris",
        metrics=("orders", "revenue", "cumulative_revenue"),
    ),
    QueryCase(
        label="monthly_moscow_net_revenue_fallback",
        start_date=date(2025, 12, 4),
        end_date=date(2026, 2, 13),
        interval=TimeInterval.month,
        timezone="Europe/Moscow",
        customer_keys=("moscow_net_missing_balance",),
        metrics=(
            "net_average_order_value",
            "renewed_subscriptions_net_revenue",
            "net_revenue",
            "net_cumulative_revenue",
        ),
    ),
    QueryCase(
        label="monthly_canary_new_subscriptions_revenue_missing_balance",
        start_date=date(2026, 3, 1),
        end_date=date(2026, 4, 13),
        interval=TimeInterval.month,
        timezone="Atlantic/Canary",
        product_keys=("monthly",),
        customer_keys=("canary_new_subscriptions_missing_balance",),
        metrics=("new_subscriptions_revenue",),
    ),
    QueryCase(
        label="daily_jerusalem_renewed_missing_balance",
        start_date=date(2026, 1, 13),
        end_date=date(2026, 2, 13),
        interval=TimeInterval.day,
        timezone="Asia/Jerusalem",
        metrics=(
            "monthly_recurring_revenue",
            "committed_monthly_recurring_revenue",
            "active_subscriptions",
            "new_subscriptions",
            "committed_subscriptions",
            "renewed_subscriptions",
            "average_revenue_per_user",
            "ltv",
            "new_subscriptions_revenue",
            "renewed_subscriptions_revenue",
        ),
    ),
    QueryCase(
        label="daily_calcutta_order_created_at_without_balance",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 3),
        interval=TimeInterval.day,
        timezone="Asia/Calcutta",
        customer_keys=("delayed_created_at",),
        metrics=("orders",),
    ),
    QueryCase(
        label="daily_shanghai_delayed_order_paid_without_balance",
        start_date=date(2026, 2, 13),
        end_date=date(2026, 2, 14),
        interval=TimeInterval.day,
        timezone="Asia/Shanghai",
        customer_keys=("shanghai_delayed_missing_balance",),
        metrics=(
            "orders",
            "revenue",
            "net_revenue",
            "cumulative_revenue",
            "net_cumulative_revenue",
            "average_order_value",
            "net_average_order_value",
            "one_time_products",
            "one_time_products_revenue",
            "one_time_products_net_revenue",
        ),
    ),
    QueryCase(
        label="daily_berlin_refund_join_duplication",
        start_date=date(2026, 1, 22),
        end_date=date(2026, 1, 24),
        interval=TimeInterval.day,
        timezone="Europe/Berlin",
        customer_keys=("refund_join_duplication",),
        metrics=("renewed_subscriptions",),
    ),
    QueryCase(
        label="weekly_stockholm_new_subscriptions_boundary",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 28),
        interval=TimeInterval.week,
        timezone="Europe/Stockholm",
        customer_keys=("weekly_boundary_new_subscriptions",),
        metrics=("new_subscriptions",),
    ),
    QueryCase(
        label="daily_stockholm_product_update_same_timestamp",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 6),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        product_keys=("monthly",),
        customer_keys=("product_update_same_timestamp",),
        metrics=(
            "new_subscriptions",
            "active_subscriptions",
            "committed_subscriptions",
        ),
    ),
    QueryCase(
        label="daily_stockholm_missing_created_product_id",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 6),
        interval=TimeInterval.day,
        timezone="Europe/Stockholm",
        product_keys=("monthly",),
        customer_keys=("missing_created_product_id",),
        metrics=(
            "new_subscriptions",
            "active_subscriptions",
            "committed_subscriptions",
        ),
    ),
    QueryCase(
        label="daily_amsterdam_canceled_replay_reason_drift",
        start_date=date(2026, 1, 14),
        end_date=date(2026, 2, 13),
        interval=TimeInterval.day,
        timezone="Europe/Amsterdam",
        customer_keys=("amsterdam_canceled_replay",),
        metrics=(
            "canceled_subscriptions",
            "canceled_subscriptions_other",
            "canceled_subscriptions_low_quality",
        ),
    ),
    QueryCase(
        label="daily_ho_chi_minh_canceled_replay_reason_drift",
        start_date=date(2026, 1, 14),
        end_date=date(2026, 2, 13),
        interval=TimeInterval.day,
        timezone="Asia/Ho_Chi_Minh",
        customer_keys=("ho_chi_minh_canceled_replay",),
        metrics=(
            "canceled_subscriptions",
            "canceled_subscriptions_other",
            "canceled_subscriptions_low_quality",
        ),
    ),
)


def _dt(d: date, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=UTC)


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
    metric_slug: str, pg: MetricsResponse, tb: MetricsResponse, *, case_label: str
) -> None:
    assert len(pg.periods) == len(tb.periods), f"[{case_label}] period length mismatch"
    for i, (pg_period, tb_period) in enumerate(
        zip(pg.periods, tb.periods, strict=True)
    ):
        assert pg_period.timestamp == tb_period.timestamp
        pg_value = _number_or_zero(getattr(pg_period, metric_slug, None))
        tb_value = _number_or_zero(getattr(tb_period, metric_slug, None))
        _assert_number_equal(
            pg_value,
            tb_value,
            label=(
                f"[{case_label}] period={i} ts={pg_period.timestamp.isoformat()} "
                f"metric={metric_slug} pg={pg_value} tb={tb_value}"
            ),
        )

    pg_total = _number_or_zero(getattr(pg.totals, metric_slug, None))
    tb_total = _number_or_zero(getattr(tb.totals, metric_slug, None))
    _assert_number_equal(
        pg_total,
        tb_total,
        label=f"[{case_label}] totals metric={metric_slug} pg={pg_total} tb={tb_total}",
    )


async def _create_subscription_created_event(
    save_fixture: Any,
    organization: Organization,
    customer: Customer,
    subscription: Subscription,
    product: Product,
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
    canceled_at: date,
    ends_at: date,
    customer_cancellation_reason: str,
) -> Event:
    return await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.subscription_canceled.value,
        timestamp=_dt(canceled_at),
        metadata={
            "subscription_id": str(subscription.id),
            "canceled_at": _dt(canceled_at).isoformat(),
            "ends_at": _dt(ends_at).isoformat(),
            "customer_cancellation_reason": customer_cancellation_reason,
        },
    )


async def _create_paid_order_events(
    save_fixture: Any,
    organization: Organization,
    customer: Customer,
    product: Product,
    *,
    ordered_on: date,
    amount: int,
    subscription: Subscription | None = None,
    include_order_paid: bool = True,
    include_balance: bool = True,
) -> list[Event]:
    order = await create_order(
        save_fixture,
        customer=customer,
        product=product,
        status=OrderStatus.paid,
        subtotal_amount=amount,
        created_at=_dt(ordered_on),
        subscription=subscription,
    )
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
    }
    if subscription is not None:
        common_metadata["subscription_id"] = str(subscription.id)

    balance_metadata = {
        **common_metadata,
        "transaction_id": str(transaction.id),
        "presentment_amount": order.net_amount,
        "presentment_currency": "usd",
        "fee": 0,
        "order_created_at": _dt(ordered_on).isoformat(),
    }
    emitted_events: list[Event] = []
    if include_balance:
        balance_order = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.balance_order.value,
            timestamp=_dt(ordered_on),
            metadata=balance_metadata,
        )
        emitted_events.append(balance_order)
    if not include_order_paid:
        return emitted_events

    order_paid = await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.order_paid.value,
        timestamp=_dt(ordered_on),
        metadata=common_metadata,
    )
    emitted_events.insert(0, order_paid)

    return emitted_events


async def _query_metrics(
    session: AsyncSession,
    auth_subject: AuthSubject[Organization],
    organization: Organization,
    case: QueryCase,
    *,
    tinybird_read: bool,
    product_ids: dict[str, UUID],
    customer_ids: dict[str, UUID],
) -> MetricsResponse:
    organization.feature_settings = {
        **organization.feature_settings,
        "tinybird_read": tinybird_read,
        "tinybird_compare": False,
    }
    await session.flush()

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
async def metrics_harness(worker_id: str, tinybird_workspace: str) -> MetricsHarness:
    engine = create_async_engine(
        dsn=get_database_url(worker_id),
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
        clickhouse_token=tinybird_workspace,
    )

    events: list[Event] = []
    snapshots: dict[str, CaseSnapshot] = {}

    try:
        with (
            patch.object(tinybird_service, "client", tinybird_client),
            patch.object(queries_tinybird, "tinybird_client", tinybird_client),
            patch.object(settings, "TINYBIRD_EVENTS_READ", True),
        ):
            organization = await create_organization(save_fixture)
            organization.feature_settings = {
                **organization.feature_settings,
                "tinybird_read": True,
                "tinybird_compare": False,
            }
            await save_fixture(organization)

            another_organization = await create_organization(save_fixture)

            products = {
                "monthly": await create_product(
                    save_fixture,
                    organization=organization,
                    recurring_interval=SubscriptionRecurringInterval.month,
                    prices=[(MONTHLY_PRICE, "usd")],
                ),
                "monthly_40": await create_product(
                    save_fixture,
                    organization=organization,
                    recurring_interval=SubscriptionRecurringInterval.month,
                    prices=[(40_00, "usd")],
                ),
                "monthly_plus": await create_product(
                    save_fixture,
                    organization=organization,
                    recurring_interval=SubscriptionRecurringInterval.month,
                    prices=[(MONTHLY_PLUS_PRICE, "usd")],
                ),
                "yearly": await create_product(
                    save_fixture,
                    organization=organization,
                    recurring_interval=SubscriptionRecurringInterval.year,
                    prices=[(YEARLY_PRICE, "usd")],
                ),
                "yearly_zero": await create_product(
                    save_fixture,
                    organization=organization,
                    recurring_interval=SubscriptionRecurringInterval.year,
                    prices=[(0, "usd")],
                ),
                "one_time": await create_product(
                    save_fixture,
                    organization=organization,
                    recurring_interval=None,
                    prices=[(ONE_TIME_PRICE, "usd")],
                ),
            }

            customer_ids: dict[str, UUID] = {}

            async def create_customer_with_data(
                key: str,
                *,
                external_id: str | None = None,
                subscriptions: list[dict[str, Any]] | None = None,
                one_time_orders: list[date] | None = None,
            ) -> None:
                customer = await create_customer(
                    save_fixture,
                    organization=organization,
                    email=f"{key}@example.com",
                    name=key,
                    external_id=external_id,
                    stripe_customer_id=f"cus_{key}",
                )
                customer_ids[key] = customer.id

                for subscription_data in subscriptions or []:
                    product = products[subscription_data["product"]]
                    subscription = await create_subscription(
                        save_fixture,
                        product=product,
                        customer=customer,
                        status=SubscriptionStatus.active,
                        started_at=_dt(subscription_data["start"]),
                        ended_at=(
                            _dt(subscription_data["end"])
                            if "end" in subscription_data
                            else None
                        ),
                        ends_at=(
                            _dt(subscription_data["end"])
                            if "end" in subscription_data
                            else None
                        ),
                    )
                    if "cancel" in subscription_data:
                        subscription.canceled_at = _dt(subscription_data["cancel"])
                        subscription.customer_cancellation_reason = (
                            CustomerCancellationReason(subscription_data["reason"])
                        )
                        await save_fixture(subscription)

                    events.append(
                        await _create_subscription_created_event(
                            save_fixture,
                            organization,
                            customer,
                            subscription,
                            product,
                        )
                    )
                    events.extend(
                        await _create_paid_order_events(
                            save_fixture,
                            organization,
                            customer,
                            product,
                            ordered_on=subscription_data["start"],
                            amount=subscription_data["amount"],
                            subscription=subscription,
                        )
                    )

                    for renewal in subscription_data.get("renewals", []):
                        events.extend(
                            await _create_paid_order_events(
                                save_fixture,
                                organization,
                                customer,
                                product,
                                ordered_on=renewal,
                                amount=subscription_data["amount"],
                                subscription=subscription,
                            )
                        )

                    if "cancel" in subscription_data:
                        events.append(
                            await _create_subscription_canceled_event(
                                save_fixture,
                                organization,
                                customer,
                                subscription,
                                canceled_at=subscription_data["cancel"],
                                ends_at=subscription_data["end"],
                                customer_cancellation_reason=subscription_data[
                                    "reason"
                                ],
                            )
                        )

                for one_time_order_date in one_time_orders or []:
                    events.extend(
                        await _create_paid_order_events(
                            save_fixture,
                            organization,
                            customer,
                            products["one_time"],
                            ordered_on=one_time_order_date,
                            amount=ONE_TIME_PRICE,
                        )
                    )

            await create_customer_with_data(
                "loyal_monthly",
                subscriptions=[
                    {
                        "product": "monthly",
                        "start": date(2024, 1, 1),
                        "renewals": [
                            date(2024, 2, 1),
                            date(2024, 3, 1),
                            date(2024, 4, 1),
                            date(2024, 5, 1),
                            date(2024, 6, 1),
                        ],
                        "amount": MONTHLY_PRICE,
                    }
                ],
            )
            await create_customer_with_data(
                "yearly_subscriber",
                subscriptions=[
                    {
                        "product": "yearly",
                        "start": date(2024, 1, 1),
                        "amount": YEARLY_PRICE,
                    }
                ],
            )
            await create_customer_with_data(
                "one_time_buyer",
                one_time_orders=[date(2024, 1, 10), date(2024, 4, 20)],
            )
            await create_customer_with_data(
                "monthly_plus_customer",
                subscriptions=[
                    {
                        "product": "monthly_plus",
                        "start": date(2024, 4, 1),
                        "renewals": [date(2024, 5, 1), date(2024, 6, 1)],
                        "amount": MONTHLY_PLUS_PRICE,
                    }
                ],
            )
            await create_customer_with_data(
                "external_match",
                external_id="ext-boundary",
                subscriptions=[
                    {
                        "product": "monthly",
                        "start": date(2024, 1, 5),
                        "renewals": [date(2024, 2, 5)],
                        "amount": MONTHLY_PRICE,
                    }
                ],
            )
            await create_customer_with_data(
                "weekly_boundary_new_subscriptions",
                subscriptions=[
                    {
                        "product": "monthly",
                        "start": date(2026, 1, 26),
                        "amount": MONTHLY_PRICE,
                    },
                    {
                        "product": "monthly",
                        "start": date(2026, 1, 28),
                        "amount": MONTHLY_PRICE,
                    },
                    {
                        "product": "monthly",
                        "start": date(2026, 1, 31),
                        "amount": MONTHLY_PRICE,
                    },
                    {
                        "product": "monthly",
                        "start": date(2026, 2, 1),
                        "amount": MONTHLY_PRICE,
                    },
                ],
            )
            await create_customer_with_data(
                "partial_window_churn",
                subscriptions=[
                    {
                        "product": "monthly",
                        "start": date(2026, 1, 1),
                        "renewals": [date(2026, 2, 1)],
                        "cancel": date(2026, 1, 15),
                        "end": date(2026, 2, 20),
                        "reason": "too_expensive",
                        "amount": MONTHLY_PRICE,
                    }
                ],
            )
            product_update_tie_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="product-update-tie@example.com",
                name="product_update_same_timestamp",
                stripe_customer_id="cus_product_update_tie",
            )
            customer_ids["product_update_same_timestamp"] = (
                product_update_tie_customer.id
            )
            product_update_tie_sub = await create_subscription(
                save_fixture,
                product=products["yearly_zero"],
                customer=product_update_tie_customer,
                status=SubscriptionStatus.active,
                started_at=_dt(date(2026, 2, 3)),
            )
            tied_ts = _dt(date(2026, 2, 3), 9, 0)
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=product_update_tie_customer,
                    source=EventSource.system,
                    name=SystemEvent.subscription_created.value,
                    timestamp=tied_ts,
                    metadata={
                        "subscription_id": str(product_update_tie_sub.id),
                        "product_id": str(products["monthly"].id),
                        "customer_id": str(product_update_tie_customer.id),
                        "started_at": product_update_tie_sub.started_at.isoformat()
                        if product_update_tie_sub.started_at
                        else None,
                        "recurring_interval": SubscriptionRecurringInterval.month.value,
                        "recurring_interval_count": 1,
                    },
                )
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=product_update_tie_customer,
                    source=EventSource.system,
                    name=SystemEvent.subscription_product_updated.value,
                    timestamp=tied_ts,
                    metadata={
                        "subscription_id": str(product_update_tie_sub.id),
                        "old_product_id": str(products["monthly"].id),
                        "new_product_id": str(products["yearly_zero"].id),
                    },
                )
            )
            missing_created_product_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="missing-created-product-id@example.com",
                name="missing_created_product_id",
                stripe_customer_id="cus_missing_created_product_id",
            )
            customer_ids["missing_created_product_id"] = (
                missing_created_product_customer.id
            )
            missing_created_product_sub = await create_subscription(
                save_fixture,
                product=products["monthly"],
                customer=missing_created_product_customer,
                status=SubscriptionStatus.active,
                started_at=_dt(date(2026, 2, 3)),
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=missing_created_product_customer,
                    source=EventSource.system,
                    name=SystemEvent.subscription_created.value,
                    timestamp=_dt(date(2026, 2, 3), 9, 0),
                    metadata={
                        "subscription_id": str(missing_created_product_sub.id),
                        "customer_id": str(missing_created_product_customer.id),
                        "started_at": missing_created_product_sub.started_at.isoformat()
                        if missing_created_product_sub.started_at
                        else None,
                        "recurring_interval": SubscriptionRecurringInterval.month.value,
                        "recurring_interval_count": 1,
                    },
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    missing_created_product_customer,
                    products["monthly"],
                    ordered_on=date(2026, 2, 3),
                    amount=MONTHLY_PRICE,
                    subscription=missing_created_product_sub,
                )
            )
            amsterdam_canceled_replay_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="amsterdam-canceled-replay@example.com",
                name="amsterdam_canceled_replay",
                stripe_customer_id="cus_amsterdam_canceled_replay",
            )
            customer_ids["amsterdam_canceled_replay"] = (
                amsterdam_canceled_replay_customer.id
            )

            async def create_canceled_subscription_with_events(
                *,
                started_on: date = date(2026, 1, 1),
                canceled_on: date,
                reason: CustomerCancellationReason,
                initial_event_reason: str | None = None,
                replay_timestamp: datetime | None = None,
                replay_canceled_at: datetime | None = None,
                replay_ends_at: datetime | None = None,
                replay_reason: str | None = None,
                replay_include_canceled_at: bool = True,
            ) -> None:
                subscription = await create_subscription(
                    save_fixture,
                    product=products["monthly"],
                    customer=amsterdam_canceled_replay_customer,
                    status=SubscriptionStatus.active,
                    started_at=_dt(started_on),
                    ended_at=_dt(canceled_on),
                    ends_at=_dt(canceled_on),
                )
                subscription.canceled_at = _dt(canceled_on)
                subscription.customer_cancellation_reason = reason
                await save_fixture(subscription)

                events.append(
                    await _create_subscription_created_event(
                        save_fixture,
                        organization,
                        amsterdam_canceled_replay_customer,
                        subscription,
                        products["monthly"],
                    )
                )
                events.extend(
                    await _create_paid_order_events(
                        save_fixture,
                        organization,
                        amsterdam_canceled_replay_customer,
                        products["monthly"],
                        ordered_on=started_on,
                        amount=MONTHLY_PRICE,
                        subscription=subscription,
                    )
                )

                events.append(
                    await _create_subscription_canceled_event(
                        save_fixture,
                        organization,
                        amsterdam_canceled_replay_customer,
                        subscription,
                        canceled_at=canceled_on,
                        ends_at=canceled_on,
                        customer_cancellation_reason=(
                            initial_event_reason
                            if initial_event_reason is not None
                            else reason.value
                        ),
                    )
                )

                if replay_timestamp is None:
                    return

                replay_metadata: dict[str, Any] = {
                    "subscription_id": str(subscription.id),
                    "customer_id": str(amsterdam_canceled_replay_customer.id),
                    "ends_at": (replay_ends_at or _dt(canceled_on)).isoformat(),
                    "customer_cancellation_reason": (
                        replay_reason if replay_reason is not None else reason.value
                    ),
                }
                if replay_include_canceled_at:
                    replay_metadata["canceled_at"] = (
                        replay_canceled_at.isoformat()
                        if replay_canceled_at is not None
                        else _dt(canceled_on).isoformat()
                    )

                events.append(
                    await create_event(
                        save_fixture,
                        organization=organization,
                        customer=amsterdam_canceled_replay_customer,
                        source=EventSource.system,
                        name=SystemEvent.subscription_canceled.value,
                        timestamp=replay_timestamp,
                        metadata=replay_metadata,
                    )
                )

            await create_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 14),
                reason=CustomerCancellationReason.other,
                initial_event_reason=CustomerCancellationReason.low_quality.value,
                replay_timestamp=_dt(date(2026, 1, 18), 10, 0),
                replay_canceled_at=_dt(date(2026, 1, 14), 10, 0),
                replay_ends_at=_dt(date(2026, 1, 14), 10, 0),
                replay_reason="",
            )
            await create_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 14),
                reason=CustomerCancellationReason.other,
            )
            await create_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 20),
                reason=CustomerCancellationReason.other,
            )
            await create_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 20),
                reason=CustomerCancellationReason.low_quality,
                replay_timestamp=_dt(date(2026, 1, 25), 10, 0),
                replay_canceled_at=_dt(date(2026, 1, 14), 10, 0),
                replay_ends_at=_dt(date(2026, 1, 20), 10, 0),
                replay_reason=CustomerCancellationReason.other.value,
            )
            await create_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 30),
                reason=CustomerCancellationReason.other,
                replay_timestamp=_dt(date(2026, 2, 1), 10, 0),
                replay_canceled_at=_dt(date(2026, 1, 10), 10, 0),
                replay_ends_at=_dt(date(2026, 1, 30), 10, 0),
                replay_reason=CustomerCancellationReason.other.value,
            )
            await create_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 30),
                reason=CustomerCancellationReason.other,
            )
            ho_chi_minh_canceled_replay_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="ho-chi-minh-canceled-replay@example.com",
                name="ho_chi_minh_canceled_replay",
                stripe_customer_id="cus_ho_chi_minh_canceled_replay",
            )
            customer_ids["ho_chi_minh_canceled_replay"] = (
                ho_chi_minh_canceled_replay_customer.id
            )

            async def create_hcm_canceled_subscription_with_events(
                *,
                started_on: date = date(2026, 1, 1),
                canceled_on: date,
                reason: CustomerCancellationReason,
                replay_timestamp: datetime | None = None,
                replay_canceled_at: datetime | None = None,
                replay_ends_at: datetime | None = None,
                replay_reason: str | None = None,
                replay_include_canceled_at: bool = True,
            ) -> None:
                subscription = await create_subscription(
                    save_fixture,
                    product=products["monthly"],
                    customer=ho_chi_minh_canceled_replay_customer,
                    status=SubscriptionStatus.active,
                    started_at=_dt(started_on),
                    ended_at=_dt(canceled_on),
                    ends_at=_dt(canceled_on),
                )
                subscription.canceled_at = _dt(canceled_on)
                subscription.customer_cancellation_reason = reason
                await save_fixture(subscription)

                events.append(
                    await _create_subscription_created_event(
                        save_fixture,
                        organization,
                        ho_chi_minh_canceled_replay_customer,
                        subscription,
                        products["monthly"],
                    )
                )
                events.extend(
                    await _create_paid_order_events(
                        save_fixture,
                        organization,
                        ho_chi_minh_canceled_replay_customer,
                        products["monthly"],
                        ordered_on=started_on,
                        amount=MONTHLY_PRICE,
                        subscription=subscription,
                    )
                )

                events.append(
                    await _create_subscription_canceled_event(
                        save_fixture,
                        organization,
                        ho_chi_minh_canceled_replay_customer,
                        subscription,
                        canceled_at=canceled_on,
                        ends_at=canceled_on,
                        customer_cancellation_reason=reason.value,
                    )
                )

                if replay_timestamp is None:
                    return

                replay_metadata: dict[str, Any] = {
                    "subscription_id": str(subscription.id),
                    "customer_id": str(ho_chi_minh_canceled_replay_customer.id),
                    "ends_at": (replay_ends_at or _dt(canceled_on)).isoformat(),
                    "customer_cancellation_reason": (
                        replay_reason if replay_reason is not None else reason.value
                    ),
                }
                if replay_include_canceled_at:
                    replay_metadata["canceled_at"] = (
                        replay_canceled_at.isoformat()
                        if replay_canceled_at is not None
                        else _dt(canceled_on).isoformat()
                    )

                events.append(
                    await create_event(
                        save_fixture,
                        organization=organization,
                        customer=ho_chi_minh_canceled_replay_customer,
                        source=EventSource.system,
                        name=SystemEvent.subscription_canceled.value,
                        timestamp=replay_timestamp,
                        metadata=replay_metadata,
                    )
                )

            await create_hcm_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 14),
                reason=CustomerCancellationReason.other,
            )
            await create_hcm_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 14),
                reason=CustomerCancellationReason.other,
            )
            await create_hcm_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 14),
                reason=CustomerCancellationReason.low_quality,
            )
            await create_hcm_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 20),
                reason=CustomerCancellationReason.other,
            )
            await create_hcm_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 20),
                reason=CustomerCancellationReason.low_quality,
                replay_timestamp=_dt(date(2026, 1, 25), 10, 0),
                replay_canceled_at=_dt(date(2026, 1, 14), 10, 0),
                replay_ends_at=_dt(date(2026, 1, 20), 10, 0),
                replay_reason=CustomerCancellationReason.other.value,
            )
            await create_hcm_canceled_subscription_with_events(
                canceled_on=date(2026, 1, 30),
                reason=CustomerCancellationReason.other,
                replay_timestamp=_dt(date(2026, 2, 1), 10, 0),
                replay_canceled_at=_dt(date(2026, 1, 10), 10, 0),
                replay_ends_at=_dt(date(2026, 1, 30), 10, 0),
                replay_reason=CustomerCancellationReason.other.value,
            )
            await create_customer_with_data(
                "missing_order_paid",
                one_time_orders=[],
            )
            renewed_missing_balance_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="renewed-missing-balance@example.com",
                name="renewed_missing_balance",
                stripe_customer_id="cus_renewed_missing_balance",
            )
            customer_ids["renewed_missing_balance"] = (
                renewed_missing_balance_customer.id
            )
            renewed_missing_balance_sub = await create_subscription(
                save_fixture,
                product=products["monthly"],
                customer=renewed_missing_balance_customer,
                status=SubscriptionStatus.active,
                started_at=_dt(date(2026, 1, 20)),
            )
            events.append(
                await _create_subscription_created_event(
                    save_fixture,
                    organization,
                    renewed_missing_balance_customer,
                    renewed_missing_balance_sub,
                    products["monthly"],
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    renewed_missing_balance_customer,
                    products["monthly"],
                    ordered_on=date(2026, 1, 20),
                    amount=MONTHLY_PRICE,
                    subscription=renewed_missing_balance_sub,
                )
            )
            for renewed_on in (date(2026, 2, 9), date(2026, 2, 10), date(2026, 2, 12)):
                events.extend(
                    await _create_paid_order_events(
                        save_fixture,
                        organization,
                        renewed_missing_balance_customer,
                        products["monthly"],
                        ordered_on=renewed_on,
                        amount=MONTHLY_PRICE,
                        subscription=renewed_missing_balance_sub,
                        include_balance=False,
                    )
                )
            delayed_created_at_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="delayed-created-at@example.com",
                name="delayed_created_at",
                stripe_customer_id="cus_delayed_created_at",
            )
            customer_ids["delayed_created_at"] = delayed_created_at_customer.id
            delayed_created_order = await create_order(
                save_fixture,
                customer=delayed_created_at_customer,
                product=products["one_time"],
                status=OrderStatus.paid,
                subtotal_amount=ONE_TIME_PRICE,
                created_at=_dt(date(2026, 2, 1)),
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=delayed_created_at_customer,
                    source=EventSource.system,
                    name=SystemEvent.order_paid.value,
                    timestamp=_dt(date(2026, 2, 2)),
                    metadata={
                        "order_id": str(delayed_created_order.id),
                        "order_created_at": _dt(date(2026, 2, 1)).isoformat(),
                        "product_id": str(products["one_time"].id),
                        "billing_type": ProductBillingType.one_time.value,
                        "amount": delayed_created_order.net_amount,
                        "net_amount": delayed_created_order.net_amount,
                        "currency": "usd",
                        "tax_amount": delayed_created_order.tax_amount,
                    },
                )
            )
            refund_dup_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="refund-duplication@example.com",
                name="refund_join_duplication",
                stripe_customer_id="cus_refund_join_duplication",
            )
            customer_ids["refund_join_duplication"] = refund_dup_customer.id
            refund_dup_subscription = await create_subscription(
                save_fixture,
                product=products["monthly"],
                customer=refund_dup_customer,
                status=SubscriptionStatus.active,
                started_at=_dt(date(2026, 1, 1)),
            )
            events.append(
                await _create_subscription_created_event(
                    save_fixture,
                    organization,
                    refund_dup_customer,
                    refund_dup_subscription,
                    products["monthly"],
                )
            )
            refund_dup_order = await create_order(
                save_fixture,
                customer=refund_dup_customer,
                product=products["monthly"],
                status=OrderStatus.paid,
                subtotal_amount=MONTHLY_PRICE,
                created_at=_dt(date(2026, 1, 22)),
                subscription=refund_dup_subscription,
            )
            refund_dup_transaction = await create_payment_transaction(
                save_fixture,
                order=refund_dup_order,
                amount=refund_dup_order.net_amount,
                tax_amount=refund_dup_order.tax_amount,
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=refund_dup_customer,
                    source=EventSource.system,
                    name=SystemEvent.order_paid.value,
                    timestamp=_dt(date(2026, 1, 23)),
                    metadata={
                        "order_id": str(refund_dup_order.id),
                        "product_id": str(products["monthly"].id),
                        "billing_type": ProductBillingType.recurring.value,
                        "amount": refund_dup_order.net_amount,
                        "net_amount": refund_dup_order.net_amount,
                        "currency": "usd",
                        "tax_amount": refund_dup_order.tax_amount,
                        "subscription_id": str(refund_dup_subscription.id),
                    },
                )
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=refund_dup_customer,
                    source=EventSource.system,
                    name=SystemEvent.balance_order.value,
                    timestamp=_dt(date(2026, 1, 23)),
                    metadata={
                        "transaction_id": str(refund_dup_transaction.id),
                        "order_id": str(refund_dup_order.id),
                        "order_created_at": _dt(date(2026, 1, 22)).isoformat(),
                        "product_id": str(products["monthly"].id),
                        "subscription_id": str(refund_dup_subscription.id),
                        "amount": refund_dup_order.net_amount,
                        "net_amount": refund_dup_order.net_amount,
                        "currency": "usd",
                        "presentment_amount": refund_dup_order.net_amount,
                        "presentment_currency": "usd",
                        "tax_amount": refund_dup_order.tax_amount,
                        "fee": 0,
                    },
                )
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=refund_dup_customer,
                    source=EventSource.system,
                    name=SystemEvent.balance_refund.value,
                    timestamp=_dt(date(2026, 1, 24)),
                    metadata={
                        "transaction_id": str(refund_dup_transaction.id),
                        "refund_id": str(uuid4()),
                        "order_id": str(refund_dup_order.id),
                        "subscription_id": str(refund_dup_subscription.id),
                        "amount": -refund_dup_order.net_amount,
                        "currency": "usd",
                        "presentment_amount": -refund_dup_order.net_amount,
                        "presentment_currency": "usd",
                        "tax_amount": 0,
                        "fee": 0,
                    },
                )
            )

            cancellation_reasons = [
                "customer_service",
                "low_quality",
                "missing_features",
                "switched_service",
                "too_complex",
                "too_expensive",
                "unused",
                "other",
            ]
            for i, reason in enumerate(cancellation_reasons):
                start_day = 2 + i
                cancel_day = 10 + i
                await create_customer_with_data(
                    f"cancel_{reason}",
                    subscriptions=[
                        {
                            "product": "monthly",
                            "start": date(2024, 3, start_day),
                            "cancel": date(2024, 3, cancel_day),
                            "end": date(2024, 4, 1),
                            "reason": reason,
                            "amount": MONTHLY_PRICE,
                        }
                    ],
                )

            external_match_customer = await session.get(
                Customer, customer_ids["external_match"]
            )
            assert external_match_customer is not None

            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    source=EventSource.user,
                    name="api.call",
                    timestamp=_dt(date(2024, 1, 15), 18, 25),
                    external_customer_id="ext-boundary",
                    metadata={"_cost": {"amount": 0.11, "currency": "usd"}},
                )
            )

            missing_order_paid_customer = await session.get(
                Customer, customer_ids["missing_order_paid"]
            )
            assert missing_order_paid_customer is not None
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    missing_order_paid_customer,
                    products["one_time"],
                    ordered_on=date(2025, 10, 10),
                    amount=ONE_TIME_PRICE,
                    include_order_paid=False,
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    missing_order_paid_customer,
                    products["one_time"],
                    ordered_on=date(2025, 10, 20),
                    amount=ONE_TIME_PRICE,
                    include_order_paid=False,
                )
            )
            moscow_net_missing_balance_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="moscow-net-missing-balance@example.com",
                name="moscow_net_missing_balance",
                stripe_customer_id="cus_moscow_net_missing_balance",
            )
            customer_ids["moscow_net_missing_balance"] = (
                moscow_net_missing_balance_customer.id
            )
            moscow_net_missing_balance_subscription = await create_subscription(
                save_fixture,
                product=products["monthly_40"],
                customer=moscow_net_missing_balance_customer,
                status=SubscriptionStatus.active,
                started_at=_dt(date(2025, 12, 10)),
            )
            events.append(
                await _create_subscription_created_event(
                    save_fixture,
                    organization,
                    moscow_net_missing_balance_customer,
                    moscow_net_missing_balance_subscription,
                    products["monthly_40"],
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    moscow_net_missing_balance_customer,
                    products["monthly_40"],
                    ordered_on=date(2025, 12, 10),
                    amount=40_00,
                    subscription=moscow_net_missing_balance_subscription,
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    moscow_net_missing_balance_customer,
                    products["monthly_40"],
                    ordered_on=date(2026, 1, 10),
                    amount=40_00,
                    subscription=moscow_net_missing_balance_subscription,
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    moscow_net_missing_balance_customer,
                    products["monthly_40"],
                    ordered_on=date(2026, 2, 11),
                    amount=40_00,
                    subscription=moscow_net_missing_balance_subscription,
                    include_balance=False,
                )
            )
            canary_new_subscriptions_missing_balance_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="canary-new-subscriptions-missing-balance@example.com",
                name="canary_new_subscriptions_missing_balance",
                stripe_customer_id="cus_canary_new_subscriptions_missing_balance",
            )
            customer_ids["canary_new_subscriptions_missing_balance"] = (
                canary_new_subscriptions_missing_balance_customer.id
            )
            canary_march_subscription = await create_subscription(
                save_fixture,
                product=products["monthly"],
                customer=canary_new_subscriptions_missing_balance_customer,
                status=SubscriptionStatus.active,
                started_at=_dt(date(2026, 3, 1)),
            )
            events.append(
                await _create_subscription_created_event(
                    save_fixture,
                    organization,
                    canary_new_subscriptions_missing_balance_customer,
                    canary_march_subscription,
                    products["monthly"],
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    canary_new_subscriptions_missing_balance_customer,
                    products["monthly"],
                    ordered_on=date(2026, 3, 1),
                    amount=1_999,
                    subscription=canary_march_subscription,
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    canary_new_subscriptions_missing_balance_customer,
                    products["monthly"],
                    ordered_on=date(2026, 3, 12),
                    amount=1_999,
                    subscription=canary_march_subscription,
                    include_balance=False,
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    canary_new_subscriptions_missing_balance_customer,
                    products["monthly"],
                    ordered_on=date(2026, 3, 28),
                    amount=1_999,
                    subscription=canary_march_subscription,
                    include_balance=False,
                )
            )
            canary_april_subscription = await create_subscription(
                save_fixture,
                product=products["monthly"],
                customer=canary_new_subscriptions_missing_balance_customer,
                status=SubscriptionStatus.active,
                started_at=_dt(date(2026, 4, 1)),
            )
            events.append(
                await _create_subscription_created_event(
                    save_fixture,
                    organization,
                    canary_new_subscriptions_missing_balance_customer,
                    canary_april_subscription,
                    products["monthly"],
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    canary_new_subscriptions_missing_balance_customer,
                    products["monthly"],
                    ordered_on=date(2026, 4, 1),
                    amount=1_999,
                    subscription=canary_april_subscription,
                    include_balance=False,
                )
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    organization,
                    canary_new_subscriptions_missing_balance_customer,
                    products["monthly"],
                    ordered_on=date(2026, 4, 11),
                    amount=1_999,
                    subscription=canary_april_subscription,
                    include_balance=False,
                )
            )
            shanghai_delayed_missing_balance_customer = await create_customer(
                save_fixture,
                organization=organization,
                email="shanghai-delayed-missing-balance@example.com",
                name="shanghai_delayed_missing_balance",
                stripe_customer_id="cus_shanghai_delayed_missing_balance",
            )
            customer_ids["shanghai_delayed_missing_balance"] = (
                shanghai_delayed_missing_balance_customer.id
            )
            shanghai_order_created_at = _dt(date(2026, 2, 13), 15, 59)
            shanghai_delayed_order = await create_order(
                save_fixture,
                customer=shanghai_delayed_missing_balance_customer,
                product=products["one_time"],
                status=OrderStatus.paid,
                subtotal_amount=799,
                created_at=shanghai_order_created_at,
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=shanghai_delayed_missing_balance_customer,
                    source=EventSource.system,
                    name=SystemEvent.order_paid.value,
                    timestamp=_dt(date(2026, 2, 16), 0, 15),
                    metadata={
                        "order_id": str(shanghai_delayed_order.id),
                        "order_created_at": shanghai_order_created_at.isoformat(),
                        "product_id": str(products["one_time"].id),
                        "billing_type": ProductBillingType.one_time.value,
                        "amount": shanghai_delayed_order.net_amount,
                        "net_amount": shanghai_delayed_order.net_amount,
                        "currency": "usd",
                        "tax_amount": shanghai_delayed_order.tax_amount,
                    },
                )
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    source=EventSource.user,
                    name="api.call",
                    timestamp=_dt(date(2024, 1, 15), 18, 35),
                    external_customer_id="ext-boundary",
                    metadata={"_cost": {"amount": 0.22, "currency": "usd"}},
                )
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    source=EventSource.user,
                    name="api.call",
                    timestamp=_dt(date(2024, 2, 10), 9, 0),
                    customer=external_match_customer,
                    metadata={"_cost": {"amount": 0.33, "currency": "usd"}},
                )
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    source=EventSource.user,
                    name="api.call",
                    timestamp=_dt(date(2024, 2, 11), 12, 0),
                    external_customer_id="ext-no-match",
                    metadata={"_cost": {"amount": 0.44, "currency": "usd"}},
                )
            )

            other_customer = await create_customer(
                save_fixture,
                organization=another_organization,
                email="other-org@example.com",
                name="other_org_customer",
                stripe_customer_id="cus_other_org",
            )
            other_product = await create_product(
                save_fixture,
                organization=another_organization,
                recurring_interval=None,
                prices=[(500_00, "usd")],
            )
            events.extend(
                await _create_paid_order_events(
                    save_fixture,
                    another_organization,
                    other_customer,
                    other_product,
                    ordered_on=date(2024, 1, 3),
                    amount=500_00,
                )
            )
            events.append(
                await create_event(
                    save_fixture,
                    organization=another_organization,
                    source=EventSource.user,
                    name="api.call",
                    timestamp=_dt(date(2024, 1, 15), 12, 0),
                    metadata={"_cost": {"amount": 2.0, "currency": "usd"}},
                )
            )

            tinybird_events = [_event_to_tinybird(event) for event in events]
            await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

            auth_subject = AuthSubject(organization, {Scope.metrics_read}, None)
            for case in QUERY_CASES:
                pg = await _query_metrics(
                    session,
                    auth_subject,
                    organization,
                    case,
                    tinybird_read=False,
                    product_ids={k: v.id for k, v in products.items()},
                    customer_ids=customer_ids,
                )
                tb = await _query_metrics(
                    session,
                    auth_subject,
                    organization,
                    case,
                    tinybird_read=True,
                    product_ids={k: v.id for k, v in products.items()},
                    customer_ids=customer_ids,
                )
                snapshots[case.label] = CaseSnapshot(pg=pg, tinybird=tb)

            return MetricsHarness(
                organization_id=organization.id,
                product_ids={k: v.id for k, v in products.items()},
                customer_ids=customer_ids,
                snapshots=snapshots,
            )
    finally:
        await session.close()
        await engine.dispose()


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
class TestTinybirdMetrics:
    @pytest.mark.parametrize("metric_slug", SETTLEMENT_METRIC_SLUGS)
    def test_metric_parity_across_cases(
        self,
        metrics_harness: MetricsHarness,
        metric_slug: str,
    ) -> None:
        for case in QUERY_CASES:
            if case.metrics is not None and metric_slug not in case.metrics:
                continue
            snapshot = metrics_harness.snapshots[case.label]
            _assert_metric_parity(
                metric_slug,
                snapshot.pg,
                snapshot.tinybird,
                case_label=case.label,
            )

    def test_dataset_has_signal_for_reason_metrics(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["monthly_h1"].pg
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
            "daily_half_hour_timezone_customer_filter"
        ].pg
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
        snapshot = metrics_harness.snapshots["monthly_partial_month_karachi_customer"]
        assert len(snapshot.pg.periods) == 3
        feb_pg = snapshot.pg.periods[2]
        feb_tb = snapshot.tinybird.periods[2]

        assert feb_pg.churned_subscriptions == 0
        assert feb_tb.churned_subscriptions == 0

    def test_orders_fallback_when_order_paid_missing(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["monthly_paris_orders_fallback"]
        assert len(snapshot.pg.periods) >= 3
        oct_pg = snapshot.pg.periods[2]
        oct_tb = snapshot.tinybird.periods[2]

        assert oct_pg.orders == 2
        assert oct_tb.orders == 2
        assert oct_pg.revenue == 20_000
        assert oct_tb.revenue == 20_000

    def test_net_revenue_fallback_when_balance_event_missing(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["monthly_moscow_net_revenue_fallback"]
        moscow = ZoneInfo("Europe/Moscow")
        feb_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(moscow).date() == date(2026, 2, 1)
        )
        feb_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(moscow).date() == date(2026, 2, 1)
        )

        assert feb_pg.net_revenue == 4_000
        assert feb_pg.renewed_subscriptions_net_revenue == 4_000
        assert feb_pg.net_average_order_value == 4_000
        assert feb_pg.net_cumulative_revenue == 12_000
        assert feb_pg.net_revenue == feb_tb.net_revenue
        assert (
            feb_pg.renewed_subscriptions_net_revenue
            == feb_tb.renewed_subscriptions_net_revenue
        )
        assert feb_pg.net_average_order_value == feb_tb.net_average_order_value
        assert feb_pg.net_cumulative_revenue == feb_tb.net_cumulative_revenue

    def test_new_subscriptions_revenue_fallback_when_balance_event_missing(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "monthly_canary_new_subscriptions_revenue_missing_balance"
        ]
        canary = ZoneInfo("Atlantic/Canary")
        march_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(canary).date() == date(2026, 3, 1)
        )
        march_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(canary).date() == date(2026, 3, 1)
        )
        april_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(canary).date() == date(2026, 4, 1)
        )
        april_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(canary).date() == date(2026, 4, 1)
        )

        assert march_pg.new_subscriptions_revenue == 5_997
        assert april_pg.new_subscriptions_revenue == 3_998
        assert march_pg.new_subscriptions_revenue == march_tb.new_subscriptions_revenue
        assert april_pg.new_subscriptions_revenue == april_tb.new_subscriptions_revenue

    def test_renewed_subscriptions_when_balance_event_missing(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["daily_jerusalem_renewed_missing_balance"]
        expected_counts = {
            date(2026, 2, 9): 1,
            date(2026, 2, 10): 1,
            date(2026, 2, 12): 1,
        }
        for target_day, expected_count in expected_counts.items():
            pg_period = next(
                p
                for p in snapshot.pg.periods
                if p.timestamp.astimezone(ZoneInfo("Asia/Jerusalem")).date()
                == target_day
            )
            tb_period = next(
                p
                for p in snapshot.tinybird.periods
                if p.timestamp.astimezone(ZoneInfo("Asia/Jerusalem")).date()
                == target_day
            )
            assert pg_period.renewed_subscriptions == expected_count
            assert pg_period.renewed_subscriptions == tb_period.renewed_subscriptions

    def test_order_paid_uses_order_created_at_without_balance(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "daily_calcutta_order_created_at_without_balance"
        ]
        calcutta = ZoneInfo("Asia/Calcutta")
        feb_1_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(calcutta).date() == date(2026, 2, 1)
        )
        feb_1_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(calcutta).date() == date(2026, 2, 1)
        )
        feb_2_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(calcutta).date() == date(2026, 2, 2)
        )
        feb_2_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(calcutta).date() == date(2026, 2, 2)
        )

        assert feb_1_pg.orders == 1
        assert feb_2_pg.orders == 0
        assert feb_1_pg.orders == feb_1_tb.orders
        assert feb_2_pg.orders == feb_2_tb.orders

    def test_order_paid_delayed_beyond_buffer_uses_order_created_at_without_balance(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "daily_shanghai_delayed_order_paid_without_balance"
        ]
        shanghai = ZoneInfo("Asia/Shanghai")
        feb_13_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(shanghai).date() == date(2026, 2, 13)
        )
        feb_13_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(shanghai).date() == date(2026, 2, 13)
        )
        feb_14_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(shanghai).date() == date(2026, 2, 14)
        )
        feb_14_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(shanghai).date() == date(2026, 2, 14)
        )

        assert feb_13_pg.orders == 1
        assert feb_13_pg.revenue == 799
        assert feb_13_pg.net_revenue == 799
        assert feb_13_pg.cumulative_revenue == 799
        assert feb_13_pg.net_cumulative_revenue == 799
        assert feb_13_pg.average_order_value == 799
        assert feb_13_pg.net_average_order_value == 799
        assert feb_13_pg.one_time_products == 1
        assert feb_13_pg.one_time_products_revenue == 799
        assert feb_13_pg.one_time_products_net_revenue == 799
        assert feb_13_pg.orders == feb_13_tb.orders
        assert feb_13_pg.revenue == feb_13_tb.revenue
        assert feb_13_pg.net_revenue == feb_13_tb.net_revenue
        assert feb_13_pg.cumulative_revenue == feb_13_tb.cumulative_revenue
        assert feb_13_pg.net_cumulative_revenue == feb_13_tb.net_cumulative_revenue
        assert feb_13_pg.average_order_value == feb_13_tb.average_order_value
        assert feb_13_pg.net_average_order_value == feb_13_tb.net_average_order_value
        assert feb_13_pg.one_time_products == feb_13_tb.one_time_products
        assert (
            feb_13_pg.one_time_products_revenue == feb_13_tb.one_time_products_revenue
        )
        assert (
            feb_13_pg.one_time_products_net_revenue
            == feb_13_tb.one_time_products_net_revenue
        )

        assert feb_14_pg.orders == 0
        assert feb_14_pg.revenue == 0
        assert feb_14_pg.net_revenue == 0
        assert feb_14_pg.cumulative_revenue == 799
        assert feb_14_pg.net_cumulative_revenue == 799
        assert feb_14_pg.one_time_products == 0
        assert feb_14_pg.one_time_products_revenue == 0
        assert feb_14_pg.one_time_products_net_revenue == 0
        assert feb_14_pg.cumulative_revenue == feb_14_tb.cumulative_revenue
        assert feb_14_pg.net_cumulative_revenue == feb_14_tb.net_cumulative_revenue

    def test_refund_balance_row_does_not_duplicate_renewed_subscriptions(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots["daily_berlin_refund_join_duplication"]
        berlin = ZoneInfo("Europe/Berlin")
        jan_22_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(berlin).date() == date(2026, 1, 22)
        )
        jan_22_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(berlin).date() == date(2026, 1, 22)
        )
        jan_23_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(berlin).date() == date(2026, 1, 23)
        )
        jan_23_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(berlin).date() == date(2026, 1, 23)
        )
        jan_24_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(berlin).date() == date(2026, 1, 24)
        )
        jan_24_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(berlin).date() == date(2026, 1, 24)
        )

        assert jan_22_pg.renewed_subscriptions == 1
        assert jan_23_pg.renewed_subscriptions == 0
        assert jan_24_pg.renewed_subscriptions == 0
        assert jan_22_pg.renewed_subscriptions == jan_22_tb.renewed_subscriptions
        assert jan_23_pg.renewed_subscriptions == jan_23_tb.renewed_subscriptions
        assert jan_24_pg.renewed_subscriptions == jan_24_tb.renewed_subscriptions

    def test_new_subscriptions_counts_full_first_week_at_range_boundary(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "weekly_stockholm_new_subscriptions_boundary"
        ]
        stockholm = ZoneInfo("Europe/Stockholm")
        week_start_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 1, 26)
        )
        week_start_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 1, 26)
        )

        assert week_start_pg.new_subscriptions == 4
        assert week_start_pg.new_subscriptions == week_start_tb.new_subscriptions

    def test_product_filter_uses_latest_subscription_product_update(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "daily_stockholm_product_update_same_timestamp"
        ]
        stockholm = ZoneInfo("Europe/Stockholm")
        feb_3_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 2, 3)
        )
        feb_3_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 2, 3)
        )

        assert feb_3_pg.new_subscriptions == 0
        assert feb_3_pg.active_subscriptions == 0
        assert feb_3_pg.committed_subscriptions == 0
        assert feb_3_pg.new_subscriptions == feb_3_tb.new_subscriptions
        assert feb_3_pg.active_subscriptions == feb_3_tb.active_subscriptions
        assert feb_3_pg.committed_subscriptions == feb_3_tb.committed_subscriptions

    def test_product_filter_works_when_subscription_created_product_id_missing(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "daily_stockholm_missing_created_product_id"
        ]
        stockholm = ZoneInfo("Europe/Stockholm")
        feb_3_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 2, 3)
        )
        feb_3_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(stockholm).date() == date(2026, 2, 3)
        )

        assert feb_3_pg.new_subscriptions == 1
        assert feb_3_pg.active_subscriptions == 1
        assert feb_3_pg.committed_subscriptions == 1
        assert feb_3_pg.new_subscriptions == feb_3_tb.new_subscriptions
        assert feb_3_pg.active_subscriptions == feb_3_tb.active_subscriptions
        assert feb_3_pg.committed_subscriptions == feb_3_tb.committed_subscriptions

    def test_canceled_subscriptions_replay_keeps_reason_and_day_alignment(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "daily_amsterdam_canceled_replay_reason_drift"
        ]
        amsterdam = ZoneInfo("Europe/Amsterdam")

        jan_14_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(amsterdam).date() == date(2026, 1, 14)
        )
        jan_14_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(amsterdam).date() == date(2026, 1, 14)
        )
        jan_20_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(amsterdam).date() == date(2026, 1, 20)
        )
        jan_20_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(amsterdam).date() == date(2026, 1, 20)
        )
        jan_30_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(amsterdam).date() == date(2026, 1, 30)
        )
        jan_30_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(amsterdam).date() == date(2026, 1, 30)
        )

        assert jan_14_pg.canceled_subscriptions == 2
        assert jan_14_pg.canceled_subscriptions_other == 2
        assert jan_20_pg.canceled_subscriptions == 2
        assert jan_20_pg.canceled_subscriptions_low_quality == 1
        assert jan_30_pg.canceled_subscriptions == 2
        assert jan_30_pg.canceled_subscriptions_other == 2

        assert jan_14_pg.canceled_subscriptions == jan_14_tb.canceled_subscriptions
        assert (
            jan_14_pg.canceled_subscriptions_other
            == jan_14_tb.canceled_subscriptions_other
        )
        assert jan_20_pg.canceled_subscriptions == jan_20_tb.canceled_subscriptions
        assert (
            jan_20_pg.canceled_subscriptions_low_quality
            == jan_20_tb.canceled_subscriptions_low_quality
        )
        assert jan_30_pg.canceled_subscriptions == jan_30_tb.canceled_subscriptions
        assert (
            jan_30_pg.canceled_subscriptions_other
            == jan_30_tb.canceled_subscriptions_other
        )

    def test_canceled_subscriptions_replay_ho_chi_minh_reason_and_day_alignment(
        self, metrics_harness: MetricsHarness
    ) -> None:
        snapshot = metrics_harness.snapshots[
            "daily_ho_chi_minh_canceled_replay_reason_drift"
        ]
        ho_chi_minh = ZoneInfo("Asia/Ho_Chi_Minh")

        jan_14_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(ho_chi_minh).date() == date(2026, 1, 14)
        )
        jan_14_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(ho_chi_minh).date() == date(2026, 1, 14)
        )
        jan_20_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(ho_chi_minh).date() == date(2026, 1, 20)
        )
        jan_20_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(ho_chi_minh).date() == date(2026, 1, 20)
        )
        jan_30_pg = next(
            p
            for p in snapshot.pg.periods
            if p.timestamp.astimezone(ho_chi_minh).date() == date(2026, 1, 30)
        )
        jan_30_tb = next(
            p
            for p in snapshot.tinybird.periods
            if p.timestamp.astimezone(ho_chi_minh).date() == date(2026, 1, 30)
        )

        assert jan_14_pg.canceled_subscriptions == 3
        assert jan_14_pg.canceled_subscriptions_other == 2
        assert jan_20_pg.canceled_subscriptions == 2
        assert jan_20_pg.canceled_subscriptions_low_quality == 1
        assert jan_30_pg.canceled_subscriptions == 1
        assert jan_30_pg.canceled_subscriptions_other == 1

        assert jan_14_pg.canceled_subscriptions == jan_14_tb.canceled_subscriptions
        assert (
            jan_14_pg.canceled_subscriptions_other
            == jan_14_tb.canceled_subscriptions_other
        )
        assert jan_20_pg.canceled_subscriptions == jan_20_tb.canceled_subscriptions
        assert (
            jan_20_pg.canceled_subscriptions_low_quality
            == jan_20_tb.canceled_subscriptions_low_quality
        )
        assert jan_30_pg.canceled_subscriptions == jan_30_tb.canceled_subscriptions
        assert (
            jan_30_pg.canceled_subscriptions_other
            == jan_30_tb.canceled_subscriptions_other
        )
