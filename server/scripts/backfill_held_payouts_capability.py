"""
Grant the `payouts` capability to organizations already under review.

The payout-hold flow flips `STATUS_CAPABILITIES` so REVIEW and SNOOZED orgs
have `payouts: True` (a request is reserved and held until approval, instead
of being blocked). But `capabilities` is a denormalized JSONB column that is
only refreshed on a status transition, so orgs that were already in REVIEW or
SNOOZED at deploy time still have `payouts: false` stored, so `can_payout`,
`estimate()`, and the public `capabilities.payouts` field all keep rejecting
them until their next status change.

This script backfills `capabilities->>'payouts' = true` for every non-deleted
org currently in REVIEW or SNOOZED whose stored capability is still false. It
only touches the `payouts` key; every other capability is left untouched.

Usage:
    cd server

    # Dry-run (default): show counts and a sample of candidates.
    uv run python -m scripts.backfill_held_payouts_capability

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_held_payouts_capability --execute
"""

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import ColumnElement, Text, cast, func, select, update
from sqlalchemy.dialects.postgresql import ARRAY

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import OrganizationStatus
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()


HELD_PAYOUT_STATUSES = (
    OrganizationStatus.REVIEW,
    OrganizationStatus.SNOOZED,
)

SAMPLE_LIMIT = 50


def _candidate_filter() -> tuple[ColumnElement[bool], ...]:
    """Orgs under review whose stored `payouts` capability is still false."""
    return (
        Organization.deleted_at.is_(None),
        Organization.status.in_(HELD_PAYOUT_STATUSES),
        Organization.capabilities["payouts"].as_boolean().is_not(True),
    )


async def _count_by_status(
    session: AsyncSession,
) -> list[tuple[OrganizationStatus, int]]:
    result = await session.execute(
        select(Organization.status, func.count())
        .where(*_candidate_filter())
        .group_by(Organization.status)
        .order_by(Organization.status)
    )
    return [(status, total) for status, total in result.all()]


async def _sample_candidates(
    session: AsyncSession, *, limit: int
) -> list[Organization]:
    result = await session.execute(
        select(Organization)
        .where(*_candidate_filter())
        .order_by(Organization.created_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


def _render_summary(counts: list[tuple[OrganizationStatus, int]]) -> int:
    table = Table(title="Orgs to grant the payouts capability")
    table.add_column("Status", style="yellow")
    table.add_column("Count", justify="right", style="cyan")
    total = 0
    for status, count in counts:
        table.add_row(status.value, str(count))
        total += count
    console.print(table)
    return total


def _render_sample(organizations: list[Organization]) -> None:
    if not organizations:
        return
    table = Table(title=f"Sample (first {len(organizations)} by created_at)")
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Status", style="yellow")
    table.add_column("Created", style="cyan")

    for org in organizations:
        table.add_row(
            str(org.id),
            org.slug,
            org.status.value,
            org.created_at.isoformat(),
        )

    console.print(table)


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            counts = await _count_by_status(session)
            sample = await _sample_candidates(session, limit=SAMPLE_LIMIT)

        total = _render_summary(counts)
        if total == 0:
            console.print(
                "[green]No REVIEW/SNOOZED organizations with payouts disabled."
            )
            return

        console.print()
        _render_sample(sample)

        if not execute:
            console.print(
                f"\n[yellow]Dry-run. Use --execute to grant the payouts "
                f"capability to {total} organization(s)."
            )
            return

        console.rule("[bold]Executing backfill")
        subquery = (
            select(Organization.id)
            .where(*_candidate_filter())
            .order_by(Organization.id)
            .limit(limit_bindparam())
            .scalar_subquery()
        )
        stmt = (
            update(Organization)
            .where(Organization.id.in_(subquery))
            # Only flip the payouts key; leave the rest of the JSON untouched.
            # The path must be bound as text[] (not a scalar string), otherwise
            # Postgres can't resolve jsonb_set(jsonb, varchar, jsonb).
            .values(
                capabilities=func.jsonb_set(
                    Organization.capabilities,
                    cast(["payouts"], ARRAY(Text)),
                    func.to_jsonb(True),
                )
            )
        )
        rows_updated = await run_batched_update(
            stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        log.info("backfill.complete", rowcount=rows_updated)
        console.print(
            f"\n[green]Granted the payouts capability to {rows_updated} "
            "organization(s)."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
