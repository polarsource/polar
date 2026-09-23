from polar.models.subscription import SubscriptionStatus
from polar.void.event.schemas import event_payload
from polar.void.product.schemas import meters_of, price_of

"""Seed the Void demo; edit CUSTOMERS below to control its timelines."""

import argparse
import asyncio
import random
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid5

import dramatiq
from sqlalchemy import delete, update

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.authz.dependencies import AuthzContext
from polar.config import settings
from polar.event.system import SystemEvent
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    Customer,
    Organization,
    User,
    VoidActivitySpan,
    VoidBillingIdentity,
    VoidDeployment,
    VoidReducer,
    VoidReducerBucket,
    VoidReducerDependency,
    VoidReducerJob,
    VoidScenario,
)
from polar.models import (
    Event as EventModel,
)
from polar.models import (
    Meter as MeterModel,
)
from polar.models import (
    Product as ProductModel,
)
from polar.models import (
    Subscription as SubscriptionModel,
)
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import create_redis
from polar.void.activity.service import activity as activity_service
from polar.void.customer.repository import CustomerRepository
from polar.void.customer.schemas import Customer as CustomerSchema
from polar.void.customer.schemas import CustomerCreate
from polar.void.customer.service import customer as customer_service
from polar.void.deploy.repository import DeployRepository
from polar.void.deploy.schemas import DeployCreate
from polar.void.deploy.service import deploy as deploy_service
from polar.void.development.service import ORGANIZATION_ID, ORGANIZATION_SLUG
from polar.void.development.service import development as development_service
from polar.void.event.repository import EventRepository
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import identity as identity_service
from polar.void.meter.balance import step
from polar.void.metric.schemas import TimeInterval
from polar.void.product.service import product as product_service
from polar.void.reducer.aggregation import (
    Aggregation,
    CountAggregation,
    DerivedAggregation,
    PropertyAggregation,
)
from polar.void.reducer.buckets import BUCKET_SIZE, bucket_start
from polar.void.reducer.filter import (
    Filter,
    FilterClause,
    FilterConjunction,
    FilterOperator,
)
from polar.void.reducer.map import EventMap
from polar.void.reducer.repository import ReducerRepository
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import derived_bucket_rows, event_bucket_rows
from polar.void.scenario.schemas import ScenarioCreate, ScenarioPatch
from polar.void.scenario.service import scenario as scenario_service
from polar.void.subscription.repository import SubscriptionRepository
from polar.void.subscription.service import lifecycle_events, new_subscription
from polar.void.tinybird import TinybirdApi, create_client
from polar.worker import JobQueueManager

DAYS = 30
EVENT_BATCH = 1_000

SEED = 20260910


def at(date: str) -> datetime:
    return datetime.fromisoformat(date).replace(tzinfo=UTC)


@dataclass(frozen=True)
class SubscriptionSeed:
    plan: str
    starts_at: datetime
    canceled_at: datetime | None = None
    ends_at: datetime | None = None
    uncanceled_at: datetime | None = None
    cancellation_reason: str = "unused"

    def cancellation_at(self, until: datetime) -> datetime | None:
        if self.uncanceled_at is not None and self.uncanceled_at <= until:
            return None
        if self.canceled_at is not None and self.canceled_at <= until:
            return self.canceled_at
        return None


@dataclass(frozen=True)
class CustomerSeed:
    name: str
    created_at: datetime
    subscription: SubscriptionSeed | None = None
    usage_weight: float = 0.0

    @property
    def external_id(self) -> str:
        return self.name.lower().replace(" ", "-")


CUSTOMERS = (
    CustomerSeed(
        "Northwind Labs",
        at("2025-01-15"),
        SubscriptionSeed("scale", at("2026-01-15")),
        usage_weight=1.0,
    ),
    CustomerSeed(
        "Halcyon Robotics",
        at("2025-10-03"),
        SubscriptionSeed("scale", at("2026-02-03")),
        usage_weight=0.72,
    ),
    CustomerSeed(
        "Aperture Analytics",
        at("2026-03-20"),
        SubscriptionSeed("scale", at("2026-03-23")),
        usage_weight=0.45,
    ),
    CustomerSeed(
        "Brightline Media",
        at("2025-11-08"),
        SubscriptionSeed("team", at("2026-01-08")),
        usage_weight=0.35,
    ),
    CustomerSeed(
        "Sable Systems",
        at("2026-02-10"),
        SubscriptionSeed(
            "team",
            at("2026-02-15"),
            canceled_at=at("2026-05-20"),
            ends_at=at("2026-06-15"),
            uncanceled_at=at("2026-05-30"),
            cancellation_reason="missing_features",
        ),
        usage_weight=0.23,
    ),
    CustomerSeed(
        "Orbital Foods",
        at("2026-04-17"),
        SubscriptionSeed("team", at("2026-04-19")),
        usage_weight=0.18,
    ),
    CustomerSeed(
        "Meridian Health",
        at("2026-06-02"),
        SubscriptionSeed("team", at("2026-06-05")),
        usage_weight=0.13,
    ),
    CustomerSeed(
        "Kestrel Games",
        at("2026-09-14"),
        SubscriptionSeed("team", at("2026-09-17")),
        usage_weight=0.09,
    ),
    CustomerSeed(
        "Tidewater Finance",
        at("2025-12-20"),
        SubscriptionSeed(
            "starter",
            at("2026-01-15"),
            canceled_at=at("2026-04-20"),
            ends_at=at("2026-05-15"),
            cancellation_reason="too_expensive",
        ),
        usage_weight=0.06,
    ),
    CustomerSeed("Lumen Studio", at("2026-08-24")),
    CustomerSeed(
        "Fairweather Co",
        at("2026-05-09"),
        SubscriptionSeed(
            "starter",
            at("2026-05-12"),
            canceled_at=at("2026-08-18"),
            ends_at=at("2026-09-12"),
        ),
        usage_weight=0.04,
    ),
    CustomerSeed(
        "Pinecrest Logistics",
        at("2026-08-18"),
        SubscriptionSeed("starter", at("2026-08-23")),
        usage_weight=0.03,
    ),
)


