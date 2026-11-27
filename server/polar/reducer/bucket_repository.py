from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    ARRAY,
    CTE,
    BigInteger,
    ColumnElement,
    ColumnExpressionArgument,
    Numeric,
    Row,
    Select,
    String,
    Uuid,
    and_,
    bindparam,
    cast,
    column,
    false,
    func,
    literal,
    literal_column,
    null,
    or_,
    select,
    true,
    union,
    union_all,
    update,
    values,
)
from sqlalchemy.dialects.postgresql import insert

from polar.event.repository import EventRepository
from polar.event.schemas import TIMESTAMP_AHEAD_TOLERANCE
from polar.kit.db.locking import pg_advisory_xact_locks
from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.meter.aggregation import PropertyAggregation
from polar.models import (
    Customer,
    Event,
    MeterReducer,
    Reducer,
    ReducerBucket,
    StagedEvent,
)
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind

from .redis_store import BucketId, get_reducer_bucket_key

INGESTED_BEFORE_TIMESTAMP_MARGIN = TIMESTAMP_AHEAD_TOLERANCE

# count, sum, min and max.
type Totals = tuple[Any, Any, Any, Any]
type CustomerIdentity = tuple[UUID | None, str | None]
# A customer identity's buckets on one reducer.
type ReducerIdentity = tuple[UUID, CustomerIdentity]


def _is_customer(
    model: type[Event | StagedEvent | ReducerBucket],
    customer_id: UUID | None,
    external_customer_id: str | None,
) -> ColumnElement[bool]:
    return and_(
        model.customer_id == customer_id,
        model.external_customer_id == external_customer_id,
    )


def _is_any_customer(
    identities: Sequence[tuple[UUID | None, str | None]],
) -> ColumnElement[bool]:
    return or_(
        *(
            _is_customer(ReducerBucket, customer_id, external_customer_id)
            for customer_id, external_customer_id in identities
        )
    )


def _is_among_customers(
    identities: Iterable[tuple[UUID | None, str | None]],
) -> ColumnElement[bool]:
    """One IN list per identity shape (customer id, external id or both), which the
    identity index can use, where one condition per identity would be checked on
    every bucket. A bucket pairing one identity's customer id with another's
    external id matches too, so the caller keeps only the identities it asked for."""
    shapes: dict[tuple[bool, bool], list[tuple[UUID | None, str | None]]] = {}
    for customer_id, external_customer_id in identities:
        shape = (customer_id is not None, external_customer_id is not None)
        shapes.setdefault(shape, []).append((customer_id, external_customer_id))
    return or_(
        *(
            and_(
                ReducerBucket.customer_id.in_(
                    {customer_id for customer_id, _ in shaped}
                )
                if by_customer_id
                else ReducerBucket.customer_id.is_(None),
                ReducerBucket.external_customer_id.in_(
                    {external_customer_id for _, external_customer_id in shaped}
                )
                if by_external_id
                else ReducerBucket.external_customer_id.is_(None),
            )
            for (by_customer_id, by_external_id), shaped in shapes.items()
        )
    )


def _event_clauses(
    model: type[Event | StagedEvent],
    reducer: Reducer,
    bucket_start: datetime,
    bucket_end: datetime,
) -> tuple[ColumnExpressionArgument[bool], ...]:
    """The reducer's events in the range: system events for a credit reducer, user
    events otherwise."""
    return (
        model.organization_id == reducer.organization_id,
        model.source
        == (
            EventSource.system
            if reducer.kind == ReducerKind.credit
            else EventSource.user
        ),
        model.timestamp >= bucket_start,
        model.timestamp < bucket_end,
        # Events are never ingested before their timestamp, beyond clock skew:
        # this bound lets the identity indexes skip the customer's history.
        model.ingested_at >= bucket_start - INGESTED_BEFORE_TIMESTAMP_MARGIN,
        reducer.filter.get_sql_clause(model),
        reducer.aggregation.get_sql_clause(model),
    )


