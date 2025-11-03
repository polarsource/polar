"""
Script to unlink organizations from an account.

Given an account ID, this script:
1. Finds all organizations linked to that account
2. Counts orders for each organization (via Customer -> Order)
3. Keeps the organization with the most orders on the existing account
4. Unlinks all other organizations by creating new accounts for them

The organization with the most orders keeps the existing account (including Stripe ID).
If multiple organizations have the same max order count, keeps the oldest one.

The new accounts for unlinked organizations:
- Have no Stripe ID (stripe_id = None)
- Copy admin and key fields from the old account
- Ensure organization still passes payment readiness checks

Usage:
    Dry run (default):
        uv run python -m scripts.unlink_organization_account ACCOUNT_UUID

    Actually perform the unlink:
        uv run python -m scripts.unlink_organization_account ACCOUNT_UUID --no-dry-run

    Send email notification to admin:
        uv run python -m scripts.unlink_organization_account ACCOUNT_UUID --no-dry-run --send-email
"""

import asyncio
import logging.config
from functools import wraps
from typing import Any
from uuid import UUID

import structlog
import typer
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from polar.account.repository import AccountRepository
from polar.email.react import render_email_template
from polar.email.schemas import (
    OrganizationAccountUnlinkEmail,
    OrganizationAccountUnlinkProps,
)
from polar.email.sender import email_sender
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Account, Customer, Order, Organization
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, create_async_engine

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def count_orders_for_organization(
    session: AsyncSession, organization_id: UUID
) -> int:
    statement = (
        select(func.count(Order.id))
        .join(Customer, Order.customer_id == Customer.id)
        .where(Customer.organization_id == organization_id)
    )
    result = await session.execute(statement)
    return result.scalar_one()


async def create_account_without_stripe(
    session: AsyncSession, old_account: Account
) -> Account:
    new_account = Account(
        status=old_account.status,
        admin_id=old_account.admin_id,
        account_type=old_account.account_type,
        stripe_id=None,
        email=old_account.email,
        country=old_account.country,
        currency=old_account.currency,
        is_details_submitted=old_account.is_details_submitted,
        is_charges_enabled=old_account.is_charges_enabled,
        is_payouts_enabled=old_account.is_payouts_enabled,
        business_type=old_account.business_type,
        data={},
        processor_fees_applicable=old_account.processor_fees_applicable,
        _platform_fee_percent=old_account._platform_fee_percent,
        _platform_fee_fixed=old_account._platform_fee_fixed,
        next_review_threshold=old_account.next_review_threshold,
        campaign_id=old_account.campaign_id,
    )

    session.add(new_account)
    await session.flush()

    return new_account


@cli.command()
@typer_async
async def unlink_organizations(
    account_id: str = typer.Argument(..., help="UUID of the account to process"),
    dry_run: bool = typer.Option(
        True, help="If True, only show what would be done without making changes"
    ),
    send_email: bool = typer.Option(
        False, help="If True, send email notification to the admin"
    ),
) -> None:
    account_uuid = UUID(account_id)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(
            account_uuid, options=(joinedload(Account.admin),)
        )

        if not account:
            typer.echo(f"❌ Account {account_id} not found")
            raise typer.Exit(code=1)

        typer.echo(f"🔍 Processing account: {account_id}")
        typer.echo(f"   Admin: {account.admin.email}")
        typer.echo(f"   Type: {account.account_type}")
        typer.echo(f"   Stripe ID: {account.stripe_id or 'None'}")
        typer.echo()

        organization_repository = OrganizationRepository.from_session(session)
        organizations = await organization_repository.get_all_by_account(
            account_uuid, options=(joinedload(Organization.account),)
        )

        if not organizations:
            typer.echo(f"⚠️  No organizations found for account {account_id}")
            raise typer.Exit(code=1)

        typer.echo(f"📊 Found {len(organizations)} organization(s)")
        typer.echo()

        # Count orders for all organizations
        orgs_with_counts = []
        for org in organizations:
            order_count = await count_orders_for_organization(session, org.id)
            orgs_with_counts.append((org, order_count))

        # Display order counts
        typer.echo("📋 Organizations and their order counts:")
        for org, count in orgs_with_counts:
            typer.echo(f"   • {org.slug} (ID: {org.id}) - {count} order(s)")
        typer.echo()

        # Find the organization with the most orders
        # If tied, use the oldest organization as tiebreaker
        orgs_with_counts_sorted = sorted(
            orgs_with_counts,
            key=lambda x: (-x[1], x[0].created_at),  # Most orders first, then oldest
        )
        org_to_keep, max_orders = orgs_with_counts_sorted[0]
        orgs_to_unlink = [org for org, _ in orgs_with_counts_sorted[1:]]

        typer.echo("✓ Organization to keep with existing account:")
        typer.echo(
            f"   • {org_to_keep.slug} (ID: {org_to_keep.id}, "
            f"{max_orders} order(s), created: {org_to_keep.created_at})"
        )
        typer.echo()

        if not orgs_to_unlink:
            typer.echo("✓ Only one organization found - nothing to unlink")
            return

        typer.echo("🔄 Organizations to unlink (will get new accounts):")
        for org in orgs_to_unlink:
            order_count = next(c for o, c in orgs_with_counts if o.id == org.id)
            typer.echo(
                f"   • {org.slug} (ID: {org.id}, "
                f"{order_count} order(s), created: {org.created_at})"
            )
        typer.echo()

        if dry_run:
            typer.echo("🏃 DRY RUN MODE - No changes will be made")
            typer.echo(f"   Would unlink {len(orgs_to_unlink)} organization(s)")
            return

        typer.echo("🚀 Proceeding with unlinking...")
        typer.echo()

        for org in orgs_to_unlink:
            try:
                typer.echo(f"   Processing {org.slug}...")

                new_account = await create_account_without_stripe(session, account)
                typer.echo(f"      ✓ Created new account {new_account.id}")

                org_repository = OrganizationRepository.from_session(session)
                await org_repository.update(
                    org, update_dict={"account_id": new_account.id}
                )
                await session.refresh(org, ["account"])
                typer.echo("      ✓ Updated organization account_id")

                is_ready = await organization_service.is_organization_ready_for_payment(
                    session, org
                )
                if is_ready:
                    typer.echo("      ✓ Organization still ready for payments")
                else:
                    typer.echo("      ⚠️  WARNING: Organization NOT ready for payments!")

                await session.commit()
                typer.echo("      ✓ Committed changes")

            except Exception as e:
                await session.rollback()
                typer.echo(f"      ❌ Error: {str(e)}")
                raise

        typer.echo()
        typer.echo(f"✅ Successfully unlinked {len(orgs_to_unlink)} organization(s)")

        if send_email:
            typer.echo()
            typer.echo("📧 Sending email notification to admin...")

            try:
                orgs_unlinked_names = [org.slug for org in orgs_to_unlink]

                email_data = OrganizationAccountUnlinkEmail(
                    props=OrganizationAccountUnlinkProps(
                        email=account.admin.email,
                        organization_kept_name=org_to_keep.slug,
                        organizations_unlinked=orgs_unlinked_names,
                    )
                )

                email_html = render_email_template(email_data)

                await email_sender.send(
                    to_email_addr=account.admin.email,
                    subject="Important: Organization Account Update",
                    html_content=email_html,
                )

                typer.echo(f"   ✓ Email sent to {account.admin.email}")
            except Exception as e:
                typer.echo(f"   ❌ Failed to send email: {str(e)}")
                typer.echo(
                    "   ⚠️  Organizations were unlinked successfully, but email notification failed"
                )


if __name__ == "__main__":
    cli()
