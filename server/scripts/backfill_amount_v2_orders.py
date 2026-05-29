import asyncio
from functools import wraps

import typer
from sqlalchemy import or_, select, update

from polar.models import Order
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
    """Backfill orders *_v2 amount columns from their legacy INT4 counterparts."""
    await run_batched_update(
        (
            update(Order)
            .values(
                subtotal_amount_v2=Order.subtotal_amount,
                discount_amount_v2=Order.discount_amount,
                net_amount_v2=Order.net_amount,
                tax_amount_v2=Order.tax_amount,
                applied_balance_amount_v2=Order.applied_balance_amount,
                refunded_amount_v2=Order.refunded_amount,
                refunded_tax_amount_v2=Order.refunded_tax_amount,
                platform_fee_amount_v2=Order.platform_fee_amount,
            )
            .where(
                Order.id.in_(
                    select(Order.id)
                    .where(
                        or_(
                            Order.subtotal_amount_v2.is_(None)
                            & Order.subtotal_amount.is_not(None),
                            Order.discount_amount_v2.is_(None)
                            & Order.discount_amount.is_not(None),
                            Order.net_amount_v2.is_(None)
                            & Order.net_amount.is_not(None),
                            Order.tax_amount_v2.is_(None)
                            & Order.tax_amount.is_not(None),
                            Order.applied_balance_amount_v2.is_(None)
                            & Order.applied_balance_amount.is_not(None),
                            Order.refunded_amount_v2.is_(None)
                            & Order.refunded_amount.is_not(None),
                            Order.refunded_tax_amount_v2.is_(None)
                            & Order.refunded_tax_amount.is_not(None),
                            Order.platform_fee_amount_v2.is_(None)
                            & Order.platform_fee_amount.is_not(None),
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
