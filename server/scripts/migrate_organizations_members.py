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

    Prepare seat-based orgs for member model (Phase 0B, non-destructive):
        uv run python -m scripts.migrate_organizations_members prepare
        uv run python -m scripts.migrate_organizations_members prepare --slug my-org --no-dry-run
        uv run python -m scripts.migrate_organizations_members prepare --limit 10 --no-dry-run

    Find one-off order grants incorrectly deleted by the backfill:
        uv run python -m scripts.migrate_organizations_members restore-oneoff-grants
        uv run python -m scripts.migrate_organizations_members restore-oneoff-grants --verbose
        uv run python -m scripts.migrate_organizations_members restore-oneoff-grants --restore
"""

import asyncio
import logging.config
import uuid
from functools import wraps
from typing import Any, cast

import structlog
import typer
from sqlalchemy import String, func, or_, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import aliased, joinedload

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.models.benefit_grant import BenefitGrant
from polar.models.organization import OrganizationStatus
from polar.organization.repository import OrganizationRepository
from polar.organization.tasks import (
    _backfill_benefit_grants,
    _backfill_owner_members,
    _backfill_seats,
    _cleanup_orphaned_seat_customers,
    _prepare_benefit_grants,
    _prepare_seats,
)
from polar.postgres import AsyncSession, create_async_engine

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
                Organization.status != OrganizationStatus.BLOCKED,
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
                Organization.status != OrganizationStatus.BLOCKED,
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
                Organization.status != OrganizationStatus.BLOCKED,
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
    """Prepare seat-based orgs for member model migration (Phase 0B).

    Non-destructive: populates member_id/email on seats and grants without
    changing customer_id, deleting customers, or flipping any flags.

    Targets orgs with seat_based_pricing_enabled=True and member_model_enabled=False.
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
        typer.echo(f"Would prepare {len(organizations)} organization(s).")
        return

    typer.echo(f"Preparing {len(organizations)} organization(s)...")
    typer.echo()

    prepared_count = 0
    failed_count = 0

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

            # Step B: Prepare seats (set member_id and email, don't change customer_id)
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                seats_prepared = await _prepare_seats(session, organization)
                await session.commit()

            # Step C: Prepare grants (set member_id, don't change customer_id)
            async with sessionmaker() as session:
                organization = await OrganizationRepository.from_session(
                    session
                ).get_by_id(org.id)
                assert organization is not None
                grants_linked = await _prepare_benefit_grants(session, organization)
                await session.commit()

            # NO Step D — no customer deletion

            prepared_count += 1
            typer.echo(
                f"  [{prepared_count}/{len(organizations)}] "
                f"{org.slug} "
                f"owners={owner_members_created} seats={seats_prepared} "
                f"grants={grants_linked}"
            )

        except Exception as e:
            failed_count += 1
            typer.echo(
                f"  FAILED: {org.slug} - {e}",
                err=True,
            )

    typer.echo()
    typer.echo("Preparation complete:")
    typer.echo(f"  - Prepared: {prepared_count}")
    typer.echo(f"  - Failed: {failed_count}")


_RESTORE_BATCH_SIZE = 100


async def find_deleted_oneoff_grants(
    session: AsyncSession,
    *,
    eager_load: bool = False,
) -> list[BenefitGrant]:
    """Find one-off order grants incorrectly soft-deleted by the backfill.

    Returns grants where:
    - order_id IS NOT NULL (one-off order)
    - subscription_id IS NULL
    - deleted_at IS NOT NULL (was soft-deleted)
    - member_id IS NULL (backfill deleted before linking)
    - A surviving sibling exists (same customer + benefit, different order,
      not deleted, and still granted — i.e. not revoked due to benefit removal)

    When eager_load=True, the customer and benefit relationships are loaded.
    """
    from polar.models import Benefit

    sibling = aliased(BenefitGrant)
    sibling_exists = (
        select(sibling.id)
        .where(
            sibling.customer_id == BenefitGrant.customer_id,
            sibling.benefit_id == BenefitGrant.benefit_id,
            sibling.id != BenefitGrant.id,
            sibling.order_id.is_not(None),
            sibling.deleted_at.is_(None),
            sibling.revoked_at.is_(None),
        )
        .correlate(BenefitGrant)
        .exists()
    )

    statement = (
        select(BenefitGrant)
        .where(
            BenefitGrant.order_id.is_not(None),
            BenefitGrant.subscription_id.is_(None),
            BenefitGrant.deleted_at.is_not(None),
            BenefitGrant.member_id.is_(None),
            sibling_exists,
        )
        .order_by(BenefitGrant.customer_id, BenefitGrant.benefit_id)
    )

    if eager_load:
        statement = statement.options(
            joinedload(BenefitGrant.customer),
            joinedload(BenefitGrant.benefit).joinedload(Benefit.organization),
        )

    result = await session.execute(statement)
    return list(result.scalars().unique().all())


