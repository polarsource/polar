import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from typing import Any

from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import (
    VoidBillingIdentity as BillingIdentity,
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
from polar.postgres import AsyncSession
from polar.void.entitlement.schemas import (
    EntitlementAssignment,
    EntitlementAssignmentRead,
    EntitlementGrant,
    IdentityEntitlements,
)
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from polar.void.identity.service import identity as identity_service
from polar.void.meter.balance import step
from polar.void.meter.service import EPOCH
from polar.void.meter.service import meter as meter_service
from polar.void.metric.schemas import TimeInterval
from polar.void.organization.service import organization as organization_service
from polar.void.product.schemas import to_schema as product_schema
from polar.void.product.service import product as product_service
from polar.void.tinybird import TinybirdApi

from .repository import SubscriptionRepository
from .schemas import ProductSubscription as SubscriptionSchema
from .schemas import (
    SubscriptionCreate,
    SubscriptionCycle,
    SubscriptionCycleMeter,
    SubscriptionRebuild,
)


class SubscriptionInvalid(PolarError):
    def __init__(self, message: str = "Invalid subscription") -> None:
        super().__init__(message, 400)


class SubscriptionConflict(PolarError):
    def __init__(self, message: str = "Subscription conflict") -> None:
        super().__init__(message, 409)


def _interval(product: Product) -> TimeInterval:
    assert product.interval is not None
    return TimeInterval(product.interval)


def period_at(subscription: Subscription, at: datetime) -> tuple[datetime, datetime]:
    """The boundaries around `at`, on the product's cadence from `started_at`."""
    product = subscription.product
    interval, count = _interval(product), product.interval_count
    k = 0
    while step(subscription.started_at, interval, (k + 1) * count) <= at:
        k += 1
    return (
        step(subscription.started_at, interval, k * count),
        step(subscription.started_at, interval, (k + 1) * count),
    )


def to_schema(subscription: Subscription, at: datetime) -> SubscriptionSchema:
    period: tuple[datetime, datetime] | None = None
    if subscription.product.is_recurring and subscription.active_at(at):
        period = period_at(subscription, at)
    return SubscriptionSchema(
        id=subscription.id,
        product=product_schema(subscription.product),
        external_identity_id=subscription.billing_identity.external_id,
        status=SubscriptionStatus(subscription.status),
        started_at=subscription.started_at,
        canceled_at=subscription.canceled_at,
        ends_at=subscription.ends_at,
        current_period_start=period[0] if period else None,
        current_period_end=period[1] if period else None,
        created_at=subscription.created_at,
    )


def _event(
    name: str,
    external_id: str,
    identity: BillingIdentity,
    at: datetime,
    metadata: dict[str, object],
) -> EventCreate:
    return EventCreate(
        name=name,
        external_id=external_id,
        external_identity_id=identity.external_id,
        timestamp=at,
        metadata=metadata,
    )


def _product_metadata(subscription: Subscription) -> dict[str, object]:
    product = subscription.product
    return {
        "subscription_id": str(subscription.id),
        "product_id": str(product.id),
        "product_slug": product.slug,
        "product_generation_id": product.generation_id,
        "product_variant_id": product.variant_id,
    }


def _lifecycle_metadata(subscription: Subscription) -> dict[str, object]:
    """Everything the row projection needs beyond the event's own timestamp,
    so a rebuild from the stream is lossless."""
    data: dict[str, object] = {
        "external_identity_id": subscription.billing_identity.external_id,
        "started_at": subscription.started_at.isoformat(),
    }
    if subscription.canceled_at is not None:
        data["canceled_at"] = subscription.canceled_at.isoformat()
    if subscription.ends_at is not None:
        data["ends_at"] = subscription.ends_at.isoformat()
    return data


PRODUCT_LIFECYCLE = (
    "product.subscription.created",
    "product.subscription.canceled",
    "product.subscription.revoked",
    "product.purchased",
    "product.canceled",
    "product.revoked",
)


def project(row: Subscription, name: str, at: datetime, data: dict[str, Any]) -> None:
    """Reconstruct the subscription fields recorded in one lifecycle event."""
    action = name.rsplit(".", 1)[1]
    if action in ("created", "purchased"):
        row.product_id = uuid.UUID(data["product_id"])
        row.started_at = datetime.fromisoformat(data.get("started_at", at.isoformat()))
        row.status = SubscriptionStatus.active
        row.canceled_at = None
        row.ends_at = None
        return
    if action not in ("canceled", "revoked"):
        return
    row.status = (
        SubscriptionStatus.canceled
        if action == "canceled"
        else SubscriptionStatus.revoked
    )
    row.ends_at = datetime.fromisoformat(data.get("ends_at", at.isoformat()))
    canceled_at = data.get("canceled_at")
    row.canceled_at = (
        datetime.fromisoformat(canceled_at) if canceled_at is not None else row.ends_at
    )


def _meter_metadata(subscription: Subscription, meter: Meter) -> dict[str, object]:
    """What the meter fold reads: the meter, the cadence, and `id`, which
    overrides the event's own external id as the subscription id."""
    product = subscription.product
    return {
        **_product_metadata(subscription),
        "id": str(subscription.id),
        "meter_id": str(meter.id),
        "meter_variant_id": meter.variant_id,
        "meter_interval": product.interval,
        "meter_interval_count": product.interval_count,
        **(product.meter_terms or {}).get(meter.slug, {}),
    }


def lifecycle_events(
    subscription: Subscription, action: str, at: datetime
) -> list[EventCreate]:
    """The product-level event, one entitlement event per grant, and one
    derived per-meter subscription event, all stamped at `at`.

    `action` is created, canceled, or revoked. One-time products emit
    `product.purchased` instead of a subscription event and have no meters.
    """
    product = subscription.product
    identity = subscription.billing_identity
    sid = str(subscription.id)
    events: list[EventCreate] = []
    if product.is_recurring:
        events.append(
            _event(
                f"product.subscription.{action}",
                f"product.subscription:{sid}:{action}",
                identity,
                at,
                {
                    **_product_metadata(subscription),
                    **_lifecycle_metadata(subscription),
                },
            )
        )
    else:
        events.append(
            _event(
                "product.purchased" if action == "created" else f"product.{action}",
                f"product:{sid}:{action}",
                identity,
                at,
                {
                    **_product_metadata(subscription),
                    **_lifecycle_metadata(subscription),
                },
            )
        )
    entitlement_action = "granted" if action == "created" else "revoked"
    for entitlement in product.entitlements:
        events.append(
            _event(
                f"entitlement.{entitlement_action}",
                f"entitlement:{sid}:{entitlement.id}:{action}",
                identity,
                at,
                {
                    **_product_metadata(subscription),
                    "entitlement_id": str(entitlement.id),
                    "entitlement": entitlement.slug,
                },
            )
        )
    for meter in product.meters:
        events.append(
            _event(
                f"subscription.{action}",
                f"subscription:{sid}:{meter.id}:{action}",
                identity,
                at,
                _meter_metadata(subscription, meter),
            )
        )
    return events


class SubscriptionService:
    async def _ingest_lifecycle(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        events: Sequence[EventCreate],
    ) -> None:
        saved, _ = await event_service.ingest(
            session, organization_id, events, EventSource.system
        )
        if saved != len({event.external_id for event in events}):
            raise SubscriptionConflict(
                "A lifecycle event ID already belongs to another operation"
            )

    async def list(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        external_identity_id: str | None = None,
        *,
        active_at: datetime | None = None,
    ) -> Sequence[Subscription]:
        identity_ids = None
        if external_identity_id is not None:
            identity = await identity_service.get(
                session, organization_id, external_identity_id
            )
            identity_ids = [identity.id]
        return await SubscriptionRepository.from_session(session).list(
            organization_id, identity_ids=identity_ids, active_at=active_at
        )

    async def get(
        self, session: AsyncSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> Subscription:
        subscription = await SubscriptionRepository.from_session(session).get(
            organization_id, id
        )
        if subscription is None:
            raise ResourceNotFound()
        return subscription

    async def create(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: SubscriptionCreate,
    ) -> Subscription:
        """Insert the row and, in the same transaction and ingest batch, the
        events derived from it. The server is the only writer of those."""
        organization = await organization_service.lock(session, organization_id)
        now = utc_now()
        product = await product_service.get(
            session, organization_id, create_schema.product_id
        )
        if product.archived_at is not None:
            raise SubscriptionInvalid(
                f"Product {product.slug!r} generation {product.generation_id} "
                "is archived; subscribe to the current generation"
            )
        identity = await identity_service.get(
            session, organization_id, create_schema.external_identity_id
        )
        if not identity.is_root:
            raise SubscriptionInvalid("Subscriptions belong to the root identity")
        started_at = create_schema.starts_at or now
        if started_at > now:
            raise SubscriptionInvalid("starts_at cannot be in the future")
        ends_at = create_schema.ends_at
        if ends_at is not None and (ends_at <= started_at or ends_at > now):
            raise SubscriptionInvalid(
                "ends_at must lie between starts_at and now; it imports history"
            )
        if ends_at is None:
            for existing in await self.list(
                session, organization_id, identity.external_id, active_at=now
            ):
                if existing.product.slug == product.slug or (
                    product.is_recurring and existing.product.is_recurring
                ):
                    raise SubscriptionConflict(
                        f"{identity.external_id} already holds {product.slug!r} "
                        f"as subscription {existing.id}"
                    )
        subscription = Subscription(
            id=uuid.uuid4(),
            status=(
                SubscriptionStatus.active
                if ends_at is None
                else SubscriptionStatus.canceled
            ),
            started_at=started_at,
            canceled_at=ends_at,
            ends_at=ends_at,
            organization=organization,
        )
        subscription.product = product
        subscription.billing_identity = identity
        events = lifecycle_events(subscription, "created", started_at)
        if ends_at is not None:
            events += lifecycle_events(subscription, "canceled", ends_at)
        await self._ingest_lifecycle(session, organization_id, events)
        session.add(subscription)
        await session.flush()
        return subscription

    async def cancel(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        id: uuid.UUID,
        at_period_end: bool,
    ) -> Subscription:
        """End access at the next boundary, or now. The derived events are
        stamped at that moment, so the fold and pipes apply them on time."""
        await organization_service.lock(session, organization_id)
        now = utc_now()
        subscription = await self.get(session, organization_id, id)
        if subscription.status != SubscriptionStatus.active:
            raise SubscriptionConflict(
                f"Subscription {id} is already {subscription.status}"
            )
        ends_at = now
        if at_period_end and subscription.product.is_recurring:
            ends_at = period_at(subscription, now)[1]
        subscription.status = SubscriptionStatus.canceled
        subscription.canceled_at = now
        subscription.ends_at = ends_at
        await self._ingest_lifecycle(
            session,
            organization_id,
            lifecycle_events(subscription, "canceled", ends_at),
        )
        await session.flush()
        return subscription

    async def revoke(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        id: uuid.UUID,
    ) -> Subscription:
        await organization_service.lock(session, organization_id)
        now = utc_now()
        subscription = await self.get(session, organization_id, id)
        if subscription.status == SubscriptionStatus.revoked or (
            subscription.ends_at is not None and subscription.ends_at <= now
        ):
            raise SubscriptionConflict(f"Subscription {id} has already ended")
        subscription.status = SubscriptionStatus.revoked
        subscription.canceled_at = subscription.canceled_at or now
        subscription.ends_at = now
        await self._ingest_lifecycle(
            session, organization_id, lifecycle_events(subscription, "revoked", now)
        )
        await session.flush()
        return subscription

    async def rebuild(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        *,
        apply: bool = True,
    ) -> SubscriptionRebuild:
        """Re-project every row from the product-level lifecycle events.

        With `apply=False` this is the consistency check: it reports what the
        stream would change without writing. Rows without events behind them
        are reported as orphans and left alone."""
        organization = await organization_service.lock(session, organization_id)
        events = await SubscriptionRepository.from_session(session).lifecycle_events(
            organization_id, PRODUCT_LIFECYCLE
        )
        order = {"created": 0, "purchased": 0, "canceled": 1, "revoked": 2}
        # A revoke overrides a previously scheduled cancellation, even before its boundary.
        events.sort(key=lambda e: (order[e.name.rsplit(".", 1)[1]], e.timestamp))

        projected: dict[uuid.UUID, Subscription] = {}
        for event in events:
            sid = uuid.UUID(event.metadata["subscription_id"])
            row = projected.get(sid)
            if row is None:
                external_id = event.metadata.get(
                    "external_identity_id", event.external_identity_id
                )
                if not isinstance(external_id, str):
                    raise SubscriptionInvalid("Lifecycle event has no billing identity")
                identity = await identity_service.get(
                    session, organization_id, external_id
                )
                row = Subscription(
                    id=sid,
                    billing_identity=identity,
                    organization=organization,
                    status=SubscriptionStatus.active,
                    started_at=event.timestamp,
                )
                row.billing_identity_id = identity.id
                projected[sid] = row
            project(row, event.name, event.timestamp, event.metadata)
            row.product = await product_service.get(
                session, organization_id, row.product_id
            )

        existing = {row.id: row for row in await self.list(session, organization_id)}
        fields = (
            "product_id",
            "billing_identity_id",
            "status",
            "started_at",
            "canceled_at",
            "ends_at",
        )
        created = updated = unchanged = 0
        for sid, wanted in projected.items():
            current = existing.get(sid)
            if current is None:
                created += 1
                if apply:
                    session.add(wanted)
                continue
            if all(getattr(current, f) == getattr(wanted, f) for f in fields):
                unchanged += 1
                continue
            updated += 1
            if apply:
                for f in fields:
                    setattr(current, f, getattr(wanted, f))
                current.product = wanted.product
                current.billing_identity = wanted.billing_identity
        if apply:
            await session.flush()
        return SubscriptionRebuild(
            subscriptions=len(projected),
            created=created,
            updated=updated,
            unchanged=unchanged,
            orphaned=sorted(set(existing) - set(projected), key=str),
            applied=apply,
        )

    async def cycles(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        organization_id: uuid.UUID,
        id: uuid.UUID,
    ) -> Sequence[SubscriptionCycle]:
        """Closed periods priced at read time: the fixed amount plus each
        meter's usage times the unit amount stamped on its cycle event."""
        subscription = await self.get(session, organization_id, id)
        product = subscription.product
        if not product.is_recurring:
            return []
        identity = subscription.billing_identity
        now = utc_now()
        by_period: dict[tuple[datetime, datetime], list[SubscriptionCycleMeter]] = (
            defaultdict(list)
        )
        for meter in product.meters:
            events = await meter_service._events(
                tinybird, meter, [identity.external_id], EPOCH, now
            )
            for event in events:
                if event.name != "meter.cycled":
                    continue
                if event.data.get("subscription_id") != str(subscription.id):
                    continue
                usage = float(event.data.get("overage", event.data.get("usage", 0)))
                unit_amount = Decimal(
                    str(event.data.get("unit_amount", meter.unit_amount))
                )
                period = (
                    datetime.fromisoformat(event.data["period_start"]),
                    datetime.fromisoformat(event.data["period_end"]),
                )
                by_period[period].append(
                    SubscriptionCycleMeter(
                        meter_id=meter.id,
                        slug=meter.slug,
                        usage=usage,
                        unit_amount=unit_amount,
                        amount=Decimal(str(usage)) * unit_amount,
                    )
                )
        cycles = []
        for (start, end), meters in sorted(by_period.items()):
            metered = sum((m.amount for m in meters), Decimal(0))
            cycles.append(
                SubscriptionCycle(
                    period_start=start,
                    period_end=end,
                    currency=product.currency,
                    fixed_amount=product.amount,
                    meters=sorted(meters, key=lambda m: m.slug),
                    total=product.amount + metered,
                )
            )
        return cycles

    async def held(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        external_identity_id: str,
        at: datetime | None = None,
    ) -> IdentityEntitlements:
        """Entitlements resolved down the tree: whatever this identity or any
        ancestor holds through a subscription active at `at`."""
        at = at or utc_now()
        identity = await identity_service.get(
            session, organization_id, external_identity_id
        )
        chain = await identity_service.chain(session, identity)
        subscriptions = await SubscriptionRepository.from_session(session).list(
            organization_id, identity_ids=[node.id for node in chain], active_at=at
        )
        grants = [
            EntitlementGrant(
                slug=entitlement.slug,
                name=entitlement.name,
                subscription_id=subscription.id,
                product_id=subscription.product.id,
                product_slug=subscription.product.slug,
                external_identity_id=subscription.billing_identity.external_id,
            )
            for subscription in subscriptions
            for entitlement in subscription.product.entitlements
        ]
        assignments = await entitlement_service.assignments(session, organization_id)
        grants = [
            grant
            for grant in grants
            if all(
                assignments.get(node.external_id, EntitlementAssignment()).allows(
                    "features", grant.slug
                )
                for node in chain
            )
        ]
        grants.sort(
            key=lambda g: (g.slug, g.external_identity_id, str(g.subscription_id))
        )
        return IdentityEntitlements(
            external_identity_id=identity.external_id,
            at=at,
            entitlements=grants,
            slugs=sorted({grant.slug for grant in grants}),
            assignments={
                node.external_id: EntitlementAssignmentRead.model_validate(
                    assignments.get(
                        node.external_id, EntitlementAssignment()
                    ).model_dump()
                )
                for node in chain
            },
        )


subscription = SubscriptionService()
