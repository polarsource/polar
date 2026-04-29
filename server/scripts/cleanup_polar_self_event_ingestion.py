import asyncio
import uuid
from typing import Any

import typer
from sqlalchemy import delete, func, select

from polar.config import settings
from polar.integrations.tinybird.client import client as tinybird_client
from polar.integrations.tinybird.service import DATASOURCE_EVENTS
from polar.kit.db.postgres import (
    AsyncSession,
    AsyncSessionMaker,
    create_async_sessionmaker,
)
from polar.models import Event
from polar.models.event import EventSource
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

EVENT_NAME = "event_ingestion"

cli = typer.Typer()


async def _summarize(session: AsyncSession, organization_id: uuid.UUID) -> int:
    statement = select(func.count(Event.id)).where(
        Event.organization_id == organization_id,
        Event.name == EVENT_NAME,
    )
    result = await session.execute(statement)
    return int(result.scalar_one() or 0)


async def _delete_postgres(
    sessionmaker: AsyncSessionMaker,
    organization_id: uuid.UUID,
    batch_size: int,
    sleep_seconds: float,
) -> int:
    subquery = (
        select(Event.id)
        .where(
            Event.organization_id == organization_id,
            Event.name == EVENT_NAME,
            Event.source == EventSource.system,
        )
        .limit(batch_size)
        .scalar_subquery()
    )
    delete_statement = delete(Event).where(Event.id.in_(subquery))

    total = 0
    batch_number = 0
    while True:
        async with sessionmaker() as session:
            result = await session.execute(delete_statement)
            await session.commit()
            rows = max(getattr(result, "rowcount", 0) or 0, 0)

        if rows == 0:
            break

        batch_number += 1
        total += rows
        typer.echo(f"Postgres batch {batch_number}: deleted {rows} (total {total})")

        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)

    return total


async def _delete_tinybird(organization_id: uuid.UUID, batch_size: int) -> int:
    condition = (
        f"id IN (SELECT id FROM {DATASOURCE_EVENTS} "
        f"WHERE organization_id = '{organization_id}' "
        f"AND name = '{EVENT_NAME}' "
        f"LIMIT {batch_size})"
    )

    total = 0
    batch_number = 0
    while True:
        result = await tinybird_client.delete(DATASOURCE_EVENTS, condition)
        rows = await _await_tinybird_job(result)

        if rows == 0:
            break

        batch_number += 1
        total += rows
        typer.echo(f"Tinybird batch {batch_number}: deleted {rows} (total {total})")

    return total


async def _await_tinybird_job(result: dict[str, Any]) -> int:
    job_id = result.get("job_id")
    if job_id is None:
        return int(result.get("rows_affected", 0))

    while True:
        job = await tinybird_client.get_job(str(job_id))
        status = job.get("status")
        if status in {"done", "error"}:
            if status == "error":
                typer.echo(
                    f"Tinybird delete error: {job.get('error', 'unknown')}",
                    err=True,
                )
            return int(job.get("rows_affected", 0))
        await asyncio.sleep(0.25)


@cli.command()
@typer_async
async def run(
    dry_run: bool = typer.Option(
        True, help="Print what would be deleted without acting"
    ),
    batch_size: int = typer.Option(1000, help="Rows per batch on each store"),
    sleep_seconds: float = typer.Option(0.5, help="Seconds to sleep between batches"),
) -> None:
    """Delete all `event_ingestion` events from the Polar-for-Polar org.

    These are the per-org rollup events emitted by the (now disabled)
    `polar_self.track_event_ingestion_v2` cron. Postgres and Tinybird each
    loop independently, deleting `--batch-size` rows per iteration via a
    SQL subquery + LIMIT.
    """
    configure_script_logging()

    if not settings.POLAR_ORGANIZATION_ID:
        typer.echo("POLAR_ORGANIZATION_ID is not configured.", err=True)
        raise typer.Exit(code=1)

    organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            count = await _summarize(session, organization_id)

        typer.echo(
            f"Found {count} `{EVENT_NAME}` events on org {organization_id} (Postgres)"
        )
        if dry_run:
            typer.echo(
                "\nDry run — pass --no-dry-run to delete from Postgres and Tinybird."
            )
            return

        deleted_pg = await _delete_postgres(
            sessionmaker, organization_id, batch_size, sleep_seconds
        )
        typer.echo(f"\nDeleted {deleted_pg} events from Postgres")

        deleted_tb = await _delete_tinybird(organization_id, batch_size)
        typer.echo(f"Deleted {deleted_tb} events from Tinybird")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
