from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    Row,
    Select,
    and_,
    delete,
    func,
    literal,
    null,
    or_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import joinedload

from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import RepositoryBase
from polar.kit.repository.base import Options
from polar.kit.utils import utc_now
from polar.meter.aggregation import PropertyAggregation
from polar.models import Event, Meter, MeterReducer, Reducer, ReducerBucket
from polar.models.event import EventSource

from .redis_store import get_reducer_bucket_key


class ReducerRepository(RepositoryBase[Reducer]):
    model = Reducer

    async def get_meter_for_update(self, meter_id: UUID) -> Meter:
        statement = (
            select(Meter)
            .where(Meter.id == meter_id)
            .options(joinedload(Meter.organization))
            .with_for_update(of=Meter)
            .execution_options(populate_existing=True)
        )
        return (await self.session.execute(statement)).scalar_one()

    async def get_by_meter_id(self, meter_id: UUID) -> Reducer | None:
        statement = (
            self.get_base_statement()
            .join(MeterReducer)
            .where(MeterReducer.meter_id == meter_id)
        )
        return await self.get_one_or_none(statement)

    async def get_meters_without_reducers(self, *, limit: int) -> Sequence[Meter]:
        statement = (
            select(Meter)
            .where(
                Meter.deleted_at.is_(None),
                ~select(MeterReducer.meter_id)
                .where(MeterReducer.meter_id == Meter.id)
                .exists(),
            )
            .order_by(Meter.id)
            .limit(limit)
        )
        return (await self.session.scalars(statement)).all()

    async def delete_without_meters(self, *, limit: int) -> int:
        orphaned_ids = (
            select(Reducer.id)
            .where(
                ~select(MeterReducer.reducer_id)
                .join(Meter, Meter.id == MeterReducer.meter_id)
                .where(
                    MeterReducer.reducer_id == Reducer.id,
                    Meter.deleted_at.is_(None),
                )
                .exists()
            )
            .order_by(Reducer.id)
            .limit(limit)
        )
        statement = (
            delete(Reducer).where(Reducer.id.in_(orphaned_ids)).returning(Reducer.id)
        )
        return len((await self.session.scalars(statement)).all())

    def get_active_statement(self) -> Select[tuple[Reducer]]:
        """Reducers used by at least one active meter."""
        active_reducer_ids = (
            select(MeterReducer.reducer_id)
            .join(MeterReducer.meter)
            .where(Meter.archived_at.is_(None), Meter.deleted_at.is_(None))
        )
        return self.get_base_statement().where(Reducer.id.in_(active_reducer_ids))

    async def get_active_by_id(
        self, id: UUID, *, options: Options = ()
    ) -> Reducer | None:
        return await self.get_one_or_none(
            self.get_active_statement().where(Reducer.id == id).options(*options)
        )

    async def get_all_active_by_organization(
        self, organization_id: UUID, *, options: Options = ()
    ) -> Sequence[Reducer]:
        """Reducers of the organization used by at least one active meter."""
        statement = (
            self.get_active_statement()
            .where(Reducer.organization_id == organization_id)
            .options(*options)
        )
        return await self.get_all(statement)


def _is_customer(
    model: type[Event | ReducerBucket],
    customer_id: UUID | None,
    external_customer_id: str | None,
) -> ColumnElement[bool]:
    return and_(
        model.customer_id.is_not_distinct_from(customer_id),
        model.external_customer_id.is_not_distinct_from(external_customer_id),
    )