def demo_customers(count: int, until: datetime) -> list[CustomerSeed]:
    if count < len(CUSTOMERS):
        raise ValueError(
            f"Keep the {len(CUSTOMERS)} named customers; count must be >= {len(CUSTOMERS)}"
        )
    customers = list(CUSTOMERS)
    rng = random.Random(SEED)
    start = at("2026-01-01")
    for index in range(len(customers), count):
        joined = start + (until - start) * rng.random()
        subscribed = joined + timedelta(days=rng.randint(0, 7))
        plan = rng.choice(("starter", "starter", "team", "team", "scale"))
        canceled = subscribed + timedelta(days=rng.randint(35, 150))
        ends = subscribed
        cycle = 0
        while ends <= canceled:
            cycle += 1
            ends = step(subscribed, TimeInterval.month, cycle)
        subscription = None
        if index % 10 and subscribed <= until:
            churns = index % 5 == 0 and canceled <= until
            subscription = SubscriptionSeed(
                plan,
                subscribed,
                canceled_at=canceled if churns else None,
                ends_at=ends if churns else None,
                cancellation_reason=rng.choice(
                    ("unused", "too_expensive", "switched_service")
                ),
            )
        customers.append(
            CustomerSeed(
                f"Demo Customer {index + 1:03d}",
                joined,
                subscription,
                usage_weight=round(rng.uniform(0.02, 0.25), 2),
            )
        )
    return customers


DATASET = "void-demo-polar-metrics"


@dataclass(frozen=True)
class MetricDefinition:
    reducer: ReducerCreate
    cumulative: bool = False


def _event(
    slug: str,
    name: SystemEvent,
    aggregation: Aggregation,
    *,
    mapping: EventMap | None = None,
    **filters: str,
) -> ReducerCreate:
    return ReducerCreate(
        slug=slug,
        filter=Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(property=key, operator=FilterOperator.eq, value=value)
                for key, value in {"name": name, **filters}.items()
            ],
        ),
        aggregation=aggregation,
        map=mapping,
    )


def _derive(
    slug: str, inputs: dict[str, ReducerCreate], expression: str
) -> ReducerCreate:
    return ReducerCreate(
        slug=slug,
        aggregation=DerivedAggregation(
            inputs={name: reducer.slug for name, reducer in inputs.items()},
            expression=expression,
        ),
    )


