import asyncio
import json
from pathlib import Path
from typing import Any
from uuid import UUID

import typer
from rich.progress import Progress
from sqlalchemy import select

from polar.config import settings
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import _event_to_tinybird
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Event

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def load_event_ids(json_path: Path) -> list[UUID]:
    with open(json_path) as f:
        data = json.load(f)
    return [UUID(item["id"]) for item in data["data"]]


async def _wait_for_job(
    client: TinybirdClient, job_id: str, poll_interval: float = 1.0
) -> dict[str, Any]:
    while True:
        job = await client.get_job(job_id)
        status = job.get("status")
        if status in ("done", "error"):
            return job
        await asyncio.sleep(poll_interval)


@cli.command()
@typer_async
async def run(
    json_path: Path = typer.Argument(..., help="Path to JSON file with event IDs"),
    delete: bool = typer.Option(False, "--delete", help="Delete events from Tinybird"),
    reingest: bool = typer.Option(
        False, "--reingest", help="Reingest events from DB to Tinybird"
    ),
    datasource: str = typer.Option(
        "events_by_ingested_at", help="Tinybird datasource name"
    ),
    batch_size: int = typer.Option(1000, help="Event IDs per batch"),
    delay_seconds: float = typer.Option(1.0, help="Seconds between batches"),
) -> None:
    """Process events from a JSON file - delete from Tinybird and/or reingest from DB."""
    configure_script_logging()

    if not delete and not reingest:
        typer.echo("Error: Must specify at least one of --delete or --reingest")
        raise typer.Exit(1)

    event_ids = load_event_ids(json_path)
    if not event_ids:
        typer.echo("No event IDs found in file")
        return

    actions = []
    if delete:
        actions.append("delete")
    if reingest:
        actions.append("reingest")
    typer.echo(f"Loaded {len(event_ids)} event IDs. Actions: {', '.join(actions)}")

    tb_client = TinybirdClient(
        api_url=settings.TINYBIRD_API_URL,
        clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
        api_token=settings.TINYBIRD_API_TOKEN,
        read_token=settings.TINYBIRD_READ_TOKEN,
        clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
        clickhouse_token=settings.TINYBIRD_CLICKHOUSE_TOKEN,
    )

    engine = None
    sessionmaker = None
    if reingest:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.tinybird_cleanup",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

    total_deleted = 0
    total_ingested = 0
    not_found = 0

    try:
        with Progress() as progress:
            task = progress.add_task("[cyan]Processing...", total=len(event_ids))

            for i in range(0, len(event_ids), batch_size):
                batch_ids = event_ids[i : i + batch_size]
                batch_num = i // batch_size + 1
                rows_affected = 0

                if delete:
                    ids_str = ", ".join(f"'{str(eid)}'" for eid in batch_ids)
                    delete_condition = f"id IN ({ids_str})"
                    result = await tb_client.delete(datasource, delete_condition)
                    job_id = result.get("job_id")
                    if job_id:
                        job = await _wait_for_job(tb_client, job_id)
                        rows_affected = job.get("rows_affected", 0)
                        total_deleted += rows_affected
                        if job.get("status") == "error":
                            typer.echo(f"Delete error: {job.get('error', 'Unknown')}")

                events: list[Event] = []
                if reingest and sessionmaker:
                    async with sessionmaker() as session:
                        stmt = select(Event).where(Event.id.in_(batch_ids))
                        db_result = await session.execute(stmt)
                        events = list(db_result.scalars().all())

                    if events:
                        tinybird_events = [_event_to_tinybird(e) for e in events]
                        await tb_client.ingest(datasource, tinybird_events, wait=False)
                        total_ingested += len(events)

                    not_found += len(batch_ids) - len(events)

                progress.update(task, advance=len(batch_ids))

                status_parts = [f"Batch {batch_num}"]
                if delete:
                    status_parts.append(f"deleted {rows_affected}")
                if reingest:
                    status_parts.append(f"ingested {len(events)}")
                typer.echo(", ".join(status_parts))

                if i + batch_size < len(event_ids):
                    await asyncio.sleep(delay_seconds)

        summary = [f"\nDone. Processed {len(event_ids)} IDs."]
        if delete:
            summary.append(f"Rows deleted: {total_deleted}")
        if reingest:
            summary.append(f"Events ingested: {total_ingested}, not found: {not_found}")
        typer.echo(" ".join(summary))

    finally:
        if engine:
            await engine.dispose()


if __name__ == "__main__":
    cli()
