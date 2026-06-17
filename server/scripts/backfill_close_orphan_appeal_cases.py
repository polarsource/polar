"""
Close appeal support cases that older bugs left open. Silent, internal,
system-authored — no merchant email (the outcomes are already recorded on the
review; re-notifying about old appeals would be noise):

1. **Deleted org** — the organization was soft-deleted while its appeal case
   stayed open (the auto-close on deletion only covers deletions going forward).
   Closed via the production ``close_for_organization_deletion`` path.

2. **Decided via the org sidebar** — a human approved/denied the appeal through
   the organization action buttons, which reactivated/kept the org but never
   closed the case. The dedicated support-case buttons DO close the case, so the
   only open cases with a *current human appeal decision* are the ones the
   sidebar left behind. Legitimately-pending cases are excluded because their
   current decision is the AI's (agent), not a human's. Closed with an empty
   body — the decision already lives on the review.

Usage:
    cd server

    # Dry-run (default) — list the cases that would be closed:
    uv run python -m scripts.backfill_close_orphan_appeal_cases

    # Apply:
    uv run python -m scripts.backfill_close_orphan_appeal_cases --execute
"""

from collections.abc import Sequence

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import Select, select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.models.organization_review import OrganizationReview
from polar.models.organization_review_feedback import OrganizationReviewFeedback
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCase,
    SupportCaseMessageAuthorKind,
    SupportCaseType,
)
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.organization_review.schemas import (
    ActorType,
    DecisionType,
    ReviewContext,
)
from polar.postgres import create_async_engine
from polar.support_case.repository import SupportCaseMessageRepository
from polar.support_case.service import support_case as support_case_service
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
configure_script_console_logging()
log = structlog.get_logger()


def _base_open_appeal_statement() -> Select[
    tuple[SupportCase, OrganizationReview, Organization]
]:
    """Open, non-deleted appeal cases with their review and organization."""
    return (
        select(SupportCase, OrganizationReview, Organization)
        .join(
            OrganizationReview,
            ReviewAppealSupportCase.organization_review_id == OrganizationReview.id,
        )
        .join(Organization, OrganizationReview.organization_id == Organization.id)
        .where(
            SupportCase.type == SupportCaseType.review_appeal,
            SupportCase.deleted_at.is_(None),
            SupportCaseMessageRepository.is_open_expression(),
        )
    )


def _deleted_org_statement() -> Select[
    tuple[SupportCase, OrganizationReview, Organization]
]:
    return _base_open_appeal_statement().where(Organization.deleted_at.is_not(None))


def _decided_via_sidebar_statement() -> Select[
    tuple[SupportCase, OrganizationReview, Organization, DecisionType]
]:
    # The org's current decision, only when it's a human appeal approve/deny.
    human_decision = (
        select(OrganizationReviewFeedback.decision)
        .where(
            OrganizationReviewFeedback.organization_id
            == OrganizationReview.organization_id,
            OrganizationReviewFeedback.is_current.is_(True),
            OrganizationReviewFeedback.deleted_at.is_(None),
            OrganizationReviewFeedback.actor_type == ActorType.HUMAN,
            OrganizationReviewFeedback.review_context == ReviewContext.APPEAL,
            OrganizationReviewFeedback.decision.in_(
                [DecisionType.APPROVE, DecisionType.DENY]
            ),
        )
        .scalar_subquery()
    )
    return (
        _base_open_appeal_statement()
        .add_columns(human_decision.label("decision"))
        .where(
            # Deleted orgs are handled by the deleted-org group.
            Organization.deleted_at.is_(None),
            human_decision.is_not(None),
        )
    )


def _render(
    title: str, rows: Sequence[tuple[str, str, str]], extra_header: str
) -> None:
    table = Table(title=title)
    table.add_column("Case ID", style="dim")
    table.add_column("Organization")
    table.add_column(extra_header, style="yellow")
    for case_id, org, extra in rows:
        table.add_row(case_id, org, extra)
    console.print(table)


@cli.command()
@typer_async
async def backfill_close_orphan_appeal_cases(
    execute: bool = typer.Option(
        False, help="Actually close the cases (default: dry-run)"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    mode = "EXECUTE" if execute else "DRY-RUN"
    console.rule(f"[bold]Close orphan appeal cases — {mode}")

    try:
        async with sessionmaker() as session:
            deleted_rows = (await session.execute(_deleted_org_statement())).all()
            decided_rows = (
                await session.execute(_decided_via_sidebar_statement())
            ).all()

            _render(
                f"Deleted org, case still open ({len(deleted_rows)})",
                [(str(c.id), o.slug, str(o.id)) for c, _r, o in deleted_rows],
                "Org ID",
            )
            console.print()
            _render(
                f"Decided via sidebar, case still open ({len(decided_rows)})",
                [(str(c.id), o.slug, d.value) for c, _r, o, d in decided_rows],
                "Decision",
            )

            total = len(deleted_rows) + len(decided_rows)
            if total == 0:
                log.info("Nothing to do — no orphan appeal cases found")
                return
            if not execute:
                log.info("Dry-run only — re-run with --execute to close", total=total)
                return

            for _case, review, _organization in deleted_rows:
                await appeal_case_service.close_for_organization_deletion(
                    session, review
                )
            for case, _review, _organization, _decision in decided_rows:
                await support_case_service.close(
                    session,
                    case,
                    author_kind=SupportCaseMessageAuthorKind.system,
                    audience=[],
                )
            await session.commit()
            log.info(
                "Closed orphan appeal cases",
                deleted_org=len(deleted_rows),
                decided_via_sidebar=len(decided_rows),
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
