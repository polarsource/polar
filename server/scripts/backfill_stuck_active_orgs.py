"""
Backfill organizations that satisfy every ACTIVE gate but are stuck in CREATED.

Before PR #11069 (the fix that introduced ``Organization.maybe_activate``),
an AI PASS verdict never transitioned the org to ACTIVE on its own, and the
previous Stripe ``account.updated`` webhook path that did this transition was
removed on 2026-04-08. Orgs that completed all three gates between then and
the fix are stuck in CREATED.

This script identifies those orgs and, for each, calls
``organization_service.maybe_activate`` — which re-checks every gate and
transitions through the proper lifecycle (``confirm_organization_reviewed``).

Usage:
    cd server

    # Dry-run (default) — list orgs that would be activated:
    uv run python -m scripts.backfill_stuck_active_orgs

    # Execute the backfill:
    uv run python -m scripts.backfill_stuck_active_orgs --execute
"""

from uuid import UUID

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from polar.enums import PayoutAccountType
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization, PayoutAccount, User
from polar.models.organization import OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.models.user import IdentityVerificationStatus
from polar.organization.service import organization as organization_service
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()


async def _find_candidates(session: AsyncSession) -> list[Organization]:
    """Orgs in CREATED with all four gates satisfied."""
    statement = (
        select(Organization)
        .join(
            OrganizationReview,
            OrganizationReview.organization_id == Organization.id,
        )
        .join(PayoutAccount, PayoutAccount.id == Organization.payout_account_id)
        .join(User, User.id == PayoutAccount.admin_id)
        .where(
            Organization.deleted_at.is_(None),
            Organization.status == OrganizationStatus.CREATED,
            Organization.details_submitted_at.is_not(None),
            OrganizationReview.deleted_at.is_(None),
            OrganizationReview.verdict == OrganizationReview.Verdict.PASS,
            PayoutAccount.deleted_at.is_(None),
            # Mirror PayoutAccount.is_payout_ready — non-Stripe accounts are
            # always ready; Stripe accounts require payouts enabled and a
            # connected stripe_id (not cleared by a disconnect).
            or_(
                PayoutAccount.type != PayoutAccountType.stripe,
                (PayoutAccount.is_payouts_enabled.is_(True))
                & (PayoutAccount.stripe_id.is_not(None)),
            ),
            User.identity_verification_status == IdentityVerificationStatus.verified,
        )
        .order_by(Organization.details_submitted_at.asc())
        .options(joinedload(Organization.payout_account))
    )
    result = await session.execute(statement)
    return list(result.unique().scalars().all())


def _render(organizations: list[Organization]) -> None:
    table = Table(title=f"{len(organizations)} stuck orgs meeting all ACTIVE gates")
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Name")
    table.add_column("Details submitted", style="cyan")

    for org in organizations:
        table.add_row(
            str(org.id),
            org.slug,
            org.name,
            org.details_submitted_at.isoformat() if org.details_submitted_at else "—",
        )

    console.print(table)


async def _activate(session: AsyncSession, organization_id: UUID) -> bool:
    """Re-fetch inside the transaction so ORM state is fresh and call maybe_activate."""
    result = await session.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = result.scalar_one_or_none()
    if organization is None:
        return False
    return await organization_service.maybe_activate(session, organization)


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
            candidates = await _find_candidates(session)

        if not candidates:
            console.print("[green]No stuck-but-ready organizations found.")
            return

        _render(candidates)

        if not execute:
            console.print(
                "\n[yellow]Dry-run — use --execute to call maybe_activate on "
                f"these {len(candidates)} organizations."
            )
            return

        console.rule("[bold]Executing backfill")
        activated = 0
        skipped = 0
        for organization in candidates:
            async with sessionmaker() as session:
                try:
                    if await _activate(session, organization.id):
                        await session.commit()
                        activated += 1
                        log.info(
                            "backfill.activated",
                            organization_id=str(organization.id),
                            slug=organization.slug,
                        )
                    else:
                        skipped += 1
                        log.info(
                            "backfill.skipped",
                            organization_id=str(organization.id),
                            slug=organization.slug,
                            reason="maybe_activate returned False",
                        )
                except Exception:
                    await session.rollback()
                    log.exception(
                        "backfill.error",
                        organization_id=str(organization.id),
                        slug=organization.slug,
                    )

        console.print(
            f"\n[green]Activated {activated} organization(s). Skipped {skipped}."
        )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
