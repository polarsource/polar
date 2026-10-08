from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    Numeric,
    Select,
    cast,
    delete,
    func,
    literal,
    or_,
    select,
)
from sqlalchemy.orm import joinedload

from polar.kit.metadata import get_nested_metadata_attr
from polar.kit.repository import RepositoryBase
from polar.kit.repository.base import Options
from polar.meter.aggregation import PropertyAggregation
from polar.models import Customer, Event, Meter, MeterReducer, Reducer, ReducerBucket
from polar.models.event import EventSource

from .aggregation import Aggregate


class ReducerRepository(RepositoryBase[Reducer]):
    model = Reducer

    async def get_unsealed_aggregate(
        self,
        reducer: Reducer,
        customer: Customer,
        *,
        end: datetime,
        exclude_bucket: datetime | None,
    ) -> Aggregate:
        identity = ReducerBucket.customer_id == customer.id
        if customer.external_id is not None:
            identity = or_(
                identity, ReducerBucket.external_customer_id == customer.external_id
            )
        statement = select(
            func.coalesce(func.sum(ReducerBucket.count), 0),
            func.coalesce(func.sum(ReducerBucket.sum), 0),
            func.min(ReducerBucket.min),
            func.max(ReducerBucket.max),
        ).where(
            ReducerBucket.organization_id == reducer.organization_id,
            ReducerBucket.reducer_id == reducer.id,
            identity,
            ReducerBucket.sealed_at.is_(None),
            ReducerBucket.deleted_at.is_(None),
            ReducerBucket.bucket_start < end,
        )
        if exclude_bucket is not None:
            statement = statement.where(ReducerBucket.bucket_start != exclude_bucket)
        count, total, minimum, maximum = (await self.session.execute(statement)).one()
        return Aggregate(int(count), total, minimum, maximum)

    async def get_edge_aggregate(
        self,
        reducer: Reducer,
        customer: Customer,
        *,
        start: datetime,
        end: datetime,
    ) -> Aggregate:
        value: ColumnElement[Decimal | None] = literal(None, type_=Numeric)
        if isinstance(reducer.aggregation, PropertyAggregation):
            prop = reducer.aggregation.property
            if prop in Event._filterable_fields:
                _, attr = Event._filterable_fields[prop]
                value = cast(attr, Numeric)
            else:
                value = cast(get_nested_metadata_attr(Event, prop).astext, Numeric)
        statement = select(
            func.count(),
            func.coalesce(func.sum(value), 0),
            func.min(value),
            func.max(value),
        ).where(
            Event.organization_id == reducer.organization_id,
            Event.customer == customer,
            Event.source == EventSource.user,
            Event.timestamp >= start,
            Event.timestamp < end,
            reducer.filter.get_sql_clause(Event),
            reducer.aggregation.get_sql_clause(Event),
        )
        return Aggregate(*(await self.session.execute(statement)).one())

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

    async def get_active_by_id(self, id: UUID) -> Reducer | None:
        return await self.get_one_or_none(
            self.get_active_statement().where(Reducer.id == id)
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