_ORDERS = _event("orders", SystemEvent.order_paid, CountAggregation())
_ONE_TIME_PRODUCTS = _event(
    "one_time_products",
    SystemEvent.order_paid,
    CountAggregation(),
    billing_type="one_time",
)
_NEW_SUBSCRIPTIONS = _event(
    "new_subscriptions", SystemEvent.subscription_created, CountAggregation()
)
_ORDER_REVENUE = _event(
    "polar_order_revenue",
    SystemEvent.balance_order,
    PropertyAggregation(func="sum", property="net_amount"),
    currency="usd",
    presentment_currency="usd",
)
_CREDIT_REVENUE = _event(
    "polar_credit_revenue",
    SystemEvent.balance_credit_order,
    PropertyAggregation(func="sum", property="amount"),
    currency="usd",
)
_ORDER_NET_REVENUE = _event(
    "polar_order_net_revenue",
    SystemEvent.balance_order,
    PropertyAggregation(func="sum", property="value"),
    mapping={"value": "$net_amount - $fee"},
    currency="usd",
    presentment_currency="usd",
)
_CREDIT_NET_REVENUE = _event(
    "polar_credit_net_revenue",
    SystemEvent.balance_credit_order,
    PropertyAggregation(func="sum", property="value"),
    mapping={"value": "$amount - $fee"},
    currency="usd",
)
_ADJUSTMENTS = {
    key: _event(
        slug,
        event,
        PropertyAggregation(func="sum", property="value"),
        mapping={"value": "$amount - $fee"},
        currency="usd",
        presentment_currency="usd",
    )
    for key, slug, event in (
        ("refunds", "polar_refund_adjustments", SystemEvent.balance_refund),
        (
            "refundReversals",
            "polar_refund_reversals",
            SystemEvent.balance_refund_reversal,
        ),
        ("disputes", "polar_dispute_adjustments", SystemEvent.balance_dispute),
        (
            "disputeReversals",
            "polar_dispute_reversals",
            SystemEvent.balance_dispute_reversal,
        ),
    )
}
_REVENUE_INPUTS = {"paid": _ORDER_REVENUE, "credit": _CREDIT_REVENUE}
_NET_REVENUE_INPUTS = {
    "paid": _ORDER_NET_REVENUE,
    "credit": _CREDIT_NET_REVENUE,
    **_ADJUSTMENTS,
}
_NET_EXPRESSION = (
    "$paid + $credit + $refunds + $refundReversals + $disputes + $disputeReversals"
)
_REVENUE = _derive("revenue", _REVENUE_INPUTS, "$paid + $credit")
_NET_REVENUE = _derive("net_revenue", _NET_REVENUE_INPUTS, _NET_EXPRESSION)
_CANCELED_SUBSCRIPTIONS = _event(
    "canceled_subscriptions", SystemEvent.subscription_canceled, CountAggregation()
)
_CANCELLATION_REASONS = {
    reason: _event(
        f"canceled_subscriptions_{reason}",
        SystemEvent.subscription_canceled,
        CountAggregation(),
        customer_cancellation_reason=reason,
    )
    for reason in (
        "customer_service",
        "low_quality",
        "missing_features",
        "switched_service",
        "too_complex",
        "too_expensive",
        "unused",
    )
}

METRICS: dict[str, MetricDefinition] = {
    "orders": MetricDefinition(_ORDERS),
    "one_time_products": MetricDefinition(_ONE_TIME_PRODUCTS),
    "new_subscriptions": MetricDefinition(_NEW_SUBSCRIPTIONS),
    "revenue": MetricDefinition(_REVENUE),
    "cumulative_revenue": MetricDefinition(_REVENUE, cumulative=True),
    "net_revenue": MetricDefinition(_NET_REVENUE),
    "net_cumulative_revenue": MetricDefinition(_NET_REVENUE, cumulative=True),
    "average_order_value": MetricDefinition(
        _derive(
            "average_order_value",
            {**_REVENUE_INPUTS, "orders": _ORDERS},
            "($paid + $credit) / $orders",
        )
    ),
    "net_average_order_value": MetricDefinition(
        _derive(
            "net_average_order_value",
            {**_NET_REVENUE_INPUTS, "orders": _ORDERS},
            f"({_NET_EXPRESSION}) / $orders",
        )
    ),
    "canceled_subscriptions": MetricDefinition(_CANCELED_SUBSCRIPTIONS),
    **{
        reducer.slug: MetricDefinition(reducer)
        for reducer in _CANCELLATION_REASONS.values()
    },
    "canceled_subscriptions_other": MetricDefinition(
        _derive(
            "canceled_subscriptions_other",
            {"total": _CANCELED_SUBSCRIPTIONS, **_CANCELLATION_REASONS},
            "$total" + "".join(f" - ${reason}" for reason in _CANCELLATION_REASONS),
        )
    ),
}

# Base inputs precede derived reducers so the seed can register them in order.
REDUCERS: dict[str, ReducerCreate] = {
    reducer.slug: reducer
    for reducer in (
        _ORDERS,
        _ONE_TIME_PRODUCTS,
        _NEW_SUBSCRIPTIONS,
        *_REVENUE_INPUTS.values(),
        *_NET_REVENUE_INPUTS.values(),
        _CANCELED_SUBSCRIPTIONS,
        *_CANCELLATION_REASONS.values(),
        *(metric.reducer for metric in METRICS.values()),
    )
}


def metric_reducers() -> list[dict[str, Any]]:
    reducers = []
    for reducer in REDUCERS.values():
        definition = reducer.model_dump(mode="json")
        if definition["filter"] is not None:
            definition["filter"]["clauses"].append(
                {"property": "seed_dataset", "operator": "eq", "value": DATASET}
            )
        reducers.append(definition)
    return reducers


def customer_event(customer: CustomerSchema) -> EventCreate:
    return EventCreate(
        name=SystemEvent.customer_created,
        external_id=f"{DATASET}:customer:{customer.id}:created",
        external_identity_id=customer.external_id,
        timestamp=customer.created_at,
        metadata={
            "seed_dataset": DATASET,
            "customer_id": str(customer.id),
            "customer_email": customer.email,
            "customer_name": customer.name,
            "customer_external_id": customer.external_id,
        },
    )


