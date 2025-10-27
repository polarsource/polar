"""
Script to unlink organizations from an account.

Given an account ID, this script:
1. Finds all organizations linked to that account
2. Counts orders for each organization (via Customer -> Order)
3. Reports organizations with orders (skips them)
4. Unlinks organizations without orders by creating a new account
5. If ALL organizations have no orders, keeps the oldest one with the existing account

The new account:
- Has no Stripe ID (stripe_id = None)
- Copies admin and key fields from the old account
- Ensures organization still passes payment readiness checks

Usage:
    Dry run (default):
        uv run python -m scripts.unlink_organization_account ACCOUNT_UUID

    Actually perform the unlink:
        uv run python -m scripts.unlink_organization_account ACCOUNT_UUID --no-dry-run
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

        orgs_with_orders = []
        orgs_without_orders = []

        for org in organizations:
            order_count = await count_orders_for_organization(session, org.id)
            if order_count > 0:
                orgs_with_orders.append((org, order_count))
            else:
                orgs_without_orders.append(org)

        if orgs_with_orders:
            typer.echo("📋 Organizations WITH orders (will be skipped):")
            for org, count in orgs_with_orders:
                typer.echo(f"   • {org.slug} (ID: {org.id}) - {count} order(s)")
            typer.echo()

        if not orgs_without_orders:
            typer.echo("❌ Error: No organizations without orders found")
            raise typer.Exit(code=1)

        # If ALL orgs have no orders, keep the oldest one with the existing account
        org_to_keep = None
        if not orgs_with_orders:
            orgs_without_orders_sorted = sorted(
                orgs_without_orders, key=lambda o: o.created_at
            )
            org_to_keep = orgs_without_orders_sorted[0]
            orgs_without_orders = orgs_without_orders_sorted[1:]

            typer.echo("ℹ️  All organizations have no orders")
            typer.echo(
                f"   Keeping oldest organization with existing account: {org_to_keep.slug} "
                f"(created: {org_to_keep.created_at})"
            )
            typer.echo()

        if orgs_without_orders:
            typer.echo("🔄 Organizations WITHOUT orders (will be unlinked):")
            for org in orgs_without_orders:
                typer.echo(f"   • {org.slug} (ID: {org.id}, created: {org.created_at})")
            typer.echo()
        else:
            typer.echo("✓ No organizations to unlink (only the oldest remains)")
            return

        if dry_run:
            typer.echo("🏃 DRY RUN MODE - No changes will be made")
            typer.echo(f"   Would unlink {len(orgs_without_orders)} organization(s)")
            return

        typer.echo("🚀 Proceeding with unlinking...")
        typer.echo()

        for org in orgs_without_orders:
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
        typer.echo(
            f"✅ Successfully unlinked {len(orgs_without_orders)} organization(s)"
        )


if __name__ == "__main__":
    cli()
