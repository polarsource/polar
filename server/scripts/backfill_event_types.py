import asyncio
import logging.config
from functools import wraps
from typing import Any
from uuid import UUID

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Event, EventType

cli = typer.Typer()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def run_backfill(
    batch_size: int = 1000,
    session: AsyncSession | None = None,
) -> None:
    """
    Backfill event_type_id for existing events.

    Processes events in batches, looking up or creating EventType records
    as needed (cached per batch), then updates events with their corresponding
    event_type_id. Safe to rerun as it only processes events without an event_type_id.
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
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    try:
        total_events = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(Event.event_type_id.is_(None))
            )
        ).scalar_one()

        if total_events == 0:
            typer.echo("No events to process")
            if engine is not None:
                await engine.dispose()
            raise typer.Exit(0)

        typer.echo(f"Found {total_events} events to backfill")

        event_type_cache: dict[tuple[str, UUID], UUID] = {}
        processed = 0

        with Progress() as progress:
            task = progress.add_task("[cyan]Processing events...", total=total_events)

            while True:
                events_result = await session.execute(
                    select(Event.id, Event.name, Event.organization_id)
                    .where(Event.event_type_id.is_(None))
                    .limit(batch_size)
                )
                events = list(events_result)

                if not events:
                    break

                unique_pairs_in_batch = list(
                    {(name, org_id) for _, name, org_id in events}
                )
                pairs_to_lookup = [
                    pair
                    for pair in unique_pairs_in_batch
                    if pair not in event_type_cache
                ]

                if pairs_to_lookup:
                    existing_result = await session.execute(
                        select(EventType.name, EventType.organization_id, EventType.id)
                        .where(EventType.deleted_at.is_(None))
                        .where(
                            func.row(EventType.name, EventType.organization_id).in_(
                                [
                                    func.row(name, org_id)
                                    for name, org_id in pairs_to_lookup
                                ]
                            )
                        )
                    )
                    for name, org_id, event_type_id in existing_result:
                        event_type_cache[(name, org_id)] = event_type_id

                    pairs_to_create = [
                        pair for pair in pairs_to_lookup if pair not in event_type_cache
                    ]

                    if pairs_to_create:
                        values = [
                            {
                                "name": name,
                                "label": name,
                                "organization_id": org_id,
                            }
                            for name, org_id in pairs_to_create
                        ]
                        await session.execute(
                            insert(EventType)
                            .values(values)
                            .on_conflict_do_nothing(
                                constraint="event_types_name_organization_id_key"
                            )
                        )
                        await session.flush()

                        created_result = await session.execute(
                            select(
                                EventType.name, EventType.organization_id, EventType.id
                            )
                            .where(EventType.deleted_at.is_(None))
                            .where(
                                func.row(EventType.name, EventType.organization_id).in_(
                                    [
                                        func.row(name, org_id)
                                        for name, org_id in pairs_to_create
                                    ]
                                )
                            )
                        )
                        for name, org_id, event_type_id in created_result:
                            event_type_cache[(name, org_id)] = event_type_id

                event_updates = [
                    {"id": event_id, "event_type_id": event_type_cache[(name, org_id)]}
                    for event_id, name, org_id in events
                ]

                for event_update in event_updates:
                    await session.execute(
                        update(Event)
                        .where(Event.id == event_update["id"])
                        .values(event_type_id=event_update["event_type_id"])
                    )

                await session.commit()

                processed += len(events)
                progress.update(task, advance=len(events))

        remaining_events = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(Event.event_type_id.is_(None))
            )
        ).scalar_one()

        typer.echo("\n---\n")
        typer.echo(f"Successfully backfilled {processed} events")
        typer.echo(f"Remaining events without event_type_id: {remaining_events}")
        typer.echo("\n---\n")

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


@cli.command()
@typer_async
async def backfill_event_types(
    batch_size: int = typer.Option(1000, help="Number of events to process per batch"),
) -> None:
    """
    Backfill event_type_id for existing events.
    """
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )

    await run_backfill(batch_size=batch_size)


if __name__ == "__main__":
    cli()
