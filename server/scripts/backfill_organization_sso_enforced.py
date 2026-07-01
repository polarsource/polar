"""
Backfill organizations.sso_enforced to false.

The column was added as nullable to avoid a locking migration on the hot
`organizations` table. New rows get `false` from the model default, but rows
that existed before the column was added are still NULL. This script fills
them so a later migration can safely enforce NOT NULL.

Every physical row must be filled — including soft-deleted ones — since the
future NOT NULL constraint applies to the whole table, so we intentionally do
not filter on `deleted_at`.

Usage:
    cd server

    # Dry-run (default) — show how many rows would be backfilled:
    uv run python -m scripts.backfill_organization_sso_enforced

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_organization_sso_enforced --execute
"""

import structlog
import typer
from rich.console import Console
from sqlalchemy import func, select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
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
            result = await session.execute(
                select(func.count()).where(Organization.sso_enforced.is_(None))
            )
            total = result.scalar_one()

        if total == 0:
            console.print("[green]No organizations with a NULL sso_enforced.")
            return

        if not execute:
            console.print(
                f"[yellow]Dry-run — use --execute to backfill {total} "
                "organization(s) to sso_enforced=false."
            )
            return

        console.rule("[bold]Executing backfill")
        subquery = (
            select(Organization.id)
            .where(Organization.sso_enforced.is_(None))
            .order_by(Organization.id)
            .limit(limit_bindparam())
            .scalar_subquery()
        )
        stmt = (
            update(Organization)
            .where(Organization.id.in_(subquery))
            .values(sso_enforced=False)
        )
        rows_updated = await run_batched_update(
            stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        log.info("backfill.complete", rowcount=rows_updated)
        console.print(
            f"\n[green]Backfilled {rows_updated} organization(s) to sso_enforced=false."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
