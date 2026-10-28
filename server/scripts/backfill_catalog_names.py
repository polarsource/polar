import asyncio
from functools import wraps

import typer
from sqlalchemy import Update, func, select, update

from polar.models import Catalog
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


def backfill_statement() -> Update:
    """Name unnamed catalogs `v{n}`, n being their position in the organization's
    history, counting soft-deleted and named catalogs like `CatalogService` does."""
    positions = select(
        Catalog.id,
        func.row_number()
        .over(
            partition_by=Catalog.organization_id,
            order_by=(Catalog.created_at, Catalog.id),
        )
        .label("position"),
    ).subquery()
    return (
        update(Catalog)
        .values(name=func.concat("v", positions.c.position))
        .where(
            Catalog.id == positions.c.id,
            Catalog.id.in_(
                select(Catalog.id)
                .where(Catalog.name.is_(None))
                .order_by(Catalog.id)
                .limit(limit_bindparam())
            ),
        )
    )


@cli.command()
@typer_async
async def backfill_catalog_names(
    batch_size: int = typer.Option(1000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        backfill_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
    )


if __name__ == "__main__":
    cli()
