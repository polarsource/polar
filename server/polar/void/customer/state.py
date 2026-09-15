"""Compact balances, with a replay tail only when the caller has pending events."""

import json
import uuid
from collections import defaultdict
from datetime import datetime

from polar.auth.models import AuthSubject
from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import Organization, VoidMeter
from polar.models import VoidReducerBucket as ReducerBucket
from polar.postgres import AsyncSession
from polar.void.entitlement.schemas import (
    EntitlementAssignment,
    EntitlementAssignmentRead,
)
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.identity.service import identity as identity_service
from polar.void.meter.balance import MeterEvent, State, _next_boundary
from polar.void.meter.schemas import Meter as MeterSchema
from polar.void.meter.service import EPOCH, _parse_time
from polar.void.meter.service import meter as meter_service
from polar.void.reducer.buckets import bucket_start
from polar.void.reducer.schemas import Reducer as ReducerSchema
from polar.void.tinybird import TinybirdApi

from .repository import CustomerRepository, CustomerStateRepository
from .schemas import (
    CustomerMeterState,
    CustomerState,
    LastProcessedEvent,
    LedgerState,
    MeterHolderState,
    ReducerState,
    StateIdentity,
)
from .service import customer as customer_service


def compact(state: State) -> LedgerState:
    # The active subscription and balance are sufficient to resume the fold.
    return LedgerState.model_validate(
        state.model_copy(update={"cycles": {}, "boundaries": []})
    )


