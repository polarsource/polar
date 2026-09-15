import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm.attributes import set_committed_value

from polar.models import (
    VoidBillingIdentity as BillingIdentity,
)
from polar.models import (
    VoidEntitlement as Entitlement,
)
from polar.models import (
    VoidMeter as Meter,
)
from polar.models import (
    VoidProduct as Product,
)
from polar.models import (
    VoidSubscription as Subscription,
)
from polar.models import (
    VoidSubscriptionStatus as SubscriptionStatus,
)
from polar.void.event.schemas import EventCreate
from polar.void.meter.balance import MeterEvent, State, fold
from polar.void.subscription.service import (
    lifecycle_events,
    period_at,
    to_schema,
)

ORG = uuid.uuid4()
NOW = datetime(2026, 9, 8, 9, tzinfo=UTC)


def _meter(slug: str) -> Meter:
    return Meter(
        id=uuid.uuid4(),
        name=slug,
        slug=slug,
        generation_id=1,
        branch_id=None,
        usage_reducer_id=uuid.uuid4(),
        credit_reducer_id=uuid.uuid4(),
        unit_amount=Decimal("0.01"),
        currency="usd",
        organization_id=ORG,
        created_at=NOW,
    )


def _product(
    *,
    price_type: str = "recurring",
    meters: list[Meter] | None = None,
    entitlements: list[Entitlement] | None = None,
    archived: bool = False,
) -> Product:
    product = Product(
        id=uuid.uuid4(),
        slug="pro",
        generation_id=3,
        name="Pro",
        description=None,
        price_type=price_type,
        interval="month" if price_type == "recurring" else None,
        interval_count=1,
        amount=Decimal(49),
        currency="usd",
        meter_ids=[m.id for m in meters or []],
        entitlement_ids=[e.id for e in entitlements or []],
        meter_terms={},
        archived_at=NOW if archived else None,
        organization_id=ORG,
        created_at=NOW,
    )
    # The pinned sets are view-only relationships resolved from the id arrays.
    set_committed_value(product, "meters", meters or [])
    set_committed_value(product, "entitlements", entitlements or [])
    return product


def _entitlement(slug: str) -> Entitlement:
    return Entitlement(
        id=uuid.uuid4(),
        slug=slug,
        name=slug,
        description=None,
        organization_id=ORG,
        created_at=NOW,
    )


def _identity(external_id: str) -> BillingIdentity:
    return BillingIdentity(
        id=uuid.uuid4(), external_id=external_id, parent_id=None, organization_id=ORG
    )


def _subscription(
    product: Product, identity: BillingIdentity, started_at: datetime = NOW
) -> Subscription:
    subscription = Subscription(
        id=uuid.uuid4(),
        product_id=product.id,
        billing_identity_id=identity.id,
        status=SubscriptionStatus.active,
        started_at=started_at,
        organization_id=ORG,
        created_at=started_at,
    )
    subscription.product = product
    subscription.billing_identity = identity
    return subscription


def test_lifecycle_events_fan_out_one_meter_event_per_pinned_meter() -> None:
    tokens, calls = _meter("tokens"), _meter("calls")
    sso = _entitlement("sso")
    subscription = _subscription(
        _product(meters=[tokens, calls], entitlements=[sso]), _identity("acme")
    )
    subscription.product.version_id = "candidate"
    tokens.version_id = "candidate"

    events = lifecycle_events(subscription, "created", NOW)

    by_name: dict[str, list[EventCreate]] = {}
    for event in events:
        by_name.setdefault(event.name, []).append(event)
    assert set(by_name) == {
        "product.subscription.created",
        "entitlement.granted",
        "subscription.created",
    }
    assert len(by_name["subscription.created"]) == 2
    assert all(e.metadata["product_version_id"] == "candidate" for e in events)
    assert {
        e.metadata["meter_id"]: e.metadata["meter_version_id"]
        for e in by_name["subscription.created"]
    } == {str(tokens.id): "candidate", str(calls.id): None}
    assert {e.metadata["meter_id"] for e in by_name["subscription.created"]} == {
        str(tokens.id),
        str(calls.id),
    }
    # Every derived event is stamped at the anchor, on the subscribing identity.
    assert all(e.timestamp == NOW for e in events)
    assert all(e.external_identity_id == "acme" for e in events)
    # External ids stay unique per meter so the ingest dedupe keeps all of them.
    assert len({e.external_id for e in events}) == len(events)
    granted = by_name["entitlement.granted"][0]
    assert granted.metadata["entitlement"] == "sso"
    assert granted.metadata["subscription_id"] == str(subscription.id)


def test_derived_meter_events_drive_the_existing_fold() -> None:
    tokens = _meter("tokens")
    subscription = _subscription(
        _product(meters=[tokens]), _identity("acme"), datetime(2026, 1, 15, tzinfo=UTC)
    )
    created = next(
        e
        for e in lifecycle_events(subscription, "created", subscription.started_at)
        if e.name == "subscription.created"
    )
    state = fold(
        State(),
        [
            MeterEvent(
                id=created.external_id,
                at=created.timestamp,
                name=created.name,
                data=created.metadata,
            )
        ],
        [],
        [(datetime(2026, 2, 1, tzinfo=UTC), 120.0)],
        datetime(2026, 3, 20, tzinfo=UTC),
    )
    assert state.subscription is not None
    # `id` in the metadata names the subscription, not the per-meter event.
    assert state.subscription.id == str(subscription.id)
    assert state.subscription.meter_interval == "month"
    cycles = sorted(state.cycles.values(), key=lambda c: c.period_end)
    assert [c.period_end for c in cycles] == [
        datetime(2026, 2, 15, tzinfo=UTC),
        datetime(2026, 3, 15, tzinfo=UTC),
    ]
    # Pure usage billing: with no credits the overage is the period's usage.
    assert cycles[0].usage == 120.0
    assert cycles[0].overage == 120.0
    assert cycles[0].subscription_id == str(subscription.id)


def test_one_time_products_emit_a_purchase_and_no_meter_events() -> None:
    subscription = _subscription(
        _product(price_type="one_time", entitlements=[_entitlement("sso")]),
        _identity("acme"),
    )
    names = [e.name for e in lifecycle_events(subscription, "created", NOW)]
    assert names == ["product.purchased", "entitlement.granted"]


def test_period_at_follows_the_anchor_day() -> None:
    subscription = _subscription(
        _product(meters=[_meter("tokens")]),
        _identity("acme"),
        datetime(2026, 1, 31, tzinfo=UTC),
    )
    start, end = period_at(subscription, datetime(2026, 3, 10, tzinfo=UTC))
    assert (start, end) == (
        datetime(2026, 2, 28, tzinfo=UTC),
        datetime(2026, 3, 31, tzinfo=UTC),
    )
    schema = to_schema(subscription, datetime(2026, 3, 10, tzinfo=UTC))
    assert schema.current_period_end == end
    assert schema.external_identity_id == "acme"
