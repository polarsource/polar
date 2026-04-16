import traceback
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field

import dramatiq
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import String, cast, select

from polar import tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.config import settings
from polar.customer.schemas.customer import CustomerTeamCreate
from polar.customer.service import customer as customer_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.member.schemas import MemberOwnerCreate
from polar.member.service import member_service
from polar.models import Customer, Organization, Product, User, UserOrganization
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import Redis, create_redis
from polar.subscription.schemas import SubscriptionCreateExternalCustomer
from polar.subscription.service import subscription as subscription_service
from polar.worker import JobQueueManager

from .helper import configure_script_logging, typer_async

log = structlog.get_logger()

cli = typer.Typer()


@dataclass
class BackfillResult:
    customers_created: int = 0
    members_created: int = 0
    subscriptions_created: int = 0
    skipped_no_members: int = 0
    errors: int = 0
    error_details: list[tuple[str, str, str]] = field(default_factory=list)


@dataclass
class _OrganizationTally:
    customers: int = 0
    members: int = 0
    subscriptions: int = 0


async def _load_active_organizations(
    session: AsyncSession,
    *,
    exclude_external_ids: set[str],
    limit: int | None,
) -> Sequence[Organization]:
    statement = (
        select(Organization)
        .where(
            Organization.deleted_at.is_(None),
            Organization.blocked_at.is_(None),
        )
        .order_by(Organization.created_at)
    )
    if exclude_external_ids:
        statement = statement.where(
            cast(Organization.id, String).notin_(exclude_external_ids)
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


async def _load_existing_external_ids(
    session: AsyncSession, self_org_id: uuid.UUID
) -> set[str]:
    statement = select(Customer.external_id).where(
        Customer.organization_id == self_org_id,
        Customer.external_id.is_not(None),
    )
    result = await session.execute(statement)
    return {row[0] for row in result.all()}


async def _backfill_organization(
    session: AsyncSession,
    *,
    auth_subject: AuthSubject[Organization],
    free_product: Product,
    organization: Organization,
    members: Sequence[User],
) -> _OrganizationTally:
    owner = members[0]
    tally = _OrganizationTally()

    customer = await customer_service.create(
        session,
        CustomerTeamCreate(
            type="team",
            email=owner.email,
            name=organization.name,
            external_id=str(organization.id),
            owner=MemberOwnerCreate(
                email=owner.email,
                name=owner.public_name,
                external_id=str(owner.id),
            ),
        ),
        auth_subject,
    )
    tally.customers += 1
    tally.members += 1

    for member in members[1:]:
        await member_service.create(
            session,
            auth_subject,
            customer_id=customer.id,
            email=member.email,
            name=member.public_name,
            external_id=str(member.id),
        )
        tally.members += 1

    await subscription_service.create(
        session,
        SubscriptionCreateExternalCustomer(
            product_id=free_product.id,
            external_customer_id=str(organization.id),
        ),
        auth_subject,
    )
    tally.subscriptions += 1

    return tally


BATCH_SIZE = 100


async def run_backfill(
    *,
    session: AsyncSession,
    redis: Redis | None = None,
    dry_run: bool = False,
    limit: int | None = None,
) -> BackfillResult:
    result = BackfillResult()

    self_org = await session.get(
        Organization, uuid.UUID(settings.POLAR_ORGANIZATION_ID)
    )
    if self_org is None:
        raise RuntimeError(
            f"Polar self organization {settings.POLAR_ORGANIZATION_ID} not found"
        )

    free_product = await session.get(Product, uuid.UUID(settings.POLAR_FREE_PRODUCT_ID))
    if free_product is None:
        raise RuntimeError(f"Free product {settings.POLAR_FREE_PRODUCT_ID} not found")

    auth_subject: AuthSubject[Organization] = AuthSubject(
        subject=self_org, scopes=set(), session=None
    )

    typer.echo("Loading existing Polar self customers...")
    existing_external_ids = await _load_existing_external_ids(session, self_org.id)
    typer.echo(f"  Found {len(existing_external_ids)} existing customers")

    organizations = await _load_active_organizations(
        session, exclude_external_ids=existing_external_ids, limit=limit
    )
    typer.echo(f"Loaded {len(organizations)} candidate organizations")

    async def commit_and_flush() -> None:
        await session.commit()
        if redis is not None:
            await JobQueueManager.get().flush(dramatiq.get_broker(), redis)

    processed_in_batch = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating customers...", total=len(organizations)
        )
        for organization in organizations:
            members = await _load_active_members(session, organization.id)
            if not members:
                log.warning(
                    "backfill.skip_no_members",
                    organization_id=str(organization.id),
                )
                result.skipped_no_members += 1
                progress.advance(task)
                continue

            if dry_run:
                typer.echo(
                    f"  Would create {organization.name} ({organization.id}) "
                    f"owner={members[0].email} members={len(members)}"
                )
                progress.advance(task)
                continue

            tally: _OrganizationTally | None = None
            try:
                async with session.begin_nested():
                    tally = await _backfill_organization(
                        session,
                        auth_subject=auth_subject,
                        free_product=free_product,
                        organization=organization,
                        members=members,
                    )
            except Exception:
                result.errors += 1
                result.error_details.append(
                    (
                        str(organization.id),
                        organization.name,
                        traceback.format_exc(),
                    )
                )

            if tally is not None:
                result.customers_created += tally.customers
                result.members_created += tally.members
                result.subscriptions_created += tally.subscriptions

            processed_in_batch += 1
            if processed_in_batch >= BATCH_SIZE:
                await commit_and_flush()
                processed_in_batch = 0

            progress.advance(task)

        if not dry_run and processed_in_batch > 0:
            await commit_and_flush()

    return result


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        True, help="Print what would be done without creating records"
    ),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to process"
    ),
) -> None:
    """Backfill Polar customers, members, and subscriptions for all active organizations."""
    configure_script_logging()

    if not settings.POLAR_SELF_ENABLED:
        typer.echo(
            "POLAR_ACCESS_TOKEN, POLAR_ORGANIZATION_ID, or POLAR_FREE_PRODUCT_ID "
            "is not configured, aborting."
        )
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")

    try:
        async with (
            JobQueueManager.open(dramatiq.get_broker(), redis),
            sessionmaker() as session,
        ):
            result = await run_backfill(
                session=session, redis=redis, dry_run=dry_run, limit=limit
            )

        typer.echo(
            f"\nDone: {result.customers_created} customers, "
            f"{result.members_created} members, "
            f"{result.subscriptions_created} subscriptions, "
            f"{result.skipped_no_members} skipped (no members), "
            f"{result.errors} errors"
        )
        if result.error_details:
            typer.echo("\nErrors:")
            for org_id, org_name, tb in result.error_details:
                typer.echo(f"\n  {org_name} ({org_id}):")
                for line in tb.rstrip().splitlines():
                    typer.echo(f"    {line}")
    finally:
        await redis.aclose()  # type: ignore[attr-defined]
        await engine.dispose()


if __name__ == "__main__":
    cli()
