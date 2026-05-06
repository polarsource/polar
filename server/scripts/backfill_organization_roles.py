import asyncio
from functools import wraps

import sqlalchemy as sa
import typer
from sqlalchemy import select, update

from polar.models import Account, Organization, UserOrganization
from polar.models.user_organization import OrganizationRole
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def backfill_organization_roles(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    target_rows = (
        select(UserOrganization.user_id, UserOrganization.organization_id)
        .join(Organization, Organization.id == UserOrganization.organization_id)
        .join(Account, Account.id == Organization.account_id)
        .where(
            UserOrganization.user_id == Account.admin_id,
            UserOrganization.role != OrganizationRole.owner,
            UserOrganization.deleted_at.is_(None),
            Organization.deleted_at.is_(None),
        )
        .limit(limit_bindparam())
    )

    await run_batched_update(
        (
            update(UserOrganization)
            .values(role=OrganizationRole.owner)
            .where(
                sa.tuple_(
                    UserOrganization.user_id, UserOrganization.organization_id
                ).in_(target_rows)
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
