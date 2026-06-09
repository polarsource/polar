"""Backfill existing free prices to fixed prices with an amount of 0.

We're dropping the dedicated `free` product price type in favor of a fixed price
with an amount of 0. New prices are already persisted that way (see
`ProductService`); this script converts the existing `free` rows.

The `amount_type` discriminator is a computed expression (see `ProductPrice`), so
updating `amount_type` alone reclassifies the row: `free` -> `fixed` and, for legacy
recurring prices, `legacy_free` -> `legacy_fixed` (the `type` column is untouched).

The update is idempotent: once a row is converted it no longer matches the filter,
so the script can be safely re-run or resumed.
"""

import typer
from sqlalchemy import select, update

from polar.models import ProductPrice
from polar.models.product_price import ProductPriceAmountType
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

product_prices = ProductPrice.__table__

subquery = (
    select(ProductPrice.id)
    .where(ProductPrice.amount_type == ProductPriceAmountType.free)
    .order_by(ProductPrice.id)
    .limit(limit_bindparam())
    .scalar_subquery()
)

update_statement = (
    update(ProductPrice)
    .values(
        {
            ProductPrice.amount_type: ProductPriceAmountType.fixed,
            # `price_amount` is only mapped on the fixed subclass; target the
            # underlying column directly on the base entity's table.
            product_prices.c.price_amount_v2: 0,
        }
    )
    .where(ProductPrice.id.in_(subquery))
)


@cli.command()
@typer_async
async def free_price_to_fixed_backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        update_statement,
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
