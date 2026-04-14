"""
Migrate organization status values from deprecated to new values.

Part of the 3-phase widen/migrate/narrow approach for OrganizationStatus changes:
- PR 2 (Widen): Added REVIEW + SNOOZED to the enum so code tolerates both old and new
- PR 3 (This script): Convert all DB rows to new values
- PR 4 (Narrow): Remove deprecated enum values from code

Conversions:
    onboarding_started → created
    initial_review     → review
    ongoing_review     → review

Prerequisites:
    PR 2 must be deployed first so running code can read the new values.

Usage:
    cd server

    # Dry-run (default) — show counts of rows that would be updated:
    uv run python -m scripts.migrate_organization_statuses

    # Execute the migration:
    uv run python -m scripts.migrate_organization_statuses --execute

    # Rollback (best-effort, onboarding_started→created is not reversible):
    uv run python -m scripts.migrate_organization_statuses --rollback --execute
"""

import asyncio
from typing import Any, cast

import typer
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from sqlalchemy import CursorResult, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()

configure_script_console_logging()

MIGRATIONS = [
    ("onboarding_started", "created", None),
    ("initial_review", "review", None),
    ("ongoing_review", "review", None),
]

ROLLBACK_MIGRATIONS = [
    ("review", "ongoing_review", "initially_reviewed_at IS NOT NULL"),
    ("review", "initial_review", "initially_reviewed_at IS NULL"),
    # onboarding_started → created is not reversible
]


def _build_where(extra_condition: str | None) -> str:
    where = "status = :old_value"
    if extra_condition:
        where += f" AND {extra_condition}"
    return where


async def _show_counts(session: AsyncSession) -> None:
    import structlog

    log = structlog.get_logger()
    result = await session.execute(
        text(
            "SELECT status, COUNT(*) FROM organizations GROUP BY status ORDER BY status"
        )
    )
    for status, count in result.all():
        log.info("Status count", status=status, count=count)


async def _run_batched_status_update(
    sessionmaker: async_sessionmaker[AsyncSession],
    *,
    old_value: str,
    new_value: str,
    extra_condition: str | None = None,
    batch_size: int,
    sleep_seconds: float,
) -> int:
    """Run a batched UPDATE on organizations.status using raw SQL to bypass StringEnum."""
    where_clause = _build_where(extra_condition)

    update_sql = text(f"""
        UPDATE organizations
        SET status = :new_value
        WHERE id IN (
            SELECT id FROM organizations
            WHERE {where_clause}
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
        label = f"{old_value} → {new_value}"
        task = progress.add_task(f"[cyan]{label}: Batch 0 — 0 rows updated", total=None)

        while True:
            async with sessionmaker() as session:
                result = await session.execute(
                    update_sql,
                    {
                        "old_value": old_value,
                        "new_value": new_value,
                        "limit": batch_size,
                    },
                )
                await session.commit()
                rows_updated = cast(CursorResult[Any], result).rowcount

                if rows_updated == 0:
                    progress.update(
                        task,
                        description=f"[green]✓ {label}: {total_updated} rows updated",
                    )
                    break

                batch_number += 1
                total_updated += rows_updated
                progress.update(
                    task,
                    description=f"[cyan]{label}: Batch {batch_number} — {total_updated} rows updated",
                )

            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

    return total_updated


@cli.command()
@typer_async
async def migrate(
    execute: bool = typer.Option(
        False, help="Actually run the migration (default: dry-run)"
    ),
    rollback: bool = typer.Option(
        False,
        help="Rollback to old status values (onboarding_started→created is not reversible)",
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    import structlog

    log = structlog.get_logger()

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        migrations = ROLLBACK_MIGRATIONS if rollback else MIGRATIONS

        if not execute:
            log.info("Running in DRY-RUN mode (no changes will be made)")
            log.info("Use --execute to actually run the migration")

            async with sessionmaker() as session:
                await _show_counts(session)

                for old_value, new_value, extra_condition in migrations:
                    result = await session.execute(
                        text(
                            f"SELECT COUNT(*) FROM organizations WHERE {_build_where(extra_condition)}"
                        ),
                        {"old_value": old_value},
                    )
                    log.info(
                        "Would migrate",
                        from_status=old_value,
                        to_status=new_value,
                        condition=extra_condition,
                        count=result.scalar(),
                    )
            return

        action = "ROLLBACK" if rollback else "MIGRATION"
        log.warning(f"Running in EXECUTE mode — {action} will modify data!")

        for old_value, new_value, extra_condition in migrations:
            total = await _run_batched_status_update(
                sessionmaker,
                old_value=old_value,
                new_value=new_value,
                extra_condition=extra_condition,
                batch_size=batch_size,
                sleep_seconds=sleep_seconds,
            )
            log.info(
                "Migration step done",
                from_status=old_value,
                to_status=new_value,
                total_updated=total,
            )

        async with sessionmaker() as session:
            log.info("Final status distribution:")
            await _show_counts(session)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