def _starts_within(
    reducer: Reducer,
    start: datetime,
    end: datetime,
    customer_id: UUID | None,
    external_customer_id: str | None,
) -> ColumnElement[bool]:
    return and_(
        ReducerBucket.organization_id == reducer.organization_id,
        ReducerBucket.reducer_id == reducer.id,
        ReducerBucket.bucket_start >= start,
        ReducerBucket.bucket_start < end,
        _is_customer(ReducerBucket, customer_id, external_customer_id),
    )


def get_customer_identities(
    customer: Customer,
) -> list[tuple[UUID | None, str | None]]:
    """The (customer_id, external_customer_id) pairs the customer's buckets use."""
    identities: list[tuple[UUID | None, str | None]] = [(customer.id, None)]
    if customer.external_id is not None:
        identities.append((None, customer.external_id))
        identities.append((customer.id, customer.external_id))
    return identities


class ReducerBucketRepository(RepositoryBase[ReducerBucket]):
    model = ReducerBucket

    async def lock_buckets(self, bucket_ids: Sequence[BucketId]) -> None:
        """Locks the buckets of each bucket id exclusively until the transaction
        ends, in one round trip and in the order of `bucket_ids`."""
        await pg_advisory_xact_locks(
            self.session,
            "reducer_bucket.buckets",
            [
                get_reducer_bucket_key(
                    reducer.id, bucket_start, customer_id, external_customer_id
                )
                for reducer, bucket_start, customer_id, external_customer_id in (
                    bucket_ids
                )
            ],
        )

    async def aggregate_events(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        bucket_end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> Row[Any, Any, Any, Any]:
        """count, sum, min and max of the customer identity's events for the
        reducer in the range, ingested after its latest sealed bucket: system events
        for a credit reducer, user events otherwise."""
        # Events still waiting in `staged_events` count too: the mover takes each one
        # out of `staged_events` and into `events` in a single transaction, so this
        # one statement sees every event exactly once.
        events = self._aggregate_statement(
            Event, reducer, bucket_start, bucket_end, customer_id, external_customer_id
        ).subquery("events_statistics")
        staged_events = self._aggregate_statement(
            StagedEvent,
            reducer,
            bucket_start,
            bucket_end,
            customer_id,
            external_customer_id,
        ).subquery("staged_events_statistics")
        statement = select(
            (events.c.count + staged_events.c.count).label("count"),
            (events.c.sum + staged_events.c.sum).label("sum"),
            func.least(events.c.min, staged_events.c.min).label("min"),
            func.greatest(events.c.max, staged_events.c.max).label("max"),
        ).select_from(events.join(staged_events, true()))
        result = await self.session.execute(statement)
        return result.one()

    async def get_identities_with_events(
        self, reducer: Reducer, bucket_start: datetime, bucket_end: datetime
    ) -> Sequence[tuple[UUID | None, str | None]]:
        """The customer identities with events for the reducer in the range, like
        `aggregate_events` counts them, including those still in `staged_events`."""
        statement = union(
            *(
                select(model.customer_id, model.external_customer_id).where(
                    *_event_clauses(model, reducer, bucket_start, bucket_end)
                )
                for model in (Event, StagedEvent)
            )
        )
        result = await self.session.execute(statement)
        return [
            (customer_id, external_customer_id)
            for customer_id, external_customer_id in result.all()
        ]

    def _aggregate_statement(
        self,
        model: type[Event | StagedEvent],
        reducer: Reducer,
        bucket_start: datetime,
        bucket_end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> Select[*tuple[Any, ...]]:
        sealed_at = (
            select(func.max(ReducerBucket.sealed_at))
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                ReducerBucket.bucket_start == bucket_start,
                _is_customer(ReducerBucket, customer_id, external_customer_id),
            )
            .scalar_subquery()
        )
        aggregation = reducer.aggregation
        statistics: tuple[Any, Any, Any]
        if isinstance(aggregation, PropertyAggregation):
            value = aggregation.get_sql_value(model)
            statistics = (
                func.coalesce(func.sum(value), 0),
                func.min(value),
                func.max(value),
            )
        else:
            statistics = (literal(0), null(), null())
        return select(
            func.count().label("count"),
            statistics[0].label("sum"),
            statistics[1].label("min"),
            statistics[2].label("max"),
        ).where(
            *_event_clauses(model, reducer, bucket_start, bucket_end),
            _is_customer(model, customer_id, external_customer_id),
            or_(sealed_at.is_(None), model.ingested_at > sealed_at),
        )

    async def get_all_starting_within(
        self,
        reducer: Reducer,
        start: datetime,
        end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> Sequence[ReducerBucket]:
        statement = self.get_base_statement().where(
            _starts_within(reducer, start, end, customer_id, external_customer_id)
        )
        return await self.get_all(statement)

    async def get_all_by_identities_starting_within(
        self,
        reducer: Reducer,
        identities: Sequence[CustomerIdentity],
        start: datetime,
        end: datetime | None,
    ) -> Sequence[ReducerBucket]:
        statement = self.get_base_statement().where(
            ReducerBucket.organization_id == reducer.organization_id,
            ReducerBucket.reducer_id == reducer.id,
            ReducerBucket.bucket_start >= start,
            _is_any_customer(identities),
        )
        if end is not None:
            statement = statement.where(ReducerBucket.bucket_start < end)
        return await self.get_all(statement)

    async def get_all_starting_within_for_update(
        self,
        slots: Sequence[tuple[Reducer, datetime, datetime, UUID | None, str | None]],
    ) -> Sequence[ReducerBucket]:
        """The buckets of each (reducer, start, end, customer identity) slot, like
        `get_all_starting_within`, locked."""
        statement = (
            self.get_base_statement()
            .where(or_(*(_starts_within(*slot) for slot in slots)))
            .with_for_update()
        )
        return await self.get_all(statement)

    async def get_latest_for_update(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> ReducerBucket | None:
        """The customer identity's bucket of the highest generation."""
        statement = (
            self.get_base_statement()
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                ReducerBucket.bucket_start == bucket_start,
                _is_customer(ReducerBucket, customer_id, external_customer_id),
            )
            .order_by(ReducerBucket.generation.desc())
            .limit(1)
            .with_for_update()
        )
        return await self.get_one_or_none(statement)

    async def get_unsealed_totals_by_identity(
        self,
        organization_id: UUID,
        before: Mapping[ReducerIdentity, datetime | None],
        *,
        since: Mapping[ReducerIdentity, datetime] | None = None,
    ) -> dict[ReducerIdentity, Totals]:
        """count, sum, min and max of each identity's unsealed buckets on its
        reducer, starting before the identity's datetime in `before` if given, and
        from its datetime in `since` if it has one."""
        if not before:
            return {}
        since = since or {}
        # Pairs that share an identity and its bounds share one condition: a cold
        # customer's reducers mostly do, so the conditions do not grow with them.
        reducers_by_bound: dict[
            tuple[CustomerIdentity, datetime | None, datetime | None], set[UUID]
        ] = {}
        for (reducer_id, identity), end in before.items():
            start = since.get((reducer_id, identity))
            reducers_by_bound.setdefault((identity, start, end), set()).add(reducer_id)
        # Identities that share their reducers and bounds share one condition too.
        identities_by_bound: dict[
            tuple[datetime | None, datetime | None, frozenset[UUID]],
            list[CustomerIdentity],
        ] = {}
        for (identity, start, end), reducer_ids in reducers_by_bound.items():
            identities_by_bound.setdefault(
                (start, end, frozenset(reducer_ids)), []
            ).append(identity)
        # One statement per group, which carries its index: a group may also match a
        # bucket pairing two of its identities, counted only by the group that asked
        # for that pair, within its own bounds.
        groups = list(identities_by_bound.items())
        group_of = {
            (reducer_id, identity): index
            for index, ((_, _, reducer_ids), identities) in enumerate(groups)
            for identity in identities
            for reducer_id in reducer_ids
        }
        statements = [
            select(
                literal(index),
                ReducerBucket.reducer_id,
                ReducerBucket.customer_id,
                ReducerBucket.external_customer_id,
                func.coalesce(func.sum(ReducerBucket.count), 0),
                func.coalesce(func.sum(ReducerBucket.sum), 0),
                func.min(ReducerBucket.min),
                func.max(ReducerBucket.max),
            )
            .where(
                ReducerBucket.organization_id == organization_id,
                ReducerBucket.reducer_id.in_(reducer_ids),
                ReducerBucket.sealed_at.is_(None),
                _is_among_customers(identities),
                ReducerBucket.bucket_start >= start if start is not None else true(),
                ReducerBucket.bucket_start < end if end is not None else true(),
            )
            .group_by(
                ReducerBucket.reducer_id,
                ReducerBucket.customer_id,
                ReducerBucket.external_customer_id,
            )
            for index, ((start, end, reducer_ids), identities) in enumerate(groups)
        ]
        result = await self.session.execute(
            statements[0] if len(statements) == 1 else union_all(*statements)
        )
        totals = {
            key: (count, total, minimum, maximum)
            for (
                index,
                reducer_id,
                customer_id,
                external_customer_id,
                count,
                total,
                minimum,
                maximum,
            ) in result
            for key in ((reducer_id, (customer_id, external_customer_id)),)
            if group_of.get(key) == index
        }
        return {
            identity: totals.get(identity, (0, 0, None, None)) for identity in before
        }

    async def get_customer_meter_totals(
        self,
        customer_meters: Sequence[tuple[Customer, UUID]],
        *,
        usage_closed_before: datetime,
    ) -> list[list[tuple[Any, ...]]]:
        """For each customer and meter id: the id, kind and aggregation of each of
        the meter's reducers, the customer's latest meter reset, the identity of the
        buckets, whether one of them starts at the reset, and their count, sum, min
        and max of every generation starting from it: one row per identity of the
        customer's usage buckets before `usage_closed_before`, and one of its credit
        buckets."""
        customer_meter = (
            func.unnest(
                bindparam(
                    "organization_ids",
                    [customer.organization_id for customer, _ in customer_meters],
                    type_=ARRAY(Uuid),
                ),
                bindparam(
                    "customer_ids",
                    [customer.id for customer, _ in customer_meters],
                    type_=ARRAY(Uuid),
                ),
                bindparam(
                    "external_customer_ids",
                    [customer.external_id for customer, _ in customer_meters],
                    type_=ARRAY(String),
                ),
                bindparam(
                    "meter_ids",
                    [meter_id for _, meter_id in customer_meters],
                    type_=ARRAY(Uuid),
                ),
            )
            .table_valued(
                column("organization_id", Uuid),
                column("customer_id", Uuid),
                column("external_customer_id", String),
                column("meter_id", Uuid),
                with_ordinality="ordinality",
            )
            .render_derived("customer_meter")
        )
        targets = (
            select(
                (customer_meter.c.ordinality - 1).label("index"),
                customer_meter.c.customer_id,
                customer_meter.c.external_customer_id,
                EventRepository.from_session(self.session)
                .get_latest_meter_reset_timestamp_statement(
                    customer_meter.c.organization_id,
                    customer_meter.c.customer_id,
                    customer_meter.c.meter_id,
                )
                .label("since"),
                Reducer.id.label("reducer_id"),
                Reducer.organization_id.label("reducer_organization_id"),
                Reducer.kind,
                Reducer.aggregation,
            )
            .select_from(customer_meter)
            .join(MeterReducer, MeterReducer.meter_id == customer_meter.c.meter_id)
            .join(Reducer, Reducer.id == MeterReducer.reducer_id)
            .cte("targets")
        )
        # One statement per kind and identity shape: Postgres won't serve an OR of
        # identities from the identity index here.
        statement = union_all(
            *(
                self._get_meter_reducer_totals_statement(
                    targets,
                    ReducerKind.usage,
                    by_customer_id,
                    by_external_id,
                    ReducerBucket.bucket_start < usage_closed_before,
                )
                for by_customer_id, by_external_id in (
                    (True, False),
                    (False, True),
                    (True, True),
                )
            ),
            self._get_meter_reducer_totals_statement(
                targets, ReducerKind.credit, True, False
            ),
        )
        rows: list[list[tuple[Any, ...]]] = [[] for _ in customer_meters]
        for index, *row in await self.session.execute(statement):
            rows[index].append(tuple(row))
        return rows

    def _get_meter_reducer_totals_statement(
        self,
        targets: CTE,
        kind: ReducerKind,
        by_customer_id: bool,
        by_external_id: bool,
        *clauses: ColumnElement[bool],
    ) -> Select[*tuple[Any, ...]]:
        # Lateral, the target's values bound the bucket index scan, `since` included.
        totals = (
            select(
                func.coalesce(
                    func.bool_or(ReducerBucket.bucket_start == targets.c.since), False
                ).label("split_at_reset"),
                func.coalesce(func.sum(ReducerBucket.count), 0).label("count"),
                func.coalesce(func.sum(ReducerBucket.sum), 0).label("sum"),
                func.min(ReducerBucket.min).label("min"),
                func.max(ReducerBucket.max).label("max"),
            )
            .where(
                ReducerBucket.organization_id == targets.c.reducer_organization_id,
                ReducerBucket.reducer_id == targets.c.reducer_id,
                ReducerBucket.bucket_start
                >= func.coalesce(
                    targets.c.since, literal_column("'-infinity'::timestamptz")
                ),
                ReducerBucket.customer_id == targets.c.customer_id
                if by_customer_id
                else ReducerBucket.customer_id.is_(None),
                ReducerBucket.external_customer_id == targets.c.external_customer_id
                if by_external_id
                else ReducerBucket.external_customer_id.is_(None),
                *clauses,
            )
            .lateral()
        )
        return (
            select(
                targets.c.index,
                targets.c.reducer_id,
                targets.c.kind,
                targets.c.aggregation,
                targets.c.since,
                targets.c.customer_id if by_customer_id else null().cast(Uuid),
                targets.c.external_customer_id
                if by_external_id
                else null().cast(String),
                totals.c.split_at_reset,
                totals.c.count,
                totals.c.sum,
                totals.c.min,
                totals.c.max,
            )
            .select_from(targets.join(totals, true()))
            .where(
                targets.c.kind == kind,
                targets.c.external_customer_id.is_not(None)
                if by_external_id
                else true(),
            )
        )

    async def get_last_synced_ends(
        self,
        organization_id: UUID,
        identities: Sequence[ReducerIdentity],
        *,
        since: datetime,
    ) -> dict[ReducerIdentity, datetime]:
        """End of each customer identity's latest bucket recomputed by sync on its
        reducer, among those starting from `since`. Identities without one are left
        out."""
        if not identities:
            return {}
        statement = (
            select(
                ReducerBucket.reducer_id,
                ReducerBucket.customer_id,
                ReducerBucket.external_customer_id,
                func.max(ReducerBucket.bucket_end),
            )
            .where(
                ReducerBucket.organization_id == organization_id,
                ReducerBucket.reducer_id.in_(
                    {reducer_id for reducer_id, _ in identities}
                ),
                _is_among_customers({identity for _, identity in identities}),
                ReducerBucket.bucket_start >= since,
                ReducerBucket.synced_at.is_not(None),
            )
            .group_by(
                ReducerBucket.reducer_id,
                ReducerBucket.customer_id,
                ReducerBucket.external_customer_id,
            )
        )
        result = await self.session.execute(statement)
        requested = set(identities)
        return {
            key: synced_end
            for reducer_id, customer_id, external_customer_id, synced_end in result
            for key in ((reducer_id, (customer_id, external_customer_id)),)
            if key in requested
        }

    async def get_synced_end_within(
        self,
        organization_id: UUID,
        reducer_id: UUID,
        customer_id: UUID | None,
        external_customer_id: str | None,
        bucket_start: datetime,
        bucket_end: datetime,
    ) -> datetime | None:
        """End of the customer identity's latest bucket recomputed by sync, among
        those starting within the slot."""
        statement = select(func.max(ReducerBucket.bucket_end)).where(
            ReducerBucket.organization_id == organization_id,
            ReducerBucket.reducer_id == reducer_id,
            _is_customer(ReducerBucket, customer_id, external_customer_id),
            ReducerBucket.bucket_start >= bucket_start,
            ReducerBucket.bucket_start < bucket_end,
            ReducerBucket.synced_at.is_not(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def get_database_now(self) -> datetime:
        """The start of the current transaction, on the database clock."""
        result = await self.session.execute(select(func.now()))
        return result.scalar_one()

    async def add_contributions(
        self,
        contributions: Sequence[
            tuple[UUID, int, Decimal, Decimal | None, Decimal | None]
        ],
    ) -> None:
        """Adds each (bucket id, count, total, minimum, maximum) to its bucket, in
        one statement."""
        if not contributions:
            return
        added = values(
            column("id", Uuid),
            column("count", BigInteger),
            column("sum", Numeric),
            column("min", Numeric),
            column("max", Numeric),
            name="added",
        ).data(list(contributions))
        await self.session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.id == added.c.id)
            .values(
                count=ReducerBucket.count + added.c.count,
                sum=ReducerBucket.sum + added.c.sum,
                # A column of NULLs only (count reducers) would be typed as text.
                min=func.least(ReducerBucket.min, cast(added.c.min, Numeric)),
                max=func.greatest(ReducerBucket.max, cast(added.c.max, Numeric)),
                modified_at=utc_now(),
            )
            .execution_options(synchronize_session=False)
        )

    async def insert_all(self, buckets: Sequence[dict[str, Any]]) -> None:
        if not buckets:
            return
        await self.session.execute(insert(ReducerBucket), buckets)

    async def mark_as_sealed(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        until: datetime,
        since: datetime | None = None,
        sealed_at: datetime,
    ) -> int:
        """Seals the identities' unsealed buckets ending by `until`, after `since`
        if given, and returns how many."""
        clauses = [ReducerBucket.bucket_end <= until]
        if since is not None:
            clauses.append(ReducerBucket.bucket_end > since)
        open_ids = (
            select(ReducerBucket.id)
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                _is_any_customer(identities),
                ReducerBucket.sealed_at.is_(None),
                *clauses,
            )
            .order_by(ReducerBucket.bucket_start)
            .with_for_update()
        )
        result = await self.session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.id.in_(open_ids))
            .values(sealed_at=sealed_at, modified_at=sealed_at)
            .returning(ReducerBucket.id)
        )
        return len(result.all())

    async def get_unbilled_totals(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        since: datetime | None,
        until: datetime,
    ) -> Sequence[tuple[UUID, int, Decimal, Decimal | None, Decimal | None]]:
        """id, count, sum, min and max of the identities' sealed, unbilled buckets
        within [since, until): those `mark_as_billed` marks."""
        result = await self.session.execute(
            select(
                ReducerBucket.id,
                ReducerBucket.count,
                ReducerBucket.sum,
                ReducerBucket.min,
                ReducerBucket.max,
            ).where(*self._get_unbilled_clauses(reducer, identities, since, until))
        )
        return result.tuples().all()

    async def get_pending_totals(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        start: datetime,
        end: datetime,
    ) -> Totals:
        """count, sum, min and max of the identities' buckets not billed yet,
        sealed or not, starting within [start, end)."""
        result = await self.session.execute(
            select(
                func.coalesce(func.sum(ReducerBucket.count), 0),
                func.coalesce(func.sum(ReducerBucket.sum), 0),
                func.min(ReducerBucket.min),
                func.max(ReducerBucket.max),
            ).where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                _is_any_customer(identities),
                ReducerBucket.billed_at.is_(None),
                ReducerBucket.bucket_start >= start,
                ReducerBucket.bucket_start < end,
            )
        )
        return result.tuples().one()

    async def mark_ids_as_billed(
        self, bucket_ids: Sequence[UUID], order_id: UUID, *, billed_at: datetime
    ) -> int:
        """Marks the buckets not billed yet as billed by the order, and returns
        how many it marked."""
        result = await self.session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.id.in_(bucket_ids), ReducerBucket.billed_at.is_(None))
            .values(billed_at=billed_at, order_id=order_id, modified_at=billed_at)
            .returning(ReducerBucket.id)
        )
        return len(result.all())

    async def mark_as_billed(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        order_id: UUID,
        *,
        since: datetime | None,
        until: datetime,
        billed_at: datetime,
    ) -> Sequence[tuple[UUID, int, Decimal, Decimal | None, Decimal | None]]:
        """Marks the identities' sealed, unbilled buckets within [since, until) as
        billed by the order, and returns their id, count, sum, min and max."""
        unbilled_ids = (
            select(ReducerBucket.id)
            .where(*self._get_unbilled_clauses(reducer, identities, since, until))
            .order_by(ReducerBucket.bucket_start)
            .with_for_update()
        )
        result = await self.session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.id.in_(unbilled_ids))
            .values(billed_at=billed_at, order_id=order_id, modified_at=billed_at)
            .returning(
                ReducerBucket.id,
                ReducerBucket.count,
                ReducerBucket.sum,
                ReducerBucket.min,
                ReducerBucket.max,
            )
        )
        return result.tuples().all()

    def _get_unbilled_clauses(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        since: datetime | None,
        until: datetime,
    ) -> list[ColumnElement[bool]]:
        clauses = [
            ReducerBucket.organization_id == reducer.organization_id,
            ReducerBucket.reducer_id == reducer.id,
            _is_any_customer(identities),
            ReducerBucket.sealed_at.is_not(None),
            ReducerBucket.billed_at.is_(None),
            ReducerBucket.bucket_end <= until,
        ]
        if since is not None:
            clauses.append(ReducerBucket.bucket_start >= since)
        return clauses

    def get_event_billed_by_other_order_clause(
        self,
        reducer: Reducer,
        order_id: UUID,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        bucket_size: timedelta,
    ) -> ColumnElement[bool]:
        """Whether the reducer billed the event, of one of `identities`, in an order
        other than `order_id`: the first generation still open at its ingestion
        holds it."""
        # One subquery per identity, bounded by the bucket size: Postgres won't
        # serve a correlated identity or an open-ended start from the identity index.
        return or_(
            false(),
            *(
                and_(
                    _is_customer(Event, customer_id, external_customer_id),
                    select(
                        and_(
                            ReducerBucket.billed_at.is_not(None),
                            ReducerBucket.order_id.is_distinct_from(order_id),
                        )
                    )
                    .where(
                        ReducerBucket.organization_id == reducer.organization_id,
                        ReducerBucket.reducer_id == reducer.id,
                        _is_customer(ReducerBucket, customer_id, external_customer_id),
                        ReducerBucket.bucket_start <= Event.timestamp,
                        ReducerBucket.bucket_start > Event.timestamp - bucket_size,
                        ReducerBucket.bucket_end > Event.timestamp,
                        or_(
                            ReducerBucket.sealed_at.is_(None),
                            ReducerBucket.sealed_at >= Event.ingested_at,
                        ),
                    )
                    .order_by(ReducerBucket.generation)
                    .limit(1)
                    .scalar_subquery()
                    .is_(True),
                )
                for customer_id, external_customer_id in identities
            ),
        )

    async def is_credit_billed(
        self,
        reducer: Reducer,
        customer: Customer,
        credit: Event,
        *,
        bucket_size: timedelta,
    ) -> bool:
        """Whether the credit reducer billed the credit event: the first
        generation still open at its ingestion holds it."""
        statement = (
            select(ReducerBucket.billed_at.is_not(None))
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                _is_customer(ReducerBucket, customer.id, None),
                ReducerBucket.bucket_start <= credit.timestamp,
                ReducerBucket.bucket_start > credit.timestamp - bucket_size,
                ReducerBucket.bucket_end > credit.timestamp,
                or_(
                    ReducerBucket.sealed_at.is_(None),
                    ReducerBucket.sealed_at >= credit.ingested_at,
                ),
            )
            .order_by(ReducerBucket.generation)
            .limit(1)
        )
        return bool((await self.session.execute(statement)).scalar_one_or_none())
