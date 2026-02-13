"""
Script to migrate organizations to the members model.

Given optional filters, this script:
1. Queries organizations ordered by next_review_threshold (ascending)
2. Filters to those that don't already have member_model_enabled
3. Enables member_model_enabled on each organization
4. Enqueues the backfill_members job for each organization

Usage:
    Dry run (default):
        uv run python -m scripts.migrate_organizations_members

    Actually perform the migration:
        uv run python -m scripts.migrate_organizations_members --no-dry-run

    Migrate only organizations below a specific threshold:
        uv run python -m scripts.migrate_organizations_members --max-threshold 1000

    Migrate a single organization by slug:
        uv run python -m scripts.migrate_organizations_members --slug my-org --no-dry-run

    Limit how many organizations to migrate:
        uv run python -m scripts.migrate_organizations_members --limit 10 --no-dry-run
"""

import asyncio
import logging.config
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer
from sqlalchemy import or_, select

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager, enqueue_job

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
async def migrate_organizations(
    dry_run: bool = typer.Option(
        True, help="If True, only show what would be done without making changes"
    ),
    max_threshold: int | None = typer.Option(
        None, help="Only migrate organizations with next_review_threshold <= this value"
    ),
    min_threshold: int | None = typer.Option(
        None,
        help="Only migrate organizations with next_review_threshold >= this value",
    ),
    slug: str | None = typer.Option(None, help="Migrate a single organization by slug"),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to migrate"
    ),
) -> None:
    """Migrate organizations to the members model, ordered by next_review_threshold."""
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")

    async with JobQueueManager.open(dramatiq.get_broker(), redis):
        async with sessionmaker() as session:
            # Build query for eligible organizations
            # Exclude orgs already migrated or with seat-based pricing at the DB level
            statement = (
                select(Organization)
                .where(
                    Organization.deleted_at.is_(None),
                    Organization.blocked_at.is_(None),
                    or_(
                        Organization.feature_settings["member_model_enabled"].is_(None),
                        Organization.feature_settings["member_model_enabled"]
                        .as_boolean()
                        .is_(False),
                    ),
                    or_(
                        Organization.feature_settings["seat_based_pricing_enabled"].is_(None),
                        Organization.feature_settings["seat_based_pricing_enabled"]
                        .as_boolean()
                        .is_(False),
                    ),
                )
                .order_by(Organization.next_review_threshold.asc())
            )

            if slug is not None:
                statement = statement.where(Organization.slug == slug)

            if max_threshold is not None:
                statement = statement.where(
                    Organization.next_review_threshold <= max_threshold
                )

            if min_threshold is not None:
                statement = statement.where(
                    Organization.next_review_threshold >= min_threshold
                )

            if limit is not None:
                statement = statement.limit(limit)

            result = await session.execute(statement)
            organizations = list(result.scalars().all())

            if not organizations:
                typer.echo("No eligible organizations found.")
                return

            typer.echo(f"Found {len(organizations)} organization(s) to migrate")
            typer.echo()

            # Display organizations to migrate
            typer.echo("Organizations to migrate (ordered by next_review_threshold):")
            typer.echo(f"{'Slug':<40} {'Threshold':>10} {'ID'}")
            typer.echo("-" * 90)
            for org in organizations:
                typer.echo(f"{org.slug:<40} {org.next_review_threshold:>10} {org.id}")
            typer.echo()

            if dry_run:
                typer.echo("DRY RUN - No changes will be made.")
                typer.echo(
                    f"Would migrate {len(organizations)} organization(s) and enqueue backfill jobs."
                )
                return

            # Perform migration
            typer.echo(f"Migrating {len(organizations)} organization(s)...")
            typer.echo()

            migrated_count = 0
            failed_count = 0

            for org in organizations:
                try:
                    # Enable member_model_enabled
                    org.feature_settings = {
                        **org.feature_settings,
                        "member_model_enabled": True,
                    }
                    session.add(org)
                    await session.flush()

                    # Enqueue backfill job
                    enqueue_job(
                        "organization.backfill_members",
                        organization_id=org.id,
                    )

                    migrated_count += 1
                    typer.echo(
                        f"  [{migrated_count}/{len(organizations)}] "
                        f"{org.slug} (threshold={org.next_review_threshold})"
                    )

                except Exception as e:
                    failed_count += 1
                    typer.echo(
                        f"  FAILED: {org.slug} - {e}",
                        err=True,
                    )

            # Commit all changes in a single transaction
            await session.commit()

            typer.echo()
            typer.echo("Migration complete:")
            typer.echo(f"  - Migrated: {migrated_count}")
            typer.echo(f"  - Failed: {failed_count}")
            typer.echo(f"  - Backfill jobs enqueued: {migrated_count}")


if __name__ == "__main__":
    cli()
