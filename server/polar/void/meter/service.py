import asyncio
import json
from bisect import bisect_right
from collections import defaultdict
from collections.abc import Awaitable, Callable, Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import ColumnElement

from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import VoidBillingIdentity, VoidMeter, VoidReducer, VoidReducerBucket
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.entitlement.schemas import EntitlementAssignment, MeterEntitlementState
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from polar.void.identity.service import identity as identity_service
from polar.void.metric.service import MERGE
from polar.void.organization.service import organization as organization_service
from polar.void.reducer.buckets import bucket_start
from polar.void.reducer.exceptions import InvalidReducer
from polar.void.reducer.service import query_buckets
from polar.void.reducer.service import reducer as reducer_service
from polar.void.tinybird import TinybirdApi

from .balance import MeterCycle, MeterEvent, State, _next_boundary, fold
from .repository import MeterRepository
from .schemas import Balance, Check, MeterCreate

EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


def _tinybird_time(timestamp: datetime) -> str:
    return timestamp.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S")


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=UTC)


def build_meter_cycle_event(
    meter: VoidMeter,
    external_identity_id: str,
    cycle: MeterCycle,
) -> EventCreate:
    return EventCreate(
        name="meter.cycled",
        external_id=(
            f"{cycle.subscription_id}:{meter.id}:{cycle.period_end.isoformat()}"
        ),
        external_identity_id=external_identity_id,
        timestamp=cycle.period_end,
        metadata={
            "meter_id": str(meter.id),
            "meter_version_id": meter.version_id,
            # Pinned so a later reprice cannot rewrite what this period cost.
            "unit_amount": str(meter.unit_amount),
            "currency": meter.currency,
            **cycle.model_dump(mode="json"),
        },
    )


def validate_reducers(usage: VoidReducer, credit: VoidReducer) -> None:
    if usage.aggregation.func == "derive":
        raise InvalidReducer("Derived reducers are available for metrics only")
    if usage.aggregation.type != "scalar" or credit.aggregation.type != "scalar":
        raise InvalidReducer("Meter reducers must be scalar")
    if credit.aggregation.func != "sum":
        raise InvalidReducer("Credit reducers must be additive")


