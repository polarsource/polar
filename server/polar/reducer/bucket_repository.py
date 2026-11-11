from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    ColumnElement,
    Numeric,
    Row,
    ScalarSelect,
    Select,
    String,
    Uuid,
    and_,
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
    union_all,
    update,
    values,
)
from sqlalchemy.dialects.postgresql import insert

from polar.event.repository import EventRepository
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

INGESTED_BEFORE_TIMESTAMP_MARGIN = timedelta(seconds=5)

# count, sum, min and max.
type Totals = tuple[Any, Any, Any, Any]


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
            _is_customer(model, customer_id, external_customer_id),
            reducer.filter.get_sql_clause(model),
            aggregation.get_sql_clause(model),
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
        reducer_id: UUID,
        before: Mapping[tuple[UUID | None, str | None], datetime | None],
    ) -> dict[tuple[UUID | None, str | None], Totals]:
        """count, sum, min and max of each identity's unsealed buckets, starting
        before the identity's datetime if given."""
        if not before:
            return {}
        statement = (
            select(
                ReducerBucket.customer_id,
                ReducerBucket.external_customer_id,
                func.coalesce(func.sum(ReducerBucket.count), 0),
                func.coalesce(func.sum(ReducerBucket.sum), 0),
                func.min(ReducerBucket.min),
                func.max(ReducerBucket.max),
            )
            .where(
                ReducerBucket.organization_id == organization_id,
                ReducerBucket.reducer_id == reducer_id,
                ReducerBucket.sealed_at.is_(None),
                or_(
                    *(
                        and_(
                            _is_customer(
                                ReducerBucket, customer_id, external_customer_id
                            ),
                            ReducerBucket.bucket_start < end
                            if end is not None
                            else true(),
                        )
                        for (customer_id, external_customer_id), end in before.items()
                    )
                ),
            )
            .group_by(ReducerBucket.customer_id, ReducerBucket.external_customer_id)
        )
        result = await self.session.execute(statement)
        totals = {
            (customer_id, external_customer_id): (count, total, minimum, maximum)
            for customer_id, external_customer_id, count, total, minimum, maximum in result
        }
        return {
            identity: totals.get(identity, (0, 0, None, None)) for identity in before
        }

    async def get_customer_meter_totals(
        self,
        customer: Customer,
        meter_id: UUID,
        *,
        usage_closed_before: datetime,
    ) -> Sequence[Row[*tuple[Any, ...]]]:
        """The id, kind and aggregation of each of the meter's reducers, the
        customer's latest meter reset, the identity of the buckets, whether one of
        them starts at the reset, and their count, sum, min and max of every
        generation starting from it: one row per identity of the customer's usage
        buckets before `usage_closed_before`, and one of its credit buckets."""
        reducers = (
            await self.session.execute(
                select(Reducer)
                .join(MeterReducer, MeterReducer.reducer_id == Reducer.id)
                .where(MeterReducer.meter_id == meter_id)
            )
        ).scalars()
        reducer_by_kind = {reducer.kind: reducer for reducer in reducers}
        usage_reducer = reducer_by_kind.get(ReducerKind.usage)
        credit_reducer = reducer_by_kind.get(ReducerKind.credit)
        if usage_reducer is None and credit_reducer is None:
            return []

        reset = (
            EventRepository.from_session(self.session)
            .get_meter_resets_statement(customer, meter_id)
            .with_only_columns(func.max(Event.timestamp).label("since"))
            .cte("reset")
        )
        # A scalar subquery runs once before the scans, so its value can bound
        # the bucket index scan; a join on the CTE can't.
        since = select(reset.c.since).scalar_subquery()
        statements: list[Select[*tuple[Any, ...]]] = []
        if usage_reducer is not None:
            statements.extend(
                self._get_meter_reducer_totals_statement(
                    usage_reducer,
                    since,
                    (customer_id, external_customer_id),
                    ReducerBucket.bucket_start < usage_closed_before,
                )
                for customer_id, external_customer_id in get_customer_identities(
                    customer
                )
            )
        if credit_reducer is not None:
            statements.append(
                self._get_meter_reducer_totals_statement(
                    credit_reducer, since, (customer.id, None)
                )
            )
        result = await self.session.execute(union_all(*statements))
        return result.all()

    def _get_meter_reducer_totals_statement(
        self,
        reducer: Reducer,
        since: ScalarSelect[datetime | None],
        identity: tuple[UUID | None, str | None],
        *clauses: ColumnElement[bool],
    ) -> Select[*tuple[Any, ...]]:
        # One statement per kind and identity: Postgres won't serve an OR of
        # identities from the identity index here.
        customer_id, external_customer_id = identity
        return (
            select(
                Reducer.id,
                Reducer.kind,
                Reducer.aggregation,
                since,
                literal(customer_id, Uuid),
                literal(external_customer_id, String),
                func.coalesce(func.bool_or(ReducerBucket.bucket_start == since), False),
                func.coalesce(func.sum(ReducerBucket.count), 0),
                func.coalesce(func.sum(ReducerBucket.sum), 0),
                func.min(ReducerBucket.min),
                func.max(ReducerBucket.max),
            )
            .outerjoin(
                ReducerBucket,
                and_(
                    ReducerBucket.organization_id == reducer.organization_id,
                    ReducerBucket.reducer_id == reducer.id,
                    ReducerBucket.bucket_start
                    >= func.coalesce(since, literal_column("'-infinity'::timestamptz")),
                    _is_customer(ReducerBucket, customer_id, external_customer_id),
                    *clauses,
                ),
            )
            .where(Reducer.id == reducer.id)
            .group_by(Reducer.id)
        )

    async def get_last_synced_ends(
        self,
        organization_id: UUID,
        reducer_id: UUID,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        since: datetime,
    ) -> dict[tuple[UUID | None, str | None], datetime]:
        """End of each customer identity's latest bucket recomputed by sync, among
        those starting from `since`. Identities without one are left out."""
        if not identities:
            return {}
        statement = (
            select(
                ReducerBucket.customer_id,
                ReducerBucket.external_customer_id,
                func.max(ReducerBucket.bucket_end),
            )
            .where(
                ReducerBucket.organization_id == organization_id,
                ReducerBucket.reducer_id == reducer_id,
                _is_any_customer(identities),
                ReducerBucket.bucket_start >= since,
                ReducerBucket.synced_at.is_not(None),
            )
            .group_by(ReducerBucket.customer_id, ReducerBucket.external_customer_id)
        )
        result = await self.session.execute(statement)
        return {
            (customer_id, external_customer_id): synced_end
            for customer_id, external_customer_id, synced_end in result
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

    async def mark_as_billed(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        order_id: UUID,
        *,
        since: datetime | None,
        until: datetime,
        billed_at: datetime,
    ) -> Sequence[tuple[int, Decimal, Decimal | None, Decimal | None]]:
        """Marks the identities' sealed, unbilled buckets within [since, until] as
        billed by the order, and returns their count, sum, min and max."""
        clauses = [ReducerBucket.bucket_end <= until]
        if since is not None:
            clauses.append(ReducerBucket.bucket_start >= since)
        unbilled_ids = (
            select(ReducerBucket.id)
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                _is_any_customer(identities),
                ReducerBucket.sealed_at.is_not(None),
                ReducerBucket.billed_at.is_(None),
                *clauses,
            )
            .order_by(ReducerBucket.bucket_start)
            .with_for_update()
        )
        result = await self.session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.id.in_(unbilled_ids))
            .values(billed_at=billed_at, order_id=order_id, modified_at=billed_at)
            .returning(
                ReducerBucket.count,
                ReducerBucket.sum,
                ReducerBucket.min,
                ReducerBucket.max,
            )
        )
        return result.tuples().all()

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
