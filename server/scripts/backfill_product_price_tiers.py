"""Backfill the shared `tiers`, `minimum_units` and `maximum_units` columns
on seat-based product prices.

Translates each row's legacy `seat_tiers` with the same functions the
dual-write hook uses, so backfilled and newly written rows match.
Re-running the script is safe: the translation is deterministic.

Dry-run still translates and validates every row, so corrupt legacy
data is detected before `--execute`.
"""

import typer

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models.product_price import ProductPrice, ProductPriceSeatUnit
from polar.postgres import create_async_engine
from polar.product.repository import ProductPriceRepository
from polar.product.tiers import (
    seat_tiers_to_tiers,
    seat_tiers_unit_bounds,
    validate_unit_bounds,
)
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()


async def run_backfill(
    *,
    dry_run: bool = True,
    session: AsyncSession | None = None,
) -> int:
    if session is not None:
        return await _run(session, dry_run=dry_run)

    engine = create_async_engine("script")
    try:
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as script_session:
            return await _run(script_session, dry_run=dry_run)
    finally:
        await engine.dispose()


async def _run(session: AsyncSession, *, dry_run: bool) -> int:
    repository = ProductPriceRepository.from_session(session)
    statement = repository.get_base_statement(include_deleted=True).where(
        ProductPriceSeatUnit.seat_tiers.isnot(None)
    )
    if not dry_run:
        # Lock each row so a concurrent seat_tiers write cannot commit new
        # canonical values that this snapshot would then overwrite.
        statement = statement.with_for_update(of=ProductPrice)

    total = 0
    async for price in repository.stream(statement):
        assert isinstance(price, ProductPriceSeatUnit)
        tiers = seat_tiers_to_tiers(price.seat_tiers)
        minimum_units, maximum_units = seat_tiers_unit_bounds(price.seat_tiers)
        # Crash on corrupt legacy rows rather than copying them into the
        # canonical columns.
        validate_unit_bounds(
            tiers,
            minimum_units=minimum_units,
            maximum_units=maximum_units,
        )
        if not dry_run:
            price.tiers = tiers
            price.minimum_units = minimum_units
            price.maximum_units = maximum_units
        total += 1

    if dry_run:
        typer.echo(
            f"[dry-run] {total} seat prices would be backfilled. "
            "Re-run with --execute to apply."
        )
        return total

    await session.commit()
    typer.echo(f"Backfilled {total} seat prices")
    return total


@cli.command()
@typer_async
async def backfill_product_price_tiers(
    execute: bool = typer.Option(
        False, "--execute", help="Apply changes. Without it, runs as a dry run."
    ),
) -> None:
    await run_backfill(dry_run=not execute)


if __name__ == "__main__":
    cli()
