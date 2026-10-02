"""Undo an onboarding reset for explicitly selected organizations.

Reverses `reset_onboarding_for_review` for organizations that were reset by
mistake and have not resubmitted since: restores the review that the reset
soft-deleted, marks details as submitted, clears the resubmission request and
moves the organization back to ACTIVE. Payouts canceled by the reset are not
recreated; merchants can request them again once active.

Usage:
    cd server
    uv run python -m scripts.restore_organizations_after_reset \
        <organization-id> [<organization-id> ...]
    uv run python -m scripts.restore_organizations_after_reset \
        <organization-id> [<organization-id> ...] \
        --restored-by operator@polar.sh --execute
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import text

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import OrganizationStatus
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_console_logging()

_RESET_WINDOW = timedelta(seconds=60)

_find_reset_reviews_sql = text("""
    SELECT id FROM organization_reviews
    WHERE organization_id = :organization_id
      AND deleted_at BETWEEN :reset_at AND :reset_at_upper
""")

_restore_review_sql = text("""
    UPDATE organization_reviews SET deleted_at = NULL WHERE id = :review_id
""")


async def _find_reset_review(
    session: AsyncSession, organization: Organization
) -> UUID | None:
    reset_at = organization.onboarding_resubmission_requested_at
    assert reset_at is not None
    result = await session.execute(
        _find_reset_reviews_sql,
        {
            "organization_id": organization.id,
            "reset_at": reset_at,
            "reset_at_upper": reset_at + _RESET_WINDOW,
        },
    )
    review_ids = result.scalars().all()
    return review_ids[0] if len(review_ids) == 1 else None


async def _plan(
    session: AsyncSession, organization_ids: list[UUID]
) -> tuple[list[tuple[Organization, UUID]], bool]:
    repository = OrganizationRepository.from_session(session)
    table = Table(title="Organizations to restore after onboarding reset")
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Current status", style="cyan")
    table.add_column("Result")

    targets: list[tuple[Organization, UUID]] = []
    is_valid = True
    for organization_id in organization_ids:
        organization = await repository.get_by_id(
            organization_id, include_blocked=True, for_update=True
        )
        if organization is None:
            is_valid = False
            table.add_row(str(organization_id), "—", "—", "[red]Not found")
            continue

        row = (str(organization.id), organization.slug)
        status = organization.status.get_display_name()
        if (
            organization.status != OrganizationStatus.CREATED
            or organization.onboarding_resubmission_requested_at is None
        ):
            is_valid = False
            table.add_row(*row, status, "[red]Not in a reset state")
            continue
        if organization.details_submitted_at is not None:
            is_valid = False
            table.add_row(*row, status, "[red]Already resubmitted")
            continue

        review_id = await _find_reset_review(session, organization)
        if review_id is None:
            is_valid = False
            table.add_row(*row, status, "[red]No single review deleted by reset")
            continue

        targets.append((organization, review_id))
        table.add_row(*row, status, "[green]Restore to Active")

    console.print(table)
    return targets, is_valid


@cli.command()
@typer_async
async def restore_organizations_after_reset(
    organization_ids: list[UUID] = typer.Argument(
        ..., help="Organization IDs to restore"
    ),
    execute: bool = typer.Option(
        False, "--execute", help="Apply the restore (default: preview only)"
    ),
    restored_by: str = typer.Option(
        "restore script",
        "--restored-by",
        help="Operator recorded in each organization's internal notes",
    ),
) -> None:
    unique_ids = list(dict.fromkeys(organization_ids))
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            targets, is_valid = await _plan(session, unique_ids)
            if not is_valid:
                console.print(
                    "[red]No changes made. Fix the organizations flagged above first."
                )
                raise typer.Exit(code=1)

            if not execute:
                console.print("[yellow]Preview only — pass --execute to apply.")
                return

            now = datetime.now(UTC)
            note = (
                f"[{now.strftime('%Y-%m-%d %H:%M')} UTC] Onboarding reset undone "
                f"by {restored_by}. Restored previous review and status to Active."
            )
            for organization, review_id in targets:
                await session.execute(_restore_review_sql, {"review_id": review_id})
                organization.set_status(OrganizationStatus.ACTIVE)
                organization.details_submitted_at = now
                organization.onboarding_resubmission_requested_at = None
                organization.internal_notes = (
                    f"{organization.internal_notes}\n\n{note}"
                    if organization.internal_notes
                    else note
                )
                session.add(organization)

            await session.commit()
            console.print(f"[green]Restored {len(targets)} organization(s) to Active.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