def subscription_events(
    customer: CustomerSchema,
    subscription: SubscriptionModel,
    timeline: SubscriptionSeed,
    until: datetime,
) -> list[EventCreate]:
    product = subscription.product
    assert subscription.started_at is not None
    assert product.recurring_interval_count is not None
    assert product.recurring_interval is not None
    amount = int(price_of(product).amount * 100)
    common = {
        "seed_dataset": DATASET,
        "customer_id": str(customer.id),
        "subscription_id": str(subscription.id),
        "product_id": str(product.id),
        "currency": price_of(product).currency,
    }
    recurring = {
        "amount": amount,
        "recurring_interval": product.recurring_interval,
        "recurring_interval_count": product.recurring_interval_count,
    }
    events: list[EventCreate] = []

    def emit(
        name: SystemEvent, key: str, at: datetime, metadata: dict[str, Any]
    ) -> None:
        if at > until:
            return
        events.append(
            EventCreate(
                name=name,
                external_id=f"{DATASET}:{subscription.id}:{key}:{name.value}",
                external_identity_id=customer.external_id,
                timestamp=at,
                metadata={**common, **metadata},
            )
        )

    emit(
        SystemEvent.subscription_created,
        "created",
        subscription.started_at,
        {**recurring, "started_at": subscription.started_at.isoformat()},
    )
    cycle = 0
    while (
        at := step(
            subscription.started_at,
            TimeInterval(product.recurring_interval),
            cycle * product.recurring_interval_count,
        )
    ) <= until:
        if subscription.ends_at is not None and at >= subscription.ends_at:
            break
        order_id = str(uuid5(subscription.id, f"order:{cycle}"))
        order = {
            "order_id": order_id,
            "amount": amount,
            "net_amount": amount,
            "tax_amount": 0,
        }
        if cycle:
            emit(SystemEvent.subscription_cycled, str(cycle), at, recurring)
            for meter in meters_of(product):
                emit(
                    SystemEvent.meter_reset,
                    f"{cycle}:{meter.id}",
                    at,
                    {"meter_id": str(meter.id)},
                )
        emit(
            SystemEvent.order_paid,
            order_id,
            at,
            {**order, **recurring, "billing_type": "recurring"},
        )
        emit(
            SystemEvent.balance_order,
            order_id,
            at,
            {
                **order,
                "transaction_id": str(uuid5(subscription.id, f"balance:{cycle}")),
                "presentment_amount": amount,
                "presentment_currency": price_of(product).currency,
                "fee": amount * 4 // 100,
            },
        )
        cycle += 1

    if timeline.canceled_at is not None:
        assert timeline.ends_at is not None
        emit(
            SystemEvent.subscription_canceled,
            "canceled",
            timeline.canceled_at,
            {
                **recurring,
                "canceled_at": timeline.canceled_at.isoformat(),
                "ends_at": timeline.ends_at.isoformat(),
                "cancel_at_period_end": True,
                "customer_cancellation_reason": timeline.cancellation_reason,
            },
        )
    if timeline.uncanceled_at is not None:
        emit(
            SystemEvent.subscription_uncanceled,
            "uncanceled",
            timeline.uncanceled_at,
            recurring,
        )
    if subscription.ends_at is not None:
        emit(
            SystemEvent.subscription_revoked, "revoked", subscription.ends_at, recurring
        )
    return sorted(events, key=lambda event: event.timestamp)


NOTES = {
    "northwind-labs": "Enterprise pilot, invoiced quarterly",
    "halcyon-robotics": "Migrated from legacy metering in v2",
}

# child name, kind; the first six roots get children in this order
CHILDREN: list[tuple[str, str]] = [
    ("deploy-bot", "agent"),
    ("support-agent", "agent"),
    ("nightly-indexer", "service"),
    ("billing-service", "service"),
    ("research-agent", "agent"),
]

MODELS = ["gpt-5", "claude-sonnet-5", "claude-opus-5"]
TOOLS = ["search", "code_exec", "browser", "file_read"]


def _reducer(slug: str, event_name: str, aggregation: dict[str, Any]) -> dict[str, Any]:
    return {
        "slug": slug,
        "filter": {
            "conjunction": "and",
            "clauses": [{"property": "name", "operator": "eq", "value": event_name}],
        },
        "aggregation": aggregation,
    }


def _product(
    slug: str,
    name: str,
    description: str,
    amount: str,
    included_output_tokens: int,
    meters: list[str],
    entitlements: list[str],
) -> dict[str, Any]:
    return {
        "slug": slug,
        "name": name,
        "description": description,
        "price": {
            "type": "recurring",
            "interval": "month",
            "amount": amount,
            "currency": "usd",
        },
        "meters": [
            {
                "slug": "output_tokens",
                "included": included_output_tokens,
                "limit": "soft",
            },
            *[{"slug": meter, "included": 0, "limit": "soft"} for meter in meters],
        ],
        "entitlements": entitlements,
    }


