"""Restore missing locks when an order's latest payment is a pending SEPA debit.

Deploy the SEPA stale-lock cleanup fix to workers before running this data migration.
Pause new payment attempts (automatic and manual) during the repair so they cannot
create newer payments on orders whose locks are still missing. Run the dry-run
again after execution and confirm it reports 0 before resuming attempts.

    uv run python -m scripts.backfill_sepa_payment_locks
    uv run python -m scripts.backfill_sepa_payment_locks --execute

Dry-run by default. Existing locks and dunning dates are left unchanged. The latest
non-deleted payment is selected across ALL methods/statuses, by created_at then id.
The update is batched and safe to rerun; no schema migration or Stripe calls occur.
"""

from uuid import UUID

import typer
from sqlalchemy import Select, Update, func, select, update
from sqlalchemy.orm import aliased

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Order, Payment
from polar.models.payment import PaymentStatus
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()


def candidate_statement() -> Select[tuple[UUID]]:
    latest_payment = aliased(Payment)
    latest_payment_id = (
        select(latest_payment.id)
        .where(latest_payment.order_id == Order.id, ~latest_payment.is_deleted)
        .order_by(latest_payment.created_at.desc(), latest_payment.id.desc())
        .limit(1)
        .correlate(Order)
        .scalar_subquery()
    )
    return (
        select(Order.id)
        .join(Payment, Payment.id == latest_payment_id)
        .where(
            ~Order.is_deleted,
            Order.payment_lock_acquired_at.is_(None),
            Payment.status == PaymentStatus.pending,
            Payment.method == "sepa_debit",
        )
    )


def backfill_statement() -> Update:
    # Serialize with webhook status updates before locking the order, as webhooks do.
    candidates = (
        candidate_statement()
        .order_by(Order.id)
        .limit(limit_bindparam())
        .with_for_update(of=Payment)
    )
    return (
        update(Order)
        .where(Order.id.in_(candidates), Order.payment_lock_acquired_at.is_(None))
        .values(payment_lock_acquired_at=func.now(), modified_at=Order.modified_at)
        .execution_options(synchronize_session=False)
    )


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(False, help="Restore locks (default: count only)"),
    batch_size: int = typer.Option(500, min=1),
    sleep_seconds: float = typer.Option(0.1, min=0),
) -> None:
    configure_script_logging()
    if not execute:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        try:
            async with sessionmaker() as session:
                count = await session.scalar(
                    select(func.count()).select_from(candidate_statement().subquery())
                )
                typer.echo(f"Dry-run: {count} order locks would be restored.")
        finally:
            await engine.dispose()
        return

    updated = await run_batched_update(
        backfill_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
    )
    typer.echo(f"Restored {updated} order locks.")


if __name__ == "__main__":
    cli()
