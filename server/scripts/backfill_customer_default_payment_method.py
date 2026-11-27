"""
Set a default payment method on customers paying for an active subscription.

A card saved at checkout used to be pinned on the subscription only, so customers
who never picked a default in the portal have `default_payment_method_id = NULL`.
Checkout now sets it; this backfills existing customers from the payment method of
their active subscription. When a customer has several, the most recently created
subscription wins.

Only customers without a default are touched, and only with a payment method of
their own that isn't deleted. No webhook or event is emitted.

Usage:
    cd server

    # Dry-run (default) — show how many customers would get a default:
    uv run python -m scripts.backfill_customer_default_payment_method

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_customer_default_payment_method --execute
"""

from uuid import UUID

import structlog
import typer
from rich.console import Console
from sqlalchemy import ColumnElement, ScalarSelect, Select, Update, func, select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, PaymentMethod, Subscription
from polar.models.subscription import SubscriptionStatus
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


def _subscription_payment_method() -> ScalarSelect[UUID | None]:
    return (
        select(Subscription.payment_method_id)
        .join(PaymentMethod, PaymentMethod.id == Subscription.payment_method_id)
        .where(
            Subscription.customer_id == Customer.id,
            Subscription.status.in_(SubscriptionStatus.active_statuses()),
            Subscription.deleted_at.is_(None),
            PaymentMethod.customer_id == Customer.id,
            PaymentMethod.deleted_at.is_(None),
        )
        .order_by(Subscription.created_at.desc())
        .limit(1)
        .correlate(Customer)
        .scalar_subquery()
    )


def _missing_default() -> ColumnElement[bool]:
    return (
        Customer.deleted_at.is_(None)
        & Customer.default_payment_method_id.is_(None)
        & _subscription_payment_method().is_not(None)
    )


def missing_default_count_statement() -> Select[int]:
    return select(func.count()).select_from(Customer).where(_missing_default())


def backfill_statement() -> Update:
    subquery = (
        select(Customer.id)
        .where(_missing_default())
        .order_by(Customer.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )
    return (
        update(Customer)
        .where(Customer.id.in_(subquery), Customer.default_payment_method_id.is_(None))
        .values(default_payment_method_id=_subscription_payment_method())
    )


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
            result = await session.execute(missing_default_count_statement())
            total = result.scalar_one()

        console.print(
            f"[bold]{total}[/bold] customer(s) with an active subscription "
            "and no default payment method."
        )

        if total == 0:
            return

        if not execute:
            console.print("[yellow]Dry-run — use --execute to backfill them.")
            return

        console.rule("[bold]Executing backfill")
        rows_updated = await run_batched_update(
            backfill_statement(),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )
        log.info("backfill.complete", rowcount=rows_updated)
        console.print(
            f"[green]Set a default payment method on {rows_updated} customer(s)."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
