"""Repair payments damaged by the pending-intent recorder racing the charge.

``payment_intent.created`` fired at the same moment as ``charge.succeeded``,
and both handlers wrote a ``Payment`` for the same attempt. That produced two
kinds of damage:

  - Duplicates: both handlers found no row and both inserted. One row is keyed
    on the intent, its sibling on the charge, so ``ix_payments_processor_id``
    never fired. The intent-keyed row is the spurious one — the charge carries
    the method and the outcome.
  - Downgrades: the ``created`` payload always reports a null ``latest_charge``,
    so a late delivery found the charge row through the intent id in its
    metadata and reset it to ``pending``, blanking the method along the way.

Duplicates are soft-deleted in batches. Downgrades are reconciled one by one
against Stripe, which is the source of truth for the charge: a row that is
legitimately pending (ACH and other delayed-notification methods) reads back as
pending and is written unchanged.

Idempotent: a soft-deleted duplicate drops out of the candidate set, and a
reconciled row is rewritten with what Stripe already reports.

Usage:
    cd server

    # Dry-run (default) — counts duplicates and prints the Stripe decision per
    # downgrade candidate, without writing:
    uv run python -m scripts.backfill_pending_intent_race_payments

    # Apply:
    uv run python -m scripts.backfill_pending_intent_race_payments --execute
"""

from collections.abc import Sequence
from datetime import datetime

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import ColumnElement, Select, exists, func, select, update
from sqlalchemy.orm import aliased

from polar.enums import PaymentProcessor
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import Dispute, Payment, Refund
from polar.models.payment import STRIPE_PAYMENT_INTENT_METADATA_KEY, PaymentStatus
from polar.payment.service import UNKNOWN_PAYMENT_METHOD
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

# The deploy that introduced the race.
DEFAULT_SINCE = datetime.fromisoformat("2026-07-22T09:00:00+00:00")


def _intent_id() -> ColumnElement[str]:
    return Payment.processor_metadata[STRIPE_PAYMENT_INTENT_METADATA_KEY].astext


def _is_referenced() -> ColumnElement[bool]:
    return exists(select(Refund.id).where(Refund.payment_id == Payment.id)) | exists(
        select(Dispute.id).where(Dispute.payment_id == Payment.id)
    )


def _duplicates_where(since: datetime) -> list[ColumnElement[bool]]:
    """Intent-keyed rows whose charge-keyed sibling is still live.

    Both sides are bound to the window so the planner can drive off
    ``ix_payments_created_at``; the intent id itself carries no index, and
    correlating on it alone scans the table once per candidate.
    """
    charge_row = aliased(Payment, name="charge_payment")
    charge_intent_id = charge_row.processor_metadata[
        STRIPE_PAYMENT_INTENT_METADATA_KEY
    ].astext
    promoted_intents = select(charge_intent_id).where(
        charge_row.processor == PaymentProcessor.stripe,
        charge_row.deleted_at.is_(None),
        charge_row.created_at >= since,
        charge_intent_id.is_not(None),
        charge_row.processor_id != charge_intent_id,
    )
    return [
        Payment.processor == PaymentProcessor.stripe,
        Payment.deleted_at.is_(None),
        Payment.status == PaymentStatus.pending,
        Payment.created_at >= since,
        _intent_id() == Payment.processor_id,
        Payment.processor_id.in_(promoted_intents),
        ~_is_referenced(),
    ]


def _downgrades_statement(since: datetime) -> Select[tuple[Payment]]:
    """Charge-keyed rows sitting at pending, damaged or genuinely pending."""
    return (
        select(Payment)
        .where(
            Payment.processor == PaymentProcessor.stripe,
            Payment.deleted_at.is_(None),
            Payment.status == PaymentStatus.pending,
            Payment.created_at >= since,
            Payment.processor_id.startswith("ch_"),
        )
        .order_by(Payment.created_at)
    )


def _render(rows: Sequence[tuple[Payment, str, str]]) -> None:
    table = Table(title=f"Downgrade candidates ({len(rows)})")
    table.add_column("Payment", style="dim")
    table.add_column("Charge", style="dim")
    table.add_column("Stripe status")
    table.add_column("Action")
    for payment, stripe_status, action in rows:
        style = "green" if action.startswith("→") else "yellow"
        table.add_row(
            str(payment.id),
            payment.processor_id,
            stripe_status,
            f"[{style}]{action}[/{style}]",
        )
    console.print(table)


@cli.command()
@typer_async
async def backfill_pending_intent_race_payments(
    execute: bool = typer.Option(False, help="Apply the repair (default: dry-run)"),
    since: datetime = typer.Option(DEFAULT_SINCE, help="Only consider payments after"),
    batch_size: int = typer.Option(1000, help="Duplicates soft-deleted per batch"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    mode = "EXECUTE" if execute else "DRY-RUN"
    console.rule(f"[bold]Repair pending-intent race payments — {mode}")

    rows: list[tuple[Payment, str, str]] = []
    restored = unchanged = errored = 0

    try:
        async with sessionmaker() as session:
            duplicates = (
                await session.execute(
                    select(func.count(Payment.id)).where(*_duplicates_where(since))
                )
            ).scalar_one()
            console.print(f"Duplicate intent-keyed payments: [bold]{duplicates}[/bold]")

            payments = (
                (await session.execute(_downgrades_statement(since))).scalars().all()
            )
            for payment in payments:
                try:
                    charge = await stripe_service.get_charge(payment.processor_id)
                except Exception as e:
                    errored += 1
                    rows.append((payment, "—", f"error — {type(e).__name__}"))
                    log.warning(
                        "Failed to retrieve charge from Stripe",
                        payment_id=str(payment.id),
                        charge_id=payment.processor_id,
                        error=str(e),
                    )
                    continue

                status = PaymentStatus.from_stripe_charge(charge.status)
                if (
                    status == PaymentStatus.pending
                    and payment.method != UNKNOWN_PAYMENT_METHOD
                ):
                    unchanged += 1
                    rows.append((payment, charge.status, "skip — pending at Stripe"))
                    continue

                restored += 1
                rows.append((payment, charge.status, f"→ {status.value}"))
                if not execute:
                    continue

                payment.status = status
                payment.amount = charge.amount
                payment.currency = charge.currency
                payment_method_details = charge.payment_method_details
                assert payment_method_details is not None
                payment.method = payment_method_details.type
                payment.method_metadata = dict(
                    payment_method_details[payment_method_details.type]
                )
                payment.customer_email = charge.billing_details.email
                session.add(payment)

            _render(rows)

            if execute:
                await session.commit()
    finally:
        await engine.dispose()

    if not execute:
        log.info(
            "Dry-run only — re-run with --execute to apply",
            would_soft_delete=duplicates,
            would_restore=restored,
            skip_pending=unchanged,
            errored=errored,
        )
        return

    soft_deleted = await run_batched_update(
        update(Payment)
        .values(deleted_at=utc_now())
        .where(
            Payment.id.in_(
                select(Payment.id)
                .where(*_duplicates_where(since))
                .order_by(Payment.id)
                .limit(limit_bindparam())
                .scalar_subquery()
            )
        ),
        batch_size=batch_size,
    )
    # rich leaves the cursor on the progress line, swallowing what follows.
    console.print()
    console.print(f"Soft-deleted duplicates: [bold]{soft_deleted}[/bold]")
    console.print(f"Restored downgrades:     [bold]{restored}[/bold]")
    log.info(
        "Repair complete",
        soft_deleted=soft_deleted,
        restored=restored,
        skip_pending=unchanged,
        errored=errored,
    )


if __name__ == "__main__":
    cli()
