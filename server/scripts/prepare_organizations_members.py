"""
Script to prepare seat-based organizations for the member model migration.

This is the Phase 0B script: it enqueues `organization.prepare_members` tasks
for seat-based orgs that haven't yet enabled `member_model_enabled`.

The prepare task is non-destructive: it populates member_id/email on seats
and grants without changing customer_id, deleting customers, or flipping flags.

Usage:
    Dry run (default):
        uv run python -m scripts.prepare_organizations_members

    Actually enqueue tasks:
        uv run python -m scripts.prepare_organizations_members --no-dry-run

    Prepare a single organization by slug:
        uv run python -m scripts.prepare_organizations_members --slug my-org --no-dry-run

    Limit how many organizations to prepare:
        uv run python -m scripts.prepare_organizations_members --limit 10 --no-dry-run
"""

import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import or_, select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import OrganizationStatus
from polar.postgres import create_async_engine
from polar.worker import enqueue_job

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


@cli.command()
@typer_async
async def prepare(
    dry_run: bool = typer.Option(
        True, help="If True, only show what would be done without making changes"
    ),
    slug: str | None = typer.Option(None, help="Prepare a single organization by slug"),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to prepare"
    ),
) -> None:
    """Enqueue prepare_members tasks for seat-based orgs (Phase 0B).

    Targets orgs with seat_based_pricing_enabled=True and member_model_enabled=False.
    Does NOT flip any flags.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        statement = (
            select(Organization)
            .where(
                Organization.deleted_at.is_(None),
                Organization.status != OrganizationStatus.BLOCKED,
                Organization.feature_settings["seat_based_pricing_enabled"]
                .as_boolean()
                .is_(True),
                or_(
                    Organization.feature_settings["member_model_enabled"].is_(None),
                    Organization.feature_settings["member_model_enabled"]
                    .as_boolean()
                    .is_(False),
                ),
            )
            .order_by(Organization.slug.asc())
        )

        if slug is not None:
            statement = statement.where(Organization.slug == slug)

        if limit is not None:
            statement = statement.limit(limit)

        result = await session.execute(statement)
        organizations = list(result.scalars().all())

    if not organizations:
        typer.echo("No eligible organizations found.")
        return

    typer.echo(f"Found {len(organizations)} organization(s) to prepare")
    typer.echo()

    typer.echo("Organizations to prepare:")
    typer.echo(f"{'Slug':<40} {'ID'}")
    typer.echo("-" * 80)
    for org in organizations:
        typer.echo(f"{org.slug:<40} {org.id}")
    typer.echo()

    if dry_run:
        typer.echo("DRY RUN - No changes will be made.")
        typer.echo(
            f"Would enqueue prepare_members for {len(organizations)} organization(s)."
        )
        return

    typer.echo(f"Enqueuing prepare_members for {len(organizations)} organization(s)...")
    typer.echo()

    enqueued_count = 0
    for org in organizations:
        enqueue_job("organization.prepare_members", organization_id=org.id)
        enqueued_count += 1
        typer.echo(f"  [{enqueued_count}/{len(organizations)}] {org.slug}")

    typer.echo()
    typer.echo(f"Enqueued {enqueued_count} task(s).")


if __name__ == "__main__":
    cli()
