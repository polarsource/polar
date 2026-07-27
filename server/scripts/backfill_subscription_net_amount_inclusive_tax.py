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
    BigInteger,
    ColumnElement,
    CursorResult,
    Numeric,
    func,
    select,
    update,
)

from polar.config import settings
from polar.enums import TaxBehavior
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Order, Subscription

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def _computed_net_amount() -> ColumnElement[int]:
    """
    Net amount derived from the subscription's latest inclusive-tax order.

    The subscription row doesn't store a tax rate, so we back inclusive tax out of
    `amount` using the net/gross ratio of the latest order that actually carried a
    usable tax treatment. Subscriptions with no such order coalesce to their current
    `net_amount`, which makes them invisible to the update predicate (idempotent, and
    never writes NULL into the NOT NULL column).
    """
    order_taxable_total = Order.net_amount + Order.tax_amount
    latest_order_net = (
        select(
            func.cast(
                func.round(
                    func.cast(Subscription.amount, Numeric)
                    * Order.net_amount
                    / func.cast(order_taxable_total, Numeric)
                ),
                BigInteger,
            )
        )
        .where(
            Order.subscription_id == Subscription.id,
            Order.tax_behavior == TaxBehavior.inclusive,
            order_taxable_total > 0,
        )
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(1)
        .correlate(Subscription)
        .scalar_subquery()
    )
    return func.coalesce(latest_order_net, Subscription.net_amount)


async def run_backfill(
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    session: AsyncSession | None = None,
) -> int:
    """
    Recompute `net_amount` for inclusive-tax subscriptions.

    Before subscriptions tracked inclusive tax, `net_amount` was always set equal to
    `amount`. This corrects every subscription with `tax_behavior == inclusive` by
    backing the inclusive tax out, using the ratio from its latest qualifying order.

    Set-based and batched: each batch updates up to `batch_size` rows whose stored
    `net_amount` differs from the freshly computed value, so already-correct rows
    (and rows with no qualifying order) drop out of the predicate. This gives the loop
    its termination condition and makes the whole script safe to rerun.
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
                    select(Subscription.id)
                    .where(
                        Subscription.tax_behavior == TaxBehavior.inclusive,
                        Subscription.net_amount.is_distinct_from(
                            _computed_net_amount()
                        ),
                    )
                    .limit(batch_size)
                )
                result = await session.execute(
                    update(Subscription)
                    .where(Subscription.id.in_(batch))
                    .values(net_amount=_computed_net_amount())
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
    """Backfill net_amount for inclusive-tax subscriptions."""
    configure_script_logging()
    total_updated = await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds
    )
    typer.echo(f"Updated {total_updated} subscriptions")


if __name__ == "__main__":
    cli()
