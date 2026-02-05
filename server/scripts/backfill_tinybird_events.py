import asyncio
from datetime import UTC, datetime
from uuid import UUID

import typer
from rich.progress import Progress
from sqlalchemy import func, select, tuple_

from polar.config import settings
from polar.integrations.tinybird.client import (
    TinybirdClient,
    TinybirdPayloadTooLargeError,
)
from polar.integrations.tinybird.service import _event_to_tinybird
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Event

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def _ingest_batch(
    client: TinybirdClient,
    events: list[Event],
) -> None:
    if not events:
        return

    tinybird_events = [_event_to_tinybird(e) for e in events]

    try:
        await client.ingest("events_by_ingested_at", tinybird_events, wait=False)
    except TinybirdPayloadTooLargeError:
        if len(events) <= 1:
            raise
        mid = len(events) // 2
        await _ingest_batch(client, events[:mid])
        await _ingest_batch(client, events[mid:])


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(5000, help="Events per batch"),
    delay_seconds: float = typer.Option(0.1, help="Seconds between batches"),
    cutoff_date: str = typer.Option(
        None,
        help="Only backfill events before this date (ISO format). Defaults to now.",
    ),
    start_date: str = typer.Option(
        None, help="Resume from this date (ISO format, cursor start)."
    ),
) -> None:
    configure_script_logging()

    parsed_cutoff: datetime = (
        datetime.fromisoformat(cutoff_date) if cutoff_date else datetime.now(UTC)
    )
    parsed_start: datetime | None = (
        datetime.fromisoformat(start_date) if start_date else None
    )

    engine = _create_async_engine(
        dsn=str(settings.get_postgres_dsn("asyncpg")),
        application_name=f"{settings.ENV.value}.backfill_tinybird",
        debug=False,
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
    )
    sessionmaker = create_async_sessionmaker(engine)

    tb_client = TinybirdClient(
        api_url=settings.TINYBIRD_API_URL,
        clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
        api_token=settings.TINYBIRD_API_TOKEN,
        clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
        clickhouse_token=settings.TINYBIRD_CLICKHOUSE_TOKEN,
    )

    try:
        async with sessionmaker() as session:
            count_stmt = (
                select(func.count())
                .select_from(Event)
                .where(Event.ingested_at < parsed_cutoff)
            )
            if parsed_start is not None:
                count_stmt = count_stmt.where(Event.ingested_at >= parsed_start)

            total = (await session.execute(count_stmt)).scalar_one()

        if total == 0:
            typer.echo("No events to backfill")
            return

        typer.echo(f"Backfilling {total} events to Tinybird")

        last_ingested_at = parsed_start
        last_id: UUID | None = None
        total_sent = 0

        with Progress() as progress:
            task = progress.add_task("[cyan]Backfilling...", total=total)

            while True:
                async with sessionmaker() as session:
                    stmt = (
                        select(Event)
                        .where(Event.ingested_at < parsed_cutoff)
                        .order_by(Event.ingested_at, Event.id)
                        .limit(batch_size)
                    )

                    if last_ingested_at is not None and last_id is not None:
                        stmt = stmt.where(
                            tuple_(Event.ingested_at, Event.id)
                            > (last_ingested_at, last_id)
                        )
                    elif last_ingested_at is not None:
                        stmt = stmt.where(Event.ingested_at >= last_ingested_at)

                    result = await session.execute(stmt)
                    events = list(result.scalars().all())

                if not events:
                    break

                await _ingest_batch(tb_client, events)

                total_sent += len(events)
                last_ingested_at = events[-1].ingested_at
                last_id = events[-1].id

                progress.update(task, advance=len(events))
                typer.echo(
                    f"Sent {len(events)} events "
                    f"(total: {total_sent}, cursor: {last_ingested_at})"
                )

                if len(events) < batch_size:
                    break

                await asyncio.sleep(delay_seconds)

        typer.echo(f"\nDone. Sent {total_sent} events to Tinybird.")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
