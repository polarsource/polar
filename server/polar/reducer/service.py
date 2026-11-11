import math
from collections import defaultdict
from collections.abc import Awaitable, Callable, Iterable, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, assert_never
from uuid import UUID

import logfire
import structlog
from redis.exceptions import RedisError

from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncReadSession
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import (
    Customer,
    CustomerMeter,
    Event,
    Meter,
    MeterReducer,
    Reducer,
    ReducerBucket,
)
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.outpost.stream import enqueue as enqueue_outpost_event
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.worker import enqueue_job

from . import cache, redis_store
from .bucket_repository import (
    ReducerBucketRepository,
    Totals,
    get_customer_identities,
)
from .repository import ReducerRepository
from .types import (
    MeterUsage,
    UsageSummary,
    UsageWindow,
    WindowUsage,
)

log: Logger = structlog.get_logger()

REDUCER_BUCKET_SIZE = timedelta(minutes=5)
# Buckets are in Postgres after 10 minutes, and billing waits 15: sealing
# normally runs in between.
SEAL_DELAY = timedelta(minutes=11)
# Until a seal splits the slot of a reset, its usage after the reset is read from
# its events, for no longer than this.
POST_RESET_EVENTS_READ_LIMIT = timedelta(minutes=15)

type Contributions = dict[redis_store.BucketId, list[tuple[datetime, Decimal]]]
# What an event adds to a count reducer.
ONE = Decimal(1)
CREDIT_AGGREGATION = PropertyAggregation(func=AggregationFunction.sum, property="units")


def _get_credit_filter(meter: Meter) -> Filter:
    """Matches the meter's `meter.credited` events."""
    return Filter(
        conjunction=FilterConjunction.and_,
        clauses=[
            FilterClause(
                property="source", operator=FilterOperator.eq, value=EventSource.system
            ),
            FilterClause(
                property="name",
                operator=FilterOperator.eq,
                value=SystemEvent.meter_credited,
            ),
            FilterClause(
                property="meter_id", operator=FilterOperator.eq, value=str(meter.id)
            ),
        ],
    )


def _is_sealed_on_reset(kind: ReducerKind) -> bool:
    match kind:
        case ReducerKind.usage | ReducerKind.credit:
            return True
        case _:
            assert_never(kind)


def get_reducer_bucket_start(timestamp: datetime) -> datetime:
    size = int(REDUCER_BUCKET_SIZE.total_seconds())
    epoch = int(timestamp.timestamp())
    return datetime.fromtimestamp(epoch - epoch % size, tz=UTC)


