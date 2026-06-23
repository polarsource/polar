"""Backfill per-member downloadable rows.

Downloadables used to be unique per (customer, file, benefit) and shared across a
customer's members, so only the first-granted member got a row. Migration
46c188b1734f makes uniqueness member-aware; this backfills the rows that were
never created, materializing one downloadable per member holding an active grant
for the benefit.

Idempotent (ON CONFLICT DO NOTHING) and re-runnable. Batches are keyset-paginated
over benefit_grants.id (a stable key on a table this script never writes to), so
each batch reads a bounded slice instead of re-scanning the whole join.

Usage:
    cd server

    # Dry-run (default) — count the rows that would be created:
    uv run python -m scripts.backfill_member_downloadables

    # Apply:
    uv run python -m scripts.backfill_member_downloadables --execute
"""

import asyncio
import uuid
from typing import Any, cast

import structlog
import typer
from sqlalchemy import CursorResult, bindparam, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()
configure_script_logging()
log = structlog.get_logger()

# Dry-run only: distinct (member, file, benefit) targets that still need a row.
# An existing granted downloadable for the (customer, file, benefit) proves the
# file set; an active member-level grant proves entitlement.
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

# Keyset window: the next page of active member grants after the cursor.
_NEXT_GRANT_IDS_SQL = text(
    """
    SELECT id
    FROM benefit_grants
    WHERE member_id IS NOT NULL
        AND granted_at IS NOT NULL
        AND revoked_at IS NULL
        AND deleted_at IS NULL
        AND id > :cursor
    ORDER BY id
    LIMIT :batch_size
    """
)

# Materialize the per-member rows for one window of grants. ON CONFLICT skips
# rows that already exist, so re-runs and overlaps are no-ops.
_INSERT_SQL = text(
    """
    INSERT INTO downloadables (
        id, created_at, status, file_id, customer_id, member_id,
        benefit_id, downloaded
    )
    SELECT
        gen_random_uuid(), now(), 'granted',
        t.file_id, t.customer_id, t.member_id, t.benefit_id, 0
    FROM (
        SELECT DISTINCT d.customer_id, d.file_id, d.benefit_id, bg.member_id
        FROM benefit_grants bg
        JOIN downloadables d
            ON d.customer_id = bg.customer_id
            AND d.benefit_id = bg.benefit_id
            AND d.status = 'granted'
            AND d.deleted_at IS NULL
        WHERE bg.id = ANY(:grant_ids)
    ) t
    ON CONFLICT (customer_id, member_id, file_id, benefit_id)
        WHERE deleted_at IS NULL
        DO NOTHING
    """
).bindparams(bindparam("grant_ids", type_=ARRAY(PGUUID(as_uuid=True))))


async def run_backfill(
    session: AsyncSession,
    *,
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    dry_run: bool = True,
) -> int:
    if dry_run:
        pending = (await session.execute(_COUNT_SQL)).scalar_one()
        log.info("backfill.member_downloadables.candidates", pending=pending)
        return pending

    created = 0
    cursor = uuid.UUID(int=0)
    while True:
        grant_ids = list(
            (
                await session.execute(
                    _NEXT_GRANT_IDS_SQL,
                    {"cursor": cursor, "batch_size": batch_size},
                )
            )
            .scalars()
            .all()
        )
        if not grant_ids:
            break
        cursor = grant_ids[-1]
        result = await session.execute(_INSERT_SQL, {"grant_ids": grant_ids})
        created += cast("CursorResult[Any]", result).rowcount
        await session.commit()
        log.info(
            "backfill.member_downloadables.batch",
            grants=len(grant_ids),
            total=created,
        )
        await asyncio.sleep(sleep_seconds)
    return created


@cli.command()
@typer_async
async def backfill_member_downloadables(
    execute: bool = typer.Option(
        False, help="Actually create the rows (default: dry-run)"
    ),
    batch_size: int = typer.Option(5000, help="Grants to process per batch"),
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
