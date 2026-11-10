import asyncio
from functools import wraps

import typer
from sqlalchemy import select, update

from polar.models import Organization, OrganizationDomain
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
async def backfill_deleted_organization_domains(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(OrganizationDomain)
            .values(
                deleted_at=select(Organization.deleted_at)
                .where(Organization.id == OrganizationDomain.organization_id)
                .scalar_subquery()
            )
            .where(
                OrganizationDomain.id.in_(
                    select(OrganizationDomain.id)
                    .join(
                        Organization,
                        Organization.id == OrganizationDomain.organization_id,
                    )
                    .where(
                        OrganizationDomain.deleted_at.is_(None),
                        Organization.deleted_at.is_not(None),
                    )
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
