import asyncio
from functools import wraps

import typer
from sqlalchemy import select, update

from polar.models import Product, Subscription
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


@cli.command()
@typer_async
async def backfill_subscription_organization_id(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Subscription)
            .values(
                organization_id=select(Product.organization_id)
                .where(Product.id == Subscription.product_id)
                .correlate(Subscription)
                .scalar_subquery()
            )
            .where(
                Subscription.id.in_(
                    select(Subscription.id)
                    .where(Subscription.organization_id.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
