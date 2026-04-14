import asyncio
import uuid
from collections.abc import Sequence
from dataclasses import dataclass

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from polar.config import settings
from polar.integrations.polar.client import (
    PolarSelfClient,
    PolarSelfClientError,
    get_client,
)
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization, User, UserOrganization
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

log = structlog.get_logger()

cli = typer.Typer()


@dataclass
class BackfillResult:
    customers_created: int = 0
    members_created: int = 0
    skipped_no_email: int = 0
    errors: int = 0


async def _load_active_organizations(
    session: AsyncSession, *, limit: int | None
) -> Sequence[Organization]:
    statement = (
        select(Organization)
        .where(
            Organization.deleted_at.is_(None),
            Organization.blocked_at.is_(None),
        )
        .order_by(Organization.created_at)
    )
    if limit is not None:
        statement = statement.limit(limit)
    result = await session.execute(statement)
    return result.scalars().all()


async def _load_active_members(
    session: AsyncSession, organization_id: uuid.UUID
) -> Sequence[User]:
    statement = (
        select(User)
        .join(UserOrganization, UserOrganization.user_id == User.id)
        .where(
            UserOrganization.organization_id == organization_id,
            UserOrganization.deleted_at.is_(None),
            User.deleted_at.is_(None),
        )
        .order_by(UserOrganization.created_at)
    )
    result = await session.execute(statement)
    return result.unique().scalars().all()


async def run_backfill(
    *,
    session: AsyncSession,
    client: PolarSelfClient,
    dry_run: bool = False,
    delay_seconds: float = 0,
    limit: int | None = None,
) -> BackfillResult:
    result = BackfillResult()
    organizations = await _load_active_organizations(session, limit=limit)

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Backfilling customers...", total=len(organizations)
        )
        for organization in organizations:
            members = await _load_active_members(session, organization.id)
            email = organization.email or (members[0].email if members else None)

            if email is None:
                log.warning(
                    "backfill.skip_no_email",
                    organization_id=str(organization.id),
                )
                result.skipped_no_email += 1
                progress.advance(task)
                continue

            if dry_run:
                typer.echo(
                    f"  Would backfill {organization.name} ({organization.id}) "
                    f"email={email} members={len(members)}"
                )
                progress.advance(task)
                continue

            try:
                customer = await client.create_customer(
                    external_id=str(organization.id),
                    email=email,
                    name=organization.name,
                )
            except PolarSelfClientError:
                log.error(
                    "backfill.customer_failed",
                    organization_id=str(organization.id),
                )
                result.errors += 1
                progress.advance(task)
                continue

            result.customers_created += 1

            try:
                await client.create_free_subscription(
                    external_customer_id=str(organization.id),
                    product_id=settings.POLAR_FREE_PRODUCT_ID,
                )
            except PolarSelfClientError:
                log.error(
                    "backfill.subscription_failed",
                    organization_id=str(organization.id),
                )
                result.errors += 1

            for member in members:
                try:
                    await client.add_member(
                        customer_id=customer.id,
                        email=member.email,
                        name=member.public_name,
                        external_id=str(member.id),
                    )
                    result.members_created += 1
                except PolarSelfClientError:
                    log.error(
                        "backfill.member_failed",
                        organization_id=str(organization.id),
                        user_id=str(member.id),
                    )
                    result.errors += 1
                if delay_seconds > 0:
                    await asyncio.sleep(delay_seconds)

            progress.advance(task)
            if delay_seconds > 0:
                await asyncio.sleep(delay_seconds)

    return result


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        True, help="Print what would be done without calling the API"
    ),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to process"
    ),
    delay_seconds: float = typer.Option(0.5, help="Seconds between API calls"),
) -> None:
    """Backfill Polar customers, free subscriptions, and members for all active organizations."""
    configure_script_logging()

    if not settings.POLAR_SELF_ENABLED:
        typer.echo(
            "POLAR_ACCESS_TOKEN, POLAR_ORGANIZATION_ID, or POLAR_FREE_PRODUCT_ID "
            "is not configured, aborting."
        )
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            result = await run_backfill(
                session=session,
                client=get_client(),
                dry_run=dry_run,
                delay_seconds=delay_seconds,
                limit=limit,
            )

        typer.echo(
            f"\nDone: {result.customers_created} customers, "
            f"{result.members_created} members, "
            f"{result.skipped_no_email} skipped (no email), "
            f"{result.errors} errors"
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
