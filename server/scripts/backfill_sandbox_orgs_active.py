"""
Promote existing sandbox organizations to ACTIVE.

Newly-created sandbox orgs default to ACTIVE with full transaction
capabilities, but orgs created before that change are still sitting in
CREATED, REVIEW, SNOOZED, or DENIED with restricted capabilities — so
their checkout, subscription, payout, and refund flows stay broken in
sandbox.

This script promotes every such org to ACTIVE and refreshes capabilities
to match. It refuses to run outside the sandbox environment.

Usage:
    cd server

    # Dry-run (default) — show counts and a sample of candidates:
    uv run python -m scripts.backfill_sandbox_orgs_active

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_sandbox_orgs_active --execute
"""

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import func, select, update

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
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


PROMOTABLE_STATUSES = (
    OrganizationStatus.CREATED,
    OrganizationStatus.REVIEW,
    OrganizationStatus.SNOOZED,
    OrganizationStatus.DENIED,
)

SAMPLE_LIMIT = 50


async def _count_by_status(
    session: AsyncSession,
) -> list[tuple[OrganizationStatus, int]]:
    result = await session.execute(
        select(Organization.status, func.count())
        .where(
            Organization.deleted_at.is_(None),
            Organization.status.in_(PROMOTABLE_STATUSES),
        )
        .group_by(Organization.status)
        .order_by(Organization.status)
    )
    return [(status, total) for status, total in result.all()]


async def _sample_candidates(
    session: AsyncSession, *, limit: int
) -> list[Organization]:
    result = await session.execute(
        select(Organization)
        .where(
            Organization.deleted_at.is_(None),
            Organization.status.in_(PROMOTABLE_STATUSES),
        )
        .order_by(Organization.created_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


def _render_summary(counts: list[tuple[OrganizationStatus, int]]) -> int:
    table = Table(title="Sandbox orgs to promote to ACTIVE")
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
    table.add_column("Current status", style="yellow")
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
    if not settings.is_sandbox():
        console.print(
            "[red]Refusing to run: this script is only safe in the sandbox "
            f"environment. Current ENV={settings.ENV.value}."
        )
        raise typer.Exit(code=1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            counts = await _count_by_status(session)
            sample = await _sample_candidates(session, limit=SAMPLE_LIMIT)

        total = _render_summary(counts)
        if total == 0:
            console.print(
                "[green]No sandbox organizations in CREATED, REVIEW, SNOOZED, or DENIED."
            )
            return

        console.print()
        _render_sample(sample)

        if not execute:
            console.print(
                f"\n[yellow]Dry-run — use --execute to promote {total} "
                "organization(s) to ACTIVE."
            )
            return

        console.rule("[bold]Executing backfill")
        subquery = (
            select(Organization.id)
            .where(
                Organization.deleted_at.is_(None),
                Organization.status.in_(PROMOTABLE_STATUSES),
            )
            .order_by(Organization.id)
            .limit(limit_bindparam())
            .scalar_subquery()
        )
        stmt = (
            update(Organization)
            .where(Organization.id.in_(subquery))
            .values(
                status=OrganizationStatus.ACTIVE,
                status_updated_at=func.now(),
                capabilities=STATUS_CAPABILITIES[OrganizationStatus.ACTIVE],
            )
        )
        rows_updated = await run_batched_update(
            stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        log.info("backfill.complete", rowcount=rows_updated)
        console.print(f"\n[green]Promoted {rows_updated} organization(s) to ACTIVE.")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
