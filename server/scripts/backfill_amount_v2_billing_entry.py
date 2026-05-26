import asyncio
from functools import wraps

import typer
from sqlalchemy import or_, select, update

from polar.models import BillingEntry
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
    """Backfill amount_v2 and discount_amount_v2 from amount and discount_amount."""
    await run_batched_update(
        (
            update(BillingEntry)
            .values(
                amount_v2=BillingEntry.amount,
                discount_amount_v2=BillingEntry.discount_amount,
            )
            .where(
                BillingEntry.id.in_(
                    select(BillingEntry.id)
                    .where(
                        or_(
                            BillingEntry.amount_v2.is_(None)
                            & BillingEntry.amount.is_not(None),
                            BillingEntry.discount_amount_v2.is_(None)
                            & BillingEntry.discount_amount.is_not(None),
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
