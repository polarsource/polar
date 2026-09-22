"""
Replace the addresses in `trial_redemptions.customer_email` with salted hashes.

The column is only ever compared for equality — a trial redemption is looked up
by the mailbox that redeemed it, never read back — so it doesn't need to hold
the address. `TrialRedemptionRepository.get_all_by_organization_and_hints` now
matches on `hash_pii(normalized_email)`, and only falls back to comparing the
address itself for rows written before this script ran.

Run this right after deploying the hashing code, then drop that fallback.

Values are lowercased before hashing, the way the fallback comparison matches
them; they are already normalized, by the service on write and by the
re-normalization backfill for older rows.

Rows whose value holds no `@` are already hashed and are skipped, which makes
the script resumable and safe to re-run.

Usage:
    cd server

    # Dry-run (default) — report how many rows would change:
    uv run python -m scripts.hash_trial_redemption_customer_emails

    # Execute the backfill (batched):
    uv run python -m scripts.hash_trial_redemption_customer_emails --execute
"""

import asyncio
from uuid import UUID

import structlog
import typer
from rich.console import Console
from sqlalchemy import func, select, update

from polar.config import DEFAULT_PII_SCRUBBING_SALT, Environment, settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.pii import hash_pii
from polar.models import TrialRedemption
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

# An address always carries an "@"; a hexadecimal digest never does.
PLAINTEXT_CLAUSE = TrialRedemption.customer_email_hash.like("%@%")


async def hash_batch(
    session: AsyncSession, *, after: UUID | None, batch_size: int, execute: bool
) -> tuple[UUID | None, int]:
    """Hash one batch of addresses, returning the cursor and the row count."""
    statement = (
        select(TrialRedemption.id, TrialRedemption.customer_email_hash)
        .where(PLAINTEXT_CLAUSE)
        .order_by(TrialRedemption.id)
        .limit(batch_size)
    )
    if after is not None:
        statement = statement.where(TrialRedemption.id > after)
    batch = (await session.execute(statement)).tuples().all()

    if not batch:
        return None, 0

    if execute:
        await session.execute(
            update(TrialRedemption),
            [
                {
                    "id": trial_redemption_id,
                    "customer_email_hash": hash_pii(email.lower()),
                }
                for trial_redemption_id, email in batch
            ],
        )
        await session.commit()

    return batch[-1][0], len(batch)


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    batch_size: int = typer.Option(
        5000, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    if (
        execute
        and settings.PII_SCRUBBING_SALT == DEFAULT_PII_SCRUBBING_SALT
        and not settings.is_environment({Environment.development, Environment.testing})
    ):
        raise typer.BadParameter(
            "POLAR_PII_SCRUBBING_SALT is still the default. Hashes computed "
            "under it can't be redone: this run is what removes the addresses."
        )

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            total = await session.scalar(
                select(func.count())
                .select_from(TrialRedemption)
                .where(PLAINTEXT_CLAUSE)
            )
        console.print(f"[bold]{total}[/bold] trial redemption(s) to hash.")

        after: UUID | None = None
        hashed = 0

        while True:
            async with sessionmaker() as session:
                after, count = await hash_batch(
                    session, after=after, batch_size=batch_size, execute=execute
                )
            if after is None:
                break
            hashed += count

            console.print(f"{hashed}/{total} {'hashed' if execute else 'to hash'}.")

            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

        if hashed == 0:
            console.print("[green]Every trial redemption email is already hashed.")
        elif execute:
            log.info("hash_trial_redemption_customer_emails.complete", rowcount=hashed)
            console.print(f"[green]Hashed {hashed} trial redemption email(s).")
        else:
            console.print(
                f"[yellow]Dry-run — {hashed} row(s) would change. "
                "Use --execute to apply."
            )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
