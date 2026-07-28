"""Attribute ``payout_reversal`` transactions to the payout they reverse.

Reversals used to be left unattributed, then claimed by whichever payout came
next — counting the released funds twice, since the reset balance transactions
already carry them. That breaks the check in ``create_payout_invoice``, so the
affected payouts cannot produce an invoice, and their CSV export lists a row
that doesn't reconcile to the payout total.

Pointing each reversal at the payout transaction it reverses restores
``sum(paid_transactions) == payout.amount`` and leaves no reversal
unattributed. Idempotent: repaired rows drop out of the candidate set.

Usage:
    cd server

    # Dry-run (default) — list the reversals and where they point today:
    uv run python -m scripts.backfill_payout_reversal_unpaid

    # Apply:
    uv run python -m scripts.backfill_payout_reversal_unpaid --execute
"""

from collections.abc import Sequence
from datetime import datetime
from typing import Any, cast
from uuid import UUID

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import CursorResult, Row, Select, or_, select, update
from sqlalchemy.orm import aliased

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Transaction
from polar.models.transaction import TransactionType
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
configure_script_console_logging()
log = structlog.get_logger()

reversal = aliased(Transaction, name="reversal")
reversed_payout_transaction = aliased(Transaction, name="reversed_payout_transaction")

_MISATTRIBUTED = or_(
    reversal.payout_transaction_id.is_(None),
    reversal.payout_transaction_id != reversed_payout_transaction.id,
)


def _candidates_statement() -> Select[tuple[UUID, datetime, int, UUID | None, UUID]]:
    return (
        select(
            reversal.id,
            reversal.created_at,
            reversal.amount,
            reversal.payout_transaction_id,
            reversed_payout_transaction.id,
        )
        .join(
            reversed_payout_transaction,
            (reversed_payout_transaction.payout_id == reversal.payout_id)
            & (reversed_payout_transaction.type == TransactionType.payout),
        )
        .where(reversal.type == TransactionType.payout_reversal, _MISATTRIBUTED)
        .order_by(reversal.created_at)
    )


def _render(
    rows: Sequence[Row[tuple[UUID, datetime, int, UUID | None, UUID]]],
) -> None:
    table = Table(title=f"Misattributed payout reversals ({len(rows)})")
    table.add_column("Reversal ID", style="dim")
    table.add_column("Created")
    table.add_column("Amount", justify="right")
    table.add_column("Points at today", style="yellow")
    table.add_column("Should point at", style="green")
    for reversal_id, created_at, amount, current, target in rows:
        table.add_row(
            str(reversal_id),
            created_at.date().isoformat(),
            str(amount),
            str(current) if current else "nothing",
            str(target),
        )
    console.print(table)


async def run_backfill(session: AsyncSession, *, execute: bool) -> int:
    rows = (await session.execute(_candidates_statement())).all()
    _render(rows)

    if not rows:
        log.info("Nothing to do — every reversal points at the payout it reverses")
        return 0
    if not execute:
        log.info("Dry-run only — re-run with --execute to attribute", total=len(rows))
        return 0

    target = (
        select(reversed_payout_transaction.id)
        .where(
            reversed_payout_transaction.payout_id == Transaction.payout_id,
            reversed_payout_transaction.type == TransactionType.payout,
        )
        .scalar_subquery()
    )
    result = cast(
        CursorResult[Any],
        await session.execute(
            update(Transaction)
            .where(
                Transaction.type == TransactionType.payout_reversal,
                Transaction.id.in_([row[0] for row in rows]),
            )
            .values(payout_transaction_id=target)
        ),
    )
    log.info("Attributed payout reversals", attributed=result.rowcount)
    return result.rowcount


@cli.command()
@typer_async
async def backfill_payout_reversal_unpaid(
    execute: bool = typer.Option(
        False, help="Actually re-point the reversals (default: dry-run)"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    mode = "EXECUTE" if execute else "DRY-RUN"
    console.rule(
        f"[bold]Attribute payout reversals to the payout they reverse — {mode}"
    )

    try:
        async with sessionmaker() as session:
            await run_backfill(session, execute=execute)
            await session.commit()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
