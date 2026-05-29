import asyncio
from functools import wraps

import typer
from sqlalchemy import or_, select, update

from polar.models import OrderItem
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
async def backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Backfill order_items *_v2 amount columns from their legacy INT4 counterparts."""
    await run_batched_update(
        (
            update(OrderItem)
            .values(
                amount_v2=OrderItem.amount,
                net_amount_v2=OrderItem.net_amount,
                tax_amount_v2=OrderItem.tax_amount,
            )
            .where(
                OrderItem.id.in_(
                    select(OrderItem.id)
                    .where(
                        or_(
                            OrderItem.amount_v2.is_(None)
                            & OrderItem.amount.is_not(None),
                            OrderItem.net_amount_v2.is_(None)
                            & OrderItem.net_amount.is_not(None),
                            OrderItem.tax_amount_v2.is_(None)
                            & OrderItem.tax_amount.is_not(None),
                        )
                    )
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
