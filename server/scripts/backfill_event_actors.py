from uuid import UUID

import typer
from rich.progress import Progress
from sqlalchemy import func, or_, select

from polar.config import settings
from polar.event_actor.service import event_actor_service
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Event
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()


async def run_backfill(
    batch_size: int = 1000,
    session: AsyncSession | None = None,
) -> None:
    """
    Backfill event_actor_id for existing events.

    Processes events in batches, looking up or creating EventActor records
    as needed (cached per batch), then updates events with their corresponding
    event_actor_id. Safe to rerun as it only processes events without an event_actor_id.
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
                .where(
                    Event.event_actor_id.is_(None),
                    or_(
                        Event.customer_id.is_not(None),
                        Event.external_customer_id.is_not(None),
                    ),
                )
            )
        ).scalar_one()

        if total_events == 0:
            typer.echo("No events to process")
            raise typer.Exit(0)

        typer.echo(f"Found {total_events} events to backfill")

        event_actor_cache: dict[tuple[UUID, UUID | None, str | None], UUID] = {}
        processed = 0

        with Progress() as progress:
            task = progress.add_task("[cyan]Processing events...", total=total_events)

            while True:
                events_result = await session.execute(
                    select(Event)
                    .where(
                        Event.event_actor_id.is_(None),
                        or_(
                            Event.customer_id.is_not(None),
                            Event.external_customer_id.is_not(None),
                        ),
                    )
                    .limit(batch_size)
                )
                events = list(events_result.scalars())

                if not events:
                    break

                for event in events:
                    cache_key = (
                        event.organization_id,
                        event.customer_id,
                        event.external_customer_id,
                    )

                    if cache_key not in event_actor_cache:
                        event_actor = await event_actor_service.resolve(
                            session,
                            event.organization_id,
                            customer_id=event.customer_id,
                            external_customer_id=event.external_customer_id,
                        )
                        event_actor_cache[cache_key] = event_actor.id

                    event.event_actor_id = event_actor_cache[cache_key]

                await session.commit()

                processed += len(events)
                progress.update(task, advance=len(events))

        remaining_events = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(
                    Event.event_actor_id.is_(None),
                    or_(
                        Event.customer_id.is_not(None),
                        Event.external_customer_id.is_not(None),
                    ),
                )
            )
        ).scalar_one()

        typer.echo("\n---\n")
        typer.echo(f"Successfully backfilled {processed} events")
        typer.echo(f"Remaining events without event_actor_id: {remaining_events}")
        typer.echo("\n---\n")

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


@cli.command()
@typer_async
async def backfill_event_actors(
    batch_size: int = typer.Option(1000, help="Number of events to process per batch"),
) -> None:
    """
    Backfill event_actor_id for existing events.
    """
    configure_script_logging()
    await run_backfill(batch_size=batch_size)


if __name__ == "__main__":
    cli()
