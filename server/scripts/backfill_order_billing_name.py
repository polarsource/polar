import asyncio
from typing import Any, cast

import typer
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)
from sqlalchemy import (
    ColumnElement,
    CursorResult,
    func,
    select,
    update,
)

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Customer, Order

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def _computed_billing_name() -> ColumnElement[str | None]:
    """
    Billing name derived from the order's customer.

    ``order.billing_name`` is a snapshot of ``customer.billing_name`` (the
    ``_billing_name`` column falling back to ``name``) taken at order creation.
    Orders created for a nameless customer got a null snapshot and can never
    produce an invoice. We re-derive it from the customer, coalescing to the
    order's current ``billing_name`` so already-filled orders (and orders whose
    customer still has no name) compute to their existing value and drop out of
    the update predicate — idempotent, and never writes NULL.

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

    Set-based and batched: each batch updates up to ``batch_size`` orders whose
    stored ``billing_name`` differs from the computed value, so already-filled
    orders (and orders whose customer has no name) drop out of the predicate.
    This gives the loop its termination condition and makes the script safe to
    rerun.
    """
    engine = None
    own_session = False

    if session is None:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.script",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    total_updated = 0
    batch_number = 0

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows updated", total=None)

            while True:
                batch = (
                    select(Order.id)
                    .where(
                        Order.deleted_at.is_(None),
                        Order.billing_name.is_(None),
                        Order.billing_name.is_distinct_from(_computed_billing_name()),
                    )
                    .limit(batch_size)
                )
                result = await session.execute(
                    update(Order)
                    .where(Order.id.in_(batch))
                    .values(billing_name=_computed_billing_name())
                    .execution_options(synchronize_session=False)
                )
                await session.commit()

                rows_updated = cast(CursorResult[Any], result).rowcount
                if rows_updated == 0:
                    progress.update(
                        task,
                        description=(
                            f"[green]✓ Complete: {total_updated} rows updated"
                        ),
                    )
                    break

                batch_number += 1
                total_updated += rows_updated
                progress.update(
                    task,
                    description=(
                        f"[cyan]Batch {batch_number}: {total_updated} rows updated"
                    ),
                )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

        return total_updated

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


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
