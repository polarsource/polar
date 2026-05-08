"""
Snooze organizations that have been stuck in REVIEW for too long.

Moves organizations from REVIEW → SNOOZED when they've been in REVIEW
for more than a configurable number of days (default: 14).

This mirrors the service-layer transition in
`OrganizationService.snooze_organization`:
  - Sets status = 'snoozed' and status_updated_at = now()
  - Increments snooze_count
  - Appends an internal note explaining the auto-snooze

Usage:
    cd server

    # Dry-run (default) — show which orgs would be snoozed:
    uv run python -m scripts.snooze_stale_reviews

    # Snooze orgs in review for more than 7 days:
    uv run python -m scripts.snooze_stale_reviews --days 7

    # Execute the snooze:
    uv run python -m scripts.snooze_stale_reviews --execute

    # Execute with custom threshold:
    uv run python -m scripts.snooze_stale_reviews --days 7 --execute
"""

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table
from sqlalchemy import CursorResult, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models.organization import OrganizationStatus
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_console_logging()


async def _show_stale_reviews(session: AsyncSession, *, cutoff: datetime) -> int:
    """Show organizations in REVIEW that have been there since before the cutoff."""
    result = await session.execute(
        text("""
            SELECT id, slug, name, status_updated_at
            FROM organizations
            WHERE status = :review_status
              AND status_updated_at < :cutoff
            ORDER BY status_updated_at ASC
            LIMIT 1000
        """),
        {"cutoff": cutoff, "review_status": OrganizationStatus.REVIEW.value},
    )
    rows = result.all()

    if not rows:
        console.print("[green]No stale reviews found — all review orgs are recent.")
        return 0

    table = Table(
        title=f"Stale Reviews (in REVIEW since before {cutoff:%Y-%m-%d %H:%M} UTC)"
    )
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Name")
    table.add_column("In Review Since", style="yellow")
    table.add_column("Days in Review", justify="right", style="red")

    now = datetime.now(UTC)
    for row in rows:
        days = (now - row.status_updated_at).days if row.status_updated_at else "?"
        table.add_row(
            str(row.id),
            row.slug,
            row.name or "",
            str(row.status_updated_at),
            str(days),
        )

    console.print(table)
    console.print(f"\n[yellow]Found {len(rows)} organization(s) eligible for snoozing.")
    return len(rows)


async def _show_status_summary(session: AsyncSession) -> None:
    """Show a summary table of organization statuses."""
    result = await session.execute(
        text("""
            SELECT status, COUNT(*) AS total
            FROM organizations
            GROUP BY status
            ORDER BY status
        """)
    )

    table = Table(title="Organization Status Distribution")
    table.add_column("Status", style="cyan")
    table.add_column("Total", justify="right")

    for status, total in result.all():
        table.add_row(status, str(total))

    console.print(table)


async def _run_snooze(
    sessionmaker: async_sessionmaker[AsyncSession],
    *,
    cutoff: datetime,
    batch_size: int,
    sleep_seconds: float,
) -> int:
    """Snooze stale review organizations in batches.

    For each batch this performs the equivalent of the service-layer
    ``snooze_organization`` method:
      - status → snoozed, status_updated_at → now()
      - snooze_count += 1
      - internal_notes gets an auto-snooze entry
    """
    now_ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M")
    note_line = f"[{now_ts} UTC] Organization auto-snoozed (stale review)."

    update_sql = text("""
        UPDATE organizations
        SET status = :snoozed_status,
            status_updated_at = now(),
            snooze_count = snooze_count + 1,
            snoozed_until = now() + INTERVAL '24 hours',
            snooze_type = 'next_sale',
            internal_notes = CASE
                WHEN internal_notes IS NULL OR internal_notes = ''
                THEN :note
                ELSE internal_notes || E'\\n\\n' || :note
            END
        WHERE id IN (
            SELECT id FROM organizations
            WHERE status = :review_status
              AND status_updated_at < :cutoff
            ORDER BY status_updated_at ASC
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
            "[cyan]Snoozing stale reviews: Batch 0 — 0 orgs snoozed", total=None
        )

        while True:
            async with sessionmaker() as session:
                result = await session.execute(
                    update_sql,
                    {
                        "cutoff": cutoff,
                        "limit": batch_size,
                        "note": note_line,
                        "review_status": OrganizationStatus.REVIEW.value,
                        "snoozed_status": OrganizationStatus.SNOOZED.value,
                    },
                )
                await session.commit()
                rows_updated = cast(CursorResult[Any], result).rowcount

                if rows_updated == 0:
                    progress.update(
                        task,
                        description=(
                            f"[green]✓ Complete: {total_updated} orgs snoozed"
                        ),
                    )
                    break

                batch_number += 1
                total_updated += rows_updated
                progress.update(
                    task,
                    description=(
                        f"[cyan]Snoozing stale reviews: "
                        f"Batch {batch_number} — {total_updated} orgs snoozed"
                    ),
                )

            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

    return total_updated


@cli.command()
@typer_async
async def snooze_stale_reviews(
    days: int = typer.Option(
        14, help="Snooze orgs in REVIEW for more than this many days"
    ),
    execute: bool = typer.Option(
        False, help="Actually run the snooze (default: dry-run)"
    ),
    batch_size: int = typer.Option(500, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    import structlog

    log = structlog.get_logger()

    cutoff = datetime.now(UTC) - timedelta(days=days)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        if not execute:
            console.rule(
                f"[bold]Dry-run: snooze orgs in REVIEW for >{days} days "
                f"(since before {cutoff:%Y-%m-%d})"
            )
            log.info("Running in DRY-RUN mode (no changes will be made)")
            log.info("Use --execute to actually snooze organizations")
            console.print()

            async with sessionmaker() as session:
                await _show_status_summary(session)
                console.print()
                await _show_stale_reviews(session, cutoff=cutoff)

            return

        console.rule(
            f"[bold]Executing: snooze orgs in REVIEW for >{days} days "
            f"(since before {cutoff:%Y-%m-%d})"
        )
        log.warning("Running in EXECUTE mode — will modify data!")

        async with sessionmaker() as session:
            console.print("[bold]Before:")
            await _show_status_summary(session)
            console.print()
            count = await _show_stale_reviews(session, cutoff=cutoff)

        if count == 0:
            log.info("Nothing to do — no stale reviews found")
            return

        console.print()
        total = await _run_snooze(
            sessionmaker,
            cutoff=cutoff,
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )

        log.info("Snooze complete", total_snoozed=total)
        console.print()

        async with sessionmaker() as session:
            console.print("[bold]After:")
            await _show_status_summary(session)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
