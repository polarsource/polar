import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.config import settings
from polar.event.system import SystemEvent
from polar.integrations.tinybird.client import client as tinybird_client
from polar.integrations.tinybird.service import (
    DATASOURCE_EVENTS,
)
from polar.integrations.tinybird.service import (
    ingest_events as tinybird_ingest_events,
)
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Event, Order
from polar.models.event import EventSource

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def backfill_discount_basis_points(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
    dry_run: bool,
) -> dict[str, int]:
    """
    Backfill discount_basis_points for balance.order and balance.credit_order events.

    For each batch:
    1. Find events missing discount_basis_points where the order has a discount
    2. Update PostgreSQL with the calculated discount_basis_points
    3. Delete events from Tinybird
    4. Re-ingest events into Tinybird
    """
    typer.echo("\n=== Backfilling discount_basis_points ===")

    results = {
        "balance_order_updated": 0,
        "balance_credit_order_updated": 0,
    }

    for event_name, result_key in [
        (SystemEvent.balance_order, "balance_order_updated"),
        (SystemEvent.balance_credit_order, "balance_credit_order_updated"),
    ]:
        typer.echo(f"\nProcessing {event_name} events...")
        updated = await _backfill_event_type(
            session,
            event_name=event_name,
            batch_size=batch_size,
            rate_limit_delay=rate_limit_delay,
            dry_run=dry_run,
        )
        results[result_key] = updated

    typer.echo("\n" + "=" * 50)
    typer.echo("DISCOUNT BASIS POINTS BACKFILL SUMMARY")
    typer.echo("=" * 50)
    for key, value in results.items():
        typer.echo(f"  {key}: {value}")
    typer.echo("=" * 50 + "\n")

    return results


async def _backfill_event_type(
    session: AsyncSession,
    event_name: str,
    batch_size: int,
    rate_limit_delay: float,
    dry_run: bool,
) -> int:
    """Backfill discount_basis_points for a specific event type."""
    total_updated = 0
    offset = 0

    while True:
        query = (
            select(Event)
            .where(
                Event.source == EventSource.system,
                Event.name == event_name,
                ~Event.user_metadata.has_key("discount_basis_points"),
            )
            .options(selectinload(Event.organization))
            .order_by(Event.id)
            .offset(offset)
            .limit(batch_size)
        )

        result = await session.execute(query)
        events = list(result.scalars().all())

        if not events:
            break

        order_ids = [
            e.user_metadata.get("order_id")
            for e in events
            if e.user_metadata.get("order_id")
        ]

        if not order_ids:
            offset += batch_size
            continue

        orders_result = await session.execute(
            select(Order).where(
                Order.id.in_(order_ids),
                Order.discount_amount > 0,
                Order.subtotal_amount > 0,
            )
        )
        orders_by_id = {str(o.id): o for o in orders_result.scalars().all()}

        events_to_update = []
        for event in events:
            order_id = event.user_metadata.get("order_id")
            if order_id not in orders_by_id:
                continue

            order = orders_by_id[order_id]
            discount_basis_points = int(
                (order.discount_amount / order.subtotal_amount) * 10000
            )

            event.user_metadata["discount_basis_points"] = discount_basis_points
            events_to_update.append(event)

        if events_to_update:
            if dry_run:
                typer.echo(f"  [DRY RUN] Would update {len(events_to_update)} events")
            else:
                for event in events_to_update:
                    session.add(event)
                await session.commit()

                event_ids = [str(e.id) for e in events_to_update]
                delete_condition = f"id IN ({','.join(repr(id) for id in event_ids)})"
                await tinybird_client.delete(DATASOURCE_EVENTS, delete_condition)

                await tinybird_ingest_events(events_to_update)

                typer.echo(f"  Updated {len(events_to_update)} events")

            total_updated += len(events_to_update)

        offset += batch_size
        await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Total {event_name} events updated: {total_updated}")
    return total_updated


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(
        1000,
        help="Number of records to process per batch",
    ),
    rate_limit_delay: float = typer.Option(
        0.5, help="Delay in seconds between batches"
    ),
    dry_run: bool = typer.Option(
        False, help="If true, only print what would be done without making changes"
    ),
) -> None:
    """
    Backfill discount_basis_points for balance.order and balance.credit_order events.

    This script:
    1. Finds events where the order has a discount but discount_basis_points is missing
    2. Calculates discount_basis_points = (discount_amount / subtotal_amount) * 10000
    3. Updates PostgreSQL
    4. Deletes and re-ingests events in Tinybird
    """
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
            "handlers": {
                "default": {
                    "level": "DEBUG",
                    "class": "logging.StreamHandler",
                },
            },
            "root": {
                "handlers": ["default"],
                "level": "WARNING",
            },
        }
    )
    structlog.configure(
        processors=[drop_all],
        wrapper_class=structlog.BoundLogger,
        cache_logger_on_first_use=True,
    )

    engine = _create_async_engine(
        dsn=str(settings.get_postgres_dsn("asyncpg")),
        application_name=f"{settings.ENV.value}.script",
        debug=False,
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        command_timeout=300,
    )
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        await backfill_discount_basis_points(
            session=session,
            batch_size=batch_size,
            rate_limit_delay=rate_limit_delay,
            dry_run=dry_run,
        )

    await engine.dispose()


if __name__ == "__main__":
    cli()
