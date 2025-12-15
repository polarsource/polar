import asyncio
import logging.config
from datetime import UTC, datetime
from functools import wraps
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select, text

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Event

cli = typer.Typer()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def run_backfill(
    batch_size: int = 100_000,
    cutoff_date: datetime | None = None,
    session: AsyncSession | None = None,
    delay_seconds: float = 1.0,
) -> None:
    """
    Backfill events_hyper table from events table.

    This script copies events from the original events table to the events_hyper
    hypertable in batches, ordered by ingested_at.
    """
    engine = None
    own_session = False

    if cutoff_date is None:
        cutoff_date = datetime.now(UTC)

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
        total_events_result = await session.execute(
            select(func.count())
            .select_from(Event)
            .where(Event.ingested_at < cutoff_date)
        )
        total_events = total_events_result.scalar_one()

        if total_events == 0:
            typer.echo("No events to backfill")
            if engine is not None:
                await engine.dispose()
            raise typer.Exit(0)

        typer.echo(f"Found {total_events} events to backfill (before {cutoff_date})")

        already_copied_result = await session.execute(
            text(
                "SELECT COUNT(*) FROM events_hyper WHERE ingested_at < :cutoff"
            ).bindparams(cutoff=cutoff_date)
        )
        already_copied = already_copied_result.scalar_one()
        typer.echo(f"Already copied: {already_copied} events")

        remaining = total_events - already_copied
        if remaining <= 0:
            typer.echo("All events already backfilled!")
            if engine is not None:
                await engine.dispose()
            raise typer.Exit(0)

        typer.echo(f"Remaining to copy: {remaining} events")

        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Backfilling events_hyper...", total=remaining
            )

            total_inserted = 0
            last_ingested_at = None

            while True:
                # Use raw SQL for the INSERT ... SELECT to handle NOT EXISTS efficiently
                if last_ingested_at is None:
                    query = text("""
                        INSERT INTO events_hyper (
                            id, ingested_at, timestamp, name, source,
                            customer_id, external_customer_id, external_id,
                            parent_id, root_id, organization_id, event_type_id,
                            user_metadata
                        )
                        SELECT
                            e.id, e.ingested_at, e.timestamp, e.name, e.source,
                            e.customer_id, e.external_customer_id, e.external_id,
                            e.parent_id, e.root_id, e.organization_id, e.event_type_id,
                            e.user_metadata
                        FROM events e
                        WHERE e.ingested_at < :cutoff
                          AND NOT EXISTS (
                              SELECT 1 FROM events_hyper eh
                              WHERE eh.id = e.id AND eh.ingested_at = e.ingested_at
                          )
                        ORDER BY e.ingested_at
                        LIMIT :batch_size
                        RETURNING ingested_at
                    """).bindparams(cutoff=cutoff_date, batch_size=batch_size)
                else:
                    query = text("""
                        INSERT INTO events_hyper (
                            id, ingested_at, timestamp, name, source,
                            customer_id, external_customer_id, external_id,
                            parent_id, root_id, organization_id, event_type_id,
                            user_metadata
                        )
                        SELECT
                            e.id, e.ingested_at, e.timestamp, e.name, e.source,
                            e.customer_id, e.external_customer_id, e.external_id,
                            e.parent_id, e.root_id, e.organization_id, e.event_type_id,
                            e.user_metadata
                        FROM events e
                        WHERE e.ingested_at < :cutoff
                          AND e.ingested_at >= :last_ingested_at
                          AND NOT EXISTS (
                              SELECT 1 FROM events_hyper eh
                              WHERE eh.id = e.id AND eh.ingested_at = e.ingested_at
                          )
                        ORDER BY e.ingested_at
                        LIMIT :batch_size
                        RETURNING ingested_at
                    """).bindparams(
                        cutoff=cutoff_date,
                        batch_size=batch_size,
                        last_ingested_at=last_ingested_at,
                    )

                result = await session.execute(query)
                rows = result.fetchall()
                inserted = len(rows)

                await session.commit()

                if inserted == 0:
                    break

                total_inserted += inserted
                progress.update(task, advance=inserted)

                if rows:
                    last_ingested_at = rows[-1][0]

                typer.echo(
                    f"Inserted {inserted} rows (total: {total_inserted}, "
                    f"last: {last_ingested_at})"
                )

                if inserted < batch_size:
                    break

                # Throttle to avoid overwhelming the database
                await asyncio.sleep(delay_seconds)

        # ID-based verification
        typer.echo("\n--- Verification ---\n")

        # Count events in source
        events_count_result = await session.execute(
            select(func.count())
            .select_from(Event)
            .where(Event.ingested_at < cutoff_date)
        )
        events_count = events_count_result.scalar_one()

        # Count events in target
        hyper_count_result = await session.execute(
            text(
                "SELECT COUNT(*) FROM events_hyper WHERE ingested_at < :cutoff"
            ).bindparams(cutoff=cutoff_date)
        )
        hyper_count = hyper_count_result.scalar_one()

        typer.echo(f"Inserted this run: {total_inserted}")
        typer.echo(f"Events table count (before cutoff): {events_count}")
        typer.echo(f"Events_hyper table count (before cutoff): {hyper_count}")

        # Find missing IDs (in events but not in events_hyper)
        missing_result = await session.execute(
            text("""
                SELECT COUNT(*) FROM events e
                WHERE e.ingested_at < :cutoff
                  AND NOT EXISTS (
                      SELECT 1 FROM events_hyper eh
                      WHERE eh.id = e.id
                  )
            """).bindparams(cutoff=cutoff_date)
        )
        missing_count = missing_result.scalar_one()

        # Find extra IDs (in events_hyper but not in events)
        extra_result = await session.execute(
            text("""
                SELECT COUNT(*) FROM events_hyper eh
                WHERE eh.ingested_at < :cutoff
                  AND NOT EXISTS (
                      SELECT 1 FROM events e
                      WHERE e.id = eh.id
                  )
            """).bindparams(cutoff=cutoff_date)
        )
        extra_count = extra_result.scalar_one()

        typer.echo(f"Missing from events_hyper: {missing_count}")
        typer.echo(f"Extra in events_hyper: {extra_count}")

        if missing_count == 0 and extra_count == 0:
            typer.echo("\n✅ ID verification passed! All IDs match.")
        else:
            if missing_count > 0:
                typer.echo(f"\n⚠️ {missing_count} events missing - run again")
            if extra_count > 0:
                typer.echo(
                    f"\n❌ {extra_count} extra events in hyper table - investigate"
                )

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
async def backfill_events_hyper(
    batch_size: int = typer.Option(
        100_000, help="Number of events to process per batch"
    ),
    cutoff_date: datetime = typer.Option(
        None,
        help="Only backfill events before this date (ISO format). Defaults to now.",
    ),
    delay_seconds: float = typer.Option(1.0, help="Seconds to wait between batches"),
) -> None:
    """
    Backfill events_hyper hypertable from events table.

    This should be run after enabling dual-write to copy historical events.
    """
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )

    await run_backfill(
        batch_size=batch_size,
        cutoff_date=cutoff_date,
        delay_seconds=delay_seconds,
    )


if __name__ == "__main__":
    cli()
