"""
Settlement metrics comparison: Original Postgres vs Tinybird.

Verifies that the Tinybird metrics path (events_by_timestamp + subscription_state MV)
produces the same results as the original Postgres metrics path (Order/Subscription tables)
for all settlement-related metrics.

Scenario: 1 org, 10 customers with diverse subscription lifecycles across H1 2024.
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime
from typing import Any, NotRequired, TypedDict
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.enums import SubscriptionRecurringInterval
from polar.event.system import SystemEvent
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import (
    DATASOURCE_EVENTS,
    _event_to_tinybird,
)
from polar.kit.time_queries import TimeInterval
from polar.metrics.schemas import MetricsPeriod, MetricsResponse
from polar.metrics.service import metrics as metrics_service
from polar.models import (
    Customer,
    Event,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.event import EventSource
from polar.models.order import OrderStatus
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_event,
    create_order,
    create_payment_transaction,
    create_product,
    create_subscription,
)
from tests.fixtures.tinybird import tinybird_available

MONTHLY_PRICE = 50_00
YEARLY_PRICE = 600_00
ONE_TIME_PRICE = 100_00


def _dt(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=UTC)


class SubEvent(TypedDict):
    product: str
    start: date
    cancel: NotRequired[date]
    cancel_reason: NotRequired[str]
    end: NotRequired[date]
    renewals: NotRequired[list[date]]


class BuyEvent(TypedDict):
    product: str
    on: date


class CustomerScenario(TypedDict):
    name: str
    subs: NotRequired[list[SubEvent]]
    buys: NotRequired[list[BuyEvent]]


SCENARIO: list[CustomerScenario] = [
    # C0: Loyal monthly — subscribes Jan, renews every month through Jun
    {
        "name": "loyal_monthly",
        "subs": [
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
            }
        ],
    },
    # C1: Early churner — subscribes Jan, cancels Feb 15, ends Mar 1
    {
        "name": "early_churner",
        "subs": [
            {
                "product": "monthly",
                "start": date(2024, 1, 1),
                "cancel": date(2024, 2, 15),
                "cancel_reason": "too_expensive",
                "end": date(2024, 3, 1),
                "renewals": [date(2024, 2, 1)],
            }
        ],
    },
    # C2: Yearly subscriber — subscribes Jan, stays active
    {
        "name": "yearly_subscriber",
        "subs": [{"product": "yearly", "start": date(2024, 1, 1)}],
    },
    # C3: One-time buyer in January
    {
        "name": "one_time_jan",
        "buys": [{"product": "one_time", "on": date(2024, 1, 15)}],
    },
    # C4: Late monthly — subscribes Apr, renews through Jun
    {
        "name": "late_monthly",
        "subs": [
            {
                "product": "monthly",
                "start": date(2024, 4, 1),
                "renewals": [date(2024, 5, 1), date(2024, 6, 1)],
            }
        ],
    },
    # C5: Mid-year churner — subscribes Feb, cancels Apr 15, ends May 1
    {
        "name": "mid_churner",
        "subs": [
            {
                "product": "monthly",
                "start": date(2024, 2, 1),
                "cancel": date(2024, 4, 15),
                "cancel_reason": "missing_features",
                "end": date(2024, 5, 1),
                "renewals": [date(2024, 3, 1), date(2024, 4, 1)],
            }
        ],
    },
    # C6: Mixed — one-time purchase in Jan, then monthly sub from Mar
    {
        "name": "mixed_buyer",
        "buys": [{"product": "one_time", "on": date(2024, 1, 10)}],
        "subs": [
            {
                "product": "monthly",
                "start": date(2024, 3, 1),
                "renewals": [
                    date(2024, 4, 1),
                    date(2024, 5, 1),
                    date(2024, 6, 1),
                ],
            }
        ],
    },
    # C7: Two one-time purchases
    {
        "name": "repeat_buyer",
        "buys": [
            {"product": "one_time", "on": date(2024, 1, 5)},
            {"product": "one_time", "on": date(2024, 4, 20)},
        ],
    },
    # C8: Short-lived monthly — subscribes Jan, cancels Jan 20, ends Feb 1
    {
        "name": "quick_churner",
        "subs": [
            {
                "product": "monthly",
                "start": date(2024, 1, 1),
                "cancel": date(2024, 1, 20),
                "cancel_reason": "unused",
                "end": date(2024, 2, 1),
            }
        ],
    },
    # C9: Mid-year yearly — subscribes Jun
    {
        "name": "yearly_jun",
        "subs": [{"product": "yearly", "start": date(2024, 6, 1)}],
    },
]


SETTLEMENT_METRIC_SLUGS = [
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
    "new_subscriptions",
    "new_subscriptions_revenue",
    "new_subscriptions_net_revenue",
    "renewed_subscriptions",
    "renewed_subscriptions_revenue",
    "renewed_subscriptions_net_revenue",
    "monthly_recurring_revenue",
    "committed_monthly_recurring_revenue",
    "active_subscriptions",
    "committed_subscriptions",
    "canceled_subscriptions",
    "canceled_subscriptions_customer_service",
    "canceled_subscriptions_low_quality",
    "canceled_subscriptions_missing_features",
    "canceled_subscriptions_switched_service",
    "canceled_subscriptions_too_complex",
    "canceled_subscriptions_too_expensive",
    "canceled_subscriptions_unused",
    "canceled_subscriptions_other",
    "churned_subscriptions",
]


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------


def _price_for(product_key: str) -> int:
    return {
        "monthly": MONTHLY_PRICE,
        "yearly": YEARLY_PRICE,
        "one_time": ONE_TIME_PRICE,
    }[product_key]


async def _create_balance_event(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    product: Product,
    subscription: Subscription | None,
    order_date: date,
    amount: int,
) -> Event:
    order = await create_order(
        save_fixture,
        status=OrderStatus.paid,
        product=product,
        customer=customer,
        subtotal_amount=amount,
        created_at=_dt(order_date),
        subscription=subscription,
    )
    txn = await create_payment_transaction(
        save_fixture, order=order, amount=order.net_amount, tax_amount=order.tax_amount
    )
    metadata: dict[str, Any] = {
        "transaction_id": str(txn.id),
        "order_id": str(order.id),
        "product_id": str(order.product_id),
        "amount": txn.amount,
        "currency": txn.currency,
        "presentment_amount": txn.presentment_amount or txn.amount,
        "presentment_currency": txn.presentment_currency or txn.currency,
        "tax_amount": order.tax_amount,
        "fee": 0,
    }
    if subscription is not None:
        metadata["subscription_id"] = str(subscription.id)

    return await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.balance_order.value,
        timestamp=_dt(order_date),
        metadata=metadata,
    )


async def _create_subscription_created_event(
    save_fixture: SaveFixture,
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
            "recurring_interval_count": 1,
        },
    )


async def _create_subscription_canceled_event(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    subscription: Subscription,
    cancel_date: date,
    end_date: date,
    cancel_reason: str | None = None,
) -> Event:
    metadata: dict[str, Any] = {
        "subscription_id": str(subscription.id),
        "canceled_at": _dt(cancel_date).isoformat(),
        "ends_at": _dt(end_date).isoformat(),
    }
    if cancel_reason is not None:
        metadata["customer_cancellation_reason"] = cancel_reason
    return await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.subscription_canceled.value,
        timestamp=_dt(cancel_date),
        metadata=metadata,
    )


async def _build_scenario(
    save_fixture: SaveFixture,
    organization: Organization,
    products: dict[str, Product],
) -> list[Event]:
    """Create all customers, subscriptions, orders, and events from SCENARIO."""
    all_events: list[Event] = []

    for i, cs in enumerate(SCENARIO):
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email=f"c{i}@test.com",
            name=cs["name"],
            stripe_customer_id=f"cus_{cs['name']}",
        )

        for sub_def in cs.get("subs", []):
            product = products[sub_def["product"]]
            price = _price_for(sub_def["product"])

            sub = await create_subscription(
                save_fixture,
                product=product,
                customer=customer,
                status=SubscriptionStatus.active,
                started_at=_dt(sub_def["start"]),
                ended_at=_dt(sub_def["end"]) if "end" in sub_def else None,
                ends_at=_dt(sub_def["end"]) if "end" in sub_def else None,
            )
            if "cancel" in sub_def:
                sub.canceled_at = _dt(sub_def["cancel"])
                reason = sub_def.get("cancel_reason")
                if reason is not None:
                    sub.customer_cancellation_reason = CustomerCancellationReason(
                        reason
                    )
                await save_fixture(sub)

            ev = await _create_subscription_created_event(
                save_fixture, organization, customer, sub, product
            )
            all_events.append(ev)

            # Initial order
            ev = await _create_balance_event(
                save_fixture,
                organization,
                customer,
                product,
                sub,
                sub_def["start"],
                price,
            )
            all_events.append(ev)

            # Renewals
            for renew_date in sub_def.get("renewals", []):
                ev = await _create_balance_event(
                    save_fixture,
                    organization,
                    customer,
                    product,
                    sub,
                    renew_date,
                    price,
                )
                all_events.append(ev)

            # Cancellation
            if "cancel" in sub_def and "end" in sub_def:
                ev = await _create_subscription_canceled_event(
                    save_fixture,
                    organization,
                    customer,
                    sub,
                    sub_def["cancel"],
                    sub_def["end"],
                    cancel_reason=sub_def.get("cancel_reason"),
                )
                all_events.append(ev)

        for buy_def in cs.get("buys", []):
            product = products[buy_def["product"]]
            price = _price_for(buy_def["product"])
            ev = await _create_balance_event(
                save_fixture,
                organization,
                customer,
                product,
                None,
                buy_def["on"],
                price,
            )
            all_events.append(ev)

    return all_events


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def products(
    save_fixture: SaveFixture, organization: Organization
) -> dict[str, Product]:
    monthly = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(MONTHLY_PRICE, "usd")],
    )
    yearly = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.year,
        prices=[(YEARLY_PRICE, "usd")],
    )
    one_time = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        prices=[(ONE_TIME_PRICE, "usd")],
    )
    return {"monthly": monthly, "yearly": yearly, "one_time": one_time}


@pytest_asyncio.fixture
async def scenario_events(
    save_fixture: SaveFixture,
    organization: Organization,
    products: dict[str, Product],
    tinybird_client: TinybirdClient,
) -> list[Event]:
    events = await _build_scenario(save_fixture, organization, products)
    tinybird_events = [_event_to_tinybird(e) for e in events]
    await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)
    return events


# ---------------------------------------------------------------------------
# Comparison helpers
# ---------------------------------------------------------------------------


def _period_slug_value(period: MetricsPeriod, slug: str) -> int | float:
    v = getattr(period, slug, None)
    return v if v is not None else 0


async def _enable_tinybird_compare(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "tinybird_compare": True,
    }
    await save_fixture(organization)


# Expected values per month for the full H1 2024 scenario (UTC, monthly interval).
# fee=0 throughout, so net_revenue == revenue and net variants match gross.
#
#       Jan: C0+C1+C2+C8 sub initial, C3+C6+C7 one-time  → 7 orders
#       Feb: C0+C1 renewal, C5 initial                    → 3 orders
#       Mar: C0+C5 renewal, C6 initial                    → 3 orders
#       Apr: C0+C5+C6 renewal, C4 initial, C7 one-time    → 5 orders
#       May: C0+C4+C6 renewal                             → 3 orders
#       Jun: C0+C4+C6 renewal, C9 yearly initial          → 4 orders
EXPECTED_MONTHLY: list[dict[str, int]] = [
    {  # Jan
        "orders": 7,
        "revenue": 105_000,
        "net_revenue": 105_000,
        "cumulative_revenue": 105_000,
        "net_cumulative_revenue": 105_000,
        "average_order_value": 15_000,
        "net_average_order_value": 15_000,
        "one_time_products": 3,
        "one_time_products_revenue": 30_000,
        "one_time_products_net_revenue": 30_000,
        "new_subscriptions": 4,
        "new_subscriptions_revenue": 75_000,
        "new_subscriptions_net_revenue": 75_000,
        "renewed_subscriptions": 0,
        "renewed_subscriptions_revenue": 0,
        "renewed_subscriptions_net_revenue": 0,
        "monthly_recurring_revenue": 20_000,
        "committed_monthly_recurring_revenue": 20_000,
        "active_subscriptions": 4,
        "committed_subscriptions": 4,
        "canceled_subscriptions": 1,
        "canceled_subscriptions_customer_service": 0,
        "canceled_subscriptions_low_quality": 0,
        "canceled_subscriptions_missing_features": 0,
        "canceled_subscriptions_switched_service": 0,
        "canceled_subscriptions_too_complex": 0,
        "canceled_subscriptions_too_expensive": 0,
        "canceled_subscriptions_unused": 1,
        "canceled_subscriptions_other": 0,
        "churned_subscriptions": 0,
    },
    {  # Feb — C1 still active (ends Mar 1), C8 ended (ends Feb 1)
        "orders": 3,
        "revenue": 15_000,
        "net_revenue": 15_000,
        "cumulative_revenue": 120_000,
        "net_cumulative_revenue": 120_000,
        "average_order_value": 5_000,
        "net_average_order_value": 5_000,
        "one_time_products": 0,
        "one_time_products_revenue": 0,
        "one_time_products_net_revenue": 0,
        "new_subscriptions": 1,
        "new_subscriptions_revenue": 5_000,
        "new_subscriptions_net_revenue": 5_000,
        "renewed_subscriptions": 2,
        "renewed_subscriptions_revenue": 10_000,
        "renewed_subscriptions_net_revenue": 10_000,
        "monthly_recurring_revenue": 20_000,
        "committed_monthly_recurring_revenue": 20_000,
        "active_subscriptions": 4,
        "committed_subscriptions": 4,
        "canceled_subscriptions": 1,
        "canceled_subscriptions_customer_service": 0,
        "canceled_subscriptions_low_quality": 0,
        "canceled_subscriptions_missing_features": 0,
        "canceled_subscriptions_switched_service": 0,
        "canceled_subscriptions_too_complex": 0,
        "canceled_subscriptions_too_expensive": 1,
        "canceled_subscriptions_unused": 0,
        "canceled_subscriptions_other": 0,
        "churned_subscriptions": 1,
    },
    {  # Mar — C1 ended (ends Mar 1)
        "orders": 3,
        "revenue": 15_000,
        "net_revenue": 15_000,
        "cumulative_revenue": 135_000,
        "net_cumulative_revenue": 135_000,
        "average_order_value": 5_000,
        "net_average_order_value": 5_000,
        "one_time_products": 0,
        "one_time_products_revenue": 0,
        "one_time_products_net_revenue": 0,
        "new_subscriptions": 1,
        "new_subscriptions_revenue": 5_000,
        "new_subscriptions_net_revenue": 5_000,
        "renewed_subscriptions": 2,
        "renewed_subscriptions_revenue": 10_000,
        "renewed_subscriptions_net_revenue": 10_000,
        "monthly_recurring_revenue": 20_000,
        "committed_monthly_recurring_revenue": 20_000,
        "active_subscriptions": 4,
        "committed_subscriptions": 4,
        "canceled_subscriptions": 0,
        "canceled_subscriptions_customer_service": 0,
        "canceled_subscriptions_low_quality": 0,
        "canceled_subscriptions_missing_features": 0,
        "canceled_subscriptions_switched_service": 0,
        "canceled_subscriptions_too_complex": 0,
        "canceled_subscriptions_too_expensive": 0,
        "canceled_subscriptions_unused": 0,
        "canceled_subscriptions_other": 0,
        "churned_subscriptions": 1,
    },
    {  # Apr — C5 still active (ends May 1)
        "orders": 5,
        "revenue": 30_000,
        "net_revenue": 30_000,
        "cumulative_revenue": 165_000,
        "net_cumulative_revenue": 165_000,
        "average_order_value": 6_000,
        "net_average_order_value": 6_000,
        "one_time_products": 1,
        "one_time_products_revenue": 10_000,
        "one_time_products_net_revenue": 10_000,
        "new_subscriptions": 1,
        "new_subscriptions_revenue": 5_000,
        "new_subscriptions_net_revenue": 5_000,
        "renewed_subscriptions": 3,
        "renewed_subscriptions_revenue": 15_000,
        "renewed_subscriptions_net_revenue": 15_000,
        "monthly_recurring_revenue": 25_000,
        "committed_monthly_recurring_revenue": 25_000,
        "active_subscriptions": 5,
        "committed_subscriptions": 5,
        "canceled_subscriptions": 1,
        "canceled_subscriptions_customer_service": 0,
        "canceled_subscriptions_low_quality": 0,
        "canceled_subscriptions_missing_features": 1,
        "canceled_subscriptions_switched_service": 0,
        "canceled_subscriptions_too_complex": 0,
        "canceled_subscriptions_too_expensive": 0,
        "canceled_subscriptions_unused": 0,
        "canceled_subscriptions_other": 0,
        "churned_subscriptions": 0,
    },
    {  # May — C5 ended (ends May 1)
        "orders": 3,
        "revenue": 15_000,
        "net_revenue": 15_000,
        "cumulative_revenue": 180_000,
        "net_cumulative_revenue": 180_000,
        "average_order_value": 5_000,
        "net_average_order_value": 5_000,
        "one_time_products": 0,
        "one_time_products_revenue": 0,
        "one_time_products_net_revenue": 0,
        "new_subscriptions": 0,
        "new_subscriptions_revenue": 0,
        "new_subscriptions_net_revenue": 0,
        "renewed_subscriptions": 3,
        "renewed_subscriptions_revenue": 15_000,
        "renewed_subscriptions_net_revenue": 15_000,
        "monthly_recurring_revenue": 20_000,
        "committed_monthly_recurring_revenue": 20_000,
        "active_subscriptions": 4,
        "committed_subscriptions": 4,
        "canceled_subscriptions": 0,
        "canceled_subscriptions_customer_service": 0,
        "canceled_subscriptions_low_quality": 0,
        "canceled_subscriptions_missing_features": 0,
        "canceled_subscriptions_switched_service": 0,
        "canceled_subscriptions_too_complex": 0,
        "canceled_subscriptions_too_expensive": 0,
        "canceled_subscriptions_unused": 0,
        "canceled_subscriptions_other": 0,
        "churned_subscriptions": 1,
    },
    {  # Jun — C9 yearly joins
        "orders": 4,
        "revenue": 75_000,
        "net_revenue": 75_000,
        "cumulative_revenue": 255_000,
        "net_cumulative_revenue": 255_000,
        "average_order_value": 18_750,
        "net_average_order_value": 18_750,
        "one_time_products": 0,
        "one_time_products_revenue": 0,
        "one_time_products_net_revenue": 0,
        "new_subscriptions": 1,
        "new_subscriptions_revenue": 60_000,
        "new_subscriptions_net_revenue": 60_000,
        "renewed_subscriptions": 3,
        "renewed_subscriptions_revenue": 15_000,
        "renewed_subscriptions_net_revenue": 15_000,
        "monthly_recurring_revenue": 25_000,
        "committed_monthly_recurring_revenue": 25_000,
        "active_subscriptions": 5,
        "committed_subscriptions": 5,
        "canceled_subscriptions": 0,
        "canceled_subscriptions_customer_service": 0,
        "canceled_subscriptions_low_quality": 0,
        "canceled_subscriptions_missing_features": 0,
        "canceled_subscriptions_switched_service": 0,
        "canceled_subscriptions_too_complex": 0,
        "canceled_subscriptions_too_expensive": 0,
        "canceled_subscriptions_unused": 0,
        "canceled_subscriptions_other": 0,
        "churned_subscriptions": 0,
    },
]


async def _run_shadow_mode(
    save_fixture: SaveFixture,
    session: AsyncSession,
    auth_subject: AuthSubject[User | Organization],
    organization: Organization,
    *,
    start_date: date,
    end_date: date,
    timezone: ZoneInfo,
    interval: TimeInterval,
    metrics: Sequence[str],
    customer_id: Sequence[uuid.UUID] | None = None,
) -> MetricsResponse:
    """Run metrics in shadow mode — PG + Tinybird comparison, returns PG values."""
    await _enable_tinybird_compare(save_fixture, organization)
    with patch.object(settings, "TINYBIRD_EVENTS_READ", True):
        return await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=start_date,
            end_date=end_date,
            timezone=timezone,
            interval=interval,
            organization_id=[organization.id],
            metrics=list(metrics),
            customer_id=customer_id,
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="user"))
class TestCumulativeMetricsHistoricalBaseline:
    """Test that cumulative metrics include historical data from before the query window.

    This catches the bug where buffer filtering excluded historical events,
    causing cumulative_revenue to start from 0 instead of including past orders.
    """

    async def test_cumulative_includes_historical_baseline(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        tinybird_client: TinybirdClient,
    ) -> None:
        # Create products
        monthly = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(MONTHLY_PRICE, "usd")],
        )
        one_time = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(ONE_TIME_PRICE, "usd")],
        )

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="historical@test.com",
            name="historical_customer",
            stripe_customer_id="cus_historical",
        )

        all_events: list[Event] = []

        # Create HISTORICAL orders (2023) - these are BEFORE our query window
        historical_dates = [
            date(2023, 6, 1),
            date(2023, 7, 1),
            date(2023, 8, 1),
            date(2023, 9, 1),
            date(2023, 10, 1),
            date(2023, 11, 1),
        ]
        historical_revenue = 0
        for d in historical_dates:
            ev = await _create_balance_event(
                save_fixture,
                organization,
                customer,
                one_time,
                None,
                d,
                ONE_TIME_PRICE,
            )
            all_events.append(ev)
            historical_revenue += ONE_TIME_PRICE

        # Create orders IN the query window (2024)
        query_window_dates = [date(2024, 1, 15), date(2024, 2, 15)]
        query_window_revenue = 0
        for d in query_window_dates:
            ev = await _create_balance_event(
                save_fixture,
                organization,
                customer,
                one_time,
                None,
                d,
                ONE_TIME_PRICE,
            )
            all_events.append(ev)
            query_window_revenue += ONE_TIME_PRICE

        # Ingest events into Tinybird
        tinybird_events = [_event_to_tinybird(e) for e in all_events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        # Query for 2024 ONLY - cumulative should include 2023 historical data
        organization.feature_settings = {
            **organization.feature_settings,
            "tinybird_read": True,
            "tinybird_compare": False,
        }
        await save_fixture(organization)
        with patch.object(settings, "TINYBIRD_EVENTS_READ", True):
            result = await metrics_service.get_metrics(
                session,
                auth_subject,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 2, 28),
                timezone=ZoneInfo("UTC"),
                interval=TimeInterval.month,
                organization_id=[organization.id],
                metrics=["cumulative_revenue", "net_cumulative_revenue", "revenue"],
            )

        assert len(result.periods) == 2

        # January 2024: cumulative should be historical + Jan revenue
        jan = result.periods[0]
        assert jan.revenue == ONE_TIME_PRICE, "Jan revenue should be 1 order"
        expected_jan_cumulative = historical_revenue + ONE_TIME_PRICE
        assert jan.cumulative_revenue == expected_jan_cumulative, (
            f"Jan cumulative_revenue should include historical baseline. "
            f"Expected {expected_jan_cumulative}, got {jan.cumulative_revenue}"
        )
        assert jan.net_cumulative_revenue == expected_jan_cumulative, (
            f"Jan net_cumulative_revenue should include historical baseline. "
            f"Expected {expected_jan_cumulative}, got {jan.net_cumulative_revenue}"
        )

        # February 2024: cumulative should be historical + Jan + Feb revenue
        feb = result.periods[1]
        assert feb.revenue == ONE_TIME_PRICE, "Feb revenue should be 1 order"
        expected_feb_cumulative = historical_revenue + query_window_revenue
        assert feb.cumulative_revenue == expected_feb_cumulative, (
            f"Feb cumulative_revenue should include historical baseline. "
            f"Expected {expected_feb_cumulative}, got {feb.cumulative_revenue}"
        )
        assert feb.net_cumulative_revenue == expected_feb_cumulative, (
            f"Feb net_cumulative_revenue should include historical baseline. "
            f"Expected {expected_feb_cumulative}, got {feb.net_cumulative_revenue}"
        )


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="user"))
@pytest.mark.usefixtures("scenario_events")
class TestSettlementComparison:
    """Compare original Postgres metrics with Tinybird settlement metrics.

    All query patterns run in a single test because the DB session is
    function-scoped with transaction rollback — PG data can't survive
    across test methods. Each pattern is labelled so failures identify
    which variant broke.
    """

    async def test_shadow_mode_returns_pg_values(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        run = _run_shadow_mode

        result = await run(
            save_fixture,
            session,
            auth_subject,
            organization,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 30),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.month,
            metrics=SETTLEMENT_METRIC_SLUGS,
        )
        assert len(result.periods) == 6
        for i, expected in enumerate(EXPECTED_MONTHLY):
            period = result.periods[i]
            for slug, value in expected.items():
                actual = _period_slug_value(period, slug)
                assert actual == value, (
                    f"[monthly] Period {i} ({period.timestamp.date()}): "
                    f"{slug} expected {value}, got {actual}"
                )


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="user"))
class TestActiveUserByEventWithCustomerFilter:
    """Test active_user_by_event metric with customer_id filter."""

    async def test_active_user_matches_with_customer_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        tinybird_client: TinybirdClient,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test-user@example.com",
            name="test_user",
            stripe_customer_id="cus_test_user",
            external_id="ext-user-123",
        )

        all_events: list[Event] = []

        ev1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name="customer.created",
            timestamp=datetime(2024, 1, 15, 10, 0, 0, tzinfo=UTC),
        )
        all_events.append(ev1)

        ev2 = await create_event(
            save_fixture,
            organization=organization,
            external_customer_id="ext-user-123",
            source=EventSource.user,
            name="api.call",
            timestamp=datetime(2024, 1, 15, 11, 0, 0, tzinfo=UTC),
        )
        all_events.append(ev2)

        ev3 = await create_event(
            save_fixture,
            organization=organization,
            external_customer_id="ext-user-123",
            source=EventSource.user,
            name="api.call",
            timestamp=datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC),
        )
        all_events.append(ev3)

        ev4 = await create_event(
            save_fixture,
            organization=organization,
            external_customer_id="other-user",
            source=EventSource.user,
            name="api.call",
            timestamp=datetime(2024, 1, 15, 13, 0, 0, tzinfo=UTC),
        )
        all_events.append(ev4)

        tinybird_events = [_event_to_tinybird(e) for e in all_events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        organization.feature_settings = {
            **organization.feature_settings,
            "tinybird_read": True,
            "tinybird_compare": False,
        }
        await save_fixture(organization)

        with patch.object(settings, "TINYBIRD_EVENTS_READ", True):
            result = await metrics_service.get_metrics(
                session,
                auth_subject,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 1, 31),
                timezone=ZoneInfo("UTC"),
                interval=TimeInterval.day,
                organization_id=[organization.id],
                customer_id=[customer.id],
                metrics=["active_user_by_event"],
            )

        jan_15_period = next((p for p in result.periods if p.timestamp.day == 15), None)
        assert jan_15_period is not None
        assert jan_15_period.active_user_by_event == 2


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="user"))
class TestActiveUserByEventNoFilter:
    """Test active_user_by_event metric without customer_id filter."""

    async def test_counts_distinct_users_per_day(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        tinybird_client: TinybirdClient,
    ) -> None:
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="user1@example.com",
            name="user1",
            stripe_customer_id="cus_user1",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="user2@example.com",
            name="user2",
            stripe_customer_id="cus_user2",
        )

        all_events: list[Event] = []

        # Two events from customer1 on Jan 15
        ev1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer1,
            source=EventSource.user,
            name="api.call",
            timestamp=datetime(2024, 1, 15, 10, 0, 0, tzinfo=UTC),
        )
        all_events.append(ev1)

        ev2 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer1,
            source=EventSource.user,
            name="api.call",
            timestamp=datetime(2024, 1, 15, 11, 0, 0, tzinfo=UTC),
        )
        all_events.append(ev2)

        # One event from customer2 on Jan 15
        ev3 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer2,
            source=EventSource.user,
            name="api.call",
            timestamp=datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC),
        )
        all_events.append(ev3)

        tinybird_events = [_event_to_tinybird(e) for e in all_events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        organization.feature_settings = {
            **organization.feature_settings,
            "tinybird_read": True,
            "tinybird_compare": False,
        }
        await save_fixture(organization)

        with patch.object(settings, "TINYBIRD_EVENTS_READ", True):
            result = await metrics_service.get_metrics(
                session,
                auth_subject,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 1, 31),
                timezone=ZoneInfo("UTC"),
                interval=TimeInterval.day,
                organization_id=[organization.id],
                metrics=["active_user_by_event"],
            )

        jan_15 = next((p for p in result.periods if p.timestamp.day == 15), None)
        assert jan_15 is not None, "Jan 15 period should exist"
        assert jan_15.active_user_by_event == 2, (
            f"Jan 15 should have 2 active users, got {jan_15.active_user_by_event}"
        )

    async def test_half_hour_timezone_day_boundary(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        tinybird_client: TinybirdClient,
    ) -> None:
        """Test that events near day boundaries are correctly bucketed for half-hour timezones.

        Asia/Kolkata is UTC+5:30, so midnight Kolkata = 18:30 UTC.
        - Event at 18:25 UTC = 23:55 Kolkata (same day)
        - Event at 18:35 UTC = 00:05 Kolkata (next day)
        """
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="tz_user1@example.com",
            name="tz_user1",
            stripe_customer_id="cus_tz_user1",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="tz_user2@example.com",
            name="tz_user2",
            stripe_customer_id="cus_tz_user2",
        )

        all_events: list[Event] = []

        # Event at 18:25 UTC on Jan 22 = 23:55 IST on Jan 22
        ev1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer1,
            source=EventSource.user,
            name="api.call",
            timestamp=datetime(2024, 1, 22, 18, 25, 0, tzinfo=UTC),
        )
        all_events.append(ev1)

        # Event at 18:35 UTC on Jan 22 = 00:05 IST on Jan 23
        ev2 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer2,
            source=EventSource.user,
            name="api.call",
            timestamp=datetime(2024, 1, 22, 18, 35, 0, tzinfo=UTC),
        )
        all_events.append(ev2)

        tinybird_events = [_event_to_tinybird(e) for e in all_events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        organization.feature_settings = {
            **organization.feature_settings,
            "tinybird_read": True,
            "tinybird_compare": False,
        }
        await save_fixture(organization)

        with patch.object(settings, "TINYBIRD_EVENTS_READ", True):
            result = await metrics_service.get_metrics(
                session,
                auth_subject,
                start_date=date(2024, 1, 20),
                end_date=date(2024, 1, 25),
                timezone=ZoneInfo("Asia/Kolkata"),
                interval=TimeInterval.day,
                organization_id=[organization.id],
                metrics=["active_user_by_event"],
            )

        # Periods are returned with UTC timestamps at the Kolkata day boundary (18:30 UTC)
        # Jan 22 Kolkata = 2024-01-21 18:30:00 UTC
        # Jan 23 Kolkata = 2024-01-22 18:30:00 UTC
        kolkata = ZoneInfo("Asia/Kolkata")
        jan_22 = next(
            (p for p in result.periods if p.timestamp.astimezone(kolkata).day == 22),
            None,
        )
        jan_23 = next(
            (p for p in result.periods if p.timestamp.astimezone(kolkata).day == 23),
            None,
        )

        assert jan_22 is not None, "Jan 22 Kolkata period should exist"
        assert jan_23 is not None, "Jan 23 Kolkata period should exist"

        # customer1's event at 18:25 UTC is before midnight Kolkata -> Jan 22
        # customer2's event at 18:35 UTC is after midnight Kolkata -> Jan 23
        assert jan_22.active_user_by_event == 1, (
            f"Jan 22 Kolkata should have 1 user (18:25 UTC = 23:55 IST), "
            f"got {jan_22.active_user_by_event}"
        )
        assert jan_23.active_user_by_event == 1, (
            f"Jan 23 Kolkata should have 1 user (18:35 UTC = 00:05 IST), "
            f"got {jan_23.active_user_by_event}"
        )


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="user"))
class TestTrialOrdersCounted:
    """Test that trial orders (free subscription_create) are counted.

    Trial orders emit order.paid events but no balance.order/balance.credit_order events.
    The orders metric should use order.paid events for counting.
    """

    async def test_trial_orders_included_in_count(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        tinybird_client: TinybirdClient,
    ) -> None:
        monthly = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(MONTHLY_PRICE, "usd")],
        )

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="trial@test.com",
            name="trial_customer",
            stripe_customer_id="cus_trial",
        )

        sub = await create_subscription(
            save_fixture,
            product=monthly,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=_dt(date(2024, 1, 15)),
        )

        all_events: list[Event] = []

        # subscription.created event
        ev = await _create_subscription_created_event(
            save_fixture, organization, customer, sub, monthly
        )
        all_events.append(ev)

        # Create a trial order (free) - this has order.paid but NO balance event
        trial_order = await create_order(
            save_fixture,
            status=OrderStatus.paid,
            product=monthly,
            customer=customer,
            subtotal_amount=0,
            created_at=_dt(date(2024, 1, 15)),
            subscription=sub,
        )

        # Create order.paid event (always emitted for paid orders)
        order_paid_ev = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.order_paid.value,
            timestamp=_dt(date(2024, 1, 15)),
            metadata={
                "order_id": str(trial_order.id),
                "product_id": str(monthly.id),
                "billing_type": "recurring",
                "amount": 0,
                "currency": "usd",
                "net_amount": 0,
                "tax_amount": 0,
                "subscription_id": str(sub.id),
            },
        )
        all_events.append(order_paid_ev)

        # NO balance.order or balance.credit_order event - this is the bug scenario

        # Also create a paid order WITH balance event for comparison
        paid_order = await create_order(
            save_fixture,
            status=OrderStatus.paid,
            product=monthly,
            customer=customer,
            subtotal_amount=MONTHLY_PRICE,
            created_at=_dt(date(2024, 2, 15)),
            subscription=sub,
        )

        # order.paid event for paid order
        order_paid_ev2 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.order_paid.value,
            timestamp=_dt(date(2024, 2, 15)),
            metadata={
                "order_id": str(paid_order.id),
                "product_id": str(monthly.id),
                "billing_type": "recurring",
                "amount": MONTHLY_PRICE,
                "currency": "usd",
                "net_amount": MONTHLY_PRICE,
                "tax_amount": 0,
                "subscription_id": str(sub.id),
            },
        )
        all_events.append(order_paid_ev2)

        # balance.order event for paid order
        txn = await create_payment_transaction(
            save_fixture,
            order=paid_order,
            amount=paid_order.net_amount,
            tax_amount=paid_order.tax_amount,
        )
        balance_ev = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.balance_order.value,
            timestamp=_dt(date(2024, 2, 15)),
            metadata={
                "transaction_id": str(txn.id),
                "order_id": str(paid_order.id),
                "product_id": str(monthly.id),
                "subscription_id": str(sub.id),
                "amount": txn.amount,
                "currency": txn.currency,
                "presentment_amount": txn.presentment_amount or txn.amount,
                "presentment_currency": txn.presentment_currency or txn.currency,
                "tax_amount": 0,
                "fee": 0,
            },
        )
        all_events.append(balance_ev)

        tinybird_events = [_event_to_tinybird(e) for e in all_events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        organization.feature_settings = {
            **organization.feature_settings,
            "tinybird_read": True,
            "tinybird_compare": False,
        }
        await save_fixture(organization)

        with patch.object(settings, "TINYBIRD_EVENTS_READ", True):
            result = await metrics_service.get_metrics(
                session,
                auth_subject,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 2, 28),
                timezone=ZoneInfo("UTC"),
                interval=TimeInterval.month,
                organization_id=[organization.id],
                metrics=["orders", "revenue", "new_subscriptions"],
            )

        assert len(result.periods) == 2

        jan = result.periods[0]
        feb = result.periods[1]

        # January: 1 trial order (free) - should be counted!
        assert jan.orders == 1, (
            f"Jan should have 1 order (trial), got {jan.orders}. "
            "Trial orders should be counted via order.paid events."
        )
        assert jan.revenue == 0, f"Jan revenue should be 0 (trial), got {jan.revenue}"
        assert jan.new_subscriptions == 1, (
            f"Jan should have 1 new subscription, got {jan.new_subscriptions}"
        )

        # February: 1 paid order
        assert feb.orders == 1, f"Feb should have 1 order (paid), got {feb.orders}"
        assert feb.revenue == MONTHLY_PRICE, (
            f"Feb revenue should be {MONTHLY_PRICE}, got {feb.revenue}"
        )