class MeterService:
    async def list(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> Sequence[VoidMeter]:
        return await MeterRepository.from_session(session).list(organization_id)

    async def get(
        self, session: AsyncReadSession, organization_id: UUID, id: UUID
    ) -> VoidMeter:
        meter = await MeterRepository.from_session(session).get(organization_id, id)
        if meter is None:
            raise ResourceNotFound()
        return meter

    async def create(
        self, session: AsyncSession, organization_id: UUID, create_schema: MeterCreate
    ) -> VoidMeter:
        organization = await organization_service.lock(session, organization_id)
        usage = await reducer_service.get(
            session, organization_id, create_schema.usage_reducer_id
        )
        credit = await reducer_service.get(
            session, organization_id, create_schema.credit_reducer_id
        )
        validate_reducers(usage, credit)
        meter = VoidMeter(
            **create_schema.model_dump(
                exclude={"usage_reducer_id", "credit_reducer_id"}
            ),
            usage_reducer=usage,
            credit_reducer=credit,
            organization=organization,
        )
        await MeterRepository.from_session(session).create(meter, flush=True)
        return meter

    async def balance(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        organization_id: UUID,
        id: UUID,
        external_identity_id: str,
        at: datetime | None = None,
    ) -> Balance:
        """Where one identity stands: its own usage and credits, and what the
        chain lets it still spend."""
        meter = await self.get(session, organization_id, id)
        identity = await identity_service.get(
            session, organization_id, external_identity_id
        )
        now = at or utc_now()
        position, states = await self._check(
            session, tinybird, organization_id, meter, identity, 0, now
        )
        own = states[identity.external_id]
        return Balance(
            **own.model_dump(exclude={"remaining", "overage"}),
            meter_id=meter.id,
            external_identity_id=identity.external_id,
            remaining=position.remaining,
            overage=position.overage,
            limited_by=position.external_identity_id,
            limit=position.limit,
            reason=position.reason,
            period_start=position.period_start,
            period_end=position.period_end,
        )

    async def check(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        organization_id: UUID,
        id: UUID,
        external_identity_id: str,
        size: float,
    ) -> Check:
        """Every holder up the chain must allow it. Each balance is derived
        over its own subtree, so the same usage counts at every level."""
        meter = await self.get(session, organization_id, id)
        identity = await identity_service.get(
            session, organization_id, external_identity_id
        )
        result, _ = await self._check(
            session, tinybird, organization_id, meter, identity, size, utc_now()
        )
        return result

    async def _check(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        organization_id: UUID,
        meter: VoidMeter,
        identity: VoidBillingIdentity,
        size: float,
        now: datetime,
    ) -> tuple[Check, dict[str, State]]:
        """The check, plus every chain node's own state so a caller can read
        the identity's ledger without folding it twice. A size of zero asks
        where the identity stands rather than whether it may spend."""
        chain = await identity_service.chain(session, identity)
        states: dict[str, State] = {}
        holder_states = {}
        root_state = None
        for node in chain:
            state, events, has_credits = await self._fold(
                session, tinybird, meter, node, now
            )
            states[node.external_id] = state
            if node.external_id == chain[-1].external_id:
                root_state = state
            if state.subscription is None and not events and not has_credits:
                continue
            holder_states[node.external_id] = state
        assignments = await entitlement_service.assignments(session, organization_id)
        for node in reversed(chain):
            if not assignments.get(node.external_id, EntitlementAssignment()).allows(
                "meters", meter.slug
            ):
                return (
                    Check(
                        allowed=False,
                        remaining=0,
                        external_identity_id=node.external_id,
                        reason="access_denied",
                        limit=None,
                        overage=0,
                        period_start=None,
                        period_end=None,
                        entitlements=[],
                    ),
                    states,
                )
        if not holder_states:
            return (
                Check(
                    allowed=False,
                    remaining=0,
                    external_identity_id=None,
                    reason="no_holder",
                    limit=None,
                    overage=0,
                    period_start=None,
                    period_end=None,
                    entitlements=[],
                ),
                states,
            )
        assert root_state is not None
        entitlements = []
        for node in reversed(chain):
            assignment = assignments.get(node.external_id, EntitlementAssignment())
            entry = next(
                (e for e in assignment.meters or [] if e.meter == meter.slug), None
            )
            if entry is None or entry.cap is None:
                continue
            entitlement = await self.entitlement_state(
                session, meter, node, root_state, entry.cap, now
            )
            entitlements.append(entitlement)
            if entitlement.period_start is None:
                return (
                    Check(
                        allowed=False,
                        remaining=0,
                        external_identity_id=node.external_id,
                        reason="missing_period",
                        limit=None,
                        overage=0,
                        period_start=None,
                        period_end=None,
                        entitlements=entitlements,
                    ),
                    states,
                )
        constraints = []
        for external_id, state in holder_states.items():
            limit = (
                state.subscription.limit
                if state.subscription and not state.subscription.ended
                else "hard"
            )
            constraints.append(
                (
                    state.remaining,
                    external_id,
                    limit,
                    state.overage,
                    state.boundary,
                    _next_boundary(state),
                )
            )
        constraints += [
            (
                e.remaining,
                e.external_identity_id,
                "hard",
                0,
                e.period_start,
                e.period_end,
            )
            for e in entitlements
        ]
        constraints.sort(key=lambda item: (item[0], item[1]))
        denying = [c for c in constraints if c[2] == "hard" and c[0] < size]
        capped = [c for c in constraints if c[2] != "unlimited"]
        selected = (denying or capped or constraints)[0]
        least, holder, limit, overage, start, end = selected
        return (
            Check(
                allowed=not denying,
                remaining=least if capped else None,
                external_identity_id=holder,
                reason="exhausted" if denying else "ok",
                limit=limit,
                overage=overage,
                period_start=start,
                period_end=end,
                entitlements=entitlements,
            ),
            states,
        )

    async def entitlement_state(
        self,
        session: AsyncSession,
        meter: VoidMeter,
        identity: VoidBillingIdentity,
        root_state: State,
        cap: float,
        at: datetime,
    ) -> MeterEntitlementState:
        """A constraint on reduced usage in the existing root meter period."""
        reducer = await reducer_service.get(
            session, meter.organization_id, meter.usage_reducer_id
        )
        if reducer.aggregation.func not in ("sum", "count"):
            raise InvalidReducer("Usage caps require a sum or count meter")
        end = _next_boundary(root_state)
        start = root_state.boundary if end is not None else None
        values = (
            await self._reducer_values(
                session,
                meter,
                meter.usage_reducer_id,
                await self._scope(session, identity),
                [start],
                # Reducer values describe five-minute buckets, not individual
                # event times. Include the bucket overlapping the period start.
                bucket_start(start),
                at,
            )
            if start is not None
            else []
        )
        usage = sum(value for _, value in values)
        return MeterEntitlementState(
            external_identity_id=identity.external_id,
            cap=cap,
            usage=usage,
            remaining=max(cap - usage, 0) if start is not None else 0,
            period_start=start,
            period_end=end,
        )

    async def cycle(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        organization_id: UUID,
    ) -> int:
        if await MeterRepository.from_session(session).has_pending_events(
            organization_id
        ):
            return 0
        result = await asyncio.to_thread(
            tinybird.query,
            "void_meter_active_subscriptions",
            {"organization_id": str(organization_id)},
        )
        events = []
        for row in result["data"]:
            try:
                meter = await self.get(session, organization_id, UUID(row["meter_id"]))
                identity = await identity_service.get(
                    session, organization_id, row["external_identity_id"]
                )
            except ValueError, ResourceNotFound:
                continue
            now = utc_now()
            changes = await self._events(
                tinybird, meter, [identity.external_id], EPOCH, now
            )
            existing = {
                (event.data.get("subscription_id"), event.at)
                for event in changes
                if event.name == "meter.cycled"
            }
            due = fold(State(), list(changes), [], [], now).cycles.values()
            if not any(
                (cycle.subscription_id, cycle.period_end) not in existing
                for cycle in due
            ):
                continue
            state, _, _ = await self._fold(
                session,
                tinybird,
                meter,
                identity,
                now,
                events=changes,
                values=await self._settlement_values(
                    session, tinybird, meter, identity
                ),
            )
            events += [
                build_meter_cycle_event(
                    meter,
                    identity.external_id,
                    cycle,
                )
                for cycle in state.cycles.values()
                if (cycle.subscription_id, cycle.period_end) not in existing
            ]
        if events:
            saved, _ = await event_service.ingest(
                session, organization_id, events, EventSource.system
            )
            return saved
        return 0

    async def _settlement_values(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        meter: VoidMeter,
        identity: VoidBillingIdentity,
    ) -> Callable[
        [UUID, Sequence[datetime], datetime, datetime],
        Awaitable[Sequence[tuple[datetime, float]]],
    ]:
        actor_ids = (
            {
                node.external_id
                for node in await identity_service.subtree(session, identity)
            }
            if not identity.is_root
            else set()
        )

        async def values(
            reducer_id: UUID,
            edges: Sequence[datetime],
            start: datetime,
            end: datetime,
        ) -> Sequence[tuple[datetime, float]]:
            reducer = await reducer_service.get(
                session, meter.organization_id, reducer_id
            )
            rows = await query_buckets(tinybird, reducer, start, end)
            segments: dict[datetime, list[float]] = defaultdict(list)
            for row in rows:
                actor = row["external_identity_id"]
                if reducer_id == meter.credit_reducer_id:
                    applies = actor == identity.external_id
                elif identity.is_root:
                    applies = row["external_root_id"] == identity.external_id
                else:
                    applies = actor in actor_ids
                if not applies:
                    continue
                timestamp = _parse_time(row["bucket_start"])
                index = bisect_right(edges, timestamp)
                segment = edges[index - 1] if index else start
                segments[segment].append(row["value"] or 0)
            return sorted(
                (segment, MERGE[reducer.aggregation.func](items))
                for segment, items in segments.items()
            )

        return values

    async def _fold(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        meter: VoidMeter,
        identity: VoidBillingIdentity,
        at: datetime,
        *,
        events: Sequence[MeterEvent] | None = None,
        values: Callable[
            [UUID, Sequence[datetime], datetime, datetime],
            Awaitable[Sequence[tuple[datetime, float]]],
        ]
        | None = None,
    ) -> tuple[State, Sequence[MeterEvent], bool]:
        if events is None:
            events = await self._events(
                tinybird, meter, [identity.external_id], EPOCH, at
            )
        checkpoint = EPOCH
        dry = fold(State(), list(events), [], [], at)
        for event in events:
            if event.name != "meter.cycled" or event.at > at:
                continue
            try:
                stored = MeterCycle.model_validate(event.data)
            except ValueError:
                continue
            if dry.cycles.get(event.at) == stored:
                checkpoint = max(checkpoint, event.at)

        past = [event for event in events if event.at <= checkpoint]
        future = [event for event in events if event.at > checkpoint]
        state = fold(State(), past, [], [], checkpoint)
        dry = fold(state, future, [], [], at)
        edges = {
            *(event.at for event in future),
            *(boundary for boundary in dry.boundaries if boundary >= checkpoint),
        }
        if checkpoint > EPOCH:
            edges.add(checkpoint)
        sorted_edges = sorted(edges)
        if not sorted_edges:
            # Prepaid meters have no subscription boundaries. Read their entire
            # credit/usage history as one segment, without creating a subscription.
            sorted_edges = [checkpoint]
        if values is not None:
            credits = await values(
                meter.credit_reducer_id, sorted_edges, checkpoint, at
            )
            usage = await values(meter.usage_reducer_id, sorted_edges, checkpoint, at)
        else:
            credits = await self._reducer_values(
                session,
                meter,
                meter.credit_reducer_id,
                VoidReducerBucket.external_identity_id == identity.external_id,
                sorted_edges,
                checkpoint,
                at,
            )
            usage = await self._reducer_values(
                session,
                meter,
                meter.usage_reducer_id,
                await self._scope(session, identity),
                sorted_edges,
                checkpoint,
                at,
            )
        # A zero or exhausted credit bucket still establishes a holder's limit.
        return fold(state, future, credits, usage, at), events, bool(credits)

    async def _query(
        self,
        tinybird: TinybirdApi,
        pipe: str,
        meter: VoidMeter,
        external_identity_ids: Sequence[str],
        start: datetime,
        end: datetime,
    ) -> Sequence[dict[str, str]]:
        if pipe == "meter_subscriptions":
            pipe = "void_meter_subscriptions"
        result = await asyncio.to_thread(
            tinybird.query,
            pipe,
            {
                "organization_id": str(meter.organization_id),
                "meter_id": str(meter.id),
                "external_identity_ids": json.dumps(list(external_identity_ids)),
                "start": _tinybird_time(start),
                "end": _tinybird_time(end),
            },
        )
        return result["data"]

    async def _events(
        self,
        tinybird: TinybirdApi,
        meter: VoidMeter,
        external_identity_ids: Sequence[str],
        start: datetime,
        end: datetime,
    ) -> Sequence[MeterEvent]:
        rows = await self._query(
            tinybird,
            "void_meter_subscriptions",
            meter,
            external_identity_ids,
            start,
            end,
        )
        return [
            MeterEvent(
                id=row["external_id"],
                at=_parse_time(row["timestamp"]),
                name=row["name"],
                data=json.loads(row["metadata"]),
            )
            for row in rows
        ]

    async def _reducer_values(
        self,
        session: AsyncSession,
        meter: VoidMeter,
        reducer_id: UUID,
        condition: ColumnElement[bool],
        edges: Sequence[datetime],
        start: datetime,
        end: datetime,
    ) -> Sequence[tuple[datetime, float]]:
        reducer = await reducer_service.get(session, meter.organization_id, reducer_id)
        return await MeterRepository.from_session(session).reducer_values(
            reducer, condition, edges, start, end
        )

    async def _scope(
        self, session: AsyncSession, identity: VoidBillingIdentity
    ) -> ColumnElement[bool]:
        if identity.is_root:
            return VoidReducerBucket.external_root_id == identity.external_id
        subtree = await identity_service.subtree(session, identity)
        return VoidReducerBucket.external_identity_id.in_(
            [node.external_id for node in subtree]
        )


meter = MeterService()