def configuration_v1() -> dict[str, Any]:
    """Two plans, token and tool-call metering."""
    return {
        "checksum": "demo:v1",
        "reducers": [
            *metric_reducers(),
            _reducer(
                "output_tokens",
                "llm.completion",
                {"func": "sum", "property": "output_tokens"},
            ),
            _reducer(
                "input_tokens",
                "llm.completion",
                {"func": "sum", "property": "input_tokens"},
            ),
            _reducer("tool_calls", "tool.call", {"func": "count"}),
        ],
        "meters": [
            {
                "slug": "output_tokens",
                "reducer": "output_tokens",
                "unit_amount": "0.0006",
            },
            {
                "slug": "input_tokens",
                "reducer": "input_tokens",
                "unit_amount": "0.00015",
            },
            {"slug": "tool_calls", "reducer": "tool_calls", "unit_amount": "0.04"},
        ],
        "entitlements": [
            {"slug": "api-access", "name": "API access"},
            {"slug": "analytics", "name": "Usage analytics"},
        ],
        "products": [
            _product(
                "starter",
                "Starter",
                "Pay as you go for individuals.",
                "19",
                0,
                ["input_tokens", "tool_calls"],
                ["api-access"],
            ),
            _product(
                "team",
                "Team",
                "Shared workspace with 5k output tokens included.",
                "99",
                5_000,
                ["input_tokens", "tool_calls"],
                ["api-access", "analytics"],
            ),
        ],
    }


def configuration_v2() -> dict[str, Any]:
    """Adds the Scale plan and priority support."""
    config = deepcopy(configuration_v1())
    config["checksum"] = "demo:v2"
    config["entitlements"].append(
        {"slug": "priority-support", "name": "Priority support"}
    )
    config["products"].append(
        _product(
            "scale",
            "Scale",
            "For production agents, 25k output tokens included.",
            "499",
            25_000,
            ["input_tokens", "tool_calls"],
            ["api-access", "analytics", "priority-support"],
        )
    )
    return config


def configuration_v3() -> dict[str, Any]:
    """Adds sandbox minutes, reprices output tokens, and deploys agent activities."""
    config = deepcopy(configuration_v2())
    config["checksum"] = "demo:v3"
    config["reducers"].append(
        _reducer(
            "sandbox_minutes", "sandbox.stopped", {"func": "sum", "property": "minutes"}
        )
    )
    config["meters"].append(
        {"slug": "sandbox_minutes", "reducer": "sandbox_minutes", "unit_amount": "0.02"}
    )
    for meter in config["meters"]:
        if meter["slug"] == "output_tokens":
            meter["unit_amount"] = "0.0008"
    config["entitlements"].append({"slug": "sandbox", "name": "Sandboxes"})
    for product in config["products"]:
        if product["slug"] in ("team", "scale"):
            product["meters"].append(
                {"slug": "sandbox_minutes", "included": 0, "limit": "soft"}
            )
            product["entitlements"].append("sandbox")
    config["activities"] = [
        {"slug": "agent", "event": "llm.completion", "group_by": "call_id"}
    ]
    return config


# (name, patch); the first one is promoted and becomes v4
SCENARIOS: list[tuple[str, dict[str, Any]]] = [
    (
        "Usage-first",
        {
            "products": {
                "team": {
                    "price": {
                        "type": "recurring",
                        "interval": "month",
                        "amount": "129",
                        "currency": "usd",
                    }
                }
            },
            "meters": {"output_tokens": {"unit_amount": "0.0012"}},
        },
    ),
    (
        "Enterprise uplift",
        {
            "products": {
                "scale": {
                    "price": {
                        "type": "recurring",
                        "interval": "month",
                        "amount": "599",
                        "currency": "usd",
                    }
                }
            },
            "meters": {},
        },
    ),
    (
        "Free Starter",
        {
            "products": {
                "starter": {
                    "price": {
                        "type": "recurring",
                        "interval": "month",
                        "amount": "0",
                        "currency": "usd",
                    }
                }
            },
            "meters": {},
        },
    ),
]


