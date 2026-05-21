"""
Migrate CREATED orgs to the new V2 onboarding flow.

Two operations, each idempotent:
1. Set feature_settings.account_review_v2_enabled = true for CREATED orgs.
2. Clear details_submitted_at for orgs that already PASS'd agent review
   but never activated, so they re-enter the V2 checklist. Resubmission
   triggers a fresh agent run whose verdict overwrites the existing row.

Usage:
    cd server
    uv run python -m scripts.migrate_created_orgs_to_v2            # dry-run
    uv run python -m scripts.migrate_created_orgs_to_v2 --execute  # apply
"""

import structlog
import typer
from rich.console import Console
from sqlalchemy import (
    ColumnElement,
    func,
    or_,
    select,
    type_coerce,
    update,
)
from sqlalchemy.dialects.postgresql import JSONB

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Checkout, Order, Organization, OrganizationReview
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

_FLAG = "account_review_v2_enabled"


def _flag_filter() -> list[ColumnElement[bool]]:
    return [
        Organization.deleted_at.is_(None),
        Organization.status == OrganizationStatus.CREATED,
        or_(
            Organization.feature_settings[_FLAG].is_(None),
            Organization.feature_settings[_FLAG].as_boolean().is_(False),
        ),
    ]


def _reset_filter() -> list[ColumnElement[bool]]:
    has_pass_review = (
        select(1)
        .where(
            OrganizationReview.organization_id == Organization.id,
            OrganizationReview.deleted_at.is_(None),
            OrganizationReview.verdict == OrganizationReview.Verdict.PASS,
            OrganizationReview.reason != "Grandfathered organization",
        )
        .exists()
    )
    has_checkout = select(1).where(Checkout.organization_id == Organization.id).exists()
    has_order = select(1).where(Order.organization_id == Organization.id).exists()
    return [
        Organization.deleted_at.is_(None),
        Organization.status == OrganizationStatus.CREATED,
        Organization.details_submitted_at.isnot(None),
        has_pass_review,
        ~has_checkout,
        ~has_order,
    ]


async def _count(session: AsyncSession, where: list[ColumnElement[bool]]) -> int:
    result = await session.execute(
        select(func.count()).select_from(Organization).where(*where)
    )
    return result.scalar_one()


@cli.command()
@typer_async
async def migrate(
    execute: bool = typer.Option(False, help="Apply the migration (default: dry-run)"),
    batch_size: int = typer.Option(5000, help="Orgs to update per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Sleep between batches"),
) -> None:
    log = structlog.get_logger()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            flag_count = await _count(session, _flag_filter())
            reset_count = await _count(session, _reset_filter())

        console.print(f"[cyan]Will enable {_FLAG} on:    [bold]{flag_count}[/] orgs")
        console.print(
            f"[cyan]Will reset details_submitted_at: [bold]{reset_count}[/] orgs"
        )

        if flag_count == 0 and reset_count == 0:
            console.print("[green]Nothing to do.")
            return

        if not execute:
            console.print("\n[yellow]Dry-run — re-run with --execute to apply.")
            return

        if flag_count > 0:
            flag_subquery = (
                select(Organization.id)
                .where(*_flag_filter())
                .order_by(Organization.id)
                .limit(limit_bindparam())
                .scalar_subquery()
            )
            flag_stmt = (
                update(Organization)
                .where(Organization.id.in_(flag_subquery))
                .values(
                    feature_settings=Organization.feature_settings.op("||")(
                        type_coerce({_FLAG: True}, JSONB)
                    )
                )
            )
            updated = await run_batched_update(
                flag_stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
            )
            log.info("migrate.flag.complete", rowcount=updated)

        if reset_count > 0:
            reset_subquery = (
                select(Organization.id)
                .where(*_reset_filter())
                .order_by(Organization.id)
                .limit(limit_bindparam())
                .scalar_subquery()
            )
            reset_stmt = (
                update(Organization)
                .where(Organization.id.in_(reset_subquery))
                .values(details_submitted_at=None)
            )
            updated = await run_batched_update(
                reset_stmt, batch_size=batch_size, sleep_seconds=sleep_seconds
            )
            log.info("migrate.reset.complete", rowcount=updated)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
