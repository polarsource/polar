import asyncio
from functools import wraps

import typer
from sqlalchemy import or_, select, update

from polar.models import Checkout
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
    """Backfill amount_v2, net_amount_v2 and tax_amount_v2 from the legacy columns."""
    await run_batched_update(
        (
            update(Checkout)
            .values(
                amount_v2=Checkout.amount,
                net_amount_v2=Checkout.net_amount,
                tax_amount_v2=Checkout.tax_amount,
            )
            .where(
                Checkout.id.in_(
                    select(Checkout.id)
                    .where(
                        or_(
                            Checkout.amount_v2.is_(None) & Checkout.amount.is_not(None),
                            Checkout.net_amount_v2.is_(None)
                            & Checkout.net_amount.is_not(None),
                            Checkout.tax_amount_v2.is_(None)
                            & Checkout.tax_amount.is_not(None),
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
