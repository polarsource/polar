"""Reset explicitly selected organizations so they must complete onboarding again.

The organizations keep their existing information, but return to CREATED with
payment capabilities disabled. Their current review is retired, and submitting
the onboarding form starts a fresh AI review. Held payouts are canceled and
their reserved funds are returned to the organization's balance.

Usage:
    cd server
    uv run python -m scripts.reset_organizations_for_review \
        <organization-id> [<organization-id> ...]
    uv run python -m scripts.reset_organizations_for_review \
        <organization-id> [<organization-id> ...] \
        --reset-by operator@polar.sh --execute
"""

from uuid import UUID

import typer
from rich.console import Console
from rich.table import Table

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import OrganizationStatus
from polar.organization.repository import OrganizationRepository
from polar.organization.service import (
    organization as organization_service,
)
from polar.postgres import AsyncSession, create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_console_logging()


async def _load_organizations(
    session: AsyncSession, organization_ids: list[UUID]
) -> list[tuple[UUID, Organization | None]]:
    repository = OrganizationRepository.from_session(session)
    return [
        (
            organization_id,
            await repository.get_by_id(
                organization_id,
                include_blocked=True,
                for_update=True,
            ),
        )
        for organization_id in organization_ids
    ]


def _show_plan(targets: list[tuple[UUID, Organization | None]]) -> bool:
    table = Table(title="Organizations to reset for onboarding review")
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Current status", style="cyan")
    table.add_column("Result")

    is_valid = True
    for organization_id, organization in targets:
        if organization is None:
            is_valid = False
            table.add_row(str(organization_id), "—", "—", "[red]Not found")
            continue

        if organization.status not in {
            OrganizationStatus.ACTIVE,
            OrganizationStatus.REVIEW,
            OrganizationStatus.SNOOZED,
        }:
            is_valid = False
            table.add_row(
                str(organization.id),
                organization.slug,
                organization.status.get_display_name(),
                "[red]Ineligible status",
            )
            continue

        table.add_row(
            str(organization.id),
            organization.slug,
            organization.status.get_display_name(),
            "[green]Reset to Created",
        )

    console.print(table)
    return is_valid


@cli.command()
@typer_async
async def reset_organizations_for_review(
    organization_ids: list[UUID] = typer.Argument(
        ..., help="Organization IDs to reset"
    ),
    execute: bool = typer.Option(
        False, "--execute", help="Apply the reset (default: preview only)"
    ),
    reset_by: str = typer.Option(
        "bulk reset script",
        "--reset-by",
        help="Operator recorded in each organization's internal notes",
    ),
) -> None:
    unique_ids = list(dict.fromkeys(organization_ids))
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            targets = await _load_organizations(session, unique_ids)
            if not _show_plan(targets):
                console.print(
                    "[red]No changes made. Fix missing or ineligible organizations first."
                )
                raise typer.Exit(code=1)

            if not execute:
                console.print("[yellow]Preview only — pass --execute to apply.")
                return

            for _, organization in targets:
                assert organization is not None
                await organization_service.reset_onboarding_for_review(
                    session,
                    organization,
                    reset_by=reset_by,
                )

            await session.commit()
            console.print(
                f"[green]Reset {len(targets)} organization(s) for onboarding review."
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
