import asyncio
import logging.config
from functools import wraps
from typing import Any
from uuid import UUID

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import aliased

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Event, EventClosure

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
    Backfill root_id and event_closure table for existing events.

    This script processes events level by level:
    1. Sets root_id for root events (no parent)
    2. Creates self-referencing closure entries for roots
    3. Processes children iteratively, setting root_id and closure entries
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
            await session.execute(select(func.count()).select_from(Event))
        ).scalar_one()

        if total_events == 0:
            typer.echo("No events to process")
            if engine is not None:
                await engine.dispose()
            raise typer.Exit(0)

        typer.echo(f"Found {total_events} events to backfill")

        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Backfilling event closure data...", total=total_events
            )

            processed = 0

            typer.echo("Step 1: Processing root events (no parent)...")
            root_count_result = await session.execute(
                select(func.count())
                .select_from(Event)
                .outerjoin(EventClosure, EventClosure.descendant_id == Event.id)
                .where(
                    Event.parent_id.is_(None),
                    or_(Event.root_id.is_(None), EventClosure.ancestor_id.is_(None)),
                )
            )
            total_roots = root_count_result.scalar_one()
            typer.echo(f"Found {total_roots} root events to backfill")

            if total_roots > 0:
                last_ingested_at = None
                while True:
                    query = (
                        select(Event.id, Event.ingested_at)
                        .outerjoin(EventClosure, EventClosure.descendant_id == Event.id)
                        .where(
                            Event.parent_id.is_(None),
                            or_(
                                Event.root_id.is_(None),
                                EventClosure.ancestor_id.is_(None),
                            ),
                        )
                        .order_by(Event.ingested_at)
                        .limit(batch_size)
                    )
                    if last_ingested_at is not None:
                        query = query.where(Event.ingested_at > last_ingested_at)

                    root_events_result = await session.execute(query)
                    rows = [(row[0], row[1]) for row in root_events_result]

                    if not rows:
                        break

                    root_ids = [row[0] for row in rows]

                    await session.execute(
                        update(Event)
                        .where(Event.id.in_(root_ids))
                        .values(root_id=Event.id)
                    )

                    closure_entries = [
                        {
                            "ancestor_id": event_id,
                            "descendant_id": event_id,
                            "depth": 0,
                        }
                        for event_id in root_ids
                    ]
                    await session.execute(
                        insert(EventClosure)
                        .values(closure_entries)
                        .on_conflict_do_nothing(
                            index_elements=["ancestor_id", "descendant_id"]
                        )
                    )
                    await session.commit()

                    processed += len(root_ids)
                    progress.update(task, advance=len(root_ids))
                    last_ingested_at = rows[-1][1]

            typer.echo("Step 2: Processing child events level by level...")
            level = 1
            while processed < total_events:
                ParentEvent = aliased(Event)
                ParentClosure = aliased(EventClosure)
                events_result = await session.execute(
                    select(Event.id, Event.parent_id)
                    .outerjoin(EventClosure, EventClosure.descendant_id == Event.id)
                    .join(ParentEvent, Event.parent_id == ParentEvent.id)
                    .join(ParentClosure, ParentClosure.descendant_id == ParentEvent.id)
                    .where(
                        Event.parent_id.is_not(None),
                        or_(
                            Event.root_id.is_(None), EventClosure.ancestor_id.is_(None)
                        ),
                    )
                    .limit(batch_size)
                )
                events = [(row[0], row[1]) for row in events_result]

                if not events:
                    break

                parent_map: dict[UUID, UUID] = {
                    event_id: parent_id for event_id, parent_id in events
                }

                parent_data_result = await session.execute(
                    select(Event.id, Event.root_id).where(
                        Event.id.in_(list(parent_map.values()))
                    )
                )
                parent_data = {row[0]: row[1] for row in parent_data_result}

                root_updates = []
                for event_id, parent_id in parent_map.items():
                    parent_root = parent_data.get(parent_id)
                    if parent_root:
                        root_updates.append({"id": event_id, "root_id": parent_root})

                if root_updates:
                    for update_data in root_updates:
                        await session.execute(
                            update(Event)
                            .where(Event.id == update_data["id"])
                            .values(root_id=update_data["root_id"])
                        )

                closure_entries = []
                for event_id, parent_id in parent_map.items():
                    closure_entries.append(
                        {
                            "ancestor_id": event_id,
                            "descendant_id": event_id,
                            "depth": 0,
                        }
                    )

                    parent_closure_result = await session.execute(
                        select(
                            EventClosure.ancestor_id,
                            EventClosure.depth,
                        ).where(EventClosure.descendant_id == parent_id)
                    )
                    parent_closures = [
                        (row[0], row[1]) for row in parent_closure_result
                    ]

                    for ancestor_id, depth in parent_closures:
                        closure_entries.append(
                            {
                                "ancestor_id": ancestor_id,
                                "descendant_id": event_id,
                                "depth": depth + 1,
                            }
                        )

                if closure_entries:
                    await session.execute(
                        insert(EventClosure)
                        .values(closure_entries)
                        .on_conflict_do_nothing(
                            index_elements=["ancestor_id", "descendant_id"]
                        )
                    )

                await session.commit()

                processed += len(events)
                progress.update(task, advance=len(events))

                level += 1

        final_count = (
            await session.execute(select(func.count()).select_from(EventClosure))
        ).scalar_one()

        typer.echo("\n---\n")
        typer.echo(f"Successfully backfilled {processed} events")
        typer.echo(f"Created {final_count} closure entries")
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
async def backfill_event_closure(
    batch_size: int = typer.Option(1000, help="Number of events to process per batch"),
) -> None:
    """
    Backfill root_id and event_closure table for existing events.
    """
    # Disable logging when running as CLI
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
