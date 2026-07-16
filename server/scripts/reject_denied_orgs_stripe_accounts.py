"""
Reject the Stripe connected accounts of organizations that are already denied.

The backoffice deny/block dialog now has an opt-in "Disable Stripe account" box
that rejects the org's Stripe connected account. Orgs denied *before* that box
existed still have live Stripe accounts, so this script syncs Stripe with our
side: it rejects the Stripe account of every currently DENIED organization.

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
from collections import defaultdict
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
from polar.payout_account.service import payout_account as payout_account_service
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

TARGET_STATUS = OrganizationStatus.DENIED
REJECT_REASONS = set(get_args(StripeAccountRejectReason))


async def _denied_stripe_orgs(session: AsyncSession) -> list[Organization]:
    """Non-deleted DENIED orgs whose payout account is a live Stripe account."""
    result = await session.execute(
        select(Organization)
        .join(Organization.payout_account)
        .options(contains_eager(Organization.payout_account))
        .where(
            Organization.deleted_at.is_(None),
            Organization.status == TARGET_STATUS,
            PayoutAccount.type == PayoutAccountType.stripe,
            PayoutAccount.stripe_id.is_not(None),
        )
        .order_by(Organization.created_at.asc())
    )
    return list(result.scalars().all())


async def _orgs_by_payout_account(
    session: AsyncSession, payout_account_ids: set[uuid.UUID]
) -> dict[uuid.UUID, list[Organization]]:
    """Map each payout account to every non-deleted org that references it, so we
    can tell whether a Stripe account is shared before rejecting it."""
    if not payout_account_ids:
        return {}
    result = await session.execute(
        select(Organization).where(
            Organization.deleted_at.is_(None),
            Organization.payout_account_id.in_(payout_account_ids),
        )
    )
    grouped: dict[uuid.UUID, list[Organization]] = defaultdict(list)
    for org in result.scalars().all():
        assert org.payout_account_id is not None
        grouped[org.payout_account_id].append(org)
    return grouped


def _render_to_reject(rows: list[tuple[Organization, str]]) -> None:
    table = Table(title=f"Stripe accounts to reject ({len(rows)})")
    table.add_column("Org slug")
    table.add_column("Org ID", style="dim")
    table.add_column("Stripe account", style="cyan")
    for org, stripe_id in rows:
        table.add_row(org.slug, str(org.id), stripe_id)
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
        help=f"Stripe reject reason, one of: {', '.join(sorted(REJECT_REASONS))}",
    ),
) -> None:
    if reason not in REJECT_REASONS:
        raise typer.BadParameter(
            f"reason must be one of: {', '.join(sorted(REJECT_REASONS))}"
        )
    reject_reason = cast(StripeAccountRejectReason, reason)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            denied_orgs = await _denied_stripe_orgs(session)
            payout_account_ids = {
                org.payout_account_id
                for org in denied_orgs
                if org.payout_account_id is not None
            }
            orgs_by_account = await _orgs_by_payout_account(session, payout_account_ids)

            to_reject: list[tuple[Organization, str]] = []
            shared: list[tuple[str, list[Organization]]] = []
            seen_accounts: set[uuid.UUID] = set()
            for org in denied_orgs:
                account_id = org.payout_account_id
                assert account_id is not None
                if account_id in seen_accounts:
                    continue
                seen_accounts.add(account_id)
                assert org.payout_account is not None
                stripe_id = cast(str, org.payout_account.stripe_id)
                linked = orgs_by_account.get(account_id, [org])
                if len(linked) > 1:
                    shared.append((stripe_id, linked))
                else:
                    to_reject.append((org, stripe_id))

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
            for org, stripe_id in to_reject:
                account_id = org.payout_account_id
                assert account_id is not None
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
