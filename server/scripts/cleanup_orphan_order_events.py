import asyncio
from datetime import datetime
from typing import Any
from uuid import UUID

import typer
from sqlalchemy import delete, select

from polar.integrations.tinybird.client import client as tinybird_client
from polar.integrations.tinybird.service import DATASOURCE_EVENTS
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Event, Order
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


async def _fetch_batch(
    *,
    batch_size: int,
    cursor_ingested_at: datetime | None,
    cursor_id: str | None,
) -> list[dict[str, Any]]:
    sql = (
        "SELECT toString(id) AS event_id, toString(order_id) AS order_id, ingested_at "
        "FROM events_by_ingested_at "
        "WHERE order_id IS NOT NULL AND order_id != '' "
    )
    parameters: dict[str, Any] = {"limit": batch_size}

    if cursor_ingested_at is not None and cursor_id is not None:
        sql += (
            "AND (ingested_at > {cursor_ingested_at:DateTime64(3)} "
            "OR (ingested_at = {cursor_ingested_at:DateTime64(3)} "
            "AND id > {cursor_id:String})) "
        )
        parameters["cursor_ingested_at"] = cursor_ingested_at
        parameters["cursor_id"] = cursor_id

    sql += "ORDER BY ingested_at, id LIMIT {limit:UInt64}"

    return await tinybird_client.query(
        sql,
        parameters=parameters,
        db_statement="select events with order_id from events_by_ingested_at",
    )


async def _delete_tinybird(datasource: str, event_ids: list[str]) -> int:
    condition = "id IN (" + ", ".join(f"'{event_id}'" for event_id in event_ids) + ")"
    result = await tinybird_client.delete(datasource, condition)
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
    batch_size: int = typer.Option(1000, help="Number of events per batch"),
    execute: bool = typer.Option(False, "--execute", help="Apply deletions"),
    tinybird: bool = typer.Option(
        False, "--tinybird", help="Delete orphan events from Tinybird"
    ),
    postgres: bool = typer.Option(
        False, "--postgres", help="Delete orphan events from PostgreSQL events table"
    ),
    datasource: str = typer.Option(DATASOURCE_EVENTS, help="Tinybird datasource"),
) -> None:
    configure_script_logging()
    if execute and not (tinybird or postgres):
        typer.echo("Error: --execute requires --tinybird and/or --postgres", err=True)
        raise typer.Exit(1)

    typer.echo(
        f"Start batch_size={batch_size} execute={execute} "
        f"tinybird={tinybird} postgres={postgres} datasource={datasource}"
    )

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    checked = 0
    missing = 0
    deleted_tinybird = 0
    deleted_postgres = 0
    cursor_ingested_at: datetime | None = None
    cursor_id: str | None = None

    try:
        async with sessionmaker() as session:
            while True:
                rows = await _fetch_batch(
                    batch_size=batch_size,
                    cursor_ingested_at=cursor_ingested_at,
                    cursor_id=cursor_id,
                )
                if not rows:
                    break

                checked += len(rows)
                cursor_ingested_at = rows[-1]["ingested_at"]
                cursor_id = str(rows[-1]["event_id"])

                event_orders = [
                    (str(row["event_id"]), _uuid(str(row["order_id"]))) for row in rows
                ]
                order_ids = {order_id for _, order_id in event_orders if order_id}
                existing_order_ids: set[UUID] = set()
                if order_ids:
                    result = await session.execute(
                        select(Order.id).where(Order.id.in_(order_ids))
                    )
                    existing_order_ids = set(result.scalars().all())

                orphan_ids = [
                    event_id
                    for event_id, order_id in event_orders
                    if order_id is None or order_id not in existing_order_ids
                ]
                missing += len(orphan_ids)
                typer.echo(
                    f"batch_rows={len(rows)} missing={len(orphan_ids)} "
                    f"sample={orphan_ids[:5]}"
                )

                if not execute or not orphan_ids:
                    continue

                if postgres:
                    postgres_ids: list[UUID] = []
                    for event_id in orphan_ids:
                        parsed = _uuid(event_id)
                        if parsed is not None:
                            postgres_ids.append(parsed)

                    if postgres_ids:
                        result = await session.execute(
                            delete(Event).where(Event.id.in_(postgres_ids))
                        )
                        await session.commit()
                        deleted = max(getattr(result, "rowcount", 0) or 0, 0)
                        deleted_postgres += deleted
                        typer.echo(f"deleted_postgres={deleted}")

                if tinybird:
                    deleted = await _delete_tinybird(datasource, orphan_ids)
                    deleted_tinybird += deleted
                    typer.echo(f"deleted_tinybird={deleted}")

        typer.echo(
            f"Done checked={checked} missing={missing} "
            f"deleted_tinybird={deleted_tinybird} deleted_postgres={deleted_postgres}"
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
