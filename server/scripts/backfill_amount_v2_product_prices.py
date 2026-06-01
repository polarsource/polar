import asyncio
from functools import wraps
from typing import cast

import typer
from sqlalchemy import Table, or_, select, update

from polar.models import ProductPrice
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
    """Backfill product_prices *_v2 amount columns from their legacy INT4 counterparts."""
    # The amount columns live on single-table-inheritance subclasses, so go
    # through the shared table rather than the base ORM entity.
    table = cast(Table, ProductPrice.__table__)
    await run_batched_update(
        (
            update(table)
            .values(
                price_amount_v2=table.c.price_amount,
                minimum_amount_v2=table.c.minimum_amount,
                maximum_amount_v2=table.c.maximum_amount,
                preset_amount_v2=table.c.preset_amount,
                cap_amount_v2=table.c.cap_amount,
            )
            .where(
                table.c.id.in_(
                    select(table.c.id)
                    .where(
                        or_(
                            table.c.price_amount_v2.is_(None)
                            & table.c.price_amount.is_not(None),
                            table.c.minimum_amount_v2.is_(None)
                            & table.c.minimum_amount.is_not(None),
                            table.c.maximum_amount_v2.is_(None)
                            & table.c.maximum_amount.is_not(None),
                            table.c.preset_amount_v2.is_(None)
                            & table.c.preset_amount.is_not(None),
                            table.c.cap_amount_v2.is_(None)
                            & table.c.cap_amount.is_not(None),
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
