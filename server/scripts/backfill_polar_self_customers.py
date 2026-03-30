import asyncio
from dataclasses import dataclass, field

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from polar.config import settings
from polar.integrations.polar.client import PolarSelfClient, PolarSelfClientError
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization, User, UserOrganization
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

log = structlog.get_logger()

cli = typer.Typer()


@dataclass
class BackfillResult:
    created: int = 0
    errors: int = 0
    members_created: list[tuple[str, str]] = field(default_factory=list)


async def run_backfill(
    *,
    session: AsyncSession,
    client: PolarSelfClient,
    delay_seconds: float = 0,
    limit: int | None = None,
) -> BackfillResult:
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
    organizations = result.scalars().all()

    backfill_result = BackfillResult()

    for org in organizations:
        members_stmt = (
            select(User)
            .join(UserOrganization, UserOrganization.user_id == User.id)
            .where(
                UserOrganization.organization_id == org.id,
                UserOrganization.deleted_at.is_(None),
            )
            .order_by(UserOrganization.created_at)
        )
        members_result = await session.execute(members_stmt)
        members = members_result.unique().scalars().all()
        email = org.email or members[0].email

        try:
            await client.create_customer(
                external_id=str(org.id),
                email=email,
                name=org.name,
                organization_id=settings.POLAR_ORGANIZATION_ID,
            )
            await client.create_free_subscription(
                external_customer_id=str(org.id),
                product_id=settings.POLAR_FREE_PRODUCT_ID,
            )
            customer = await client.get_customer_by_external_id(str(org.id))
            for member in members:
                await client.add_member(
                    customer_id=customer.id,
                    email=member.email,
                    name=member.public_name,
                    external_id=str(member.id),
                )
                backfill_result.members_created.append((str(org.id), str(member.id)))
                if delay_seconds > 0:
                    await asyncio.sleep(delay_seconds)
            backfill_result.created += 1
        except PolarSelfClientError:
            backfill_result.errors += 1
            log.error(
                "backfill.create_customer_failed",
                organization_id=str(org.id),
            )

        if delay_seconds > 0:
            await asyncio.sleep(delay_seconds)

    return backfill_result


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

    if not settings.POLAR_ACCESS_TOKEN:
        typer.echo("POLAR_ACCESS_TOKEN is not configured, aborting.")
        raise typer.Exit(1)

    client = PolarSelfClient(
        access_token=settings.POLAR_ACCESS_TOKEN,
        api_url=settings.POLAR_API_URL,
    )

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            if dry_run:
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
                organizations = result.scalars().all()
                for org in organizations:
                    members_stmt = (
                        select(User)
                        .join(
                            UserOrganization,
                            UserOrganization.user_id == User.id,
                        )
                        .where(
                            UserOrganization.organization_id == org.id,
                            UserOrganization.deleted_at.is_(None),
                        )
                    )
                    members_result = await session.execute(members_stmt)
                    members = members_result.unique().scalars().all()
                    email = org.email or members[0].email
                    typer.echo(
                        f"  Would create customer: {org.name} ({org.id}) email={email} members={len(members)}"
                    )
                return

            with Progress() as progress:
                task = progress.add_task("[cyan]Backfilling customers...", total=1)
                backfill_result = await run_backfill(
                    session=session,
                    client=client,
                    delay_seconds=delay_seconds,
                    limit=limit,
                )
                progress.update(task, advance=1)

            typer.echo(
                f"\nDone: {backfill_result.created} created, "
                f"{backfill_result.errors} errors, "
                f"{len(backfill_result.members_created)} members created"
            )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
