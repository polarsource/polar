"""
Backfill customers.first_user_event_at from the Tinybird aggregating views.

The column is filled going forward by event ingestion and by the
`customer.resolve_first_user_event_at` task, but neither reaches customers whose
events were all ingested before those paths existed. This script fills them.

Events reach a customer under two keys: `customer_id` when the caller knew the
Polar id, and `external_customer_id` otherwise — including events ingested before
the customer row existed, which is the whole point of the column. Both views are
read, and the earlier of the two wins.

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
from datetime import datetime
from uuid import UUID

import structlog
import typer
from rich.console import Console
from rich.progress import Progress
from sqlalchemy import select

from polar.customer.repository import CustomerRepository
from polar.integrations.tinybird import service as tinybird_service
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
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


def _chunks(timestamps: dict[UUID, datetime], size: int) -> list[dict[UUID, datetime]]:
    items = list(timestamps.items())
    return [dict(items[i : i + size]) for i in range(0, len(items), size)]


async def backfill_organization(
    session: AsyncSession, organization_id: UUID, *, execute: bool
) -> int:
    """
    Resolve and write `first_user_event_at` for one organization's customers.

    Returns the number of customers the views produced a timestamp for.
    """
    (
        by_customer_id,
        by_external_customer_id,
    ) = await tinybird_service.get_first_user_event_at_by_organization(organization_id)

    if not by_customer_id and not by_external_customer_id:
        return 0

    repository = CustomerRepository.from_session(session)
    timestamps = dict(by_customer_id)

    if by_external_customer_id:
        customer_ids = await repository.get_ids_by_external_ids_and_organization(
            list(by_external_customer_id), organization_id
        )
        for external_id, timestamp in by_external_customer_id.items():
            customer_id = customer_ids.get(external_id)
            if customer_id is None:
                continue
            earliest = timestamps.get(customer_id)
            if earliest is None or timestamp < earliest:
                timestamps[customer_id] = timestamp

    if execute:
        for chunk in _chunks(timestamps, CHUNK_SIZE):
            await repository.lower_first_user_event_at(chunk)

    return len(timestamps)


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
        async with sessionmaker() as session:
            statement = select(Organization.id).order_by(Organization.id)
            if organization_id is not None:
                statement = statement.where(Organization.id == organization_id)
            result = await session.execute(statement)
            organization_ids = list(result.scalars().all())

        total_customers = 0
        with Progress(console=console) as progress:
            task = progress.add_task("[cyan]Organizations", total=len(organization_ids))
            for id in organization_ids:
                async with sessionmaker() as session:
                    total_customers += await backfill_organization(
                        session, id, execute=execute
                    )
                    if execute:
                        await session.commit()

                progress.advance(task)
                await asyncio.sleep(sleep_seconds)

        if not execute:
            console.print(
                f"[yellow]Dry-run — use --execute to backfill {total_customers} "
                f"customer(s) across {len(organization_ids)} organization(s)."
            )
            return

        log.info("backfill.complete", customers=total_customers)
        console.print(
            f"\n[green]Backfilled {total_customers} customer(s) across "
            f"{len(organization_ids)} organization(s)."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
