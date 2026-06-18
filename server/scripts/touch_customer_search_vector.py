import asyncio
from uuid import UUID

import typer
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from sqlalchemy import select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_logging,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()


@cli.command()
@typer_async
async def touch_customer_search_vector(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """
    Set Customer.search_vector to NULL in batches.

    Uses a cursor based on Customer.id to avoid reprocessing the same rows
    when the trigger repopulates search_vector.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    total_updated = 0
    batch_number = 0
    last_id: UUID | None = None

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows updated", total=None)

            while True:
                async with sessionmaker() as session:
                    # Select the batch of IDs to update
                    id_query = (
                        select(Customer.id).order_by(Customer.id).limit(batch_size)
                    )

                    if last_id is not None:
                        id_query = id_query.where(Customer.id > last_id)

                    id_result = await session.execute(id_query)
                    batch_ids = id_result.scalars().all()

                    if not batch_ids:
                        progress.update(
                            task,
                            description=f"[green]Complete: {total_updated} rows updated",
                        )
                        break

                    # Update the batch
                    result = await session.execute(
                        update(Customer)
                        .values(search_vector=None)
                        .where(Customer.id.in_(batch_ids))
                    )
                    await session.commit()

                    rows_updated = result.rowcount  # type: ignore
                    batch_number += 1
                    total_updated += rows_updated

                    # Update cursor to the last ID in this batch
                    last_id = batch_ids[-1]

                    progress.update(
                        task,
                        description=(
                            f"[cyan]Batch {batch_number}: {total_updated} rows updated "
                            f"(last_id: {last_id})"
                        ),
                    )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
