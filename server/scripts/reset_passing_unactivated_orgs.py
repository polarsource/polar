"""
Reset details_submitted_at for CREATED orgs that already passed agent
review but never reached ACTIVE — they're stuck on Stripe Identity /
Stripe Connect Express. Clearing the timestamp re-routes them to the
new V2 onboarding checklist, which guides them through the missing
prerequisites; re-submission will trigger a fresh agent review (whose
verdict overwrites the existing row).

Usage:
    cd server
    uv run python -m scripts.reset_passing_unactivated_orgs            # dry-run
    uv run python -m scripts.reset_passing_unactivated_orgs --execute  # apply
"""

import asyncio
from datetime import UTC, datetime

import structlog
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_console_logging()


_TARGET_WHERE = """
    o.deleted_at IS NULL
    AND o.status = 'created'
    AND o.details_submitted_at IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM organization_reviews r
        WHERE r.organization_id = o.id
          AND r.deleted_at IS NULL
          AND r.verdict = 'PASS'
          AND r.reason != 'Grandfathered organization'
    )
    -- Safety: skip merchants with any live activity
    AND NOT EXISTS (SELECT 1 FROM checkouts c WHERE c.organization_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM orders ord WHERE ord.organization_id = o.id)
"""


async def _show_targets(session: AsyncSession, *, sample_limit: int) -> int:
    count_result = await session.execute(
        text(f"SELECT COUNT(*) FROM organizations o WHERE {_TARGET_WHERE}")
    )
    total = count_result.scalar_one()

    if total == 0:
        console.print("[green]No matching orgs — nothing to reset.")
        return 0

    sample_result = await session.execute(
        text(f"""
            SELECT o.id, o.slug, o.name, o.details_submitted_at, o.created_at
            FROM organizations o
            WHERE {_TARGET_WHERE}
            ORDER BY o.created_at ASC
            LIMIT :sample_limit
        """),
        {"sample_limit": sample_limit},
    )

    table = Table(
        title=f"PASS+stuck CREATED orgs to reset (showing {sample_limit} of {total})"
    )
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Name")
    table.add_column("Submitted", style="yellow")
    table.add_column("Created", style="cyan")

    for row in sample_result.all():
        table.add_row(
            str(row.id),
            row.slug,
            row.name or "",
            row.details_submitted_at.date().isoformat(),
            row.created_at.date().isoformat(),
        )

    console.print(table)
    console.print(f"\n[yellow]Total to reset: {total}")
    return total


async def _run_reset(
    sessionmaker: async_sessionmaker[AsyncSession],
    *,
    batch_size: int,
    sleep_seconds: float,
) -> int:
    """Reset matching orgs in batches.

    Per batch, in a single transaction: clear ``details_submitted_at`` and
    append an internal_notes line documenting the reset.
    """
    now_ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M")
    note_line = (
        f"[{now_ts} UTC] Reset details_submitted_at: PASS review preserved; "
        f"merchant re-routed to V2 onboarding to complete Stripe Identity / "
        f"Connect Express. A fresh agent review will run on resubmission."
    )

    select_targets_sql = text(f"""
        SELECT o.id FROM organizations o
        WHERE {_TARGET_WHERE}
        ORDER BY o.id
        LIMIT :limit
    """)

    update_orgs_sql = text("""
        UPDATE organizations
        SET details_submitted_at = NULL,
            internal_notes = CASE
                WHEN internal_notes IS NULL OR internal_notes = ''
                THEN :note
                ELSE internal_notes || E'\\n\\n' || :note
            END
        WHERE id = ANY(:ids)
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
            "[cyan]Resetting PASS+stuck orgs: Batch 0 — 0 reset", total=None
        )

        while True:
            async with sessionmaker() as session:
                target_ids = (
                    (await session.execute(select_targets_sql, {"limit": batch_size}))
                    .scalars()
                    .all()
                )

                if not target_ids:
                    progress.update(
                        task,
                        description=f"[green]✓ Complete: {total_updated} orgs reset",
                    )
                    break

                await session.execute(
                    update_orgs_sql,
                    {"note": note_line, "ids": target_ids},
                )
                await session.commit()

                batch_number += 1
                total_updated += len(target_ids)
                progress.update(
                    task,
                    description=(
                        f"[cyan]Resetting PASS+stuck orgs: "
                        f"Batch {batch_number} — {total_updated} reset"
                    ),
                )

            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

    return total_updated


@cli.command()
@typer_async
async def reset_passing_unactivated_orgs(
    execute: bool = typer.Option(
        False, help="Actually run the reset (default: dry-run)"
    ),
    sample_limit: int = typer.Option(50, help="Sample size in the dry-run preview"),
    batch_size: int = typer.Option(500, help="Orgs to update per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Sleep between batches"),
) -> None:
    log = structlog.get_logger()

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        if not execute:
            console.rule("[bold]Dry-run: reset PASS+stuck CREATED orgs")
        else:
            console.rule("[bold]Executing: reset PASS+stuck CREATED orgs")

        async with sessionmaker() as session:
            count = await _show_targets(session, sample_limit=sample_limit)

        if count == 0:
            return

        if not execute:
            console.print(
                f"\n[yellow]Dry-run — use --execute to reset {count} organization(s)."
            )
            return

        console.print()
        total = await _run_reset(
            sessionmaker, batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        log.info("reset.complete", rowcount=total)
        console.print(f"\n[green]Reset {total} organization(s).")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
