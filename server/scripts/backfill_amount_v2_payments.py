import asyncio
from functools import wraps

import typer
from sqlalchemy import select, update

from polar.models import Payment
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
    """Backfill payments *_v2 amount columns from their legacy INT4 counterparts."""
    await run_batched_update(
        (
            update(Payment)
            .values(
                amount_v2=Payment.amount,
            )
            .where(
                Payment.id.in_(
                    select(Payment.id)
                    .where(Payment.amount_v2.is_(None) & Payment.amount.is_not(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
