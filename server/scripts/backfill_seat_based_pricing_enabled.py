"""
Enable the seats feature flag for every organization.

The seats feature is gated by `feature_settings->>'seat_based_pricing_enabled'`,
a key in the denormalized `feature_settings` JSONB column. Historically it was
opt-in per organization, so most rows either lack the key or have it set to
`false`. This script flips it to `true` for every organization whose stored value
is not already `true` — including soft-deleted ones — leaving every other key in
`feature_settings` untouched.

Usage:
    cd server

    # Dry-run (default) — show how many organizations would be updated:
    uv run python -m scripts.backfill_seat_based_pricing_enabled

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_seat_based_pricing_enabled --execute
"""

import structlog
import typer
from rich.console import Console
from sqlalchemy import ColumnElement, Text, cast, func, select, update
from sqlalchemy.dialects.postgresql import ARRAY

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

FEATURE_KEY = "seat_based_pricing_enabled"


def _candidate_filter() -> tuple[ColumnElement[bool], ...]:
    """Every org whose seats flag is not already enabled, including soft-deleted."""
    return (Organization.feature_settings[FEATURE_KEY].as_boolean().is_not(True),)


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
                "[green]No organizations to update — seats already enabled everywhere."
            )
            return

        if not execute:
            console.print(
                f"[yellow]Dry-run — use --execute to enable seats "
                f"({FEATURE_KEY}=true) for {total} organization(s)."
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
            # Only flip the seats key; leave the rest of feature_settings untouched.
            # The path must be bound as text[] (not a scalar string), otherwise
            # Postgres can't resolve jsonb_set(jsonb, varchar, jsonb).
            .values(
                feature_settings=func.jsonb_set(
                    Organization.feature_settings,
                    cast([FEATURE_KEY], ARRAY(Text)),
                    func.to_jsonb(True),
                )
            )
        )
        rows_updated = await run_batched_update(
            stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        log.info("backfill.complete", rowcount=rows_updated)
        console.print(
            f"\n[green]Enabled seats ({FEATURE_KEY}=true) for {rows_updated} "
            "organization(s)."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
