"""
Re-run :meth:`maybe_activate` against organizations stuck in DENIED with an
approved review/appeal.

Two bugs left these orgs stranded:

  1. The original ``approve_appeal`` ignored ``maybe_activate``'s False return
     when onboarding gates were unmet — the appeal was recorded but the org
     stayed DENIED instead of moving to a state from which Stripe webhooks
     could finish the job.
  2. Older manual-appeal flows (pre-AI auto-decide) had the same gap.

With the fix in place, ``maybe_activate`` will either promote a stuck org
to ACTIVE (gates met) or move it to CREATED (gates pending). This script
walks every stuck org and calls ``maybe_activate`` once per row.

Usage:
    cd server

    # Dry-run (default): list the candidates.
    uv run python -m scripts.backfill_unstuck_denied_approved

    # Execute:
    uv run python -m scripts.backfill_unstuck_denied_approved --execute
"""

from collections import Counter

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.organization.service import organization as organization_service
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()


STUCK_STATUSES = (OrganizationStatus.DENIED, OrganizationStatus.BLOCKED)


async def _find_stuck(session: AsyncSession) -> list[Organization]:
    statement = (
        select(Organization)
        .join(OrganizationReview, OrganizationReview.organization_id == Organization.id)
        .where(
            Organization.deleted_at.is_(None),
            Organization.status.in_(STUCK_STATUSES),
            OrganizationReview.appeal_decision
            == OrganizationReview.AppealDecision.APPROVED,
        )
        .order_by(Organization.created_at.asc())
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            stuck = await _find_stuck(session)
            console.print(f"Found [bold]{len(stuck)}[/bold] stuck organization(s).")
            if not stuck:
                return

            if not execute:
                table = Table(title="Stuck candidates")
                table.add_column("ID", style="dim")
                table.add_column("Slug")
                table.add_column("Status", style="yellow")
                table.add_column("Created", style="cyan")
                for org in stuck:
                    table.add_row(
                        str(org.id),
                        org.slug,
                        org.status.value,
                        org.created_at.isoformat(),
                    )
                console.print(table)
                console.print(
                    "\n[yellow]Dry-run — re-run with --execute to apply.[/yellow]"
                )
                return

            counts: Counter[OrganizationStatus] = Counter()
            for org in stuck:
                previous_status = org.status
                await organization_service.maybe_activate(session, org)
                counts[org.status] += 1
                log.info(
                    "backfill.row",
                    id=str(org.id),
                    slug=org.slug,
                    previous_status=previous_status.value,
                    new_status=org.status.value,
                )
            await session.commit()

        summary = Table(title="Backfill result")
        summary.add_column("New status", style="cyan")
        summary.add_column("Count", justify="right")
        for status, count in counts.most_common():
            summary.add_row(status.value, str(count))
        console.print(summary)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
