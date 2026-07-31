"""
Drop the `auto_accept_currency` key from organizations.dispute_settings.

The threshold is denominated in the account's settlement currency, so the key
carries no meaning. It was written by the column's first backfill and never read.

Usage:
    cd server

    # Dry-run (default) — show how many rows still carry the key:
    uv run python -m scripts.cleanup_organization_dispute_settings_currency

    # Execute (batched):
    uv run python -m scripts.cleanup_organization_dispute_settings_currency --execute
"""

import structlog
import typer
from rich.console import Console
from sqlalchemy import Select, Update, func, select, update

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

CURRENCY_KEY = "auto_accept_currency"
HAS_CURRENCY_KEY = Organization.dispute_settings.has_key(CURRENCY_KEY)


def pending_count_statement() -> Select[tuple[int]]:
    return select(func.count()).select_from(Organization).where(HAS_CURRENCY_KEY)


def drop_key_statement() -> Update:
    subquery = (
        select(Organization.id)
        .where(HAS_CURRENCY_KEY)
        .order_by(Organization.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )
    return (
        update(Organization)
        .where(Organization.id.in_(subquery))
        .values(dispute_settings=Organization.dispute_settings - CURRENCY_KEY)
    )


@cli.command()
@typer_async
async def cleanup(
    execute: bool = typer.Option(
        False, help="Actually run the cleanup (default: dry-run)"
    ),
    batch_size: int = typer.Option(
        5000, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            result = await session.execute(pending_count_statement())
            total = result.scalar_one()

        if total == 0:
            console.print("[green]No organizations carry auto_accept_currency.")
            return

        if not execute:
            console.print(
                f"[yellow]Dry-run — use --execute to drop the key from {total} "
                "organization(s)."
            )
            return

        console.rule("[bold]Executing cleanup")
        rows_updated = await run_batched_update(
            drop_key_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        log.info("cleanup.complete", rowcount=rows_updated)
        console.print(
            f"\n[green]Dropped auto_accept_currency from {rows_updated} "
            "organization(s)."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
