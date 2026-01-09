import asyncio
import datetime
import logging.config
import uuid
from functools import wraps
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import and_, or_, select
from sqlalchemy.dialects.postgresql import insert

from polar.config import settings
from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.meter.repository import MeterRepository
from polar.models import Event, Meter, MeterEvent
from polar.models.event import EventSource

cli = typer.Typer()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


INSERT_CHUNK_SIZE = 1000


def _event_matches_meter(event: Event, meter: Meter) -> bool:
    if (
        event.source == EventSource.system
        and event.name in (SystemEvent.meter_credited, SystemEvent.meter_reset)
        and event.user_metadata.get("meter_id") == str(meter.id)
    ):
        return True

    return meter.filter.matches(event) and meter.aggregation.matches(event)


async def run_backfill(
    batch_size: int = 2000,
    session: AsyncSession | None = None,
    resume_org_id: uuid.UUID | None = None,
    resume_timestamp: datetime.datetime | None = None,
    resume_event_id: uuid.UUID | None = None,
) -> dict[str, int]:
    """
    Backfill meter_events table for all meters.

    Scans events by organization using cursor-based pagination (fast primary key scan),
    checks meter matching in Python, and uses on_conflict_do_nothing for idempotency.
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

        found_resume_org = resume_org_id is None

        with Progress() as progress:
            task = progress.add_task("[cyan]Backfilling meter events...", total=None)

            for org_id, org_meters in meters_by_org.items():
                if not found_resume_org:
                    if org_id == resume_org_id:
                        found_resume_org = True
                        last_timestamp = resume_timestamp
                        last_event_id = resume_event_id
                        org_inserted = 0
                    else:
                        continue
                else:
                    last_timestamp = None
                    last_event_id = None
                    org_inserted = 0

                meter_names = ", ".join(m.name for m in org_meters[:3])
                if len(org_meters) > 3:
                    meter_names += f" (+{len(org_meters) - 3} more)"

                progress.update(task, description=f"[cyan]Org {org_id}: {meter_names}")

                while True:
                    statement = (
                        select(Event)
                        .where(Event.organization_id == org_id)
                        .order_by(Event.timestamp.desc(), Event.id.desc())
                        .limit(batch_size)
                    )
                    if last_timestamp is not None and last_event_id is not None:
                        statement = statement.where(
                            or_(
                                Event.timestamp < last_timestamp,
                                and_(
                                    Event.timestamp == last_timestamp,
                                    Event.id < last_event_id,
                                ),
                            )
                        )

                    result = await session.execute(statement)
                    events = list(result.scalars().all())

                    if not events:
                        break

                    last_timestamp = events[-1].timestamp
                    last_event_id = events[-1].id

                    meter_event_rows = []
                    for event in events:
                        for meter in org_meters:
                            if _event_matches_meter(event, meter):
                                meter_event_rows.append(
                                    {
                                        "meter_id": meter.id,
                                        "event_id": event.id,
                                        "customer_id": event.customer_id,
                                        "external_customer_id": event.external_customer_id,
                                        "organization_id": event.organization_id,
                                        "ingested_at": event.ingested_at,
                                        "timestamp": event.timestamp,
                                    }
                                )

                    if meter_event_rows:
                        for i in range(0, len(meter_event_rows), INSERT_CHUNK_SIZE):
                            chunk = meter_event_rows[i : i + INSERT_CHUNK_SIZE]
                            await session.execute(
                                insert(MeterEvent)
                                .values(chunk)
                                .on_conflict_do_nothing()
                            )
                        await session.commit()
                        org_inserted += len(meter_event_rows)
                        total_inserted += len(meter_event_rows)

                    progress.update(
                        task,
                        description=f"[cyan]Org {org_id}: {org_inserted} meter_events",
                    )

                progress.update(
                    task,
                    description=f"[green]Org {org_id}: {org_inserted} meter_events [done]",
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
    batch_size: int = typer.Option(2000, help="Number of events to process per batch"),
    resume_org_id: str = typer.Option(None, help="Organization ID to resume from"),
    resume_timestamp: str = typer.Option(
        None, help="Timestamp to resume from (ISO format)"
    ),
    resume_event_id: str = typer.Option(None, help="Event ID to resume from"),
) -> None:
    """
    Backfill meter_events table for all meters.
    """
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )

    parsed_org_id = uuid.UUID(resume_org_id) if resume_org_id else None
    parsed_timestamp = (
        datetime.datetime.fromisoformat(resume_timestamp) if resume_timestamp else None
    )
    parsed_event_id = uuid.UUID(resume_event_id) if resume_event_id else None

    await run_backfill(
        batch_size=batch_size,
        resume_org_id=parsed_org_id,
        resume_timestamp=parsed_timestamp,
        resume_event_id=parsed_event_id,
    )


if __name__ == "__main__":
    cli()
