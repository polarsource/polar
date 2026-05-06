import asyncio
from datetime import timedelta
from functools import wraps

import typer
from sqlalchemy import select, update

from polar.models import Account
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
async def backfill_payout_transaction_delay(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
    delay_days: int = typer.Option(7, help="Default delay in days"),
) -> None:

    await run_batched_update(
        (
            update(Account)
            .values(payout_transaction_delay=timedelta(days=delay_days))
            .where(
                Account.id.in_(
                    select(Account.id)
                    .where(Account.payout_transaction_delay.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