async def restore_oneoff_grant_batch(
    session: AsyncSession,
    grant_ids: list[uuid.UUID],
) -> tuple[int, int]:
    """Restore a batch of incorrectly deleted one-off order grants.

    For each grant:
    - Clears deleted_at
    - Copies member_id from the surviving sibling
    - Ensures granted_at is set, clears revoked_at
    - Restores the associated license key (if any)

    Returns (grants_restored, license_keys_restored).
    """
    from polar.kit.utils import utc_now
    from polar.models.license_key import LicenseKey, LicenseKeyStatus

    # Re-fetch with qualifying filters so the function is safe
    # regardless of what IDs are passed in.
    grants = list(
        (
            await session.execute(
                select(BenefitGrant).where(
                    BenefitGrant.id.in_(grant_ids),
                    BenefitGrant.order_id.is_not(None),
                    BenefitGrant.subscription_id.is_(None),
                    BenefitGrant.deleted_at.is_not(None),
                    BenefitGrant.member_id.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )

    restored = 0
    lk_restored = 0

    for grant in grants:
        # Find the surviving sibling to copy member_id from.
        # Sibling must still be granted (not revoked due to benefit removal).
        sibling_grant = await session.scalar(
            select(BenefitGrant).where(
                BenefitGrant.customer_id == grant.customer_id,
                BenefitGrant.benefit_id == grant.benefit_id,
                BenefitGrant.id != grant.id,
                BenefitGrant.order_id.is_not(None),
                BenefitGrant.deleted_at.is_(None),
                BenefitGrant.revoked_at.is_(None),
            )
        )

        # Restore the grant
        grant.deleted_at = None
        if sibling_grant is not None and sibling_grant.member_id is not None:
            grant.member_id = sibling_grant.member_id
        if grant.granted_at is None:
            grant.granted_at = utc_now()
        if grant.revoked_at is not None:
            grant.revoked_at = None

        # Restore associated license key if referenced in properties
        lk_id_raw = (grant.properties or {}).get("license_key_id")
        if lk_id_raw:
            try:
                lk_id = uuid.UUID(str(lk_id_raw))
            except ValueError:
                restored += 1
                continue

            lk = await session.get(LicenseKey, lk_id)
            if lk is not None:
                # Verify ownership before mutating
                if (
                    lk.customer_id != grant.customer_id
                    or lk.benefit_id != grant.benefit_id
                ):
                    restored += 1
                    continue

                lk_changed = False
                if lk.deleted_at is not None:
                    lk.deleted_at = None
                    lk_changed = True
                if lk.status != LicenseKeyStatus.granted:
                    lk.status = LicenseKeyStatus.granted
                    lk_changed = True
                if grant.member_id is not None and lk.member_id != grant.member_id:
                    lk.member_id = grant.member_id
                    lk_changed = True
                if lk_changed:
                    lk_restored += 1

        restored += 1

    await session.flush()
    return restored, lk_restored


@cli.command("restore-oneoff-grants")
@typer_async
async def restore_oneoff_grants(
    restore: bool = typer.Option(
        False, help="Actually restore the grants. Without this flag, only finds them."
    ),
    verbose: bool = typer.Option(
        False, "--verbose", "-v", help="Show customer, member, and benefit details"
    ),
) -> None:
    """Find (and optionally restore) one-off order benefit grants incorrectly deleted by backfill.

    The member backfill previously treated one-off order grants as duplicates
    when the same (subscription_id=NULL, member_id, benefit_id) already existed.
    This deleted one grant per (customer, benefit) pair even though each order
    should have its own independent grant.

    By default, this command only lists the affected grants.
    Pass --restore to actually fix them.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        deleted_grants = await find_deleted_oneoff_grants(session, eager_load=verbose)

    if not deleted_grants:
        typer.echo("No incorrectly deleted one-off grants found.")
        return

    typer.echo(f"Found {len(deleted_grants)} grant(s) to restore")
    typer.echo()

    if verbose:
        for grant in deleted_grants:
            customer = grant.customer
            benefit = grant.benefit
            org = benefit.organization
            typer.echo(f"  Grant {grant.id}")
            typer.echo(f"    Organization: {org.slug} ({org.id})")
            typer.echo(f"    Customer:     {customer.email} ({customer.id})")
            typer.echo(f"    Benefit:      {benefit.description} ({benefit.id})")
            typer.echo(f"    Order:        {grant.order_id}")
            lk_id = (grant.properties or {}).get("license_key_id")
            if lk_id:
                typer.echo(f"    License key:  {lk_id}")
            typer.echo()
    else:
        typer.echo(
            f"  {'Grant ID':<38} {'Customer ID':<38} {'Benefit ID':<38} {'Order ID'}"
        )
        typer.echo(f"  {'-' * 150}")
        for grant in deleted_grants:
            typer.echo(
                f"  {grant.id!s:<38} {grant.customer_id!s:<38} "
                f"{grant.benefit_id!s:<38} {grant.order_id}"
            )
        typer.echo()

    if not restore:
        typer.echo("Pass --restore to actually restore these grants.")
        return

    # Restore grants in batches
    typer.echo(f"Restoring {len(deleted_grants)} grant(s)...")
    typer.echo()

    total_restored = 0
    total_lk_restored = 0
    failed_count = 0

    grant_ids = [g.id for g in deleted_grants]
    for batch_start in range(0, len(grant_ids), _RESTORE_BATCH_SIZE):
        batch_ids = grant_ids[batch_start : batch_start + _RESTORE_BATCH_SIZE]

        try:
            async with sessionmaker() as session:
                restored, lk_restored = await restore_oneoff_grant_batch(
                    session, batch_ids
                )
                await session.commit()

            total_restored += restored
            total_lk_restored += lk_restored
            typer.echo(
                f"  Batch {batch_start // _RESTORE_BATCH_SIZE + 1}: "
                f"restored {restored} grant(s)"
            )

        except Exception as e:
            failed_count += len(batch_ids)
            typer.echo(
                f"  FAILED batch {batch_start // _RESTORE_BATCH_SIZE + 1}: {e}",
                err=True,
            )

    typer.echo()
    typer.echo("Restore complete:")
    typer.echo(f"  - Grants restored: {total_restored}")
    typer.echo(f"  - License keys restored: {total_lk_restored}")
    typer.echo(f"  - Failed: {failed_count}")
    if total_restored > 0:
        typer.echo()
        typer.echo(
            "NOTE: Run 'repair' afterwards to link any grants "
            "that could not be matched to a member."
        )


async def _backfill_license_keys(session: AsyncSession) -> int:
    """Backfill member_id on license keys using the grant's properties->>'license_key_id'."""
    from polar.models.license_key import LicenseKey

    lk_subq = (
        select(
            BenefitGrant.properties["license_key_id"].as_string().label("lk_id"),
            BenefitGrant.member_id,
        )
        .where(
            BenefitGrant.member_id.is_not(None),
            BenefitGrant.is_deleted.is_(False),
            BenefitGrant.properties["license_key_id"].is_not(None),
        )
        .subquery()
    )

    result = cast(
        CursorResult[Any],
        await session.execute(
            update(LicenseKey)
            .where(
                LicenseKey.member_id.is_(None),
                LicenseKey.id.cast(String) == lk_subq.c.lk_id,
            )
            .values(member_id=lk_subq.c.member_id)
        ),
    )
    return result.rowcount


async def _backfill_downloadables(session: AsyncSession) -> int:
    """Backfill member_id on downloadables via (customer_id, benefit_id).

    Uses DISTINCT ON to pick the most recently granted grant.
    """
    from polar.models.downloadable import Downloadable

    dl_subq = (
        select(
            BenefitGrant.customer_id,
            BenefitGrant.benefit_id,
            BenefitGrant.member_id,
        )
        .where(
            BenefitGrant.member_id.is_not(None),
            BenefitGrant.is_deleted.is_(False),
        )
        .distinct(BenefitGrant.customer_id, BenefitGrant.benefit_id)
        .order_by(
            BenefitGrant.customer_id,
            BenefitGrant.benefit_id,
            BenefitGrant.granted_at.desc().nulls_last(),
        )
        .subquery()
    )

    result = cast(
        CursorResult[Any],
        await session.execute(
            update(Downloadable)
            .where(
                Downloadable.member_id.is_(None),
                Downloadable.customer_id == dl_subq.c.customer_id,
                Downloadable.benefit_id == dl_subq.c.benefit_id,
            )
            .values(member_id=dl_subq.c.member_id)
        ),
    )
    return result.rowcount


@cli.command()
@typer_async
async def backfill_benefit_records(
    dry_run: bool = typer.Option(
        True, help="If True, only show what would be done without making changes"
    ),
) -> None:
    """One-time backfill of member_id on license_keys and downloadables.

    Uses benefit_grants (which already have member_id set by the migration)
    to populate the missing member_id on the related benefit records.

    License keys are matched 1:1 via the grant's properties->>'license_key_id'.
    Downloadables are matched via (customer_id, benefit_id) with DISTINCT ON
    to pick the most recently granted grant.
    """
    from polar.models.downloadable import Downloadable
    from polar.models.license_key import LicenseKey

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        lk_count = await session.scalar(
            select(func.count())
            .select_from(LicenseKey)
            .where(LicenseKey.member_id.is_(None))
        )
        dl_count = await session.scalar(
            select(func.count())
            .select_from(Downloadable)
            .where(Downloadable.member_id.is_(None))
        )

    typer.echo(f"License keys without member_id: {lk_count}")
    typer.echo(f"Downloadables without member_id: {dl_count}")
    typer.echo()

    if dry_run:
        typer.echo("DRY RUN - No changes will be made.")
        return

    async with sessionmaker() as session:
        lk_updated = await _backfill_license_keys(session)
        typer.echo(f"License keys updated: {lk_updated}")

        dl_updated = await _backfill_downloadables(session)
        typer.echo(f"Downloadables updated: {dl_updated}")

        await session.commit()

    typer.echo()
    typer.echo("Backfill complete.")


if __name__ == "__main__":
    cli()
