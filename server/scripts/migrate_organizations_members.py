"""
Script to migrate organizations to the members model.

Given optional filters, this script:
1. Queries organizations ordered by next_review_threshold (ascending)
2. Filters to those that don't already have member_model_enabled
3. Enables member_model_enabled on each organization
4. Runs the backfill steps directly for each organization

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

    Repair previously migrated orgs (re-run backfill for orgs with flag already enabled):
        uv run python -m scripts.migrate_organizations_members repair --no-dry-run
        uv run python -m scripts.migrate_organizations_members repair --slug my-org --no-dry-run

    Repair in batches of 1000:
        uv run python -m scripts.migrate_organizations_members repair --no-dry-run --limit 1000 --offset 0
        uv run python -m scripts.migrate_organizations_members repair --no-dry-run --limit 1000 --offset 1000
        uv run python -m scripts.migrate_organizations_members repair --no-dry-run --limit 1000 --offset 2000
"""

import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import func, or_, select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.organization.repository import OrganizationRepository
from polar.organization.tasks import (
    _backfill_benefit_grants,
    _backfill_owner_members,
    _backfill_seats,
    _cleanup_orphaned_seat_customers,
)
from polar.postgres import create_async_engine

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
                    Organization.feature_settings["seat_based_pricing_enabled"].is_(
                        None
                    ),
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
            f"Would migrate {len(organizations)} organization(s) and run backfill."
        )
        return

    # Perform migration
    typer.echo(f"Migrating {len(organizations)} organization(s)...")
    typer.echo()

    migrated_count = 0
    failed_count = 0

    for org in organizations:
        try:
            # Step 1: Enable member_model_enabled
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                organization.feature_settings = {
                    **organization.feature_settings,
                    "member_model_enabled": True,
                }
                session.add(organization)
                await session.commit()

            # Step 2: Run backfill steps directly
            # Each step runs in its own session/transaction so that
            # partial progress is preserved on failure (steps are idempotent)

            # Step A: Create owner members for all customers without one
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                owner_members_created = await _backfill_owner_members(
                    session, organization
                )
                await session.commit()

            # Step B: Migrate active seats
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                seats_migrated, orphaned_customer_ids = await _backfill_seats(
                    session, organization
                )
                await session.commit()

            # Step C: Link benefit grants to correct members
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                grants_linked = await _backfill_benefit_grants(session, organization)
                await session.commit()

            # Step D: Soft-delete orphaned seat-holder customers
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                customers_deleted = await _cleanup_orphaned_seat_customers(
                    session, organization, orphaned_customer_ids
                )
                await session.commit()

            migrated_count += 1
            typer.echo(
                f"  [{migrated_count}/{len(organizations)}] "
                f"{org.slug} (threshold={org.next_review_threshold}) "
                f"owners={owner_members_created} seats={seats_migrated} "
                f"grants={grants_linked} deleted={customers_deleted}"
            )

        except Exception as e:
            failed_count += 1
            typer.echo(
                f"  FAILED: {org.slug} - {e}",
                err=True,
            )

    typer.echo()
    typer.echo("Migration complete:")
    typer.echo(f"  - Migrated: {migrated_count}")
    typer.echo(f"  - Failed: {failed_count}")


@cli.command()
@typer_async
async def repair(
    dry_run: bool = typer.Option(
        True, help="If True, only show what would be done without making changes"
    ),
    slug: str | None = typer.Option(None, help="Repair a single organization by slug"),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to repair"
    ),
    offset: int = typer.Option(
        0, help="Number of organizations to skip (for batch pagination)"
    ),
) -> None:
    """Re-run backfill for orgs that already have member_model_enabled.

    This is safe to run on all enabled orgs — every backfill step is idempotent
    and skips customers/seats/grants that already have members.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        statement = (
            select(Organization)
            .where(
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
                Organization.feature_settings["member_model_enabled"]
                .as_boolean()
                .is_(True),
                or_(
                    Organization.feature_settings["seat_based_pricing_enabled"].is_(
                        None
                    ),
                    Organization.feature_settings["seat_based_pricing_enabled"]
                    .as_boolean()
                    .is_(False),
                ),
            )
            .order_by(
                Organization.next_review_threshold.asc(),
                Organization.id.asc(),
            )
        )

        if slug is not None:
            statement = statement.where(Organization.slug == slug)

        if offset > 0:
            statement = statement.offset(offset)

        if limit is not None:
            statement = statement.limit(limit)

        result = await session.execute(statement)
        organizations = list(result.scalars().all())

        # Get total count (without limit/offset) for progress display
        count_statement = (
            select(func.count())
            .select_from(Organization)
            .where(
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
                Organization.feature_settings["member_model_enabled"]
                .as_boolean()
                .is_(True),
                or_(
                    Organization.feature_settings[
                        "seat_based_pricing_enabled"
                    ].is_(None),
                    Organization.feature_settings["seat_based_pricing_enabled"]
                    .as_boolean()
                    .is_(False),
                ),
            )
        )
        total_count = await session.scalar(count_statement)

    if not organizations:
        typer.echo("No eligible organizations found.")
        return

    typer.echo(
        f"Found {len(organizations)} organization(s) to repair"
        f" (offset={offset}, total={total_count})"
    )
    typer.echo()

    if dry_run:
        typer.echo("DRY RUN - No changes will be made.")
        typer.echo(f"Would repair {len(organizations)} organization(s).")
        return

    typer.echo(f"Repairing {len(organizations)} organization(s)...")
    typer.echo()

    repaired_count = 0
    failed_count = 0
    skipped_count = 0

    for org in organizations:
        try:
            # Step A: Create owner members for all customers without one
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                owner_members_created = await _backfill_owner_members(
                    session, organization
                )
                await session.commit()

            # Step B: Migrate active seats
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                seats_migrated, orphaned_customer_ids = await _backfill_seats(
                    session, organization
                )
                await session.commit()

            # Step C: Link benefit grants to correct members
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                grants_linked = await _backfill_benefit_grants(session, organization)
                await session.commit()

            # Step D: Soft-delete orphaned seat-holder customers
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                customers_deleted = await _cleanup_orphaned_seat_customers(
                    session, organization, orphaned_customer_ids
                )
                await session.commit()

            if (
                owner_members_created == 0
                and seats_migrated == 0
                and grants_linked == 0
                and customers_deleted == 0
            ):
                skipped_count += 1
            else:
                repaired_count += 1
                typer.echo(
                    f"  [{repaired_count}] "
                    f"{org.slug} (threshold={org.next_review_threshold}) "
                    f"owners={owner_members_created} seats={seats_migrated} "
                    f"grants={grants_linked} deleted={customers_deleted}"
                )

        except Exception as e:
            failed_count += 1
            typer.echo(
                f"  FAILED: {org.slug} - {e}",
                err=True,
            )

    typer.echo()
    typer.echo("Repair complete:")
    typer.echo(f"  - Repaired: {repaired_count}")
    typer.echo(f"  - Already OK: {skipped_count}")
    typer.echo(f"  - Failed: {failed_count}")


if __name__ == "__main__":
    cli()
