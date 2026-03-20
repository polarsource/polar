import asyncio
from functools import wraps

import typer
from sqlalchemy import select, update

from polar.enums import TaxBehavior, TaxBehaviorOption
from polar.models import (
    Checkout,
    Order,
    Organization,
    Subscription,
)
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def backfill_orders(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Order)
            .values(tax_behavior=TaxBehavior.exclusive)
            .where(
                Order.id.in_(
                    select(Order.id)
                    .where(
                        Order.tax_behavior.is_(None), Order.tax_processor.is_not(None)
                    )
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


async def backfill_checkouts(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:

    await run_batched_update(
        (
            update(Checkout)
            .values(tax_behavior=TaxBehavior.exclusive)
            .where(
                Checkout.id.in_(
                    select(Checkout.id)
                    .where(
                        Checkout.tax_behavior.is_(None),
                        Checkout.tax_processor.is_not(None),
                    )
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


async def backfill_subscriptions(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Subscription)
            .values(tax_behavior=TaxBehavior.exclusive)
            .where(
                Subscription.id.in_(
                    select(Subscription.id)
                    .where(Subscription.tax_behavior.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


async def backfill_organizations(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Organization)
            .values(default_tax_behavior=TaxBehaviorOption.exclusive)
            .where(
                Organization.id.in_(
                    select(Organization.id)
                    .where(Organization.default_tax_behavior.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


@cli.command()
@typer_async
async def backfill_all(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    print("Backfilling orders...")
    await backfill_orders(batch_size, sleep_seconds)

    print("Backfilling checkouts...")
    await backfill_checkouts(batch_size, sleep_seconds)

    print("Backfilling subscriptions...")
    await backfill_subscriptions(batch_size, sleep_seconds)

    print("Backfilling organizations...")
    await backfill_organizations(batch_size, sleep_seconds)

    print("All backfills completed!")


if __name__ == "__main__":
    cli()