async def customer_state(
    session: AsyncSession,
    tinybird: TinybirdApi,
    auth_subject: AuthSubject[Organization],
    external_id: str,
    since: datetime | None = None,
    variant_id: str | None = None,
) -> CustomerState:
    organization_id = auth_subject.subject.id
    customer = await customer_service.get(session, auth_subject, external_id)
    native = await CustomerRepository.from_session(session).get_active_by_external_id(
        organization_id, external_id
    )
    if native is None:
        raise ResourceNotFound("No bound customer with this external ID.")
    assert native.root_identity is not None
    identities = await identity_service.subtree(session, native.root_identity)
    repository = CustomerStateRepository.from_session(session)
    identity_ids = {node.external_id for node in identities}
    assignments = await entitlement_service.assignments(session, organization_id)
    at = utc_now()
    next_changes: list[datetime] = []
    next_changes.extend(
        await repository.upcoming_subscription_changes(
            organization_id, [node.id for node in identities], at
        )
    )
    cutoff = max(EPOCH, min(since, at)) if since is not None else at
    # Retired generations have no place in the current customer state.
    latest: dict[str, VoidMeter] = {}
    for meter in await meter_service.list(session, organization_id):
        if meter.branch_id is not None or meter.variant_id != variant_id:
            continue
        previous = latest.get(meter.slug)
        if previous is None or meter.generation_id > previous.generation_id:
            latest[meter.slug] = meter
    meters = list(latest.values())
    reducer_ids = {r for m in meters for r in (m.usage_reducer_id, m.credit_reducer_id)}
    reducers = await repository.reducers(organization_id, sorted(reducer_ids))
    last_processed: dict[uuid.UUID, LastProcessedEvent] = {}
    for (
        reducer_id,
        event_id,
        timestamp,
        ingested_at,
    ) in await repository.last_processed_events(
        organization_id, sorted(reducer_ids), sorted(identity_ids)
    ):
        event = LastProcessedEvent.model_validate(
            {
                "external_id": event_id,
                "timestamp": timestamp,
                "ingested_at": ingested_at,
            }
        )
        previous_receipt = last_processed.get(reducer_id)
        if previous_receipt is None or (
            event.ingested_at,
            event.timestamp,
            event.external_id,
        ) > (
            previous_receipt.ingested_at,
            previous_receipt.timestamp,
            previous_receipt.external_id,
        ):
            last_processed[reducer_id] = event
    buckets = (
        await repository.buckets_since(
            organization_id, sorted(reducer_ids), sorted(identity_ids), cutoff, at
        )
        if cutoff < at
        else []
    )
    states = []
    for meter in meters:
        rows = await meter_service._query(
            tinybird,
            "void_meter_subscriptions",
            meter,
            sorted(identity_ids),
            EPOCH,
            at,
        )
        changes: dict[str, list[MeterEvent]] = defaultdict(list)
        for row in rows:
            changes[row["external_identity_id"]].append(
                MeterEvent(
                    id=row["external_id"],
                    at=_parse_time(row["timestamp"]),
                    name=row["name"],
                    data=json.loads(row["metadata"]),
                )
            )
        holders = []
        root_state = None
        for node in identities:
            events = changes[node.external_id]
            current, _, has_credits = await meter_service._fold(
                session,
                tinybird,
                meter,
                node,
                at,
                events=events,
            )
            if node.external_id == native.root_identity.external_id:
                root_state = current
            entitlement = None
            entitlement_usage_base = 0.0
            assignment = assignments.get(node.external_id, EntitlementAssignment())
            entry = next(
                (e for e in assignment.meters or [] if e.meter == meter.slug), None
            )
            if entry is not None and entry.cap is not None:
                assert root_state is not None
                entitlement = await meter_service.entitlement_state(
                    session, meter, node, root_state, entry.cap, at
                )
                if entitlement.period_start is not None and cutoff > bucket_start(
                    entitlement.period_start
                ):
                    baseline = await meter_service._reducer_values(
                        session,
                        meter,
                        meter.usage_reducer_id,
                        await meter_service._scope(session, node),
                        [entitlement.period_start],
                        bucket_start(entitlement.period_start),
                        cutoff,
                    )
                    entitlement_usage_base = sum(value for _, value in baseline)
            base = current
            credit_base = usage_base = None
            if cutoff < at:
                through, _, _ = await meter_service._fold(
                    session,
                    tinybird,
                    meter,
                    node,
                    cutoff,
                    events=[event for event in events if event.at <= cutoff],
                )
                segment_start = max(
                    [
                        EPOCH,
                        *(event.at for event in events if event.at <= cutoff),
                        *(
                            boundary
                            for boundary in through.boundaries
                            if boundary <= cutoff
                        ),
                    ]
                )
                base, _, _ = await meter_service._fold(
                    session,
                    tinybird,
                    meter,
                    node,
                    segment_start,
                    events=[event for event in events if event.at <= segment_start],
                )
                credit_values = await meter_service._reducer_values(
                    session,
                    meter,
                    meter.credit_reducer_id,
                    ReducerBucket.external_identity_id == node.external_id,
                    [segment_start],
                    segment_start,
                    cutoff,
                )
                usage_values = await meter_service._reducer_values(
                    session,
                    meter,
                    meter.usage_reducer_id,
                    await meter_service._scope(session, node),
                    [segment_start],
                    segment_start,
                    cutoff,
                )
                credit_base = credit_values[0][1] if credit_values else None
                usage_base = usage_values[0][1] if usage_values else None
            boundary = _next_boundary(current)
            if boundary is not None and boundary > at:
                next_changes.append(boundary)
            holders.append(
                MeterHolderState(
                    external_identity_id=node.external_id,
                    balance=compact(current),
                    entitlement=entitlement,
                    entitlement_usage_base=entitlement_usage_base,
                    base=compact(base),
                    credit_base=credit_base,
                    usage_base=usage_base,
                    is_holder=current.subscription is not None
                    or bool(events)
                    or has_credits,
                    events=[event for event in events if event.at > cutoff],
                )
            )
        states.append(
            CustomerMeterState(
                meter=MeterSchema.model_validate(meter, from_attributes=True),
                holders=holders,
                usage_last_processed_event=last_processed.get(meter.usage_reducer_id),
                credit_last_processed_event=last_processed.get(meter.credit_reducer_id),
            )
        )
    return CustomerState(
        organization_id=organization_id,
        customer=customer,
        at=at,
        next_change_at=min(next_changes) if next_changes else None,
        since=cutoff,
        identities=[
            StateIdentity(
                external_id=n.external_id,
                parent_external_id=n.parent_external_id,
                entitlements=EntitlementAssignmentRead.model_validate(
                    assignments.get(n.external_id, EntitlementAssignment()).model_dump()
                ),
            )
            for n in identities
        ],
        meters=states,
        reducers=[
            ReducerSchema.model_validate(r, from_attributes=True) for r in reducers
        ],
        buckets=[ReducerState.model_validate(b, from_attributes=True) for b in buckets],
    )
