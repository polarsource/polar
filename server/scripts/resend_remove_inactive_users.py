import typer
from sqlalchemy import select

from polar.integrations.resend.service import ACTIVE_ORGANIZATION_STATUSES
from polar.models import User
from polar.user_organization.repository import UserOrganizationRepository

from .backfill_resend_id import enqueue_sync_users
from .helper import typer_async

cli = typer.Typer()


@cli.command()
@typer_async
async def remove_inactive_users() -> None:
    """Sync users in Resend without an active, review, snoozed or offboarding organization."""
    statement = select(User.id).where(
        ~User.is_deleted,
        User.resend_id.is_not(None),
        ~UserOrganizationRepository.get_has_organization_with_status_clause(
            User.id, ACTIVE_ORGANIZATION_STATUSES
        ),
    )
    await enqueue_sync_users(statement)


if __name__ == "__main__":
    cli()
