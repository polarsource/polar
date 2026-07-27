"""
Backfill `pause_at_period_end` to false on existing subscriptions.

The column is added nullable by the migration to avoid rewriting the large
`subscriptions` table under an exclusive lock. New rows get `false` via the
model-level default; this script fills the pre-existing rows in batches so a
follow-up migration can set the column NOT NULL.

Usage:
    cd server

    # Dry-run (default) — show how many subscriptions would be updated:
    uv run python -m scripts.backfill_subscription_pause_at_period_end

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_subscription_pause_at_period_end --execute
"""

import structlog
import typer
from rich.console import Console
from sqlalchemy import ColumnElement, func, select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Subscription
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


def _candidate_filter() -> tuple[ColumnElement[bool], ...]:
    """Every subscription whose pause flag has not been set yet."""
    return (Subscription.pause_at_period_end.is_(None),)


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
                select(func.count()).where(*_candidate_filter())
            )
            total = result.scalar_one()

        if total == 0:
            console.print(
                "[green]No subscriptions to update — pause_at_period_end already set."
            )
            return

        if not execute:
            console.print(
                f"[yellow]Dry-run — use --execute to set pause_at_period_end=false "
                f"for {total} subscription(s)."
            )
            return

        console.rule("[bold]Executing backfill")
        subquery = (
            select(Subscription.id)
            .where(*_candidate_filter())
            .order_by(Subscription.id)
            .limit(limit_bindparam())
            .scalar_subquery()
        )
        stmt = (
            update(Subscription)
            .where(Subscription.id.in_(subquery))
            .values(pause_at_period_end=False)
        )
        rows_updated = await run_batched_update(
            stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        log.info("backfill.complete", rowcount=rows_updated)
        console.print(
            f"\n[green]Set pause_at_period_end=false for {rows_updated} "
            "subscription(s)."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
