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
from polar.models import Checkout, Customer
from polar.models.checkout import CheckoutStatus

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def _computed_name() -> ColumnElement[str | None]:
    """
    Name derived from the customer's earliest succeeded checkout.

    Mirrors what checkout confirmation now does for a nameless customer:
    ``customer.name = checkout.customer_billing_name or checkout.customer_name``.
    We coalesce to the customer's current ``name``, so customers that already
    have a name (or have no succeeded checkout carrying one) compute to their
    existing value and drop out of the update predicate — idempotent, and never
    writes NULL.
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

    Set-based and batched: each batch updates up to ``batch_size`` customers
    whose stored ``name`` differs from the computed value, so already-named
    customers (and those with no qualifying checkout) drop out of the predicate.
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
                    select(Customer.id)
                    .where(
                        Customer.deleted_at.is_(None),
                        Customer.name.is_(None),
                        Customer.name.is_distinct_from(_computed_name()),
                    )
                    .limit(batch_size)
                )
                result = await session.execute(
                    update(Customer)
                    .where(Customer.id.in_(batch))
                    .values(name=_computed_name())
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
    """Backfill customer.name from the earliest succeeded checkout."""
    configure_script_logging()
    total_updated = await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds
    )
    typer.echo(f"Updated {total_updated} customers")


if __name__ == "__main__":
    cli()