class ReducerBucketRepository(RepositoryBase[ReducerBucket]):
    model = ReducerBucket

    async def lock_buckets(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> None:
        """Locks the reducer's buckets of the customer identity starting at
        `bucket_start` exclusively until the transaction ends."""
        await pg_advisory_xact_lock(
            self.session,
            "reducer_bucket.buckets",
            get_reducer_bucket_key(
                reducer.id, bucket_start, customer_id, external_customer_id
            ),
        )

    async def aggregate_events(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        bucket_end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> Row[Any]:
        """count, sum, min and max of the customer identity's user events for the
        reducer in the range, ingested after its latest sealed bucket."""
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
            value = aggregation.get_sql_value(Event)
            statistics = (
                func.coalesce(func.sum(value), 0),
                func.min(value),
                func.max(value),
            )
        else:
            statistics = (literal(0), null(), null())
        statement = select(
            func.count().label("count"),
            statistics[0].label("sum"),
            statistics[1].label("min"),
            statistics[2].label("max"),
        ).where(
            Event.organization_id == reducer.organization_id,
            Event.source == EventSource.user,
            Event.timestamp >= bucket_start,
            Event.timestamp < bucket_end,
            _is_customer(Event, customer_id, external_customer_id),
            reducer.filter.get_sql_clause(Event),
            aggregation.get_sql_clause(Event),
            or_(sealed_at.is_(None), Event.ingested_at > sealed_at),
        )
        result = await self.session.execute(statement)
        return result.one()

    async def get_all_starting_within(
        self,
        reducer: Reducer,
        start: datetime,
        end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> Sequence[ReducerBucket]:
        statement = self.get_base_statement().where(
            ReducerBucket.organization_id == reducer.organization_id,
            ReducerBucket.reducer_id == reducer.id,
            ReducerBucket.bucket_start >= start,
            ReducerBucket.bucket_start < end,
            _is_customer(ReducerBucket, customer_id, external_customer_id),
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

    async def get_unsealed_totals(
        self,
        organization_id: UUID,
        reducer_id: UUID,
        identities: Sequence[tuple[UUID | None, str | None]],
    ) -> Row[Any]:
        """count, sum, min and max of the identities' usage not billed yet."""
        statement = select(
            func.coalesce(func.sum(ReducerBucket.count), 0).label("count"),
            func.coalesce(func.sum(ReducerBucket.sum), 0).label("sum"),
            func.min(ReducerBucket.min).label("min"),
            func.max(ReducerBucket.max).label("max"),
        ).where(
            ReducerBucket.organization_id == organization_id,
            ReducerBucket.reducer_id == reducer_id,
            ReducerBucket.sealed_at.is_(None),
            or_(
                *(
                    _is_customer(ReducerBucket, customer_id, external_customer_id)
                    for customer_id, external_customer_id in identities
                )
            ),
        )
        result = await self.session.execute(statement)
        return result.one()

    async def add_contribution(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        bucket_end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
        *,
        count: int,
        total: Decimal = Decimal(0),
        minimum: Decimal | None = None,
        maximum: Decimal | None = None,
    ) -> None:
        """Adds to the customer identity's latest bucket, or to the next generation
        once it's sealed."""
        latest = await self.get_latest_for_update(
            reducer, bucket_start, customer_id, external_customer_id
        )
        if latest is not None and latest.sealed_at is None:
            await self.session.execute(
                update(ReducerBucket)
                .where(ReducerBucket.id == latest.id)
                .values(
                    count=ReducerBucket.count + count,
                    sum=ReducerBucket.sum + total,
                    min=func.least(ReducerBucket.min, minimum),
                    max=func.greatest(ReducerBucket.max, maximum),
                    modified_at=utc_now(),
                )
                .execution_options(synchronize_session=False)
            )
            return
        await self.session.execute(
            insert(ReducerBucket).values(
                organization_id=reducer.organization_id,
                reducer_id=reducer.id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                bucket_start=bucket_start,
                bucket_end=bucket_end,
                count=count,
                sum=total,
                min=minimum,
                max=maximum,
                generation=1 if latest is None else latest.generation + 1,
            )
        )

    async def seal(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        start: datetime,
        end: datetime,
        sealed_at: datetime,
    ) -> Sequence[tuple[int, Decimal, Decimal | None, Decimal | None]]:
        open_ids = (
            select(ReducerBucket.id)
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                or_(
                    *(
                        and_(
                            ReducerBucket.customer_id == customer_id,
                            ReducerBucket.external_customer_id == external_customer_id,
                        )
                        for customer_id, external_customer_id in identities
                    )
                ),
                ReducerBucket.sealed_at.is_(None),
                ReducerBucket.bucket_end > start,
                ReducerBucket.bucket_end <= end,
            )
            .order_by(ReducerBucket.bucket_start)
            .with_for_update()
        )
        result = await self.session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.id.in_(open_ids))
            .values(sealed_at=sealed_at, modified_at=sealed_at)
            .returning(
                ReducerBucket.count,
                ReducerBucket.sum,
                ReducerBucket.min,
                ReducerBucket.max,
            )
        )
        return result.tuples().all()
