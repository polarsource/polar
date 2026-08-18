"""
Backfill customers.first_user_event_at from the Tinybird aggregating views.

The column is filled going forward by event ingestion and by the
`customer.resolve_first_user_event_at` task, but neither reaches customers whose
events were all ingested before those paths existed. This script fills them.

Events reach a customer under two keys: `customer_id` when the caller knew the
Polar id, and `external_customer_id` otherwise — including events ingested before
the customer row existed, which is the whole point of the column. Both views are
read, and the earlier of the two wins.

Pages are written as they arrive, so memory stays bounded by `PAGE_SIZE` however
many customers an organization has.

Work is driven per organization because that is the leading column of both views'
sorting keys, so each read stays on the key prefix instead of scanning the view.

Usage:
    cd server

    # Dry-run (default) — report what would be written:
    uv run python -m scripts.backfill_customer_first_user_event_at

    # Execute:
    uv run python -m scripts.backfill_customer_first_user_event_at --execute

    # Scope to a single organization:
    uv run python -m scripts.backfill_customer_first_user_event_at \
        --organization-id 00000000-0000-0000-0000-000000000000 --execute
"""

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime
from uuid import UUID

import structlog
import typer
from rich.console import Console
from rich.progress import Progress
from sqlalchemy import Table, func, literal, select

from polar.customer.repository import CustomerRepository
from polar.integrations.tinybird.client import client as tinybird_client
from polar.integrations.tinybird.service import (
    _compile,
    _parse_datetime,
    _parse_uuid,
    event_types_by_customer_id_table,
    event_types_by_external_customer_id_table,
)
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.models.event import EventSource
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    typer_async,
)

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

# Bounds the parameter count of a single UPDATE ... FROM (VALUES ...).
CHUNK_SIZE = 1000

# Bounds one Tinybird response. The client allows 30s and holds the rows in memory.
PAGE_SIZE = 50_000


async def organization_ids_with_user_events() -> set[UUID]:
    """
    Organizations that appear in either view, in two queries rather than two per org.

    Production has ~90k organizations and almost none of them ingest events. Iterating
    all of them costs two Tinybird round trips each, which is hours before any writes.
    """
    organization_ids: set[UUID] = set()

    for table in (
        event_types_by_customer_id_table,
        event_types_by_external_customer_id_table,
    ):
        statement = (
            select(table.c.organization_id)
            .where(table.c.source == EventSource.user)
            .group_by(table.c.organization_id)
        )
        sql, params = _compile(statement)
        rows = await tinybird_client.query(sql, parameters=params, db_statement=sql)
        organization_ids.update(_parse_uuid(row["organization_id"]) for row in rows)

    return organization_ids


async def _pages_by_key(
    table: Table, key: str, organization_id: UUID, *, uuid_key: bool
) -> AsyncIterator[dict[str, datetime]]:
    """
    Page through one aggregating view, keyed on the column after `organization_id`.

    Keyset rather than OFFSET: the key is the second column of the sorting key, so
    each page scans the remaining range instead of re-aggregating from the start.
    """
    key_column = table.c[key]
    last: str | None = None

    while True:
        conditions = [
            table.c.organization_id == str(organization_id),
            table.c.source == EventSource.user,
        ]
        if last is not None:
            conditions.append(
                key_column > (func.toUUID(last) if uuid_key else literal(last))
            )

        statement = (
            select(key_column, func.minMerge(table.c.first_seen).label("first_seen"))
            .where(*conditions)
            .group_by(key_column)
            .order_by(key_column)
            .limit(PAGE_SIZE)
        )
        sql, params = _compile(statement)
        rows = await tinybird_client.query(sql, parameters=params, db_statement=sql)

        if not rows:
            break

        yield {str(row[key]): _parse_datetime(row["first_seen"]) for row in rows}

        if len(rows) < PAGE_SIZE:
            break

        last = str(rows[-1][key])


def _chunks(timestamps: dict[UUID, datetime], size: int) -> list[dict[UUID, datetime]]:
    items = list(timestamps.items())
    return [dict(items[i : i + size]) for i in range(0, len(items), size)]


async def _lower(
    repository: CustomerRepository, timestamps: dict[UUID, datetime], *, execute: bool
) -> int:
    if execute:
        for chunk in _chunks(timestamps, CHUNK_SIZE):
            await repository.lower_first_user_event_at(chunk)
    return len(timestamps)


async def backfill_organization(
    session: AsyncSession, organization_id: UUID, *, execute: bool
) -> int:
    """
    Resolve and write `first_user_event_at` for one organization's customers.

    Each page is written as it arrives. A customer present in both views is written
    twice, and `lower_first_user_event_at` keeps the earlier value, so there's no
    need to hold an organization's mappings in memory to merge them here.

    Returns the number of rows written, which counts such a customer twice.
    """
    repository = CustomerRepository.from_session(session)
    written = 0

    async for page in _pages_by_key(
        event_types_by_customer_id_table, "customer_id", organization_id, uuid_key=True
    ):
        written += await _lower(
            repository,
            {_parse_uuid(key): value for key, value in page.items()},
            execute=execute,
        )

    async for page in _pages_by_key(
        event_types_by_external_customer_id_table,
        "external_customer_id",
        organization_id,
        uuid_key=False,
    ):
        external_ids = list(page)
        customer_ids: dict[str, UUID] = {}
        # Chunked for the same reason the writes are: a page can hold far more
        # external ids than Postgres allows bind parameters.
        for start in range(0, len(external_ids), CHUNK_SIZE):
            customer_ids.update(
                await repository.get_ids_by_external_ids_and_organization(
                    external_ids[start : start + CHUNK_SIZE], organization_id
                )
            )
        written += await _lower(
            repository,
            {
                customer_id: page[external_id]
                for external_id, customer_id in customer_ids.items()
            },
            execute=execute,
        )

    return written


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    organization_id: UUID | None = typer.Option(
        None, help="Only backfill this organization"
    ),
    sleep_seconds: float = typer.Option(
        0.1, help="Seconds to sleep between organizations"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        if organization_id is not None:
            organization_ids = [organization_id]
        else:
            console.print("[cyan]Listing organizations with events…")
            with_events = await organization_ids_with_user_events()
            async with sessionmaker() as session:
                result = await session.execute(
                    select(Organization.id)
                    .where(Organization.id.in_(with_events))
                    .order_by(Organization.id)
                )
                organization_ids = list(result.scalars().all())

        console.print(f"[cyan]{len(organization_ids)} organization(s) to process.")

        total_rows = 0
        with Progress(console=console) as progress:
            task = progress.add_task("[cyan]Organizations", total=len(organization_ids))
            for id in organization_ids:
                async with sessionmaker() as session:
                    total_rows += await backfill_organization(
                        session, id, execute=execute
                    )
                    if execute:
                        await session.commit()

                progress.advance(task)
                await asyncio.sleep(sleep_seconds)

        if not execute:
            console.print(
                f"[yellow]Dry-run — use --execute to write {total_rows} row(s) "
                f"across {len(organization_ids)} organization(s). A customer in both "
                "views counts twice."
            )
            return

        log.info("backfill.complete", rows=total_rows)
        console.print(
            f"\n[green]Wrote {total_rows} row(s) across "
            f"{len(organization_ids)} organization(s)."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
