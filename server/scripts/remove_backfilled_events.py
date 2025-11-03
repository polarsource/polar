import asyncio
import logging.config
from functools import wraps
from typing import Any, cast

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult

from polar.event.system import SystemEvent
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Event, Meter
from polar.postgres import create_async_engine

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def remove_backfilled_events(
    batch_size: int = typer.Option(1000, help="Number of events to delete per batch"),
    rate_limit_delay: float = typer.Option(
        0.1, help="Delay in seconds between batches"
    ),
) -> None:
    """
    Remove backfilled order_paid and order_refunded events.

    This script processes events in batches to avoid long-running transactions.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        total_deleted = 0

        # Count total events to process (excluding those referenced by meters)
        count_statement = (
            select(func.count())
            .select_from(Event)
            .outerjoin(Meter, Meter.last_billed_event_id == Event.id)
            .where(
                Event.name.in_([SystemEvent.order_paid, SystemEvent.order_refunded]),
                Event.user_metadata["backfilled"].as_boolean().is_(True),
                Meter.id.is_(None),
            )
        )
        total_count = (await session.execute(count_statement)).scalar_one()

        if total_count == 0:
            typer.echo("No backfilled events to remove")
            await engine.dispose()
            raise typer.Exit(0)

        typer.echo(f"Found {total_count} backfilled events to remove")

        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Removing backfilled events...", total=total_count
            )

            while True:
                result = await session.execute(
                    delete(Event).where(
                        Event.id.in_(
                            select(Event.id)
                            .outerjoin(Meter, Meter.last_billed_event_id == Event.id)
                            .where(
                                Event.name.in_(
                                    [SystemEvent.order_paid, SystemEvent.order_refunded]
                                ),
                                Event.user_metadata["backfilled"]
                                .as_boolean()
                                .is_(True),
                                Meter.id.is_(None),
                            )
                            .limit(batch_size)
                        )
                    )
                )
                await session.commit()

                batch_deleted = cast(CursorResult[Any], result).rowcount
                if batch_deleted == 0:
                    break

                total_deleted += batch_deleted
                progress.update(task, advance=batch_deleted)

                await asyncio.sleep(rate_limit_delay)

        typer.echo("\n---\n")
        typer.echo(f"Successfully removed {total_deleted} backfilled events")
        typer.echo("\n---\n")

    await engine.dispose()


if __name__ == "__main__":
    cli()
