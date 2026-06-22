"""Backfill per-member downloadable rows.

Downloadables used to be unique per (customer, file, benefit) and shared across a
customer's members, so only the first-granted member got a row. Migration
46c188b1734f makes uniqueness member-aware; this backfills the rows that were
never created, materializing one downloadable per member holding an active grant
for the benefit.

Idempotent (ON CONFLICT DO NOTHING) and re-runnable.

Usage:
    cd server

    # Dry-run (default) — count the rows that would be created:
    uv run python -m scripts.backfill_member_downloadables

    # Apply:
    uv run python -m scripts.backfill_member_downloadables --execute
"""

import asyncio
from typing import Any, cast

import structlog
import typer
from sqlalchemy import CursorResult, text

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()
configure_script_logging()
log = structlog.get_logger()

# Distinct (member, file, benefit) targets entitled to a downloadable they don't
# have yet: an existing granted downloadable for the (customer, file, benefit)
# proves the file set, and an active member-level grant proves entitlement.
_CANDIDATES = """
    SELECT DISTINCT d.customer_id, d.file_id, d.benefit_id, bg.member_id
    FROM downloadables d
    JOIN benefit_grants bg
        ON bg.customer_id = d.customer_id
        AND bg.benefit_id = d.benefit_id
        AND bg.member_id IS NOT NULL
        AND bg.granted_at IS NOT NULL
        AND bg.revoked_at IS NULL
        AND bg.deleted_at IS NULL
    WHERE d.status = 'granted'
        AND d.deleted_at IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM downloadables x
            WHERE x.customer_id = d.customer_id
                AND x.file_id = d.file_id
                AND x.benefit_id = d.benefit_id
                AND x.member_id = bg.member_id
                AND x.deleted_at IS NULL
        )
"""

_COUNT_SQL = text(f"SELECT COUNT(*) FROM ({_CANDIDATES}) t")

_INSERT_SQL = text(
    f"""
    INSERT INTO downloadables (
        id, created_at, status, file_id, customer_id, member_id,
        benefit_id, downloaded
    )
    SELECT
        gen_random_uuid(), now(), 'granted',
        t.file_id, t.customer_id, t.member_id, t.benefit_id, 0
    FROM ({_CANDIDATES} LIMIT :batch_size) t
    ON CONFLICT (customer_id, file_id, benefit_id, member_id)
        WHERE deleted_at IS NULL
        DO NOTHING
    """
)


async def run_backfill(
    session: AsyncSession,
    *,
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    dry_run: bool = True,
) -> int:
    pending = (await session.execute(_COUNT_SQL)).scalar_one()
    log.info("backfill.member_downloadables.candidates", pending=pending)
    if dry_run or pending == 0:
        return pending

    created = 0
    while True:
        result = await session.execute(_INSERT_SQL, {"batch_size": batch_size})
        inserted = cast("CursorResult[Any]", result).rowcount
        await session.commit()
        created += inserted
        log.info(
            "backfill.member_downloadables.batch", inserted=inserted, total=created
        )
        if inserted == 0:
            break
        await asyncio.sleep(sleep_seconds)
    return created


@cli.command()
@typer_async
async def backfill_member_downloadables(
    execute: bool = typer.Option(
        False, help="Actually create the rows (default: dry-run)"
    ),
    batch_size: int = typer.Option(5000, help="Rows to insert per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            count = await run_backfill(
                session,
                batch_size=batch_size,
                sleep_seconds=sleep_seconds,
                dry_run=not execute,
            )
        if execute:
            log.info("backfill.member_downloadables.done", created=count)
        else:
            log.info(
                "backfill.member_downloadables.dry_run",
                would_create=count,
                hint="re-run with --execute to apply",
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
