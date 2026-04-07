import asyncio
from uuid import UUID

import typer
from sqlalchemy import delete, func, select

from polar.integrations.tinybird.client import client as tinybird_client
from polar.integrations.tinybird.service import DATASOURCE_EVENTS
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Event
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def find_stale_events(session: AsyncSession) -> list[Event]:
    """Find fee=0 balance.order events where a duplicate with real fees exists."""
    order_id_col = Event.user_metadata["order_id"].astext

    dupes_subq = (
        select(order_id_col.label("order_id"))
        .where(
            Event.name == "balance.order",
            Event.source == "system",
        )
        .group_by(order_id_col)
        .having(func.count() > 1)
        .subquery()
    )

    stale_events_stmt = (
        select(Event)
        .where(
            Event.name == "balance.order",
            Event.source == "system",
            Event.user_metadata["fee"].astext == "0",
            order_id_col.in_(select(dupes_subq.c.order_id)),
        )
        .order_by(Event.organization_id, Event.ingested_at)
    )

    return list(await session.scalars(stale_events_stmt))


async def delete_stale_events(session: AsyncSession, stale_events: list[Event]) -> int:
    """Delete stale events from PostgreSQL. Returns number of rows deleted."""
    stale_ids = [e.id for e in stale_events]
    result = await session.execute(delete(Event).where(Event.id.in_(stale_ids)))
    await session.flush()
    return max(getattr(result, "rowcount", 0) or 0, 0)


async def _delete_tinybird(event_ids: list[str]) -> int:
    condition = "id IN (" + ", ".join(f"'{eid}'" for eid in event_ids) + ")"
    result = await tinybird_client.delete(DATASOURCE_EVENTS, condition)
    job_id = result.get("job_id")
    if job_id is None:
        return int(result.get("rows_affected", 0))

    while True:
        job = await tinybird_client.get_job(str(job_id))
        status = job.get("status")
        if status in {"done", "error"}:
            if status == "error":
                typer.echo(
                    f"Tinybird delete error: {job.get('error', 'unknown')}", err=True
                )
            return int(job.get("rows_affected", 0))
        await asyncio.sleep(1)


@cli.command()
@typer_async
async def run(
    dry_run: bool = typer.Option(
        True, help="Print what would be deleted without acting"
    ),
) -> None:
    """Delete stale fee=0 balance.order events that have a duplicate with real fees.

    These were created by a bug in commit 6827eeaef (Dec 16 2025) that emitted
    balance.order events before the held-balance check with fee=0. The fix in
    d49c4d183 (Jan 9 2026) moved emission to after balance creation. Orders
    created between deployment of these two commits have duplicate events.
    """
    configure_script_logging()

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            stale_events = await find_stale_events(session)

            if not stale_events:
                typer.echo("No duplicate balance.order events found.")
                return

            by_org: dict[UUID, list[Event]] = {}
            for event in stale_events:
                by_org.setdefault(event.organization_id, []).append(event)

            typer.echo(
                f"Found {len(stale_events)} stale events across {len(by_org)} orgs:\n"
            )
            for org_id, events in sorted(by_org.items(), key=lambda x: -len(x[1])):
                typer.echo(f"  {org_id}: {len(events)} duplicate events")
                for e in events[:3]:
                    typer.echo(
                        f"    event={e.id} order={e.user_metadata.get('order_id')} "
                        f"ingested={e.ingested_at.isoformat()}"
                    )
                if len(events) > 3:
                    typer.echo(f"    ... and {len(events) - 3} more")

            if dry_run:
                typer.echo(
                    f"\nDry run — would delete {len(stale_events)} events. "
                    f"Pass --no-dry-run to execute."
                )
                return

            deleted_pg = await delete_stale_events(session, stale_events)
            await session.commit()
            typer.echo(f"\nDeleted {deleted_pg} events from PostgreSQL")

            stale_id_strs = [str(e.id) for e in stale_events]
            deleted_tb = await _delete_tinybird(stale_id_strs)
            typer.echo(f"Deleted {deleted_tb} events from Tinybird")

            typer.echo(
                "\nDone. Remember to repopulate orders_base_state_by_quarter_hour MV."
            )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
