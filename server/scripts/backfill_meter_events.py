import asyncio
import datetime
import logging.config
import uuid
from collections.abc import Iterator
from functools import wraps
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import CursorResult, literal, or_, select
from sqlalchemy.dialects.postgresql import insert

from polar.config import settings
from polar.event.repository import EventRepository
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.meter.repository import MeterRepository
from polar.models import Event, Meter, MeterEvent

cli = typer.Typer()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


DEFAULT_CHUNK_MINUTES = 10


async def get_org_timestamp_range(
    session: AsyncSession, org_id: uuid.UUID
) -> tuple[datetime.datetime, datetime.datetime] | None:
    min_result = await session.execute(
        select(Event.timestamp)
        .where(Event.organization_id == org_id)
        .order_by(Event.timestamp.asc())
        .limit(1)
    )
    min_ts = min_result.scalar_one_or_none()

    max_result = await session.execute(
        select(Event.timestamp)
        .where(Event.organization_id == org_id)
        .order_by(Event.timestamp.desc())
        .limit(1)
    )
    max_ts = max_result.scalar_one_or_none()

    if min_ts and max_ts:
        return min_ts, max_ts
    return None


def generate_time_chunks(
    start: datetime.datetime,
    end: datetime.datetime,
    chunk_minutes: int,
) -> Iterator[tuple[datetime.datetime, datetime.datetime]]:
    chunk_duration = datetime.timedelta(minutes=chunk_minutes)
    current = start
    while current <= end:
        chunk_end = current + chunk_duration
        yield current, chunk_end
        current = chunk_end


async def run_backfill(
    chunk_minutes: int = DEFAULT_CHUNK_MINUTES,
    session: AsyncSession | None = None,
    resume_meter_id: uuid.UUID | None = None,
) -> dict[str, int]:
    """
    Backfill meter_events table for all meters.

    Uses time-based chunking with SQL filtering for efficient processing of large event sets.
    Each chunk processes a bounded time window, ensuring queries complete within timeout.
    """
    engine = None
    own_session = False

    if session is None:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.script",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=300,
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    total_inserted = 0

    try:
        meter_repository = MeterRepository.from_session(session)
        event_repository = EventRepository.from_session(session)

        meters = await meter_repository.get_all(meter_repository.get_base_statement())

        if not meters:
            typer.echo("No meters to process")
            return {"total_inserted": 0}

        meters_by_org: dict[uuid.UUID, list[Meter]] = {}
        for meter in meters:
            meters_by_org.setdefault(meter.organization_id, []).append(meter)

        typer.echo(
            f"Found {len(meters)} meters across {len(meters_by_org)} organizations"
        )

        found_resume_meter = resume_meter_id is None
        org_ts_ranges: dict[uuid.UUID, tuple[datetime.datetime, datetime.datetime]] = {}

        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Backfilling meter events...", total=len(meters)
            )

            for meter_idx, meter in enumerate(meters):
                if not found_resume_meter:
                    if meter.id == resume_meter_id:
                        found_resume_meter = True
                    else:
                        progress.update(task, advance=1)
                        continue

                if meter.organization_id not in org_ts_ranges:
                    ts_range = await get_org_timestamp_range(
                        session, meter.organization_id
                    )
                    if ts_range:
                        org_ts_ranges[meter.organization_id] = ts_range

                ts_range = org_ts_ranges.get(meter.organization_id)
                if not ts_range:
                    progress.update(task, advance=1)
                    continue

                min_ts, max_ts = ts_range
                meter_clause = event_repository.get_meter_clause(meter)
                system_clause = event_repository.get_meter_system_clause(meter)
                meter_inserted = 0

                for chunk_start, chunk_end in generate_time_chunks(
                    min_ts, max_ts, chunk_minutes
                ):
                    progress.update(
                        task,
                        description=(
                            f"[cyan]Meter {meter_idx + 1}/{len(meters)}: {meter.name} "
                            f"({chunk_start.date()})"
                        ),
                    )

                    insert_stmt = (
                        insert(MeterEvent)
                        .from_select(
                            [
                                "meter_id",
                                "event_id",
                                "customer_id",
                                "external_customer_id",
                                "organization_id",
                                "ingested_at",
                                "timestamp",
                            ],
                            select(
                                literal(meter.id).label("meter_id"),
                                Event.id,
                                Event.customer_id,
                                Event.external_customer_id,
                                Event.organization_id,
                                Event.ingested_at,
                                Event.timestamp,
                            ).where(
                                Event.organization_id == meter.organization_id,
                                Event.timestamp >= chunk_start,
                                Event.timestamp < chunk_end,
                                or_(meter_clause, system_clause),
                            ),
                        )
                        .on_conflict_do_nothing()
                    )

                    cursor_result = await session.execute(insert_stmt)
                    await session.commit()
                    assert isinstance(cursor_result, CursorResult)
                    inserted_count = (
                        cursor_result.rowcount if cursor_result.rowcount >= 0 else 0
                    )
                    meter_inserted += inserted_count
                    total_inserted += inserted_count

                progress.update(
                    task,
                    description=(
                        f"[green]Meter {meter_idx + 1}/{len(meters)}: {meter.name} "
                        f"({meter_inserted} inserted)"
                    ),
                    advance=1,
                )

        typer.echo(f"\nTotal meter_events inserted: {total_inserted}")
        return {"total_inserted": total_inserted}

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


@cli.command()
@typer_async
async def backfill_meter_events(
    chunk_minutes: int = typer.Option(
        DEFAULT_CHUNK_MINUTES,
        help="Size of time chunks in minutes (smaller = slower but safer for high-volume orgs)",
    ),
    resume_meter_id: str = typer.Option(None, help="Meter ID to resume from"),
) -> None:
    """
    Backfill meter_events table for all meters.

    Uses time-based chunking to process events in bounded windows,
    ensuring queries complete within timeout even for high-volume organizations.
    """
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )

    parsed_meter_id = uuid.UUID(resume_meter_id) if resume_meter_id else None

    await run_backfill(
        chunk_minutes=chunk_minutes,
        resume_meter_id=parsed_meter_id,
    )


if __name__ == "__main__":
    cli()
