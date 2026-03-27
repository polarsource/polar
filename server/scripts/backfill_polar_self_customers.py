import asyncio

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import select

from polar.config import settings
from polar.integrations.polar.client import PolarSelfClient, PolarSelfClientError
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization, User, UserOrganization
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

log = structlog.get_logger()

cli = typer.Typer()


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        False, help="Print what would be done without calling the API"
    ),
    delay_seconds: float = typer.Option(0.5, help="Seconds between API calls"),
) -> None:
    """Backfill Polar customers and free subscriptions for all active organizations."""
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
            statement = (
                select(Organization)
                .where(
                    Organization.deleted_at.is_(None),
                    Organization.blocked_at.is_(None),
                )
                .order_by(Organization.created_at)
            )
            result = await session.execute(statement)
            organizations = result.scalars().all()

            typer.echo(f"Found {len(organizations)} active organizations")

            created = 0
            skipped = 0
            errors = 0

            with Progress() as progress:
                task = progress.add_task(
                    "[cyan]Backfilling customers...", total=len(organizations)
                )

                for org in organizations:
                    user_stmt = (
                        select(User)
                        .join(UserOrganization, UserOrganization.user_id == User.id)
                        .where(
                            UserOrganization.organization_id == org.id,
                            UserOrganization.deleted_at.is_(None),
                        )
                        .order_by(UserOrganization.created_at)
                        .limit(1)
                    )
                    user_result = await session.execute(user_stmt)
                    user = user_result.scalar_one_or_none()

                    if user is None:
                        skipped += 1
                        progress.update(task, advance=1)
                        continue

                    email = org.email or user.email

                    if dry_run:
                        typer.echo(
                            f"  Would create customer: {org.name} ({org.id}) email={email}"
                        )
                        progress.update(task, advance=1)
                        continue

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
                        created += 1
                    except PolarSelfClientError:
                        errors += 1
                        log.error(
                            "backfill.create_customer_failed",
                            organization_id=str(org.id),
                        )

                    progress.update(task, advance=1)

                    if delay_seconds > 0:
                        await asyncio.sleep(delay_seconds)

            typer.echo(
                f"\nDone: {created} created, {skipped} skipped (no users), {errors} errors"
            )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