class ReducerService:
    def enqueue_seal(self, customer_id: UUID, meter_id: UUID, *, at: datetime) -> None:
        """Seals the customer's usage before `at` once it has all reached Postgres,
        before billing gets to it."""
        delay = at + SEAL_DELAY - utc_now()
        enqueue_job(
            "reducer.seal",
            customer_id,
            meter_id,
            at.isoformat(),
            delay=max(int(delay.total_seconds() * 1000), 0),
        )

    async def seal(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_id: UUID,
        *,
        at: datetime,
        boundaries: Sequence[datetime],
    ) -> None:
        """Makes `at` and `boundaries` bucket boundaries and seals the customer's
        buckets of every reducer of the meter before `at`."""
        await self._seal(
            session,
            customer,
            meter_id,
            [kind for kind in ReducerKind if _is_sealed_on_reset(kind)],
            at=at,
            boundaries=boundaries,
        )

    async def seal_credits(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_id: UUID,
        *,
        at: datetime,
    ) -> None:
        """Seals the customer's credits before `at` right away: unlike usage, they
        are all in Postgres already."""
        await self._seal(session, customer, meter_id, (ReducerKind.credit,), at=at)

    async def sync_credits(
        self, session: AsyncSession, customer: Customer, meter_id: UUID
    ) -> None:
        """Rebuilds the customer's credit buckets from its credit events: seals
        the credits before the latest reset and recomputes the slots after it."""
        reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter_id, ReducerKind.credit
        )
        if reducer is None:
            return
        event_repository = EventRepository.from_session(session)
        reset = await event_repository.get_latest_meter_reset(customer, meter_id)
        if reset is not None:
            await self.seal_credits(session, customer, meter_id, at=reset.timestamp)
        timestamps = await event_repository.get_meter_credit_timestamps(
            customer, meter_id, since=reset.timestamp if reset is not None else None
        )
        bucket_ids = {
            (reducer, get_reducer_bucket_start(timestamp), customer.id, None)
            for timestamp in timestamps
        }
        repository = ReducerBucketRepository.from_session(session)
        await self._lock_buckets(repository, bucket_ids)
        for _, bucket_start, customer_id, external_customer_id in bucket_ids:
            await self._sync_bucket_intervals(
                repository, reducer, bucket_start, customer_id, external_customer_id
            )

    async def _seal(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_id: UUID,
        kinds: Iterable[ReducerKind],
        *,
        at: datetime,
        boundaries: Sequence[datetime] = (),
    ) -> None:
        try:
            async with session.begin_nested():
                reducers = [
                    reducer
                    for kind in kinds
                    for reducer in (
                        await self._get_reducers(session, [meter_id], kind)
                    ).values()
                ]
                await self._seal_buckets(
                    session, reducers, customer, until=at, boundaries=boundaries
                )
        except Exception:
            log.exception(
                "Failed to seal reducer buckets",
                customer_id=customer.id,
                meter_id=meter_id,
                at=at.isoformat(),
            )

    async def add_credit(self, session: AsyncSession, event: Event) -> None:
        """Adds a `meter.credited` event to its meter's credit reducer."""
        meter_id = UUID(event.user_metadata["meter_id"])
        try:
            async with session.begin_nested():
                reducer = await ReducerRepository.from_session(
                    session
                ).get_by_meter_and_kind(meter_id, ReducerKind.credit)
                if reducer is None:
                    return
                await self._add_to_closed_buckets(
                    session, _reduce_events_to_bucket_contributions([reducer], [event])
                )
        except Exception:
            log.exception(
                "Failed to add credit to reducer buckets",
                event_id=event.id,
                meter_id=meter_id,
            )

    async def bill(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_ids: Iterable[UUID],
        *,
        order_id: UUID,
        windows: Sequence[UsageWindow],
        cutoff: datetime,
    ) -> dict[UUID, tuple[Decimal, Decimal]]:
        """Marks the customer's usage in `windows` and its credits since the latest
        reset as billed by the order, and returns their quantities per meter.
        Raises on failure: the caller rolls it back."""
        usage, _ = await self._settle(
            session,
            customer,
            meter_ids,
            order_id=order_id,
            windows=windows,
            cutoff=cutoff,
        )
        return {
            meter_id: (
                finalize_quantity(
                    merge_summaries([window.summary for window in meter.windows]),
                    meter.function,
                ),
                meter.credits,
            )
            for meter_id, meter in usage.items()
        }

    async def seal_usage(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_ids: Iterable[UUID],
        *,
        windows: Sequence[UsageWindow],
        cutoff: datetime,
    ) -> tuple[dict[UUID, MeterUsage], list[UUID]]:
        """Seals what `bill` would bill and returns it with the ids of its buckets,
        without marking them as billed: for an order that doesn't exist yet.
        `mark_as_billed` then bills exactly those buckets, so usage arriving in
        between is left to the next order."""
        return await self._settle(
            session,
            customer,
            meter_ids,
            order_id=None,
            windows=windows,
            cutoff=cutoff,
        )

    async def mark_as_billed(
        self, session: AsyncSession, bucket_ids: Sequence[UUID], *, order_id: UUID
    ) -> int:
        """Marks the buckets `seal_usage` returned as billed by the order, and
        returns how many weren't billed yet."""
        return await ReducerBucketRepository.from_session(session).mark_ids_as_billed(
            bucket_ids, order_id, billed_at=utc_now()
        )

    async def _settle(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_ids: Iterable[UUID],
        *,
        order_id: UUID | None,
        windows: Sequence[UsageWindow],
        cutoff: datetime,
    ) -> tuple[dict[UUID, MeterUsage], list[UUID]]:
        """Seals the customer's usage in `windows` and its credits since the latest
        reset, and marks them as billed by the order if there is one. Returns the
        usage per meter and the ids of its buckets."""
        meter_ids = sorted(meter_ids)
        reducers = await self._get_reducers(session, meter_ids, ReducerKind.usage)
        observed = await self._bill_windows(
            session,
            customer,
            reducers,
            [window for window in windows if window.meter_id in reducers],
            order_id=order_id,
        )
        if observed is None:
            log.warning(
                "Incomplete reducer usage",
                customer_id=customer.id,
                order_id=order_id,
                reason="boundary_unavailable",
            )
            return {}, []
        observed_usage, bucket_ids = observed
        credit_reducers = await self._get_reducers(
            session, meter_ids, ReducerKind.credit
        )
        event_repository = EventRepository.from_session(session)
        credits: dict[UUID, Decimal] = {}
        for meter_id, credit_reducer in credit_reducers.items():
            reset = await event_repository.get_latest_meter_reset(
                customer, meter_id, cutoff=cutoff
            )
            since = None if reset is None else reset.timestamp
            await self._seal_buckets(
                session, [credit_reducer], customer, since=since, until=cutoff
            )
            billed, credit_bucket_ids = await self._bill_buckets(
                session,
                [credit_reducer],
                customer,
                order_id=order_id,
                since=since,
                until=cutoff,
            )
            credits[meter_id] = billed[credit_reducer.id]
            bucket_ids.extend(credit_bucket_ids)
        usage = {
            meter_id: MeterUsage(
                function=reducer.aggregation.func,
                windows=tuple(
                    usage
                    for usage in observed_usage
                    if usage.window.meter_id == meter_id
                ),
                credits=max(credits.get(meter_id, Decimal(0)), Decimal(0)),
            )
            for meter_id, reducer in reducers.items()
        }
        return usage, bucket_ids

    async def get_pending_usage(
        self,
        session: AsyncReadSession,
        redis: Redis,
        customer: Customer,
        meter_ids: Iterable[UUID],
        *,
        windows: Sequence[UsageWindow],
    ) -> dict[UUID, MeterUsage]:
        """What `bill` would bill now, without sealing or marking
        anything: a preview, exact to the slot rather than the second.
        - A slot a window's start or end falls in counts in the window the slot
          starts in, until a seal or a bill splits it.
        - The last two slots are read from Redis, which still holds usage an
          order just billed.
        - Credits are those since the latest reset, so until the order following
          a reset bills the previous period's usage, it shows against the new
          period's credits.
        Billing splits and seals first, so an order charges the exact usage."""
        identities = get_customer_identities(customer)
        current_bucket_start = get_reducer_bucket_start(utc_now())
        previous_bucket_start = current_bucket_start - REDUCER_BUCKET_SIZE
        repository = ReducerBucketRepository.from_session(session)
        meter_ids = sorted(meter_ids)
        reducers = await self._get_reducers(session, meter_ids, ReducerKind.usage)
        credit_reducers = await self._get_reducers(
            session, meter_ids, ReducerKind.credit
        )
        usage: dict[UUID, MeterUsage] = {}
        for meter_id, reducer in reducers.items():
            function = reducer.aggregation.func
            window_usage: list[WindowUsage] = []
            for window in windows:
                if window.meter_id != meter_id:
                    continue
                cold = await repository.get_pending_totals(
                    reducer,
                    identities,
                    start=window.start,
                    end=min(window.end, previous_bucket_start),
                )
                hot_bucket_starts = [
                    bucket_start
                    for bucket_start in (previous_bucket_start, current_bucket_start)
                    if window.start <= bucket_start < window.end
                ]
                hot = (
                    await redis_store.get_bucket_totals(
                        redis, reducer.id, function, hot_bucket_starts, identities
                    )
                    if hot_bucket_starts
                    else []
                )
                summary = merge_summaries(
                    [UsageSummary(*totals) for totals in (cold, *hot)]
                )
                window_usage.append(WindowUsage(window, summary))
            credit_reducer = credit_reducers.get(meter_id)
            credits = Decimal(0)
            if credit_reducer is not None:
                totals = await self.get_credits(session, credit_reducer, [customer.id])
                credits = max(Decimal(totals[customer.id][1]), Decimal(0))
            usage[meter_id] = MeterUsage(function, tuple(window_usage), credits)
        return usage

    async def _bill_windows(
        self,
        session: AsyncSession,
        customer: Customer,
        reducers: Mapping[UUID, Reducer],
        windows: Sequence[UsageWindow],
        *,
        order_id: UUID | None,
    ) -> tuple[list[WindowUsage], list[UUID]] | None:
        """Marks the customer's usage in each window as billed by the order, if
        any, and returns it with the ids of its buckets, or None if a window's
        start or end is inside a sealed bucket.
        The windows' starts and ends become bucket boundaries first.
        `reducers` are the usage reducers by meter id, one for each window's meter."""
        repository = ReducerBucketRepository.from_session(session)
        identities = get_customer_identities(customer)
        boundaries_by_meter: dict[UUID, set[datetime]] = defaultdict(set)
        for window in windows:
            boundaries_by_meter[window.meter_id].update((window.start, window.end))
        await self._lock_buckets(
            repository,
            [
                (reducers[meter_id], get_reducer_bucket_start(at), *identity)
                for meter_id, boundaries in boundaries_by_meter.items()
                for at in boundaries
                for identity in identities
            ],
        )
        for meter_id, boundaries in sorted(boundaries_by_meter.items()):
            for identity in identities:
                if not await self._split_at(
                    repository,
                    reducers[meter_id],
                    customer,
                    identity,
                    sorted(boundaries),
                ):
                    return None

        usage: list[WindowUsage] = []
        bucket_ids: list[UUID] = []
        for window in windows:
            reducer = reducers[window.meter_id]
            with logfire.span(
                "Bill reducer buckets",
                organization_id=str(customer.organization_id),
                reducer_id=str(reducer.id),
                customer_id=str(customer.id),
                order_id=str(order_id),
                meter_id=str(window.meter_id),
                subscription_id=str(window.source_subscription_id),
                interval_id=str(window.interval_id),
                since=window.start,
                until=window.end,
            ) as span:
                await self._seal_buckets(
                    session, [reducer], customer, since=window.start, until=window.end
                )
                billed = await self._get_unbilled(
                    repository,
                    reducer,
                    identities,
                    order_id,
                    since=window.start,
                    until=window.end,
                )
                summary = merge_summaries([UsageSummary(*row[1:]) for row in billed])
                span.set_attribute("billed_buckets", len(billed))
                span.set_attribute(
                    "quantity",
                    str(finalize_quantity(summary, reducer.aggregation.func)),
                )
            usage.append(WindowUsage(window, summary))
            bucket_ids.extend(row[0] for row in billed)
        return usage, bucket_ids

    async def sync_meter(self, session: AsyncSession, meter: Meter) -> Reducer:
        """Creates the meter's reducer of each kind and updates its usage reducer,
        which it returns."""
        repository = ReducerRepository.from_session(session)
        meter = await repository.get_meter_for_update(meter.id)
        usage: Reducer | None = None
        for kind in ReducerKind:
            reducer = await repository.get_by_meter_and_kind(meter.id, kind)
            match kind:
                case ReducerKind.usage:
                    if reducer is None:
                        usage = await self._create_reducer(
                            session, meter, kind, meter.filter, meter.aggregation
                        )
                    else:
                        usage = await repository.update(
                            reducer,
                            update_dict={
                                "filter": meter.filter,
                                "aggregation": meter.aggregation,
                            },
                        )
                case ReducerKind.credit:
                    if reducer is None:
                        await self._create_reducer(
                            session,
                            meter,
                            kind,
                            _get_credit_filter(meter),
                            CREDIT_AGGREGATION,
                        )
                case _:
                    assert_never(kind)
        assert usage is not None
        enqueue_outpost_event(meter.organization_id, {"type": "configuration"})
        return usage

    async def rollup(
        self,
        session: AsyncSession,
        redis: Redis,
        organization_id: UUID,
        events: Sequence[Event],
    ) -> int:
        """Returns the number of reducer buckets the events contributed to."""
        reducers = [
            reducer
            for reducer in await cache.get_active_reducers(
                session, redis, organization_id
            )
            if not isinstance(reducer.aggregation, UniqueAggregation)
        ]
        if not reducers:
            return 0

        now = utc_now()
        current_bucket_start = get_reducer_bucket_start(now)
        oldest_active_bucket_start = current_bucket_start - REDUCER_BUCKET_SIZE
        contributions = _reduce_events_to_bucket_contributions(reducers, events)
        contributions_to_active_buckets = {
            bucket_id: [value for _, value in values]
            for bucket_id, values in contributions.items()
            if bucket_id[1] >= oldest_active_bucket_start
        }
        if contributions_to_active_buckets:
            # Roll up active events into buckets in Redis
            try:
                await redis_store.add_to_buckets(redis, contributions_to_active_buckets)
            except RedisError:
                log.exception(
                    "Failed to update active reducer buckets in Redis",
                    organization_id=organization_id,
                    bucket_count=len(contributions_to_active_buckets),
                    event_count=len(events),
                )
            else:
                log.info(
                    "Active reducer buckets updated in Redis",
                    organization_id=organization_id,
                    bucket_count=len(contributions_to_active_buckets),
                    event_count=len(events),
                )

        contributions_to_closed_buckets = {
            bucket_id: values
            for bucket_id, values in contributions.items()
            if bucket_id[1] < current_bucket_start
        }
        if contributions_to_closed_buckets:
            await self._add_to_closed_buckets(session, contributions_to_closed_buckets)

        for reducer, bucket_start, customer_id, external_customer_id in contributions:
            if bucket_start < current_bucket_start:
                continue
            # Current buckets are only in Redis: persist them once they close.
            delay = bucket_start + REDUCER_BUCKET_SIZE - now
            enqueue_job(
                "reducer_bucket.sync",
                reducer.id,
                bucket_start.isoformat(),
                customer_id,
                external_customer_id,
                delay=int(delay.total_seconds() * 1000),
            )

        return len(contributions)

    async def sync_bucket(
        self,
        session: AsyncSession,
        reducer_id: UUID,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> None:
        reducer = await ReducerRepository.from_session(
            session
        ).get_active_by_id_and_kinds(reducer_id, (ReducerKind.usage,))
        if reducer is None:
            return
        repository = ReducerBucketRepository.from_session(session)
        await self._lock_buckets(
            repository, [(reducer, bucket_start, customer_id, external_customer_id)]
        )
        await self._sync_bucket_intervals(
            repository, reducer, bucket_start, customer_id, external_customer_id
        )
        _enqueue_outpost_event(reducer, customer_id, external_customer_id)

    async def get_cold_usage(
        self,
        session: AsyncReadSession,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        since: datetime,
    ) -> dict[tuple[UUID | None, str | None], tuple[datetime, Totals]]:
        """For each customer identity, the end of its last fully synced slot
        starting from `since`, or `since`, with the count, sum, min and max of its
        usage not billed yet before it. Clients count whole slots: a slot a seal
        split, with only its first part synced, stays theirs."""
        repository = ReducerBucketRepository.from_session(session)
        synced_ends = await repository.get_last_synced_ends(
            reducer.organization_id, reducer.id, identities, since=since
        )
        cold_until = {
            identity: get_reducer_bucket_start(synced_ends[identity])
            if identity in synced_ends
            else since
            for identity in identities
        }
        totals = await repository.get_unsealed_totals_by_identity(
            reducer.organization_id, reducer.id, cold_until
        )
        return {
            identity: (cold_until[identity], totals[identity])
            for identity in identities
        }

    async def get_credits(
        self, session: AsyncReadSession, reducer: Reducer, customer_ids: Sequence[UUID]
    ) -> dict[UUID, Totals]:
        """count, sum, min and max of each customer's credits since the meter's
        latest reset: the credit reducer's unsealed buckets."""
        totals = await ReducerBucketRepository.from_session(
            session
        ).get_unsealed_totals_by_identity(
            reducer.organization_id,
            reducer.id,
            {(customer_id, None): None for customer_id in customer_ids},
        )
        return {
            customer_id: totals[(customer_id, None)] for customer_id in customer_ids
        }

    async def get_stored_external_ids(
        self,
        session: AsyncReadSession,
        reducer: Reducer,
        customer_id: UUID | None,
        external_customer_id: str | None,
        *,
        bucket_start: datetime,
        external_ids: Sequence[str],
    ) -> set[str]:
        """The given external ids of the customer identity's stored events that the
        synced part of the bucket starting at `bucket_start` counts: a seal can
        split a bucket, and sync then recomputes each part on its own."""
        repository = ReducerBucketRepository.from_session(session)
        synced_end = await repository.get_synced_end_within(
            reducer.organization_id,
            reducer.id,
            customer_id,
            external_customer_id,
            bucket_start,
            bucket_start + REDUCER_BUCKET_SIZE,
        )
        if synced_end is None:
            return set()
        return await EventRepository.from_session(session).get_stored_external_ids(
            reducer.organization_id,
            external_ids,
            timestamp_from=bucket_start,
            timestamp_to=synced_end,
        )

    async def get_database_now(self, session: AsyncReadSession) -> datetime:
        return await ReducerBucketRepository.from_session(session).get_database_now()

    async def get_customer_meter_units(
        self,
        session: AsyncReadSession,
        redis: Redis,
        customer: Customer,
        meter_id: UUID,
    ) -> tuple[Decimal | None, Decimal | None]:
        """The customer's consumed and credited units since the meter's latest reset."""
        usage, credited_units = await self._get_customer_meter_usage(
            session, redis, customer, meter_id
        )
        if usage is None:
            return None, credited_units
        function, summary = usage
        return finalize_quantity(summary, function), credited_units

    async def _get_customer_meter_usage(
        self,
        session: AsyncReadSession,
        redis: Redis,
        customer: Customer,
        meter_id: UUID,
    ) -> tuple[tuple[AggregationFunction, UsageSummary] | None, Decimal | None]:
        """The aggregation function and summary of the customer's usage since the
        meter's latest reset, and its credited units."""
        identities = get_customer_identities(customer)
        now = utc_now()
        current_bucket_start = get_reducer_bucket_start(now)
        previous_bucket_start = current_bucket_start - REDUCER_BUCKET_SIZE
        rows = await ReducerBucketRepository.from_session(
            session
        ).get_customer_meter_totals(
            customer, meter_id, usage_closed_before=previous_bucket_start
        )
        usage: tuple[UUID, Aggregation, datetime | None] | None = None
        usage_cold_agg_values: list[tuple[Any, ...]] = []
        unsplit_identities: list[tuple[UUID | None, str | None]] = []
        credited_units: Decimal | None = None
        for (
            reducer_id,
            kind,
            aggregation,
            since,
            customer_id,
            external_customer_id,
            split_at_reset,
            *cold_agg_values,
        ) in rows:
            match kind:
                case ReducerKind.credit:
                    # credits are always sums and never rolled up in redis
                    credited_units = Decimal(cold_agg_values[1])
                case ReducerKind.usage:
                    usage = (reducer_id, aggregation, since)
                    usage_cold_agg_values.append(tuple(cold_agg_values))
                    if not split_at_reset:
                        unsplit_identities.append((customer_id, external_customer_id))

        if usage is None or isinstance(usage[1], UniqueAggregation):
            return None, credited_units

        reducer_id, aggregation, since = usage
        active_bucket_starts = [
            bucket_start
            for bucket_start in (previous_bucket_start, current_bucket_start)
            if since is None or bucket_start >= since
        ]
        hot_agg_values = (
            await redis_store.get_bucket_totals(
                redis, reducer_id, aggregation.func, active_bucket_starts, identities
            )
            if active_bucket_starts
            else []
        )
        # The buckets of the slot a reset falls within start before it until a seal
        # splits the slot, so the usage after the reset is read from its events.
        post_reset_usage: list[UsageSummary] = []
        if (
            since is not None
            and since != get_reducer_bucket_start(since)
            and unsplit_identities
        ):
            if now < since + POST_RESET_EVENTS_READ_LIMIT:
                post_reset_usage = await self._get_post_reset_usage(
                    session, meter_id, unsplit_identities, since
                )
            else:
                log.warning(
                    "Reducer slot of the latest meter reset isn't split",
                    customer_id=customer.id,
                    meter_id=meter_id,
                    since=since.isoformat(),
                )
        summary = merge_summaries(
            [
                *(
                    UsageSummary(*agg_values)
                    for agg_values in [*usage_cold_agg_values, *hot_agg_values]
                ),
                *post_reset_usage,
            ]
        )
        return (aggregation.func, summary), credited_units

    async def _get_post_reset_usage(
        self,
        session: AsyncReadSession,
        meter_id: UUID,
        identities: Sequence[tuple[UUID | None, str | None]],
        since: datetime,
    ) -> list[UsageSummary]:
        """Summary of each identity's usage from `since` to the end of its slot."""
        reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter_id, ReducerKind.usage
        )
        assert reducer is not None
        repository = ReducerBucketRepository.from_session(session)
        slot_end = get_reducer_bucket_start(since) + REDUCER_BUCKET_SIZE
        summaries: list[UsageSummary] = []
        for customer_id, external_customer_id in identities:
            count, total, minimum, maximum = await repository.aggregate_events(
                reducer, since, slot_end, customer_id, external_customer_id
            )
            summaries.append(
                UsageSummary(
                    count=count,
                    total=Decimal(total),
                    minimum=None if minimum is None else Decimal(minimum),
                    maximum=None if maximum is None else Decimal(maximum),
                )
            )
        return summaries

    async def log_customer_meter_comparison(
        self,
        session: AsyncReadSession,
        redis: Redis,
        customer_meter: CustomerMeter,
        get_late_usage: Callable[[], Awaitable[UsageSummary]],
        get_legacy_usage: Callable[[], Awaitable[float]],
        get_usage_ingested_before: Callable[[datetime], Awaitable[UsageSummary]],
    ) -> None:
        if isinstance(customer_meter.meter.aggregation, UniqueAggregation):
            return
        customer = customer_meter.customer
        with logfire.span(
            "Compare customer meter with reducer",
            organization_id=str(customer.organization_id),
            customer_meter_id=str(customer_meter.id),
            aggregation=str(customer_meter.meter.aggregation.func),
        ) as span:
            consumed_units: Decimal | None = None
            late_usage: UsageSummary | None = None
            consumed_units_with_late_usage: Decimal | None = None
            legacy_consumed_units_after: Decimal | None = None
            pre_reducer_usage: UsageSummary | None = None
            consumed_units_with_pre_reducer_usage: Decimal | None = None
            try:
                async with session.begin_nested():
                    usage, credited_units = await self._get_customer_meter_usage(
                        session, redis, customer, customer_meter.meter_id
                    )
                    if usage is not None:
                        function, summary = usage
                        consumed_units = finalize_quantity(summary, function)
                        # Legacy counts usage ingested since the reset, the reducer
                        # usage timestamped since it: when they differ, merge in the
                        # usage ingested since the reset but timestamped before it.
                        if not math.isclose(
                            consumed_units, customer_meter.consumed_units
                        ):
                            late_usage = await get_late_usage()
                            consumed_units_with_late_usage = finalize_quantity(
                                merge_summaries([summary, late_usage]), function
                            )
                            # Usage ingested since legacy's read is only in the
                            # reducer, so read legacy again to bound it.
                            if not math.isclose(
                                consumed_units_with_late_usage,
                                customer_meter.consumed_units,
                            ):
                                legacy_consumed_units_after = Decimal(
                                    await get_legacy_usage()
                                )
                                # Legacy also counts usage ingested before the
                                # reducer was created, which it only has if backfilled.
                                if not _is_between(
                                    consumed_units_with_late_usage,
                                    customer_meter.consumed_units,
                                    legacy_consumed_units_after,
                                ):
                                    reducer = await ReducerRepository.from_session(
                                        session
                                    ).get_by_meter_and_kind(
                                        customer_meter.meter_id, ReducerKind.usage
                                    )
                                    assert reducer is not None
                                    pre_reducer_usage = await get_usage_ingested_before(
                                        reducer.created_at
                                    )
                                    consumed_units_with_pre_reducer_usage = (
                                        finalize_quantity(
                                            merge_summaries(
                                                [summary, late_usage, pre_reducer_usage]
                                            ),
                                            function,
                                        )
                                    )
            except Exception:
                log.exception(
                    "Failed to compare customer meter with reducer",
                    customer_meter_id=customer_meter.id,
                )
                return
            span.set_attribute(
                "legacy",
                {
                    "consumed_units": _format_units(customer_meter.consumed_units),
                    "consumed_units_after_reducer": _format_units(
                        legacy_consumed_units_after
                    )
                    if legacy_consumed_units_after is not None
                    else None,
                    "credited_units": _format_units(customer_meter.credited_units),
                },
            )
            span.set_attribute(
                "reducer",
                {
                    "consumed_units": _format_units(consumed_units)
                    if consumed_units is not None
                    else None,
                    "late_events": late_usage.count if late_usage is not None else None,
                    "consumed_units_with_late_usage": _format_units(
                        consumed_units_with_late_usage
                    )
                    if consumed_units_with_late_usage is not None
                    else None,
                    "pre_reducer_events": pre_reducer_usage.count
                    if pre_reducer_usage is not None
                    else None,
                    "consumed_units_with_pre_reducer_usage": _format_units(
                        consumed_units_with_pre_reducer_usage
                    )
                    if consumed_units_with_pre_reducer_usage is not None
                    else None,
                    "credited_units": _format_units(credited_units)
                    if credited_units is not None
                    else None,
                },
            )
            span.set_attribute(
                "match",
                consumed_units is not None
                and credited_units is not None
                and _is_between(
                    consumed_units_with_pre_reducer_usage
                    if consumed_units_with_pre_reducer_usage is not None
                    else consumed_units_with_late_usage
                    if consumed_units_with_late_usage is not None
                    else consumed_units,
                    customer_meter.consumed_units,
                    customer_meter.consumed_units
                    if legacy_consumed_units_after is None
                    else legacy_consumed_units_after,
                )
                and math.isclose(credited_units, customer_meter.credited_units),
            )

    async def _add_to_closed_buckets(
        self, session: AsyncSession, contributions: Contributions
    ) -> None:
        """Adds the contributions in a fixed number of statements, whatever the
        number of buckets."""
        repository = ReducerBucketRepository.from_session(session)
        # Locks are all taken before writing any row, and rows are written in
        # chronological order like seal locks them, so a seal can't deadlock with us.
        bucket_ids = sorted(contributions, key=_get_bucket_key)
        await self._lock_buckets(repository, bucket_ids)
        buckets_by_slot: dict[
            tuple[UUID, datetime, UUID | None, str | None], list[ReducerBucket]
        ] = defaultdict(list)
        for bucket in await repository.get_all_starting_within_for_update(
            [
                (
                    reducer,
                    bucket_start,
                    bucket_start + REDUCER_BUCKET_SIZE,
                    customer_id,
                    external_customer_id,
                )
                for reducer, bucket_start, customer_id, external_customer_id in (
                    bucket_ids
                )
            ]
        ):
            buckets_by_slot[
                (
                    bucket.reducer_id,
                    get_reducer_bucket_start(bucket.bucket_start),
                    bucket.customer_id,
                    bucket.external_customer_id,
                )
            ].append(bucket)

        additions: list[tuple[UUID, int, Decimal, Decimal | None, Decimal | None]] = []
        new_buckets: list[dict[str, Any]] = []
        for bucket_id in bucket_ids:
            reducer, bucket_start, customer_id, external_customer_id = bucket_id
            slot_buckets = buckets_by_slot[
                (reducer.id, bucket_start, customer_id, external_customer_id)
            ]
            for start, end in _get_slot_intervals(slot_buckets, bucket_start):
                values = [
                    value
                    for timestamp, value in contributions[bucket_id]
                    if start <= timestamp < end
                ]
                if not values:
                    continue
                count = len(values)
                total = Decimal(0)
                minimum: Decimal | None = None
                maximum: Decimal | None = None
                if isinstance(reducer.aggregation, PropertyAggregation):
                    total, minimum, maximum = (
                        sum(values, Decimal(0)),
                        min(values),
                        max(values),
                    )
                latest = max(
                    (bucket for bucket in slot_buckets if bucket.bucket_start == start),
                    key=lambda bucket: bucket.generation,
                    default=None,
                )
                if latest is not None and latest.sealed_at is None:
                    additions.append((latest.id, count, total, minimum, maximum))
                    continue
                new_buckets.append(
                    {
                        "organization_id": reducer.organization_id,
                        "reducer_id": reducer.id,
                        "customer_id": customer_id,
                        "external_customer_id": external_customer_id,
                        "bucket_start": start,
                        "bucket_end": end,
                        "count": count,
                        "sum": total,
                        "min": minimum,
                        "max": maximum,
                        "generation": 1 if latest is None else latest.generation + 1,
                    }
                )
            _enqueue_outpost_event(reducer, customer_id, external_customer_id)
        await repository.add_contributions(additions)
        await repository.insert_all(new_buckets)

    async def _create_reducer(
        self,
        session: AsyncSession,
        meter: Meter,
        kind: ReducerKind,
        filter: Filter,
        aggregation: Aggregation,
    ) -> Reducer:
        reducer = await ReducerRepository.from_session(session).create(
            Reducer(
                organization=meter.organization,
                kind=kind,
                filter=filter,
                aggregation=aggregation,
            )
        )
        session.add(MeterReducer(meter=meter, reducer=reducer))
        return reducer

    async def _get_reducers(
        self, session: AsyncReadSession, meter_ids: Iterable[UUID], kind: ReducerKind
    ) -> dict[UUID, Reducer]:
        """The meters' reducers of the kind with buckets, by meter id."""
        repository = ReducerRepository.from_session(session)
        reducers: dict[UUID, Reducer] = {}
        for meter_id in meter_ids:
            reducer = await repository.get_by_meter_and_kind(meter_id, kind)
            if reducer is not None and not isinstance(
                reducer.aggregation, UniqueAggregation
            ):
                reducers[meter_id] = reducer
        return reducers

    async def _seal_buckets(
        self,
        session: AsyncSession,
        reducers: Sequence[Reducer],
        customer: Customer,
        *,
        until: datetime,
        since: datetime | None = None,
        boundaries: Sequence[datetime] = (),
    ) -> None:
        """Seals the customer's unsealed usage until `until`, from `since` if
        given. `until`, `since` and, for usage reducers, `boundaries` all become
        bucket boundaries."""
        repository = ReducerBucketRepository.from_session(session)
        identities = get_customer_identities(customer)
        edges = {until} if since is None else {since, until}
        split_at = {
            reducer.id: sorted(
                {*edges, *boundaries} if reducer.kind == ReducerKind.usage else edges
            )
            for reducer in reducers
        }
        await self._lock_buckets(
            repository,
            [
                (
                    reducer,
                    get_reducer_bucket_start(at),
                    customer_id,
                    external_customer_id,
                )
                for reducer in reducers
                for at in split_at[reducer.id]
                for customer_id, external_customer_id in identities
            ],
        )

        for reducer in sorted(reducers, key=lambda reducer: str(reducer.id)):
            for customer_id, external_customer_id in identities:
                await self._split_at(
                    repository,
                    reducer,
                    customer,
                    (customer_id, external_customer_id),
                    split_at[reducer.id],
                )
            with logfire.span(
                "Seal reducer buckets",
                organization_id=str(customer.organization_id),
                reducer_id=str(reducer.id),
                customer_id=str(customer.id),
                until=until,
            ) as span:
                sealed = await repository.mark_as_sealed(
                    reducer, identities, since=since, until=until, sealed_at=utc_now()
                )
                span.set_attribute("sealed_buckets", sealed)
            if sealed:
                # Credits are the customer's: their events only carry its id.
                for customer_id, external_customer_id in (
                    [(customer.id, None)]
                    if reducer.kind == ReducerKind.credit
                    else identities
                ):
                    _enqueue_outpost_event(reducer, customer_id, external_customer_id)

    async def _split_at(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        customer: Customer,
        identity: tuple[UUID | None, str | None],
        boundaries: Sequence[datetime],
    ) -> bool:
        """Makes each boundary a bucket boundary of the customer identity, and
        returns whether they all are: one inside a sealed bucket can't be."""
        customer_id, external_customer_id = identity
        all_split = True
        for at in boundaries:
            with logfire.span(
                "Split reducer buckets",
                organization_id=str(customer.organization_id),
                reducer_id=str(reducer.id),
                customer_id=str(customer.id),
                bucket_customer_id=customer_id is not None,
                bucket_external_customer_id=external_customer_id is not None,
                at=at,
            ) as span:
                start, end = await self._get_interval_containing(
                    repository, reducer, customer_id, external_customer_id, at
                )
                split = False
                if start != at:
                    split = await self._split(
                        repository,
                        reducer,
                        customer_id,
                        external_customer_id,
                        (start, end),
                        split_at=at,
                    )
                    all_split = all_split and split
                span.set_attribute("interval", [start.isoformat(), end.isoformat()])
                span.set_attribute("split", split)
        return all_split

    async def _bill_buckets(
        self,
        session: AsyncSession,
        reducers: Sequence[Reducer],
        customer: Customer,
        *,
        order_id: UUID | None,
        since: datetime | None,
        until: datetime,
    ) -> tuple[dict[UUID, Decimal], list[UUID]]:
        """Marks the customer's sealed, unbilled usage within [since, until) as
        billed by the order, if any, and returns its quantity per reducer and the
        ids of its buckets."""
        repository = ReducerBucketRepository.from_session(session)
        identities = get_customer_identities(customer)
        quantities: dict[UUID, Decimal] = {}
        bucket_ids: list[UUID] = []
        for reducer in sorted(reducers, key=lambda reducer: str(reducer.id)):
            with logfire.span(
                "Bill reducer buckets",
                organization_id=str(customer.organization_id),
                reducer_id=str(reducer.id),
                customer_id=str(customer.id),
                order_id=str(order_id),
                since=since,
                until=until,
            ) as span:
                billed = await self._get_unbilled(
                    repository,
                    reducer,
                    identities,
                    order_id,
                    since=since,
                    until=until,
                )
                quantity = _get_quantity(
                    reducer.aggregation.func, [row[1:] for row in billed]
                )
                span.set_attribute("billed_buckets", len(billed))
                span.set_attribute("quantity", str(quantity))
            quantities[reducer.id] = quantity
            bucket_ids.extend(row[0] for row in billed)
        return quantities, bucket_ids

    async def _get_unbilled(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        order_id: UUID | None,
        *,
        since: datetime | None,
        until: datetime,
    ) -> Sequence[tuple[UUID, int, Decimal, Decimal | None, Decimal | None]]:
        """id, count, sum, min and max of the identities' sealed, unbilled buckets
        within [since, until), marked as billed by the order if there is one."""
        if order_id is None:
            return await repository.get_unbilled_totals(
                reducer, identities, since=since, until=until
            )
        return await repository.mark_as_billed(
            reducer,
            identities,
            order_id,
            since=since,
            until=until,
            billed_at=utc_now(),
        )

    async def _lock_buckets(
        self,
        repository: ReducerBucketRepository,
        bucket_ids: Iterable[redis_store.BucketId],
    ) -> None:
        """Locks the buckets in one global order, so transactions locking several
        can't deadlock each other."""
        await repository.lock_buckets(sorted(bucket_ids, key=_get_bucket_key))

    async def _get_intervals(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> list[tuple[datetime, datetime]]:
        """The [start, end) intervals the slot's rows divide it into, or the whole
        slot if it has none."""
        buckets = await repository.get_all_starting_within(
            reducer,
            bucket_start,
            bucket_start + REDUCER_BUCKET_SIZE,
            customer_id,
            external_customer_id,
        )
        return _get_slot_intervals(buckets, bucket_start)

    async def _sync_bucket_intervals(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> None:
        for start, end in await self._get_intervals(
            repository, reducer, bucket_start, customer_id, external_customer_id
        ):
            previous = await repository.get_latest_for_update(
                reducer, start, customer_id, external_customer_id
            )
            count, total, minimum, maximum = await repository.aggregate_events(
                reducer, start, end, customer_id, external_customer_id
            )
            if count == 0:
                continue
            statistics = {"count": count, "sum": total, "min": minimum, "max": maximum}
            # Sealed buckets were billed: events since go to a new generation.
            if previous is not None and previous.sealed_at is None:
                await repository.update(
                    previous, update_dict={**statistics, "synced_at": utc_now()}
                )
                continue
            await repository.create(
                ReducerBucket(
                    organization_id=reducer.organization_id,
                    reducer=reducer,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                    bucket_start=start,
                    bucket_end=end,
                    **statistics,
                    generation=1 if previous is None else previous.generation + 1,
                    synced_at=utc_now(),
                ),
                flush=True,
            )

    async def _get_interval_containing(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        customer_id: UUID | None,
        external_customer_id: str | None,
        at: datetime,
    ) -> tuple[datetime, datetime]:
        intervals = await self._get_intervals(
            repository,
            reducer,
            get_reducer_bucket_start(at),
            customer_id,
            external_customer_id,
        )
        return next((start, end) for start, end in intervals if start <= at < end)

    async def _split(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        customer_id: UUID | None,
        external_customer_id: str | None,
        interval: tuple[datetime, datetime],
        *,
        split_at: datetime,
    ) -> bool:
        """Makes `split_at` a bucket boundary, so a seal can include the usage on
        one side of it only: `interval`, which contains it, becomes
        [interval_start, split_at) and [split_at, interval_end), created empty
        if the bucket doesn't exist yet."""
        interval_start, interval_end = interval
        bucket = await repository.get_latest_for_update(
            reducer, interval_start, customer_id, external_customer_id
        )
        # An earlier seal went past `split_at`. Sealed rows can't change.
        if bucket is not None and bucket.sealed_at is not None:
            log.warning(
                "Skipping split of a sealed reducer bucket",
                reducer_id=reducer.id,
                bucket_start=interval_start.isoformat(),
                split_at=split_at.isoformat(),
            )
            return False
        # Same, but late events arrived after that seal and opened a new generation.
        # Splitting it would leave its generations covering different intervals.
        if bucket is not None and bucket.generation > 1:
            log.warning(
                "Skipping split of a reducer bucket with a sealed generation",
                reducer_id=reducer.id,
                bucket_start=interval_start.isoformat(),
                split_at=split_at.isoformat(),
                generation=bucket.generation,
            )
            return False

        before = (
            await repository.aggregate_events(
                reducer, interval_start, split_at, customer_id, external_customer_id
            )
        )._asdict()
        after = (
            await repository.aggregate_events(
                reducer, split_at, interval_end, customer_id, external_customer_id
            )
        )._asdict()
        if bucket is None:
            await repository.create(
                ReducerBucket(
                    organization_id=reducer.organization_id,
                    reducer=reducer,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                    bucket_start=interval_start,
                    bucket_end=split_at,
                    **before,
                ),
                flush=True,
            )
        else:
            await repository.update(
                bucket, update_dict={"bucket_end": split_at, **before}
            )
        await repository.create(
            ReducerBucket(
                organization_id=reducer.organization_id,
                reducer=reducer,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                bucket_start=split_at,
                bucket_end=interval_end,
                **after,
                synced_at=None if bucket is None else bucket.synced_at,
            ),
            flush=True,
        )
        return True


def _enqueue_outpost_event(
    reducer: Reducer,
    customer_id: UUID | None,
    external_customer_id: str | None,
) -> None:
    enqueue_outpost_event(
        reducer.organization_id,
        {
            "type": "reducer_bucket",
            "reducer_id": reducer.id,
            "customer_id": customer_id,
            "external_customer_id": external_customer_id,
        },
    )


def _is_between(value: Decimal, bound: Decimal, other_bound: Decimal) -> bool:
    low, high = sorted((bound, other_bound))
    return math.isclose(value, low) or math.isclose(value, high) or low < value < high


def _format_units(units: Decimal | int) -> str:
    return f"{Decimal(units).normalize():f}"


def _get_bucket_key(bucket_id: redis_store.BucketId) -> str:
    reducer, bucket_start, customer_id, external_customer_id = bucket_id
    return redis_store.get_reducer_bucket_key(
        reducer.id, bucket_start, customer_id, external_customer_id
    )


def _get_slot_intervals(
    buckets: Iterable[ReducerBucket], bucket_start: datetime
) -> list[tuple[datetime, datetime]]:
    return sorted({(bucket.bucket_start, bucket.bucket_end) for bucket in buckets}) or [
        (bucket_start, bucket_start + REDUCER_BUCKET_SIZE)
    ]


def _get_quantity(
    function: AggregationFunction,
    buckets: Sequence[tuple[int, Decimal, Decimal | None, Decimal | None]],
) -> Decimal:
    return finalize_quantity(
        merge_summaries([UsageSummary(*bucket) for bucket in buckets]), function
    )


def merge_summaries(summaries: Sequence[UsageSummary]) -> UsageSummary:
    minimums = [summary.minimum for summary in summaries if summary.minimum is not None]
    maximums = [summary.maximum for summary in summaries if summary.maximum is not None]
    return UsageSummary(
        count=sum(summary.count for summary in summaries),
        total=sum((summary.total for summary in summaries), Decimal(0)),
        minimum=min(minimums, default=None),
        maximum=max(maximums, default=None),
    )


def finalize_quantity(summary: UsageSummary, function: AggregationFunction) -> Decimal:
    match function:
        case AggregationFunction.cnt:
            return Decimal(summary.count)
        case AggregationFunction.sum:
            return summary.total
        case AggregationFunction.avg:
            return summary.total / summary.count if summary.count else Decimal(0)
        case AggregationFunction.min:
            return summary.minimum if summary.minimum is not None else Decimal(0)
        case AggregationFunction.max:
            return summary.maximum if summary.maximum is not None else Decimal(0)
        case AggregationFunction.unique:
            raise ValueError("Unique aggregations have no reducer buckets")


def _reduce_events_to_bucket_contributions(
    reducers: Sequence[Reducer], events: Sequence[Event]
) -> Contributions:
    """The timestamped values each event adds to the buckets of the reducers it
    matches."""
    contributions: Contributions = defaultdict(list)
    prepared = [
        (
            reducer,
            reducer.filter,
            reducer.aggregation
            if isinstance(reducer.aggregation, PropertyAggregation)
            else None,
        )
        for reducer in reducers
    ]
    for event in events:
        timestamp = event.timestamp
        bucket_start = get_reducer_bucket_start(timestamp)
        for reducer, filter, aggregation in prepared:
            if not filter.matches(event):
                continue
            value = ONE
            if aggregation is not None:
                property_value = aggregation.get_value(event)
                if property_value is None:
                    continue
                value = Decimal(str(property_value))
            bucket_id = (
                reducer,
                bucket_start,
                event.customer_id,
                event.external_customer_id,
            )
            contributions[bucket_id].append((timestamp, value))
    return contributions


reducer = ReducerService()
