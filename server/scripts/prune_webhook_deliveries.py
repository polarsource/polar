"""
Delete webhook deliveries past the retention period.

Intended to be run manually to clear the backlog of deliveries older than
`WEBHOOK_DELIVERY_RETENTION_PERIOD` in chunks, before the recurring
cleanup job switches to deleting rows. Safe to interrupt and run again.
"""

import asyncio
from datetime import timedelta

import typer
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.postgres import create_async_engine
from polar.webhook.repository import WebhookDeliveryRepository
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()


@cli.command()
@typer_async
async def prune_webhook_deliveries(
    older_than_days: int = typer.Option(
        settings.WEBHOOK_DELIVERY_RETENTION_PERIOD.days,
        min=settings.WEBHOOK_DELIVERY_RETENTION_PERIOD.days,
        help="Delete deliveries created more than this many days ago",
    ),
    batch_size: int = typer.Option(
        5000, min=1, help="Number of rows to delete per batch"
    ),
    sleep_seconds: float = typer.Option(
        0.5,
        min=0,
        help="Seconds to sleep between batches, to spare replicas and autovacuum",
    ),
    max_rows: int | None = typer.Option(
        None,
        min=1,
        help="Stop after deleting this many rows, to run the backlog in chunks",
    ),
    dry_run: bool = typer.Option(
        False, help="Only report how many rows would be deleted, then exit"
    ),
) -> None:
    older_than = utc_now() - timedelta(days=older_than_days)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    total_deleted = 0
    exhausted = False

    try:
        if dry_run:
            async with sessionmaker() as session:
                repository = WebhookDeliveryRepository.from_session(session)
                count = await repository.count_expired(older_than=older_than)
            typer.echo(
                f"{count} deliveries created before {older_than.isoformat()} "
                "would be deleted."
            )
            return

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows deleted", total=None)
            batch_number = 0

            while True:
                limit = batch_size
                if max_rows is not None:
                    limit = min(limit, max_rows - total_deleted)
                    if limit <= 0:
                        break

                async with sessionmaker() as session:
                    repository = WebhookDeliveryRepository.from_session(session)
                    ids = await repository.get_expired_ids(
                        older_than=older_than, limit=limit
                    )
                    if not ids:
                        exhausted = True
                        break

                    total_deleted += await repository.delete_by_ids(ids)
                    await session.commit()

                batch_number += 1
                progress.update(
                    task,
                    description=(
                        f"[cyan]Batch {batch_number}: {total_deleted} rows deleted"
                    ),
                )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

            progress.update(
                task, description=f"[green]Done: {total_deleted} rows deleted"
            )
    finally:
        if not dry_run:
            typer.echo(f"Deleted {total_deleted} rows.")
            if exhausted:
                typer.echo("Nothing left to delete past the retention period.")
        await engine.dispose()


if __name__ == "__main__":
    cli()