class DemoSeeder:
    def __init__(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        customers: int = len(CUSTOMERS),
        now: datetime | None = None,
    ) -> None:
        self.session = session
        self.organization = organization
        self.now = now or utc_now()
        self.random = random.Random(SEED)
        self.timelines = demo_customers(customers, self.now)
        self.customers: dict[str, CustomerSchema] = {}
        self.history: list[EventCreate] = []

    async def is_seeded(self) -> bool:
        deployments = await DeployRepository.from_session(self.session).list(
            self.organization.id
        )
        return any(deployment.checksum == "demo:v3" for deployment in deployments)

    async def reset(self, tinybird: TinybirdApi) -> None:
        """Clear the organization's database rows and Tinybird history."""
        organization_id = self.organization.id
        await self.session.execute(
            update(Customer)
            .where(Customer.organization_id == organization_id)
            .values(root_identity_id=None)
        )
        for model in (
            EventModel,
            SubscriptionModel,
            VoidScenario,
            VoidReducerJob,
            VoidReducerDependency,
            VoidReducerBucket,
            VoidActivitySpan,
            ProductModel,
            MeterModel,
            VoidDeployment,
            Benefit,
            VoidReducer,
        ):
            await self.session.execute(
                delete(model).where(model.organization_id == organization_id)
            )
        # Children before roots: the parent FK is not cascading.
        await self.session.execute(
            delete(VoidBillingIdentity).where(
                VoidBillingIdentity.organization_id == organization_id,
                VoidBillingIdentity.parent_id.is_not(None),
            )
        )
        await self.session.execute(
            delete(VoidBillingIdentity).where(
                VoidBillingIdentity.organization_id == organization_id
            )
        )
        # Polar customers stay; unbound above, they are re-bound by external id.
        await self.session.flush()
        # The event deletion waits for in-flight deliveries before clearing Tinybird.
        await asyncio.to_thread(tinybird.delete_organization_events, organization_id)

    async def deploy_versions(self) -> str:
        """v1 → v2 → v3, each activated in turn, backdated like the fixtures."""
        for config, age in (
            (configuration_v1(), timedelta(days=23)),
            (configuration_v2(), timedelta(days=9)),
            (configuration_v3(), timedelta(days=2)),
        ):
            create_schema = DeployCreate.model_validate({**config, "activate": True})
            deploy = await deploy_service.deploy(
                self.session, self.organization.id, create_schema
            )
            await self.session.execute(
                update(VoidDeployment)
                .where(VoidDeployment.id == deploy.id)
                .values(created_at=self.now - age)
            )
            # Meters and products inherit the version's age so their pages
            # read as history too.
            for model in (MeterModel, ProductModel):
                await self.session.execute(
                    update(model)
                    .where(
                        model.organization_id == self.organization.id,
                        model.version_id == deploy.version_id,
                    )
                    .values(created_at=self.now - age)
                )
            await self.session.flush()
        return create_schema.version_id

    async def create_identities(self, auth: AuthzContext[User]) -> dict[str, list[str]]:
        """Bind every root to a Polar customer; give the first six children.

        Returns the external ids that emit events for each root.
        """
        emitters: dict[str, list[str]] = {}
        for index, timeline in enumerate(self.timelines):
            slug = timeline.external_id
            self.customers[slug] = await self.seed_customer(auth, timeline)
            root = await identity_service.get(self.session, self.organization.id, slug)
            root.metadata_ = {
                **root.metadata_,
                **({"note": NOTES[slug]} if slug in NOTES else {}),
            }
            children: list[str] = []
            if index < 6:
                count = 5 - index if index < 3 else 2
                for child_name, kind in CHILDREN[:count]:
                    external_id = f"{slug}/{child_name}"
                    await identity_service.ensure(
                        self.session,
                        self.organization,
                        IdentityCreate(
                            external_id=external_id,
                            parent_external_id=slug,
                            metadata={"kind": kind, "name": child_name},
                        ),
                    )
                    children.append(external_id)
            emitters[slug] = children or [slug]
        await self.session.flush()
        return emitters

    async def seed_customer(
        self, auth: AuthzContext[User], timeline: CustomerSeed
    ) -> CustomerSchema:
        customer = await customer_service.create(
            self.session,
            auth,
            CustomerCreate(
                external_id=timeline.external_id,
                email=f"void-demo+{timeline.external_id}@polar.sh",
                name=timeline.name,
            ),
        )
        repository = CustomerRepository.from_session(self.session)
        native = await repository.get_active_by_external_id(
            self.organization.id, timeline.external_id
        )
        assert native is not None
        assert native.root_identity is not None
        native.created_at = timeline.created_at
        native.root_identity.created_at = timeline.created_at
        customer.created_at = timeline.created_at
        self.history.append(customer_event(customer))
        return customer

    async def create_subscriptions(self, version_id: str) -> None:
        products = {
            product.slug: product
            for product in await product_service.list(
                self.session, self.organization.id
            )
            if product.version_id == version_id
        }
        for timeline in self.timelines:
            plan = timeline.subscription
            if plan is None:
                continue
            await self.seed_subscription(timeline, products[plan.plan])

    async def seed_subscription(
        self, timeline: CustomerSeed, product: ProductModel
    ) -> None:
        plan = timeline.subscription
        assert plan is not None
        canceled_at = plan.cancellation_at(self.now)
        subscription = await new_subscription(
            self.session,
            product,
            await identity_service.get(
                self.session, self.organization.id, timeline.external_id
            ),
            plan.starts_at,
            id=uuid5(self.organization.id, f"demo:subscription:{timeline.external_id}"),
            ends_at=plan.ends_at if canceled_at else None,
        )
        subscription.created_at = plan.starts_at
        subscription.canceled_at = canceled_at
        subscription.cancel_at_period_end = bool(
            canceled_at and subscription.ends_at and subscription.ends_at > self.now
        )
        if subscription.cancel_at_period_end:
            subscription.status = SubscriptionStatus.active
            subscription.ended_at = None
        await SubscriptionRepository.from_session(self.session).create(subscription)
        self.history.extend(lifecycle_events(subscription, "created", plan.starts_at))
        if subscription.ends_at is not None:
            self.history.extend(
                lifecycle_events(subscription, "canceled", subscription.ends_at)
            )
        self.history.extend(
            subscription_events(
                self.customers[timeline.external_id], subscription, plan, self.now
            )
        )

    def _events_for(
        self, timeline: CustomerSeed, emitters: list[str]
    ) -> list[EventCreate]:
        """Thirty days of usage, heavier on weekdays, scaled by the root's weight."""
        events: list[EventCreate] = []
        plan = timeline.subscription
        if plan is None:
            return events
        root_slug, weight = timeline.external_id, timeline.usage_weight
        rng = self.random
        start = self.now - timedelta(days=DAYS)
        for day in range(DAYS):
            day_start = start + timedelta(days=day)
            weekday_factor = 0.55 if day_start.weekday() >= 5 else 1.0
            completions = int(rng.gauss(90, 18) * weight * weekday_factor)
            for _ in range(max(completions, 0)):
                emitter = rng.choice(emitters)
                at = day_start + timedelta(seconds=rng.uniform(6 * 3600, 22 * 3600))
                input_tokens = int(rng.lognormvariate(6.8, 0.6))
                output_tokens = int(rng.lognormvariate(6.2, 0.7))
                events.append(
                    EventCreate(
                        name="llm.completion",
                        external_id=f"{root_slug}:{day}:{len(events)}",
                        external_identity_id=emitter,
                        timestamp=at,
                        metadata={
                            "model": rng.choice(MODELS),
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens,
                        },
                    )
                )
                if rng.random() < 0.35:
                    events.append(
                        EventCreate(
                            name="tool.call",
                            external_id=f"{root_slug}:{day}:{len(events)}",
                            external_identity_id=emitter,
                            timestamp=at + timedelta(seconds=rng.uniform(1, 40)),
                            metadata={"tool": rng.choice(TOOLS)},
                        )
                    )
            sandboxes = int(rng.gauss(4, 1.5) * weight * weekday_factor)
            for _ in range(max(sandboxes, 0)):
                emitter = rng.choice(emitters)
                at = day_start + timedelta(seconds=rng.uniform(7 * 3600, 20 * 3600))
                minutes = round(rng.lognormvariate(3.0, 0.5), 1)
                sandbox_id = f"sbx_{rng.randrange(10**8):08d}"
                events.append(
                    EventCreate(
                        name="sandbox.started",
                        external_id=f"{root_slug}:{day}:{len(events)}",
                        external_identity_id=emitter,
                        timestamp=at,
                        metadata={"sandbox_id": sandbox_id},
                    )
                )
                events.append(
                    EventCreate(
                        name="sandbox.stopped",
                        external_id=f"{root_slug}:{day}:{len(events)}",
                        external_identity_id=emitter,
                        timestamp=at + timedelta(minutes=minutes),
                        metadata={"sandbox_id": sandbox_id, "minutes": minutes},
                    )
                )
        ends_at = plan.ends_at if plan.cancellation_at(self.now) else None
        return [
            event
            for event in events
            if plan.starts_at <= event.timestamp <= self.now
            and (ends_at is None or event.timestamp < ends_at)
        ]

    async def ingest_events(self, emitters: dict[str, list[str]]) -> int:
        saved = await self.ingest(self.history, EventSource.system)
        for timeline in self.timelines:
            events = self._events_for(timeline, emitters[timeline.external_id])
            saved += await self.ingest(events, EventSource.user)
        return saved

    async def ingest(self, events: list[EventCreate], source: EventSource) -> int:
        saved = 0
        events.sort(key=lambda event: event.timestamp)
        for offset in range(0, len(events), EVENT_BATCH):
            count, _ = await event_service.ingest(
                self.session,
                self.organization.id,
                events[offset : offset + EVENT_BATCH],
                source,
            )
            saved += count
        return saved

    async def deliver(self, tinybird: TinybirdApi) -> dict[str, int]:
        repository = EventRepository.from_session(self.session)
        delivered = 0
        while pending := await repository.pending(
            {self.organization.id}, limit=EVENT_BATCH
        ):
            await asyncio.to_thread(
                tinybird.ingest_batch,
                "void_events",
                [event_payload(event) for event in pending],
            )
            await activity_service.touch_events(self.session, pending)
            await repository.mark_delivered(pending, utc_now())
            delivered += len(pending)
        return {"delivered_events": delivered}

    async def backfill_buckets(self, tinybird: TinybirdApi) -> int:
        start, end = await EventRepository.from_session(self.session).timestamp_range(
            self.organization.id
        )
        if start is None or end is None:
            return 0
        repository = ReducerRepository.from_session(self.session)
        await repository.lock_definitions(self.organization.id)
        reducers = {r.slug: r for r in await repository.list(self.organization.id)}
        base: dict[UUID, list[VoidReducerBucket]] = {}
        rows: list[dict[str, Any]] = []
        for reducer in reducers.values():
            if reducer.aggregation.func == "derive":
                continue
            values = await event_bucket_rows(
                tinybird, reducer, bucket_start(start), bucket_start(end) + BUCKET_SIZE
            )
            rows.extend(values)
            base[reducer.id] = [VoidReducerBucket(**row) for row in values]
        for reducer in reducers.values():
            if reducer.aggregation.func != "derive":
                continue
            sources = {
                name: reducers[slug]
                for name, slug in reducer.aggregation.inputs.items()
            }
            rows.extend(
                derived_bucket_rows(
                    reducer,
                    sources,
                    [row for source in sources.values() for row in base[source.id]],
                )
            )
        await self.session.execute(
            delete(VoidReducerBucket).where(
                VoidReducerBucket.organization_id == self.organization.id
            )
        )
        for offset in range(0, len(rows), EVENT_BATCH):
            await repository.write_buckets(rows[offset : offset + EVENT_BATCH])
        return len(rows)

    async def create_scenarios(self, base_version_id: str) -> None:
        for index, (name, patch) in enumerate(SCENARIOS):
            scenario = await scenario_service.create(
                self.session,
                self.organization.id,
                ScenarioCreate(
                    name=name,
                    base_version_id=base_version_id,
                    patch=ScenarioPatch.model_validate(patch),
                ),
            )
            if index == 0:
                await scenario_service.promote(
                    self.session, self.organization.id, scenario.id
                )

    async def run(self) -> dict[str, int]:
        user = await development_service.ensure_operator(
            self.session, self.organization
        )
        auth: AuthzContext[User] = AuthzContext(
            organization=self.organization,
            auth_subject=AuthSubject(user, set(Scope), None),
        )
        version_id = await self.deploy_versions()
        emitters = await self.create_identities(auth)
        await self.create_subscriptions(version_id)
        events = await self.ingest_events(emitters)
        await self.create_scenarios(version_id)
        return {
            "versions": 4,
            "customers": len(self.timelines),
            "identities": len(self.timelines)
            + sum(len(e) for slug, e in emitters.items() if e != [slug]),
            "subscriptions": sum(
                timeline.subscription is not None for timeline in self.timelines
            ),
            "events": events,
            "scenarios": len(SCENARIOS),
        }


