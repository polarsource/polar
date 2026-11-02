"""Backfill `webhook_deliveries.organization_id` from the delivery's endpoint.

The table is walked in physical order, a range of heap pages at a time, so
each batch is a TID range scan touching only its own pages: cost per batch
stays flat however much of the table is already done, and the I/O is
sequential. Each batch commits on its own; rerun with `--start-page` set to
the last logged page to resume.

Rows inserted while the backfill runs already carry `organization_id`, and
the rows an update moves to later pages are skipped by the
`organization_id IS NULL` filter.
"""

import asyncio

import typer
from sqlalchemy import text

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()

UPDATE_STATEMENT = text(
    """
    UPDATE webhook_deliveries AS d
    SET organization_id = e.organization_id
    FROM webhook_endpoints AS e
    WHERE d.ctid >= format('(%s,0)', CAST(:start_page AS bigint))::tid
    AND d.ctid < format('(%s,0)', CAST(:end_page AS bigint))::tid
    AND d.organization_id IS NULL
    AND e.id = d.webhook_endpoint_id
    """
)

TOTAL_PAGES_STATEMENT = text(
    """
    SELECT pg_relation_size('webhook_deliveries')
    / current_setting('block_size')::bigint
    """
)


async def get_total_pages(session: AsyncSession) -> int:
    result = await session.execute(TOTAL_PAGES_STATEMENT)
    return result.scalar_one()


async def backfill_pages(session: AsyncSession, start_page: int, end_page: int) -> int:
    result = await session.execute(
        UPDATE_STATEMENT, {"start_page": start_page, "end_page": end_page}
    )
    return result.rowcount  # type: ignore[attr-defined]


async def backfill(
    session: AsyncSession,
    *,
    start_page: int = 0,
    pages_per_batch: int = 1000,
    sleep_seconds: float = 0.0,
) -> int:
    # Read once: pages added later only hold rows inserted with organization_id.
    total_pages = await get_total_pages(session)
    updated = 0
    page = start_page
    while page < total_pages:
        end_page = min(page + pages_per_batch, total_pages)
        updated += await backfill_pages(session, page, end_page)
        await session.commit()
        typer.echo(
            f"{utc_now():%H:%M:%S}  pages {end_page:,}/{total_pages:,} "
            f"({end_page / total_pages:.1%}), {updated:,} rows updated"
        )
        page = end_page
        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)
    return updated


@cli.command()
@typer_async
async def backfill_webhook_delivery_organization_id(
    start_page: int = typer.Option(
        0, help="Heap page to start from, to resume an interrupted run"
    ),
    pages_per_batch: int = typer.Option(
        1000, help="Heap pages updated per batch, each in its own transaction"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            updated = await backfill(
                session,
                start_page=start_page,
                pages_per_batch=pages_per_batch,
                sleep_seconds=sleep_seconds,
            )
        typer.echo(f"Done: {updated:,} rows updated")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
