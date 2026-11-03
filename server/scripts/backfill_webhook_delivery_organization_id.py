"""
Backfill `webhook_deliveries.organization_id` from the delivery's webhook endpoint.

Walks the table in `created_at` order on its index. Each run ends by printing
its cursor; pass it as `--created-after` to the next run so it only covers
deliveries created since.

Usage:
    cd server
    uv run python -m scripts.backfill_webhook_delivery_organization_id
    uv run python -m scripts.backfill_webhook_delivery_organization_id \\
        --created-after 2026-11-03T12:00:00+00:00
"""

import asyncio
from datetime import UTC, datetime
from typing import Any, cast

import typer
from rich.console import Console
from sqlalchemy import CursorResult, select, update

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import WebhookDelivery, WebhookEndpoint
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_logging()


def parse_cursor(value: str) -> datetime:
    cursor = datetime.fromisoformat(value)
    return cursor if cursor.tzinfo is not None else cursor.replace(tzinfo=UTC)


async def backfill_batch(
    session: AsyncSession, *, created_after: datetime | None, batch_size: int
) -> tuple[datetime | None, int]:
    window = (
        select(WebhookDelivery.created_at)
        .order_by(WebhookDelivery.created_at)
        .limit(batch_size)
    )
    if created_after is not None:
        window = window.where(WebhookDelivery.created_at > created_after)
    timestamps = list((await session.execute(window)).scalars().all())
    if not timestamps:
        return None, 0

    # The window ends on a whole timestamp so a cursor never splits rows sharing one.
    window_end = timestamps[-1]
    statement = (
        update(WebhookDelivery)
        .values(organization_id=WebhookEndpoint.organization_id)
        .where(
            WebhookDelivery.webhook_endpoint_id == WebhookEndpoint.id,
            WebhookDelivery.created_at <= window_end,
            WebhookDelivery.organization_id.is_(None),
        )
        .execution_options(synchronize_session=False)
    )
    if created_after is not None:
        statement = statement.where(WebhookDelivery.created_at > created_after)
    result = await session.execute(statement)
    await session.commit()
    return window_end, cast(CursorResult[Any], result).rowcount


@cli.command()
@typer_async
async def backfill(
    created_after: datetime | None = typer.Option(
        None,
        parser=parse_cursor,
        help="Only process deliveries created after this ISO 8601 cursor",
    ),
    batch_size: int = typer.Option(
        5000, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    cursor = created_after
    updated = 0
    try:
        while True:
            async with sessionmaker() as session:
                window_end, rowcount = await backfill_batch(
                    session, created_after=cursor, batch_size=batch_size
                )
            if window_end is None:
                break
            cursor = window_end
            updated += rowcount
            console.print(f"{updated} row(s) updated, cursor at {cursor.isoformat()}")
            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)
    finally:
        await engine.dispose()

    console.print(f"[green]✓ Complete: {updated} row(s) updated")
    if cursor is not None:
        console.print(f"Resume with --created-after {cursor.isoformat()}")


if __name__ == "__main__":
    cli()