async def run(reset: bool, customers: int = len(CUSTOMERS)) -> dict[str, int]:
    if not settings.is_development():
        raise ValueError("The Void demo seed only runs with POLAR_ENV=development")
    engine = create_async_engine("script")
    redis = create_redis("app")
    tinybird: TinybirdApi | None = None
    try:
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            counts = None
            async with (
                JobQueueManager.open(dramatiq.get_broker(), redis),
                session.begin(),
            ):
                organization, _ = await development_service.seed(session)
                seeder = DemoSeeder(session, organization, customers=customers)
                if reset:
                    tinybird = create_client(local=True)
                    await seeder.reset(tinybird)
                if reset or not await seeder.is_seeded():
                    counts = await seeder.run()
            async with session.begin():
                if tinybird is None:
                    tinybird = create_client(local=True)
                delivery = await seeder.deliver(tinybird)
                delivery["reducer_buckets"] = await seeder.backfill_buckets(tinybird)
            return {**(counts or {}), **delivery}
    finally:
        if tinybird is not None:
            tinybird.close()
        await redis.close()
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=f"Seed {ORGANIZATION_SLUG} ({ORGANIZATION_ID}) with demo data"
    )
    parser.add_argument(
        "--customers",
        type=int,
        default=len(CUSTOMERS),
        help="Total customers, including the 12 named timelines (default: 12)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete the organization's Void data first and seed again",
    )
    arguments = parser.parse_args()
    try:
        counts = asyncio.run(run(arguments.reset, arguments.customers))
    except (ValueError, RuntimeError) as error:
        parser.error(str(error))
    summary = ", ".join(f"{value} {key}" for key, value in counts.items())
    print(f"Seeded {ORGANIZATION_SLUG}: {summary}.")


if __name__ == "__main__":
    main()
