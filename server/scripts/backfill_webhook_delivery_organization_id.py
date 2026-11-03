"""
Backfill `webhook_deliveries.organization_id` from the delivery's webhook endpoint.

Walks the table in primary-key order with a keyset cursor, so each batch costs
the same however much of the table is already filled — `organization_id` has
no index to find the remaining NULLs with.

Usage:
    cd server
    uv run python -m scripts.backfill_webhook_delivery_organization_id
"""

import asyncio
from typing import Any, cast
from uuid import UUID

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


async def backfill_batch(
    session: AsyncSession, *, after: UUID | None, batch_size: int
) -> tuple[UUID | None, int]:
    window = select(WebhookDelivery.id).order_by(WebhookDelivery.id).limit(batch_size)
    if after is not None:
        window = window.where(WebhookDelivery.id > after)
    ids = list((await session.execute(window)).scalars().all())
    if not ids:
        return None, 0

    result = await session.execute(
        update(WebhookDelivery)
        .values(organization_id=WebhookEndpoint.organization_id)
        .where(
            WebhookDelivery.webhook_endpoint_id == WebhookEndpoint.id,
            WebhookDelivery.id.in_(ids),
            WebhookDelivery.organization_id.is_(None),
        )
        .execution_options(synchronize_session=False)
    )
    await session.commit()
    return ids[-1], cast(CursorResult[Any], result).rowcount


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(
        5000, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    after: UUID | None = None
    updated = 0
    try:
        while True:
            async with sessionmaker() as session:
                after, rowcount = await backfill_batch(
                    session, after=after, batch_size=batch_size
                )
            if after is None:
                break
            updated += rowcount
            console.print(f"{updated} row(s) updated, cursor at {after}")
            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)
    finally:
        await engine.dispose()

    console.print(f"[green]✓ Complete: {updated} row(s) updated")


if __name__ == "__main__":
    cli()
