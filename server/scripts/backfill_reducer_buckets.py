from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import typer
from sqlalchemy import (
    ColumnElement,
    CursorResult,
    Numeric,
    ScalarSelect,
    cast,
    delete,
    func,
    insert,
    literal,
    or_,
    select,
)

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.metadata import get_nested_metadata_attr
from polar.kit.utils import utc_now
from polar.meter.aggregation import PropertyAggregation, UniqueAggregation
from polar.models import (
    BillingEntry,
    Customer,
    Event,
    MeterReducer,
    Order,
    OrderItem,
    ProductPrice,
    Reducer,
    ReducerBucket,
)
from polar.models.billing_entry import BillingEntryType
from polar.models.event import EventSource
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()
BUCKET_SIZE = timedelta(minutes=5)


def floor_bucket(value: datetime) -> datetime:
    return value.replace(minute=value.minute // 5 * 5, second=0, microsecond=0)


def bucket_range(start: datetime, end: datetime) -> tuple[datetime, datetime]:
    start = start.replace(tzinfo=UTC) if start.tzinfo is None else start.astimezone(UTC)
    end = end.replace(tzinfo=UTC) if end.tzinfo is None else end.astimezone(UTC)
    if start >= end:
        raise typer.BadParameter("start must be before end")
    rounded_end = floor_bucket(end)
    if rounded_end < end:
        rounded_end += BUCKET_SIZE
    return floor_bucket(start), min(
        rounded_end, floor_bucket(utc_now() - timedelta(minutes=10))
    )


async def get_reducers(
    session: AsyncSession, *, organization_id: UUID | None, meter_id: UUID | None
) -> Sequence[Reducer]:
    statement = select(Reducer).where(Reducer.deleted_at.is_(None))
    if organization_id is not None:
        statement = statement.where(Reducer.organization_id == organization_id)
    if meter_id is not None:
        statement = statement.join(MeterReducer).where(
            MeterReducer.meter_id == meter_id
        )
    return (await session.scalars(statement)).all()


def select_external_customer_id(
    reducer: Reducer, customer_id: UUID
) -> ScalarSelect[str | None]:
    return (
        select(Customer.external_id)
        .where(
            Customer.id == customer_id,
            Customer.organization_id == reducer.organization_id,
        )
        .scalar_subquery()
    )


async def delete_bucket_rows(
    session: AsyncSession,
    reducer: Reducer,
    bucket_start: datetime,
    *,
    customer_id: UUID | None = None,
) -> None:
    statement = delete(ReducerBucket).where(
        ReducerBucket.organization_id == reducer.organization_id,
        ReducerBucket.reducer_id == reducer.id,
        ReducerBucket.bucket_start == bucket_start,
    )
    if customer_id is not None:
        statement = statement.where(
            or_(
                ReducerBucket.customer_id == customer_id,
                ReducerBucket.external_customer_id
                == select_external_customer_id(reducer, customer_id),
            )
        )
    await session.execute(statement)


async def backfill_bucket(
    session: AsyncSession,
    reducer: Reducer,
    start: datetime,
    end: datetime,
    *,
    customer_id: UUID | None = None,
) -> int:
    value: ColumnElement[Decimal | None] = literal(None, type_=Numeric)
    if isinstance(reducer.aggregation, PropertyAggregation):
        prop = reducer.aggregation.property
        if prop in Event._filterable_fields:
            _, attr = Event._filterable_fields[prop]
            value = cast(attr, Numeric)
        else:
            value = cast(get_nested_metadata_attr(Event, prop).astext, Numeric)

    # Which events got billed, and on what order
    billing_entries = (
        select(
            BillingEntry.event_id,
            Order.id.label("order_id"),
            Order.created_at.label("sealed_at"),
        )
        .join(ProductPrice, ProductPrice.id == BillingEntry.product_price_id)
        .join(MeterReducer, MeterReducer.meter_id == ProductPrice.__table__.c.meter_id)
        .outerjoin(OrderItem, OrderItem.id == BillingEntry.order_item_id)
        .outerjoin(Order, Order.id == OrderItem.order_id)
        .where(
            MeterReducer.reducer_id == reducer.id,
            BillingEntry.type == BillingEntryType.metered,
            BillingEntry.deleted_at.is_(None),
        )
        .subquery()
    )
    is_billed = billing_entries.c.event_id.is_not(None)

    # Aggregate events for a bucket per customer and order (non-associated orders are aggregated together)
    generations = (
        select(
            Event.customer_id,
            Event.external_customer_id,
            billing_entries.c.order_id,
            billing_entries.c.sealed_at,
            func.count().label("count"),
            func.coalesce(func.sum(value), 0).label("sum"),
            func.min(value).label("min"),
            func.max(value).label("max"),
        )
        .select_from(Event)
        .outerjoin(billing_entries, billing_entries.c.event_id == Event.id)
        .where(
            Event.organization_id == reducer.organization_id,
            Event.source == EventSource.user,
            Event.timestamp >= start,
            Event.timestamp < end,
            reducer.aggregation.get_sql_clause(Event),
            or_(is_billed, reducer.filter.get_sql_clause(Event)),
        )
        .group_by(
            Event.customer_id,
            Event.external_customer_id,
            billing_entries.c.order_id,
            billing_entries.c.sealed_at,
        )
    )
    if customer_id is not None:
        generations = generations.where(
            or_(
                Event.customer_id == customer_id,
                Event.external_customer_id
                == select_external_customer_id(reducer, customer_id),
            )
        )
    generations_cte = generations.cte("generations")

    # Insert the aggregated buckets and set generation to row_number()
    statement = insert(ReducerBucket).from_select(
        [
            "id",
            "organization_id",
            "reducer_id",
            "customer_id",
            "external_customer_id",
            "bucket_start",
            "count",
            "sum",
            "min",
            "max",
            "generation",
            "sealed_at",
        ],
        select(
            func.gen_random_uuid(),
            literal(reducer.organization_id),
            literal(reducer.id),
            generations_cte.c.customer_id,
            generations_cte.c.external_customer_id,
            literal(start),
            generations_cte.c.count,
            generations_cte.c.sum,
            generations_cte.c.min,
            generations_cte.c.max,
            func.row_number().over(
                partition_by=(
                    generations_cte.c.customer_id,
                    generations_cte.c.external_customer_id,
                ),
                order_by=(
                    generations_cte.c.sealed_at.asc().nulls_last(),
                    generations_cte.c.order_id.asc().nulls_last(),
                ),
            ),
            generations_cte.c.sealed_at,
        ),
    )

    # Clear existing reducer_bucket for start/end time
    await delete_bucket_rows(session, reducer, start, customer_id=customer_id)

    # Write new value
    result: CursorResult[Any] = await session.execute(statement)  # type: ignore[assignment]
    return result.rowcount


@cli.command()
@typer_async
async def backfill(
    start: datetime,
    end: datetime,
    organization_id: UUID | None = None,
    meter_id: UUID | None = None,
    customer_id: UUID | None = None,
) -> None:
    """Rebuild usage and billing buckets, excluding the latest ten minutes.

    Expands START/END to full buckets; naive timestamps are UTC.
    Replaces all generations in the selected scope, including sealed ones.
    """
    start, end = bucket_range(start, end)
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    rows_written = 0
    try:
        async with sessionmaker() as session:
            reducers = await get_reducers(
                session, organization_id=organization_id, meter_id=meter_id
            )
        typer.echo(f"Backfilling [{start.isoformat()}, {end.isoformat()})")
        for reducer in reducers:
            if isinstance(reducer.aggregation, UniqueAggregation):
                typer.echo(f"Skipping unique reducer {reducer.id}")
                continue
            bucket_start = start
            while bucket_start < end:
                bucket_end = bucket_start + BUCKET_SIZE
                async with sessionmaker.begin() as session:
                    rows_written += await backfill_bucket(
                        session,
                        reducer,
                        bucket_start,
                        bucket_end,
                        customer_id=customer_id,
                    )
                bucket_start = bucket_end
        typer.echo(f"Wrote {rows_written} reducer bucket rows.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
