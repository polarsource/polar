"""
Backfill ``receipt_number`` for paid orders, then enable the receipts flag.

For each target organization, the script does two things, in order:

1. Allocate a ``receipt_number`` for every paid order with a succeeded payment
   that doesn't already have one. Allocation is bulked per customer: a single
   ``UPDATE`` statement per customer per batch keeps the round-trip count low.
2. Flip ``feature_settings.receipts_enabled`` to true on the organization.

The flag flips last, so customers don't see the Download Receipt button until
every historical order has a number — no window where some orders 404.

Usage:
    cd server

    # Dry-run (default) — count candidates for one org:
    uv run python -m scripts.backfill_receipts <organization_id>

    # Execute one org:
    uv run python -m scripts.backfill_receipts <organization_id> --execute

    # Dry-run across every org:
    uv run python -m scripts.backfill_receipts --all

    # Execute across every org (smallest first):
    uv run python -m scripts.backfill_receipts --all --execute
"""

import asyncio
import uuid
from dataclasses import dataclass
from itertools import groupby

import typer
from sqlalchemy.ext.asyncio import async_sessionmaker

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.order.repository import OrderRepository
from polar.postgres import create_async_engine
from polar.receipt.service import receipt as receipt_service

from .helper import configure_script_console_logging, typer_async

cli = typer.Typer()

BATCH_SIZE = 500
SLEEP_SECONDS = 0.1


@dataclass
class OrgResult:
    organization_id: uuid.UUID
    name: str
    allocated: int = 0
    flag_enabled: bool = False


@dataclass
class BackfillResult:
    total_allocated: int = 0
    total_flag_enabled: int = 0


async def run_backfill_for_org(
    *,
    session: AsyncSession,
    organization_id: uuid.UUID,
    batch_size: int = BATCH_SIZE,
    sleep_seconds: float = SLEEP_SECONDS,
) -> OrgResult:
    organization = await session.get(Organization, organization_id)
    if organization is None:
        raise RuntimeError(f"Organization {organization_id} not found")

    result = OrgResult(organization_id=organization.id, name=organization.name)
    typer.echo(
        f"Backfilling receipts for organization {organization.name} ({organization.id})"
    )

    order_repository = OrderRepository.from_session(session)
    last_keyset: tuple[uuid.UUID, uuid.UUID] | None = None
    while True:
        orders = await order_repository.list_unallocated_paid_for_organization(
            organization_id, after=last_keyset, limit=batch_size
        )
        if not orders:
            break

        # Page query orders by (customer_id, id) so groupby clusters cleanly.
        for _, group in groupby(orders, key=lambda o: o.customer_id):
            customer_orders = list(group)
            customer = customer_orders[0].customer
            result.allocated += await receipt_service.bulk_allocate_for_customer(
                session, customer, customer_orders
            )

        last_keyset = (orders[-1].customer_id, orders[-1].id)
        await session.commit()

        typer.echo(f"  allocated={result.allocated}")

        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)

    if not organization.is_receipts_enabled:
        organization.feature_settings = {
            **organization.feature_settings,
            "receipts_enabled": True,
        }
        await session.commit()
        result.flag_enabled = True
        typer.echo("  receipts_enabled flag set to true")
    else:
        typer.echo("  receipts_enabled flag was already true")

    return result


async def _process_org(
    *,
    sessionmaker: async_sessionmaker[AsyncSession],
    organization_id: uuid.UUID,
    batch_size: int,
    sleep_seconds: float,
    summary: BackfillResult,
) -> None:
    # Per-org session so a failure on one doesn't poison the rest.
    async with sessionmaker() as session:
        org_result = await run_backfill_for_org(
            session=session,
            organization_id=organization_id,
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )
    summary.total_allocated += org_result.allocated
    if org_result.flag_enabled:
        summary.total_flag_enabled += 1


async def _resolve_target_ids(
    *,
    sessionmaker: async_sessionmaker[AsyncSession],
    organization_id: uuid.UUID | None,
    all_orgs: bool,
) -> list[uuid.UUID]:
    """Print the preview and return the org IDs to backfill."""
    async with sessionmaker() as session:
        order_repository = OrderRepository.from_session(session)
        if all_orgs:
            target_ids = list(
                await order_repository.list_organizations_with_unallocated_paid_orders()
            )
            typer.echo(
                f"Found {len(target_ids)} organization(s) with unallocated "
                "paid orders (smallest balance first)."
            )
            for org_id in target_ids:
                typer.echo(f"  {org_id}")
            return target_ids

        assert organization_id is not None
        organization = await session.get(Organization, organization_id)
        if organization is None:
            typer.echo(f"Error: Organization {organization_id} not found", err=True)
            raise typer.Exit(1)
        typer.echo(f"Organization: {organization.name} ({organization.id})")
        typer.echo(f"Current receipts_enabled flag: {organization.is_receipts_enabled}")
        return [organization_id]


def _print_summary(summary: BackfillResult, organizations_processed: int) -> None:
    typer.echo("\n=== Backfill Summary ===")
    typer.echo(f"  organizations processed: {organizations_processed}")
    typer.echo(f"  allocated: {summary.total_allocated}")
    typer.echo(f"  flag flipped this run: {summary.total_flag_enabled}")


@cli.command()
@typer_async
async def backfill(
    organization_id: uuid.UUID | None = typer.Argument(
        None, help="Organization ID to backfill (omit with --all to do every org)"
    ),
    all_orgs: bool = typer.Option(
        False, "--all", help="Backfill every organization with unallocated orders"
    ),
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    batch_size: int = typer.Option(
        BATCH_SIZE, help="Number of orders to fetch per batch"
    ),
    sleep_seconds: float = typer.Option(
        SLEEP_SECONDS, help="Seconds to sleep between batches to ease DB load"
    ),
) -> None:
    """Backfill receipt_number for paid orders, then enable the receipts flag."""
    configure_script_console_logging()

    if (organization_id is None) != all_orgs:
        typer.echo("Error: pass exactly one of <organization_id> or --all", err=True)
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    summary = BackfillResult()

    try:
        target_ids = await _resolve_target_ids(
            sessionmaker=sessionmaker,
            organization_id=organization_id,
            all_orgs=all_orgs,
        )

        if not execute:
            typer.echo(
                "\nDry-run — pass --execute to allocate receipt numbers and "
                "enable the flag(s)."
            )
            return

        if not target_ids:
            typer.echo("\nNothing to do.")
            return

        for org_id in target_ids:
            await _process_org(
                sessionmaker=sessionmaker,
                organization_id=org_id,
                batch_size=batch_size,
                sleep_seconds=sleep_seconds,
                summary=summary,
            )
    finally:
        await engine.dispose()

    _print_summary(summary, organizations_processed=len(target_ids))


if __name__ == "__main__":
    cli()
