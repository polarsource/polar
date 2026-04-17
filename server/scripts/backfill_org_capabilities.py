"""
Backfill Organization.capabilities from the current status.

Usage:
    cd server

    # Dry-run (default) — show current state and how many rows need backfilling:
    uv run python -m scripts.backfill_org_capabilities

    # Execute the backfill:
    uv run python -m scripts.backfill_org_capabilities --execute

    # Verify — expect 0 NULLs and every row in sync with its status:
    uv run python -m scripts.backfill_org_capabilities --verify
"""

import json

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import bindparam, case, false, select, text, update
from sqlalchemy.dialects.postgresql import JSONB

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import STATUS_CAPABILITIES
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


async def _show_status_summary(session: AsyncSession) -> None:
    result = await session.execute(
        text("""
            SELECT
                status,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE capabilities IS NULL) AS null_capabilities,
                COUNT(*) FILTER (WHERE capabilities IS NOT NULL) AS has_capabilities
            FROM organizations
            GROUP BY status
            ORDER BY status
        """)
    )

    table = Table(title="Organization capabilities coverage by status")
    table.add_column("Status", style="cyan")
    table.add_column("Total", justify="right")
    table.add_column("NULL capabilities", justify="right", style="yellow")
    table.add_column("Has capabilities", justify="right", style="green")

    for status, total, null_caps, has_caps in result.all():
        table.add_row(status, str(total), str(null_caps), str(has_caps))

    console.print(table)


async def _count_null(session: AsyncSession) -> int:
    result = await session.execute(
        text("SELECT COUNT(*) FROM organizations WHERE capabilities IS NULL")
    )
    return int(result.scalar_one())


async def _show_drift(session: AsyncSession) -> int:
    drift_expr = case(
        *[
            (
                Organization.status == status,
                Organization.capabilities != bindparam(f"caps_{i}", caps, type_=JSONB),
            )
            for i, (status, caps) in enumerate(STATUS_CAPABILITIES.items())
        ],
        else_=false(),
    )
    stmt = (
        select(
            Organization.id,
            Organization.slug,
            Organization.status,
            Organization.capabilities,
        )
        .where(Organization.capabilities.is_not(None), drift_expr)
        .order_by(Organization.status, Organization.id)
        .limit(50)
    )
    result = await session.execute(stmt)
    rows = result.all()

    if not rows:
        console.print(
            "[green]No drift detected — every non-NULL capabilities row matches "
            "STATUS_CAPABILITIES for its status."
        )
        return 0

    table = Table(title="Drift: capabilities do not match STATUS_CAPABILITIES[status]")
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Status", style="yellow")
    table.add_column("Stored capabilities", overflow="fold")

    for row in rows:
        table.add_row(
            str(row.id), row.slug, str(row.status), json.dumps(row.capabilities)
        )

    console.print(table)
    console.print(
        "\n[yellow]Showing up to 50 drifted rows. "
        "Drifted rows may reflect operator overrides — investigate before acting."
    )
    return len(rows)


async def _run_backfill(*, batch_size: int, sleep_seconds: float) -> int:
    total = 0
    for status, capabilities in STATUS_CAPABILITIES.items():
        subquery = (
            select(Organization.id)
            .where(
                Organization.capabilities.is_(None),
                Organization.status == status,
            )
            .order_by(Organization.id)
            .limit(limit_bindparam())
            .scalar_subquery()
        )
        stmt = (
            update(Organization)
            .values(capabilities=capabilities)
            .where(Organization.id.in_(subquery))
        )
        total += await run_batched_update(
            stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
        )
    return total


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    verify: bool = typer.Option(False, help="Only run verification checks, no changes"),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        if verify:
            console.rule("[bold]Verification: capabilities populated for every org")
            async with sessionmaker() as session:
                await _show_status_summary(session)
                console.print()

                null_count = await _count_null(session)
                drift_count = await _show_drift(session)

                if null_count == 0 and drift_count == 0:
                    console.print(
                        "\n[bold green]All checks passed — every organization "
                        "has capabilities matching its status."
                    )
                else:
                    console.print(
                        f"\n[bold red]{null_count} NULL row(s), "
                        f"{drift_count} drifted row(s)."
                    )
            return

        if not execute:
            console.rule("[bold]Dry-run: backfill organizations.capabilities")
            log.info("Running in DRY-RUN mode (no changes will be made)")
            log.info("Use --execute to actually run the backfill")
            console.print()

            async with sessionmaker() as session:
                await _show_status_summary(session)
                console.print()
                null_count = await _count_null(session)
                console.print(f"[yellow]{null_count} row(s) would be backfilled.")
            return

        console.rule("[bold]Executing backfill: organizations.capabilities")
        log.warning("Running in EXECUTE mode — will modify data!")

        async with sessionmaker() as session:
            console.print("[bold]Before:")
            await _show_status_summary(session)
            console.print()

        total = await _run_backfill(batch_size=batch_size, sleep_seconds=sleep_seconds)

        log.info("Backfill complete", total_updated=total)
        console.print()

        async with sessionmaker() as session:
            console.print("[bold]After:")
            await _show_status_summary(session)
            console.print()

            null_count = await _count_null(session)
            if null_count == 0:
                console.print("[green]✓ No NULL capabilities remain.")
            else:
                console.print(
                    f"[red]{null_count} NULL row(s) still remain — "
                    "re-run to catch rows inserted during the backfill."
                )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
