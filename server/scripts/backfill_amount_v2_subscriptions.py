import asyncio
from functools import wraps

import typer
from sqlalchemy import or_, select, update

from polar.models import Subscription
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
    """Backfill subscriptions *_v2 amount columns from their legacy INT4 counterparts."""
    await run_batched_update(
        (
            update(Subscription)
            .values(
                amount_v2=Subscription.amount,
                net_amount_v2=Subscription.net_amount,
            )
            .where(
                Subscription.id.in_(
                    select(Subscription.id)
                    .where(
                        or_(
                            Subscription.amount_v2.is_(None)
                            & Subscription.amount.is_not(None),
                            Subscription.net_amount_v2.is_(None)
                            & Subscription.net_amount.is_not(None),
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
