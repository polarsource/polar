"""
Re-normalize `trial_redemptions.customer_email` under the current rules.

The column stores an email already reduced to the mailbox it delivers to, so
that a customer can't buy a second trial by varying an address they control.
That reduction used to strip only the `+alias` suffix; it now also lowercases
and applies Google's addressing rules (`googlemail.com` is `gmail.com`, and
Gmail ignores dots in the local part).

Rows written before that change hold the old form, and the lookup in
`TrialRedemptionRepository.get_all_by_organization_and_hints` compares against
the new one, so `john.doe@gmail.com` stored yesterday no longer matches
`johndoe@gmail.com` presented today. Run this right after deploying the new
normalization to close that gap.

Normalization runs in Python against `polar.kit.email.normalize_email` rather
than being mirrored in SQL, so there is exactly one definition of the rules.

Addresses that no longer parse are counted and left untouched; the trial they
record still blocks on customer id and payment method fingerprint.

Usage:
    cd server

    # Dry-run (default) — report how many rows would change:
    uv run python -m scripts.backfill_trial_redemption_customer_email

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_trial_redemption_customer_email --execute
"""

import asyncio
from uuid import UUID

import structlog
import typer
from rich.console import Console
from sqlalchemy import func, select, update

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.email import EmailNotValidError, normalize_email
from polar.models import TrialRedemption
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()


async def _fetch_batch(
    session: AsyncSession, *, after: UUID | None, batch_size: int
) -> list[tuple[UUID, str]]:
    statement = (
        select(TrialRedemption.id, TrialRedemption.customer_email)
        .order_by(TrialRedemption.id)
        .limit(batch_size)
    )
    if after is not None:
        statement = statement.where(TrialRedemption.id > after)
    result = await session.execute(statement)
    return list(result.tuples().all())


async def _apply(session: AsyncSession, changes: list[dict[str, object]]) -> None:
    await session.execute(update(TrialRedemption), changes)
    await session.commit()


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
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            total = await session.scalar(
                select(func.count()).select_from(TrialRedemption)
            )
        console.print(f"[bold]{total}[/bold] trial redemption(s) to inspect.")

        after: UUID | None = None
        scanned = 0
        changed = 0
        invalid = 0

        while True:
            async with sessionmaker() as session:
                batch = await _fetch_batch(session, after=after, batch_size=batch_size)
                if not batch:
                    break

                after = batch[-1][0]
                scanned += len(batch)

                changes: list[dict[str, object]] = []
                for trial_redemption_id, email in batch:
                    try:
                        normalized = normalize_email(email)
                    except EmailNotValidError:
                        invalid += 1
                        log.warning(
                            "backfill.unparseable_email",
                            trial_redemption_id=str(trial_redemption_id),
                        )
                        continue
                    if normalized != email:
                        changes.append(
                            {"id": trial_redemption_id, "customer_email": normalized}
                        )

                changed += len(changes)

                if changes and execute:
                    await _apply(session, changes)

            console.print(
                f"Scanned {scanned}/{total} — {changed} row(s) "
                f"{'updated' if execute else 'to update'}, {invalid} unparseable."
            )

            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

        if changed == 0:
            console.print("[green]Every trial redemption is already normalized.")
        elif execute:
            log.info("backfill.complete", rowcount=changed, invalid=invalid)
            console.print(f"[green]Re-normalized {changed} trial redemption(s).")
        else:
            console.print(
                f"[yellow]Dry-run — {changed} row(s) would change. "
                "Use --execute to apply."
            )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
