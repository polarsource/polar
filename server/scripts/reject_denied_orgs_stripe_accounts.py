"""
Reject the Stripe accounts of organizations that are already denied or blocked.

The backoffice deny/block dialog now has an opt-in "Disable Stripe account" box
that rejects the org's Stripe connected account. Orgs denied or blocked *before*
that box existed still have live Stripe accounts, so this script syncs Stripe
with our side: it rejects the Stripe account of every currently DENIED or
BLOCKED organization.

Caveat handled explicitly: rejecting a Stripe account is permanent and affects
every org backed by it. If a payout account is shared by more than one
organization, this script does NOT touch it — it lists those accounts (with all
linked orgs) so they can be reviewed and handled manually.

Usage:
    cd server

    # Dry-run (default): show what would be rejected and what needs manual review.
    uv run python -m scripts.reject_denied_orgs_stripe_accounts

    # Execute the rejections:
    uv run python -m scripts.reject_denied_orgs_stripe_accounts --execute

    # Reject with a different reason (default: terms_of_service):
    uv run python -m scripts.reject_denied_orgs_stripe_accounts --reason fraud --execute
"""

import uuid
from typing import cast, get_args

import stripe as stripe_lib
import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import select
from sqlalchemy.orm import contains_eager

from polar.enums import PayoutAccountType
from polar.integrations.stripe.service import StripeAccountRejectReason
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization, PayoutAccount
from polar.models.organization import OrganizationStatus
from polar.organization.repository import OrganizationRepository
from polar.payout_account.service import payout_account as payout_account_service
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

TARGET_STATUSES = (OrganizationStatus.DENIED, OrganizationStatus.BLOCKED)
REJECT_REASONS = set(get_args(StripeAccountRejectReason))
REJECT_REASONS_HELP = ", ".join(sorted(REJECT_REASONS))


async def _target_stripe_orgs(session: AsyncSession) -> list[Organization]:
    """Non-deleted denied/blocked orgs whose payout account is a live Stripe
    account."""
    result = await session.execute(
        select(Organization)
        .join(Organization.payout_account)
        .options(contains_eager(Organization.payout_account))
        .where(
            Organization.deleted_at.is_(None),
            Organization.status.in_(TARGET_STATUSES),
            PayoutAccount.type == PayoutAccountType.stripe,
            PayoutAccount.stripe_id.is_not(None),
        )
        .order_by(Organization.created_at.asc())
    )
    return list(result.scalars().all())


def _render_to_reject(rows: list[tuple[Organization, uuid.UUID, str]]) -> None:
    table = Table(title=f"Stripe accounts to reject ({len(rows)})")
    table.add_column("Org slug")
    table.add_column("Status", style="yellow")
    table.add_column("Org ID", style="dim")
    table.add_column("Stripe account", style="cyan")
    for org, _, stripe_id in rows:
        table.add_row(org.slug, org.status.value, str(org.id), stripe_id)
    console.print(table)


def _render_shared(shared: list[tuple[str, list[Organization]]]) -> None:
    if not shared:
        return
    table = Table(
        title=f"Shared Stripe accounts — handle manually ({len(shared)})",
        caption="Linked to more than one org; not rejected by this script.",
    )
    table.add_column("Stripe account", style="cyan")
    table.add_column("Linked orgs")
    for stripe_id, orgs in shared:
        linked = "\n".join(f"{o.slug} ({o.status.value})" for o in orgs)
        table.add_row(stripe_id, linked)
    console.print(table)


@cli.command()
@typer_async
async def reject(
    execute: bool = typer.Option(
        False, help="Actually reject the accounts (default: dry-run)"
    ),
    reason: str = typer.Option(
        "terms_of_service",
        help=f"Stripe reject reason, one of: {REJECT_REASONS_HELP}",
    ),
) -> None:
    if reason not in REJECT_REASONS:
        raise typer.BadParameter(f"reason must be one of: {REJECT_REASONS_HELP}")
    reject_reason = cast(StripeAccountRejectReason, reason)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            target_orgs = await _target_stripe_orgs(session)
            org_repository = OrganizationRepository.from_session(session)

            to_reject: list[tuple[Organization, uuid.UUID, str]] = []
            shared: list[tuple[str, list[Organization]]] = []
            seen_accounts: set[uuid.UUID] = set()
            for org in target_orgs:
                account_id = org.payout_account_id
                assert account_id is not None
                if account_id in seen_accounts:
                    continue
                seen_accounts.add(account_id)
                assert org.payout_account is not None
                stripe_id = cast(str, org.payout_account.stripe_id)
                linked = await org_repository.get_all_by_payout_account(account_id)
                if len(linked) > 1:
                    shared.append((stripe_id, list(linked)))
                else:
                    to_reject.append((org, account_id, stripe_id))

            _render_to_reject(to_reject)
            console.print()
            _render_shared(shared)

            if not to_reject:
                console.print("\n[green]No Stripe accounts to reject.")
                return

            if not execute:
                console.print(
                    f"\n[yellow]Dry-run. Use --execute to reject "
                    f"{len(to_reject)} Stripe account(s) with reason "
                    f"'{reject_reason}'."
                )
                return

            console.rule("[bold]Rejecting Stripe accounts")
            rejected = 0
            for org, account_id, stripe_id in to_reject:
                try:
                    await payout_account_service.reject_stripe_account(
                        session, account_id, reject_reason
                    )
                except stripe_lib.StripeError as e:
                    log.error(
                        "reject.failed",
                        org=org.slug,
                        stripe_id=stripe_id,
                        error=e.user_message or str(e),
                    )
                    console.print(
                        f"[red]Failed {org.slug} ({stripe_id}): {e.user_message or e}"
                    )
                    continue
                rejected += 1
                log.info("reject.ok", org=org.slug, stripe_id=stripe_id)
                console.print(f"[green]Rejected {org.slug} ({stripe_id})")

            console.print(
                f"\n[green]Rejected {rejected}/{len(to_reject)} Stripe account(s)."
            )
            if shared:
                console.print(
                    f"[yellow]{len(shared)} shared account(s) skipped — "
                    "see the table above and handle manually."
                )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
