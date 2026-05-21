"""
Enable the new account review (v2) feature flag for orgs in CREATED.

Only orgs whose flag is missing or explicitly false are touched; orgs
already at true are left alone. Safe to re-run.

Usage:
    cd server

    # Dry-run (default) — counts, shape breakdown, and a sample:
    uv run python -m scripts.enable_account_review_v2_for_created_orgs

    # Execute the backfill (batched):
    uv run python -m scripts.enable_account_review_v2_for_created_orgs --execute
"""

from typing import Any

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import Row, and_, case, cast, func, or_, select, type_coerce, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql.elements import ColumnElement

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import OrganizationStatus
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()
console = Console()

configure_script_console_logging()


SAMPLE_LIMIT = 50

_FLAG = "account_review_v2_enabled"


def _candidate_filter() -> list[ColumnElement[bool]]:
    return [
        Organization.deleted_at.is_(None),
        Organization.status == OrganizationStatus.CREATED,
        or_(
            Organization.feature_settings[_FLAG].is_(None),
            Organization.feature_settings[_FLAG].as_boolean().is_(False),
        ),
    ]


_SHAPE_EXPR = case(
    (Organization.details_submitted_at.isnot(None), "submitted"),
    (Organization.details == cast({}, JSONB), "empty, unsubmitted"),
    (
        and_(
            Organization.details.has_key("product_description"),
            Organization.details.has_key("pricing_models"),
        ),
        "v2-shape, unsubmitted",
    ),
    (
        and_(
            Organization.details.has_key("about"),
            Organization.details.has_key("future_annual_revenue"),
        ),
        "legacy-form, unsubmitted",
    ),
    else_="other, unsubmitted",
).label("shape")


async def _breakdown_candidates(session: AsyncSession) -> list[Row[Any]]:
    """Per-shape candidate counts. Sum of `n` is the total candidate count."""
    result = await session.execute(
        select(_SHAPE_EXPR, func.count().label("n"))
        .where(*_candidate_filter())
        .group_by(_SHAPE_EXPR)
        .order_by(func.count().desc())
    )
    return list(result.all())


def _render_breakdown(rows: list[Row[Any]]) -> None:
    if not rows:
        return
    table = Table(title="Candidates by details shape")
    table.add_column("Shape")
    table.add_column("Count", justify="right")
    for row in rows:
        table.add_row(row.shape, f"{row.n:,}")
    console.print(table)


async def _sample_candidates(session: AsyncSession, *, limit: int) -> list[Row[Any]]:
    result = await session.execute(
        select(
            Organization.id,
            Organization.slug,
            Organization.status,
            Organization.created_at,
        )
        .where(*_candidate_filter())
        .order_by(Organization.created_at.asc())
        .limit(limit)
    )
    return list(result.all())


def _render_sample(rows: list[Row[Any]]) -> None:
    if not rows:
        return
    table = Table(title=f"Sample (first {len(rows)} by created_at)")
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Status", style="yellow")
    table.add_column("Created", style="cyan")

    for row in rows:
        table.add_row(
            str(row.id),
            row.slug,
            row.status.value,
            row.created_at.isoformat(),
        )

    console.print(table)


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    log = structlog.get_logger()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        if not execute:
            console.rule(f"[bold]Dry-run: enable {_FLAG} on CREATED orgs")
        else:
            console.rule(f"[bold]Executing: enable {_FLAG} on CREATED orgs")

        async with sessionmaker() as session:
            breakdown = await _breakdown_candidates(session)
            sample = await _sample_candidates(session, limit=SAMPLE_LIMIT)

        total = sum(row.n for row in breakdown)
        console.print(f"[cyan]CREATED orgs missing {_FLAG}=true: [bold]{total}")
        if total == 0:
            console.print("[green]Nothing to do.")
            return

        console.print()
        _render_breakdown(breakdown)
        console.print()
        _render_sample(sample)

        if not execute:
            console.print(
                f"\n[yellow]Dry-run — use --execute to enable {_FLAG} on "
                f"{total} organization(s)."
            )
            return

        subquery = (
            select(Organization.id)
            .where(*_candidate_filter())
            .order_by(Organization.id)
            .limit(limit_bindparam())
            .scalar_subquery()
        )
        merge_patch = type_coerce({_FLAG: True}, JSONB)
        stmt = (
            update(Organization)
            .where(Organization.id.in_(subquery))
            .values(
                feature_settings=Organization.feature_settings.op("||")(merge_patch)
            )
        )
        rows_updated = await run_batched_update(
            stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        log.info("backfill.complete", rowcount=rows_updated)
        console.print(f"\n[green]Enabled {_FLAG} on {rows_updated} organization(s).")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
