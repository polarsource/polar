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

    This script:
    1. Finds all unique event names per organization
    2. Creates EventType records for each unique (name, organization_id) pair
    3. Updates all events with their corresponding event_type_id
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

        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Backfilling event groups...", total=total_events
            )

            typer.echo(
                "Step 1: Creating event groups for unique (name, organization_id) pairs..."
            )
            unique_names_result = await session.execute(
                select(Event.name, Event.organization_id)
                .where(Event.event_type_id.is_(None))
                .distinct()
            )
            unique_pairs = [(row[0], row[1]) for row in unique_names_result]
            typer.echo(
                f"Found {len(unique_pairs)} unique event name/organization pairs"
            )

            event_type_map: dict[tuple[str, UUID], UUID] = {}

            for name, organization_id in unique_pairs:
                existing_group_result = await session.execute(
                    select(EventType.id).where(
                        EventType.name == name,
                        EventType.organization_id == organization_id,
                        EventType.deleted_at.is_(None),
                    )
                )
                existing_group = existing_group_result.scalar_one_or_none()

                if existing_group:
                    event_type_map[(name, organization_id)] = existing_group
                else:
                    insert_result = await session.execute(
                        insert(EventType)
                        .values(
                            name=name,
                            label=name,
                            organization_id=organization_id,
                        )
                        .on_conflict_do_nothing(
                            constraint="event_types_name_organization_id_key"
                        )
                        .returning(EventType.id)
                    )
                    inserted_id = insert_result.scalar_one_or_none()

                    if inserted_id:
                        event_type_map[(name, organization_id)] = inserted_id
                    else:
                        retry_result = await session.execute(
                            select(EventType.id).where(
                                EventType.name == name,
                                EventType.organization_id == organization_id,
                                EventType.deleted_at.is_(None),
                            )
                        )
                        event_type_map[(name, organization_id)] = (
                            retry_result.scalar_one()
                        )

            await session.commit()
            typer.echo(f"Created/found {len(event_type_map)} event groups")

            typer.echo("Step 2: Updating events with event_type_id...")
            processed = 0

            for (name, organization_id), event_type_id in event_type_map.items():
                offset = 0
                while True:
                    event_ids_result = await session.execute(
                        select(Event.id)
                        .where(
                            Event.name == name,
                            Event.organization_id == organization_id,
                            Event.event_type_id.is_(None),
                        )
                        .limit(batch_size)
                        .offset(offset)
                    )
                    event_ids = [row[0] for row in event_ids_result]

                    if not event_ids:
                        break

                    await session.execute(
                        update(Event)
                        .where(Event.id.in_(event_ids))
                        .values(event_type_id=event_type_id)
                    )
                    await session.commit()

                    processed += len(event_ids)
                    progress.update(task, advance=len(event_ids))
                    offset += batch_size

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
