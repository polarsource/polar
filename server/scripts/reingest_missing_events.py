import asyncio
import json
import logging.config
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from functools import wraps
from itertools import batched
from typing import Any

import dramatiq
import structlog
import typer
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from polar import tasks  # noqa: F401
from polar.event.service import event as event_service
from polar.integrations.tinybird.client import TinybirdClient, client
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import Customer, Event
from polar.models.event import EventSource
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig({"version": 1, "disable_existing_loggers": True})


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


TB_SQL = """\
SELECT
    id, timestamp, name, customer_id, external_customer_id,
    member_id, external_member_id, external_id, parent_id, root_id,
    event_type_id, user_metadata, cost_amount, cost_currency,
    llm_vendor, llm_model, llm_input_tokens, llm_output_tokens
FROM events_by_ingested_at
WHERE organization_id = {organization_id:UUID}
AND ingested_at >= {start:DateTime64(3)}
AND ingested_at < {end:DateTime64(3)}
AND source = 'user'
"""


def _to_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _build_event(
    row: dict[str, Any], ingested_at: datetime, organization_id: uuid.UUID
) -> dict[str, Any]:
    metadata = json.loads(row["user_metadata"] or "{}")
    if row["cost_amount"] is not None:
        cost: dict[str, Any] = {"amount": row["cost_amount"]}
        if row["cost_currency"] is not None:
            cost["currency"] = row["cost_currency"]
        metadata["_cost"] = cost
    llm = {
        key: row[f"llm_{key}"]
        for key in ("vendor", "model", "input_tokens", "output_tokens")
        if row[f"llm_{key}"] is not None
    }
    if llm:
        metadata["_llm"] = llm
    return {
        "id": row["id"],
        "ingested_at": ingested_at,
        "timestamp": _to_utc(row["timestamp"]),
        "name": row["name"],
        "source": EventSource.user,
        "organization_id": organization_id,
        "customer_id": row["customer_id"],
        "external_customer_id": row["external_customer_id"],
        "member_id": row["member_id"],
        "external_member_id": row["external_member_id"],
        "external_id": row["external_id"],
        "parent_id": row["parent_id"],
        "root_id": row["root_id"] or row["id"],
        "event_type_id": row["event_type_id"],
        "user_metadata": metadata,
    }


async def fetch_tinybird_rows(
    tb_client: TinybirdClient,
    organization_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[dict[str, Any]]:
    return await tb_client.query(
        TB_SQL,
        parameters={
            "organization_id": str(organization_id),
            "start": start,
            "end": end,
        },
        db_statement="SELECT ... FROM events_by_ingested_at WHERE organization_id = {organization_id} AND ingested_at >= {start} AND ingested_at < {end} AND source = 'user'",
    )


async def find_missing(
    session: AsyncSession, rows: Sequence[dict[str, Any]]
) -> list[dict[str, Any]]:
    existing: set[uuid.UUID] = set()
    for id_chunk in batched((row["id"] for row in rows), 1000):
        result = await session.execute(select(Event.id).where(Event.id.in_(id_chunk)))
        existing.update(result.scalars())
    return [row for row in rows if row["id"] not in existing]


def _order_parents_first(rows: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {row["id"]: row for row in rows}
    ordered: list[dict[str, Any]] = []
    seen: set[uuid.UUID] = set()

    def visit(row: dict[str, Any]) -> None:
        if row["id"] in seen:
            return
        seen.add(row["id"])
        for ref in (row["parent_id"], row["root_id"]):
            ref_row = by_id.get(ref)
            if ref_row is not None:
                visit(ref_row)
        ordered.append(row)

    for row in rows:
        visit(row)
    return ordered


async def _check_dangling_references(
    session: AsyncSession, rows: Sequence[dict[str, Any]]
) -> None:
    batch_ids = {row["id"] for row in rows}
    referenced = {
        ref
        for row in rows
        for ref in (row["parent_id"], row["root_id"])
        if ref is not None and ref not in batch_ids
    }
    if not referenced:
        return

    found: set[uuid.UUID] = set()
    for id_chunk in batched(referenced, 1000):
        result = await session.execute(select(Event.id).where(Event.id.in_(id_chunk)))
        found.update(result.scalars())
    dangling = referenced - found
    if dangling:
        raise ValueError(
            "Events reference parent/root events missing from both the batch "
            f"and Postgres (widen the window?): {sorted(str(id) for id in dangling)}"
        )


async def reingest(
    session: AsyncSession,
    rows: Sequence[dict[str, Any]],
    organization_id: uuid.UUID,
) -> tuple[list[Event], set[uuid.UUID]]:
    await _check_dangling_references(session, rows)
    ordered_rows = _order_parents_first(rows)

    now = utc_now()
    inserted_ids: list[uuid.UUID] = []
    for chunk in batched(ordered_rows, 1000):
        values = [_build_event(row, now, organization_id) for row in chunk]
        result = await session.execute(
            insert(Event).on_conflict_do_nothing().returning(Event.id), values
        )
        inserted_ids.extend(result.scalars().all())

    inserted_events: list[Event] = []
    for id_chunk in batched(inserted_ids, 1000):
        events_result = await session.execute(
            select(Event).where(Event.id.in_(id_chunk))
        )
        inserted_events.extend(events_result.scalars().all())

    await event_service._create_meter_events(session, inserted_events)

    customer_ids = {
        event.customer_id for event in inserted_events if event.customer_id is not None
    }
    external_ids = {
        event.external_customer_id
        for event in inserted_events
        if event.customer_id is None and event.external_customer_id is not None
    }
    if external_ids:
        customers_result = await session.execute(
            select(Customer.id).where(
                Customer.organization_id == organization_id,
                Customer.external_id.in_(external_ids),
                Customer.deleted_at.is_(None),
            )
        )
        customer_ids.update(customers_result.scalars())

    return inserted_events, customer_ids


@cli.command()
@typer_async
async def reingest_missing_events(
    organization_id: uuid.UUID,
    start: datetime = typer.Option(..., help="Tinybird ingested_at window start (UTC)"),
    end: datetime = typer.Option(
        ..., help="Tinybird ingested_at window end (UTC, exclusive)"
    ),
    dry_run: bool = typer.Option(False),
) -> None:
    rows = await fetch_tinybird_rows(client, organization_id, start, end)
    typer.echo(f"Tinybird events in window: {len(rows)}")
    if not rows:
        return

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")

    try:
        async with sessionmaker() as session:
            missing = await find_missing(session, rows)
            typer.echo(f"Missing in Postgres: {len(missing)}")
            if dry_run or not missing:
                return

            inserted_events, customer_ids = await reingest(
                session, missing, organization_id
            )
            await session.commit()
            typer.echo(f"Inserted {len(inserted_events)} events")

            async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
                for customer_id in customer_ids:
                    manager.enqueue_job("customer_meter.update_customer", customer_id)
            typer.echo(
                f"Enqueued customer_meter.update_customer for {len(customer_ids)} customers"
            )
    finally:
        await redis.close()
        await engine.dispose()


if __name__ == "__main__":
    cli()
