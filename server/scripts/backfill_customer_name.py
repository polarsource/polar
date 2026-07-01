import typer
from sqlalchemy import ColumnElement, func, select, update

from polar.kit.db.postgres import AsyncSession
from polar.models import Checkout, Customer
from polar.models.checkout import CheckoutStatus

from .helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()


def _computed_name() -> ColumnElement[str | None]:
    """
    Name derived from the customer's earliest succeeded checkout.

    Mirrors what checkout confirmation now does for a nameless customer:
    ``customer.name = checkout.customer_billing_name or checkout.customer_name``.
    We coalesce to the customer's current ``name``, so customers that already
    have a name (or have no succeeded checkout carrying one) compute to their
    existing value and are excluded by the ``is_distinct_from`` predicate below
    — idempotent, and never writes NULL.
    """
    checkout_name = func.coalesce(
        Checkout.customer_billing_name, Checkout.customer_name
    )
    earliest_checkout_name = (
        select(checkout_name)
        .where(
            Checkout.customer_id == Customer.id,
            Checkout.status == CheckoutStatus.succeeded,
            Checkout.deleted_at.is_(None),
            checkout_name.is_not(None),
        )
        .order_by(Checkout.created_at.asc(), Checkout.id.asc())
        .limit(1)
        .correlate(Customer)
        .scalar_subquery()
    )
    return func.coalesce(Customer.name, earliest_checkout_name)


async def run_backfill(
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    session: AsyncSession | None = None,
) -> int:
    """
    Backfill ``customer.name`` from the earliest succeeded checkout that carried
    a name, for customers that don't have one yet.

    A nameless customer leaves ``billing_name`` (which falls back to ``name``)
    null, so its orders get a null ``billing_name`` and can never produce an
    invoice. This sets an initial name without ever overwriting an existing one.

    ``name IS DISTINCT FROM COALESCE(name, <checkout name>)`` is only true when
    ``name`` is null and a checkout name exists, so already-named customers (and
    those with no qualifying checkout) drop out of the predicate. This gives the
    batched loop its termination condition and makes the script safe to rerun.
    """
    batch = (
        select(Customer.id)
        .where(
            Customer.deleted_at.is_(None),
            Customer.name.is_distinct_from(_computed_name()),
        )
        .limit(limit_bindparam())
    )
    update_statement = (
        update(Customer)
        .where(Customer.id.in_(batch))
        .values(name=_computed_name())
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
    """Backfill customer.name from the earliest succeeded checkout."""
    configure_script_logging()
    total_updated = await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds
    )
    typer.echo(f"Updated {total_updated} customers")


if __name__ == "__main__":
    cli()
