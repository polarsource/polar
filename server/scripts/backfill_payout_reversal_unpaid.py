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
from typing import Any
from uuid import UUID

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import Row, Select, Update, func, or_, select, update
from sqlalchemy.orm import aliased

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Transaction
from polar.models.transaction import TransactionType
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

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
_PREVIEW_LIMIT = 50


def _candidates[SelectT: Select[Any]](statement: SelectT) -> SelectT:
    return statement.join(
        reversed_payout_transaction,
        (reversed_payout_transaction.payout_id == reversal.payout_id)
        & (reversed_payout_transaction.type == TransactionType.payout),
    ).where(reversal.type == TransactionType.payout_reversal, _MISATTRIBUTED)


def _preview_statement() -> Select[tuple[UUID, datetime, int, UUID | None, UUID]]:
    return _candidates(
        select(
            reversal.id,
            reversal.created_at,
            reversal.amount,
            reversal.payout_transaction_id,
            reversed_payout_transaction.id,
        )
    ).order_by(reversal.created_at)


def _count_statement() -> Select[tuple[int]]:
    return select(func.count()).select_from(_candidates(select(reversal.id)).subquery())


def _attribution_statement() -> Update:
    batch = _candidates(select(reversal.id)).limit(limit_bindparam())
    target = (
        select(reversed_payout_transaction.id)
        .where(
            reversed_payout_transaction.payout_id == Transaction.payout_id,
            reversed_payout_transaction.type == TransactionType.payout,
        )
        .correlate(Transaction)
        .scalar_subquery()
    )
    return (
        update(Transaction)
        .where(Transaction.id.in_(batch))
        .values(payout_transaction_id=target)
        .execution_options(synchronize_session=False)
    )


def _render(
    rows: Sequence[Row[tuple[UUID, datetime, int, UUID | None, UUID]]], total: int
) -> None:
    title = f"Misattributed payout reversals ({total})"
    if len(rows) < total:
        title += f" — first {len(rows)}"
    table = Table(title=title)
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


async def run_backfill(
    session: AsyncSession,
    *,
    execute: bool,
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
) -> int:
    total = (await session.execute(_count_statement())).scalar_one()
    rows = (await session.execute(_preview_statement().limit(_PREVIEW_LIMIT))).all()
    _render(rows, total)

    if total == 0:
        log.info("Nothing to do — every reversal points at the payout it reverses")
        return 0
    if not execute:
        log.info("Dry-run only — re-run with --execute to attribute", total=total)
        return 0

    attributed = await run_batched_update(
        _attribution_statement(),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
        session=session,
    )
    log.info("Attributed payout reversals", attributed=attributed)
    return attributed


@cli.command()
@typer_async
async def backfill_payout_reversal_unpaid(
    execute: bool = typer.Option(
        False, help="Actually re-point the reversals (default: dry-run)"
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    mode = "EXECUTE" if execute else "DRY-RUN"
    console.rule(
        f"[bold]Attribute payout reversals to the payout they reverse — {mode}"
    )

    try:
        async with sessionmaker() as session:
            await run_backfill(
                session,
                execute=execute,
                batch_size=batch_size,
                sleep_seconds=sleep_seconds,
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
