"""Backfill the shared `tiers`, `minimum_units` and `maximum_units` columns
on seat-based product prices.

Translates each row's legacy `seat_tiers` with the same functions the
dual-write hook uses, so backfilled and newly written rows match.
Re-running the script is safe: the translation is deterministic.
"""

import typer
from sqlalchemy import func, select

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models.product_price import (
    ProductPriceSeatUnit,
    seat_tiers_to_tiers_data,
    seat_tiers_unit_bounds,
    validate_tiers_data,
)
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()


async def run_backfill(
    *,
    batch_size: int = 1000,
    dry_run: bool = True,
    session: AsyncSession | None = None,
) -> int:
    if session is not None:
        return await _run(session, batch_size=batch_size, dry_run=dry_run)

    engine = create_async_engine("script")
    try:
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as script_session:
            return await _run(script_session, batch_size=batch_size, dry_run=dry_run)
    finally:
        await engine.dispose()


async def _run(session: AsyncSession, *, batch_size: int, dry_run: bool) -> int:
    where_clause = ProductPriceSeatUnit.seat_tiers.isnot(None)

    if dry_run:
        count = (
            await session.execute(
                select(func.count(ProductPriceSeatUnit.id)).where(where_clause)
            )
        ).scalar_one()
        typer.echo(
            f"[dry-run] {count} seat prices would be backfilled. "
            "Re-run with --execute to apply."
        )
        return count

    total = 0
    last_id = None
    while True:
        statement = (
            select(ProductPriceSeatUnit)
            .where(where_clause)
            .order_by(ProductPriceSeatUnit.id)
            .limit(batch_size)
        )
        if last_id is not None:
            statement = statement.where(ProductPriceSeatUnit.id > last_id)
        prices = (await session.execute(statement)).scalars().all()
        if not prices:
            break

        for price in prices:
            tiers_data = seat_tiers_to_tiers_data(price.seat_tiers)
            minimum_units, maximum_units = seat_tiers_unit_bounds(price.seat_tiers)
            # Crash on corrupt legacy rows rather than copying them into the
            # canonical columns.
            validate_tiers_data(
                tiers_data,
                minimum_units=minimum_units,
                maximum_units=maximum_units,
            )
            price.tiers = tiers_data
            price.minimum_units = minimum_units
            price.maximum_units = maximum_units
        last_id = prices[-1].id
        await session.commit()

        total += len(prices)
        typer.echo(f"Backfilled {total} seat prices")

    return total


@cli.command()
@typer_async
async def backfill_product_price_tiers(
    execute: bool = typer.Option(
        False, "--execute", help="Apply changes. Without it, runs as a dry run."
    ),
    batch_size: int = typer.Option(1000, help="Number of rows to process per batch"),
) -> None:
    await run_backfill(batch_size=batch_size, dry_run=not execute)


if __name__ == "__main__":
    cli()
