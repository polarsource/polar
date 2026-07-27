import typer
from sqlalchemy import ColumnElement, func, select, update

from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Order

from .helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()


def _computed_billing_name() -> ColumnElement[str | None]:
    """
    Billing name derived from the order's customer.

    ``order.billing_name`` is a snapshot of ``customer.billing_name`` (the
    ``_billing_name`` column falling back to ``name``) taken at order creation.
    Orders created for a nameless customer got a null snapshot and can never
    produce an invoice. We re-derive it from the customer, coalescing to the
    order's current ``billing_name`` so already-filled orders (and orders whose
    customer still has no name) compute to their existing value and are excluded
    by the ``is_distinct_from`` predicate below — idempotent, never writes NULL.

    ``Customer._billing_name`` is the mapped column behind the read-only
    ``billing_name`` property; the property isn't queryable, so we read the
    column directly.

    Run *after* ``backfill_customer_name`` so the customer name is populated
    first — otherwise the source it reads is still null.
    """
    customer_billing_name = (
        select(func.coalesce(Customer._billing_name, Customer.name))
        .where(Customer.id == Order.customer_id)
        .correlate(Order)
        .scalar_subquery()
    )
    return func.coalesce(Order.billing_name, customer_billing_name)


async def run_backfill(
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    session: AsyncSession | None = None,
) -> int:
    """
    Backfill ``order.billing_name`` from the order's customer, for paid-through
    orders that never got one.

    Invoice generation is hard-gated on ``order.billing_name`` (and
    ``billing_address``) being non-null, so orders snapshotted from a nameless
    customer can never produce an invoice. This re-derives the name from the
    customer without overwriting orders that already have one. Orders still
    missing a ``billing_address`` remain un-invoiceable — that's a separate gate.

    ``billing_name IS DISTINCT FROM COALESCE(billing_name, <customer name>)`` is
    only true when ``billing_name`` is null and the customer has a name, so
    already-filled orders (and orders whose customer has no name) drop out of the
    predicate. This gives the batched loop its termination condition and makes
    the script safe to rerun.
    """
    batch = (
        select(Order.id)
        .where(
            Order.deleted_at.is_(None),
            Order.billing_name.is_distinct_from(_computed_billing_name()),
        )
        .limit(limit_bindparam())
    )
    update_statement = (
        update(Order)
        .where(Order.id.in_(batch))
        .values(billing_name=_computed_billing_name())
        .execution_options(synchronize_session=False)
    )
    return await run_batched_update(
        update_statement,
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
        session=session,
    )


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Backfill order.billing_name from the order's customer."""
    configure_script_logging()
    total_updated = await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds
    )
    typer.echo(f"Updated {total_updated} orders")


if __name__ == "__main__":
    cli()
