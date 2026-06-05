import typer
from sqlalchemy import select, tuple_, update

from polar.models import Organization, UserOrganization
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Copy organization-level notification settings down to every membership.

    Each `user_organizations.notification_settings` that hasn't been set yet
    inherits the value from its organization. Soft-deleted memberships are
    intentionally included so the column is fully populated.
    """
    await run_batched_update(
        (
            update(UserOrganization)
            .values(
                notification_settings=(
                    select(Organization.notification_settings)
                    .where(Organization.id == UserOrganization.organization_id)
                    .scalar_subquery()
                )
            )
            .where(
                tuple_(UserOrganization.user_id, UserOrganization.organization_id).in_(
                    select(
                        UserOrganization.user_id,
                        UserOrganization.organization_id,
                    )
                    .where(UserOrganization.notification_settings.is_(None))
                    .order_by(
                        UserOrganization.user_id,
                        UserOrganization.organization_id,
                    )
                    .limit(limit_bindparam())
                )
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
