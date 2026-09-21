"""
Scrub stored webhook delivery responses past the retention period.

Intended to be run manually to clear the backlog that accumulated before
`WEBHOOK_DELIVERY_PAYLOAD_RETENTION_PERIOD` existed, ahead of the first
`webhook_delivery.archive` cron run. Safe to interrupt and resume: pass the
cursor it prints on exit back as `--start-after`.
"""

import asyncio
from datetime import datetime, timedelta
from uuid import UUID

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
async def scrub_webhook_delivery_responses(
    older_than_days: int = typer.Option(
        settings.WEBHOOK_DELIVERY_PAYLOAD_RETENTION_PERIOD.days,
        help="Scrub responses of deliveries created more than this many days ago",
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to scrub per batch"),
    sleep_seconds: float = typer.Option(
        0.5, help="Seconds to sleep between batches, to spare replicas and autovacuum"
    ),
    max_rows: int | None = typer.Option(
        None, help="Stop after scrubbing this many rows, to run the backlog in chunks"
    ),
    start_after: datetime | None = typer.Option(
        None, help="Resume from this `created_at` cursor instead of the oldest row"
    ),
    dry_run: bool = typer.Option(
        False, help="Only report how many rows would be scrubbed, then exit"
    ),
) -> None:
    older_than = utc_now() - timedelta(days=older_than_days)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    cursor: tuple[datetime, UUID] | None = (
        (start_after, UUID(int=0)) if start_after is not None else None
    )
    total_scrubbed = 0
    exhausted = False

    try:
        if dry_run:
            async with sessionmaker() as session:
                repository = WebhookDeliveryRepository.from_session(session)
                count = await repository.count_scrubbable_responses(
                    older_than=older_than
                )
            typer.echo(
                f"{count} deliveries created before {older_than.isoformat()} "
                "still store a response."
            )
            return

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows scrubbed", total=None)
            batch_number = 0

            while True:
                limit = batch_size
                if max_rows is not None:
                    limit = min(limit, max_rows - total_scrubbed)
                    if limit <= 0:
                        break

                async with sessionmaker() as session:
                    repository = WebhookDeliveryRepository.from_session(session)
                    page = await repository.get_scrubbable_response_page(
                        older_than=older_than, limit=limit, after=cursor
                    )
                    if not page:
                        exhausted = True
                        break

                    await repository.scrub_responses([id for id, _ in page])
                    await session.commit()

                batch_number += 1
                total_scrubbed += len(page)
                last_id, last_created_at = page[-1]
                cursor = (last_created_at, last_id)

                progress.update(
                    task,
                    description=(
                        f"[cyan]Batch {batch_number}: {total_scrubbed} rows scrubbed "
                        f"(through {last_created_at.isoformat()})"
                    ),
                )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

            progress.update(
                task, description=f"[green]Done: {total_scrubbed} rows scrubbed"
            )
    finally:
        if not dry_run:
            typer.echo(f"Scrubbed {total_scrubbed} rows.")
            if exhausted:
                typer.echo("Nothing left to scrub past the retention period.")
            elif cursor is not None:
                typer.echo(f"Resume with --start-after {cursor[0].isoformat()}")
        await engine.dispose()


if __name__ == "__main__":
    cli()
