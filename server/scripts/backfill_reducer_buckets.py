from datetime import UTC, datetime, timedelta
from decimal import Decimal

import typer
from sqlalchemy import ColumnElement, Numeric, cast, func, literal, select
from sqlalchemy.dialects.postgresql import insert

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.metadata import get_nested_metadata_attr
from polar.kit.utils import utc_now
from polar.meter.aggregation import PropertyAggregation, UniqueAggregation
from polar.models import Event, Reducer, ReducerBucket
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
    return floor_bucket(start), min(rounded_end, floor_bucket(utc_now() - BUCKET_SIZE))


async def backfill_bucket(
    session: AsyncSession, reducer: Reducer, start: datetime, end: datetime
) -> int:
    aggregation = reducer.aggregation
    value: ColumnElement[Decimal | None] = literal(None, type_=Numeric)
    if isinstance(aggregation, PropertyAggregation):
        if aggregation.property in Event._filterable_fields:
            _, attr = Event._filterable_fields[aggregation.property]
            value = cast(attr, Numeric)
        else:
            value = cast(
                get_nested_metadata_attr(Event, aggregation.property).astext,
                Numeric,
            )

    insert_statement = insert(ReducerBucket).from_select(
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
        ],
        select(
            func.gen_random_uuid(),
            literal(reducer.organization_id),
            literal(reducer.id),
            Event.customer_id,
            Event.external_customer_id,
            literal(start),
            func.count(),
            func.coalesce(func.sum(value), 0),
            func.min(value),
            func.max(value),
            literal(0),
        )
        .where(
            Event.organization_id == reducer.organization_id,
            Event.timestamp >= start,
            Event.timestamp < end,
            reducer.filter.get_sql_clause(Event),
            aggregation.get_sql_clause(Event),
        )
        .group_by(Event.customer_id, Event.external_customer_id),
    )
    statement = insert_statement.on_conflict_do_update(
        constraint="reducer_buckets_identity_generation_key",
        set_={
            "count": insert_statement.excluded.count,
            "sum": insert_statement.excluded.sum,
            "min": insert_statement.excluded.min,
            "max": insert_statement.excluded.max,
        },
        where=ReducerBucket.cold_at.is_(None),
    ).returning(ReducerBucket.id)
    return len((await session.scalars(statement)).all())


@cli.command()
@typer_async
async def backfill(start: datetime, end: datetime) -> None:
    """Backfill event-time buckets; expand START/END to full buckets (naive = UTC).

    Excludes the latest five minutes. Recomputes uncold buckets; never seals them.
    """
    start, end = bucket_range(start, end)
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    total = 0
    try:
        async with sessionmaker() as session:
            reducers = (
                await session.scalars(
                    select(Reducer).where(Reducer.deleted_at.is_(None))
                )
            ).all()
        typer.echo(f"Backfilling [{start.isoformat()}, {end.isoformat()})")
        for reducer in reducers:
            if isinstance(reducer.aggregation, UniqueAggregation):
                typer.echo(f"Skipping unique reducer {reducer.id}")
                continue
            bucket_start = start
            while bucket_start < end:
                bucket_end = bucket_start + BUCKET_SIZE
                async with sessionmaker.begin() as session:
                    total += await backfill_bucket(
                        session, reducer, bucket_start, bucket_end
                    )
                bucket_start = bucket_end
        typer.echo(f"Backfilled {total} reducer buckets.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
