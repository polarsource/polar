"""
Backfill organizations with blocked_at set to have status = 'blocked'.

Part of the blocked_at → OrganizationStatus.BLOCKED migration (PR 3 of 7):
- PR 1: Added BLOCKED to OrganizationStatus enum (code-only)
- PR 2: Dual-write — block/unblock sets BOTH blocked_at AND status
- PR 3 (This script): Backfill historical rows so blocked_at ↔ status are in sync
- PR 4+: Switch reads from blocked_at to status, then drop blocked_at

Prerequisites:
    PR 2 must be deployed first so new block/unblock operations keep both fields
    in sync while this script catches up historical rows.

What it does:
    Sets status = 'blocked' and status_updated_at = COALESCE(blocked_at, now())
    for all organizations where blocked_at IS NOT NULL and status != 'blocked'.

Usage:
    cd server

    # Dry-run (default) — show current state and what would change:
    uv run python -m scripts.backfill_blocked_status

    # Execute the backfill:
    uv run python -m scripts.backfill_blocked_status --execute

    # Verify after execution:
    uv run python -m scripts.backfill_blocked_status --verify
"""

import asyncio
from typing import Any, cast

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table
from sqlalchemy import CursorResult, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_console_logging()


async def _show_status_summary(session: AsyncSession) -> None:
    """Show a summary table of organization statuses and blocked_at state."""
    result = await session.execute(
        text("""
            SELECT
                status,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE blocked_at IS NOT NULL) AS has_blocked_at
            FROM organizations
            GROUP BY status
            ORDER BY status
        """)
    )

    table = Table(title="Organization Status Distribution")
    table.add_column("Status", style="cyan")
    table.add_column("Total", justify="right")
    table.add_column("Has blocked_at", justify="right", style="yellow")

    for status, total, has_blocked_at in result.all():
        table.add_row(status, str(total), str(has_blocked_at))

    console.print(table)


async def _show_drift(session: AsyncSession) -> int:
    """Show rows where blocked_at and status disagree. Returns count of drifted rows."""
    result = await session.execute(
        text("""
            SELECT id, slug, status, blocked_at
            FROM organizations
            WHERE blocked_at IS NOT NULL AND status != 'blocked'
            ORDER BY blocked_at DESC
        """)
    )
    rows = result.all()

    if not rows:
        console.print("[green]No drift detected — blocked_at and status are in sync.")
        return 0

    table = Table(title="Drift: blocked_at IS NOT NULL but status != 'blocked'")
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Current Status", style="red")
    table.add_column("blocked_at", style="yellow")

    for row in rows:
        table.add_row(str(row.id), row.slug, row.status, str(row.blocked_at))

    console.print(table)
    console.print(f"\n[yellow]Found {len(rows)} row(s) that need backfilling.")
    return len(rows)


async def _show_reverse_drift(session: AsyncSession) -> int:
    """Show rows where status is blocked but blocked_at is NULL."""
    result = await session.execute(
        text("""
            SELECT id, slug, status, status_updated_at
            FROM organizations
            WHERE blocked_at IS NULL AND status = 'blocked'
            ORDER BY status_updated_at DESC
        """)
    )
    rows = result.all()

    if not rows:
        console.print(
            "[green]No reverse drift — all status='blocked' rows have blocked_at set."
        )
        return 0

    table = Table(title="Reverse Drift: status = 'blocked' but blocked_at IS NULL")
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("status_updated_at", style="yellow")

    for row in rows:
        table.add_row(str(row.id), row.slug, str(row.status_updated_at))

    console.print(table)
    console.print(f"\n[yellow]Found {len(rows)} row(s) with reverse drift.")
    return len(rows)


async def _run_backfill(
    sessionmaker: async_sessionmaker[AsyncSession],
    *,
    batch_size: int,
    sleep_seconds: float,
) -> int:
    """Backfill status = 'blocked' for rows with blocked_at set."""

    update_sql = text("""
        UPDATE organizations
        SET status = 'blocked',
            status_updated_at = COALESCE(blocked_at, now())
        WHERE id IN (
            SELECT id FROM organizations
            WHERE blocked_at IS NOT NULL
              AND status != 'blocked'
            ORDER BY id
            LIMIT :limit
        )
    """)

    total_updated = 0
    batch_number = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        transient=False,
    ) as progress:
        task = progress.add_task(
            "[cyan]Backfill blocked status: Batch 0 — 0 rows updated", total=None
        )

        while True:
            async with sessionmaker() as session:
                result = await session.execute(update_sql, {"limit": batch_size})
                await session.commit()
                rows_updated = cast(CursorResult[Any], result).rowcount

                if rows_updated == 0:
                    progress.update(
                        task,
                        description=(
                            f"[green]✓ Backfill complete: {total_updated} rows updated"
                        ),
                    )
                    break

                batch_number += 1
                total_updated += rows_updated
                progress.update(
                    task,
                    description=(
                        f"[cyan]Backfill blocked status: "
                        f"Batch {batch_number} — {total_updated} rows updated"
                    ),
                )

            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

    return total_updated


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
    import structlog

    log = structlog.get_logger()

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        if verify:
            console.rule("[bold]Verification: blocked_at ↔ status consistency")
            async with sessionmaker() as session:
                await _show_status_summary(session)
                console.print()

                drift = await _show_drift(session)
                console.print()
                reverse_drift = await _show_reverse_drift(session)

                if drift == 0 and reverse_drift == 0:
                    console.print(
                        "\n[bold green]All checks passed — "
                        "blocked_at and status are fully consistent."
                    )
                else:
                    console.print(
                        f"\n[bold red]Inconsistencies found: "
                        f"{drift} forward drift, {reverse_drift} reverse drift."
                    )
            return

        if not execute:
            console.rule("[bold]Dry-run: backfill blocked_at → status = 'blocked'")
            log.info("Running in DRY-RUN mode (no changes will be made)")
            log.info("Use --execute to actually run the backfill")
            console.print()

            async with sessionmaker() as session:
                await _show_status_summary(session)
                console.print()
                await _show_drift(session)

            return

        console.rule("[bold]Executing backfill: blocked_at → status = 'blocked'")
        log.warning("Running in EXECUTE mode — will modify data!")

        async with sessionmaker() as session:
            console.print("[bold]Before:")
            await _show_status_summary(session)
            console.print()

        total = await _run_backfill(
            sessionmaker,
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )

        log.info("Backfill complete", total_updated=total)
        console.print()

        async with sessionmaker() as session:
            console.print("[bold]After:")
            await _show_status_summary(session)
            console.print()
            await _show_drift(session)
            console.print()
            await _show_reverse_drift(session)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
