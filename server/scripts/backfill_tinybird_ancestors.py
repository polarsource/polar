import asyncio
from uuid import UUID

import typer
from rich.progress import Progress
from sqlalchemy import select

from polar.config import settings
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import _event_to_tinybird
from polar.kit.db.postgres import AsyncSessionMaker, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Event, EventClosure

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

DATASOURCE = "events_by_ingested_at"


async def _wait_for_job(
    client: TinybirdClient, job_id: str, poll_interval: float = 1.0
) -> dict[str, object]:
    while True:
        job = await client.get_job(job_id)
        if job.get("status") in ("done", "error"):
            return job
        await asyncio.sleep(poll_interval)


async def _build_ancestors(
    sessionmaker: AsyncSessionMaker,
    event_ids: list[UUID],
) -> dict[UUID, list[str]]:
    ancestors_by_event: dict[UUID, list[str]] = {}
    async with sessionmaker() as session:
        result = await session.execute(
            select(
                EventClosure.descendant_id,
                EventClosure.ancestor_id,
                EventClosure.depth,
            )
            .where(
                EventClosure.descendant_id.in_(event_ids),
                EventClosure.depth > 0,
            )
            .order_by(EventClosure.descendant_id, EventClosure.depth)
        )
        for descendant_id, ancestor_id, _ in result.all():
            ancestors_by_event.setdefault(descendant_id, []).append(str(ancestor_id))
    return ancestors_by_event


async def _verify(tb_client: TinybirdClient) -> int:
    rows = await tb_client.query(
        "SELECT count() AS cnt FROM events_by_ingested_at "
        "WHERE parent_id IS NOT NULL AND empty(ancestors)",
        db_statement="SELECT count() FROM events_by_ingested_at WHERE parent_id IS NOT NULL AND empty(ancestors)",
    )
    return rows[0]["cnt"] if rows else 0


@cli.command()
@typer_async
async def run(
    batch_size: int = typer.Option(500, help="Events per batch"),
    limit: int = typer.Option(0, help="Max events to process (0 = unlimited)"),
    delay_seconds: float = typer.Option(1.0, help="Seconds between batches"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Only count, don't update"),
) -> None:
    """Backfill ancestors array on Tinybird events that have a parent_id but empty ancestors."""
    configure_script_logging()

    tb_client = TinybirdClient(
        api_url=settings.TINYBIRD_API_URL,
        clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
        api_token=settings.TINYBIRD_API_TOKEN,
        read_token=settings.TINYBIRD_READ_TOKEN,
        clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
        clickhouse_token=settings.TINYBIRD_CLICKHOUSE_TOKEN,
    )

    remaining = await _verify(tb_client)
    typer.echo(f"Found {remaining} events with empty ancestors")

    if remaining == 0 or dry_run:
        return

    target = min(remaining, limit) if limit > 0 else remaining

    engine = _create_async_engine(
        dsn=str(settings.get_postgres_dsn("asyncpg")),
        application_name=f"{settings.ENV.value}.backfill_ancestors",
        debug=False,
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
    )
    sessionmaker = create_async_sessionmaker(engine)

    total_processed = 0

    try:
        with Progress() as progress:
            task = progress.add_task("[cyan]Backfilling ancestors...", total=target)

            while True:
                if limit > 0 and total_processed >= limit:
                    break

                fetch_size = (
                    min(batch_size, limit - total_processed)
                    if limit > 0
                    else batch_size
                )

                id_rows = await tb_client.query(
                    "SELECT toString(id) AS id FROM events_by_ingested_at "
                    "WHERE parent_id IS NOT NULL AND empty(ancestors) "
                    f"ORDER BY ingested_at ASC LIMIT {fetch_size}",
                    db_statement="SELECT toString(id) FROM events_by_ingested_at WHERE parent_id IS NOT NULL AND empty(ancestors) ORDER BY ingested_at ASC LIMIT {limit}",
                )

                if not id_rows:
                    break

                event_ids = [UUID(row["id"]) for row in id_rows]
                ancestors_by_event = await _build_ancestors(sessionmaker, event_ids)

                async with sessionmaker() as session:
                    result = await session.execute(
                        select(Event).where(Event.id.in_(event_ids))
                    )
                    events = list(result.scalars().all())

                if not events:
                    break

                ids_str = ", ".join(f"'{str(eid)}'" for eid in event_ids)
                delete_result = await tb_client.delete(DATASOURCE, f"id IN ({ids_str})")
                job_id = delete_result.get("job_id")
                if job_id:
                    job = await _wait_for_job(tb_client, job_id)
                    if job.get("status") == "error":
                        typer.echo(f"Delete error: {job.get('error')}")
                        break

                tinybird_events = [
                    _event_to_tinybird(e, ancestors_by_event.get(e.id)) for e in events
                ]
                await tb_client.ingest(DATASOURCE, tinybird_events, wait=True)

                total_processed += len(events)
                progress.update(task, advance=len(event_ids))

                await asyncio.sleep(delay_seconds)

        remaining = await _verify(tb_client)
        typer.echo(f"Done. Backfilled {total_processed} events. {remaining} remaining.")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
