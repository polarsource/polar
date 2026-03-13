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
from typing import Any

import structlog
import typer
from sqlalchemy import func, or_, select
from sqlalchemy.orm import aliased, joinedload

from polar.customer.repository import CustomerRepository
from polar.kit.db.postgres import create_async_sessionmaker
from polar.member.repository import MemberRepository
from polar.models import Customer, CustomerSeat, Organization
from polar.models.benefit_grant import BenefitGrant
from polar.models.customer_seat import SeatStatus
from polar.models.member import Member
from polar.organization.repository import OrganizationRepository
from polar.organization.tasks import (
    _backfill_benefit_grants,
    _backfill_owner_members,
    _backfill_seats,
    _cleanup_orphaned_seat_customers,
    _get_or_create_member_for_backfill,
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


_PREPARE_BATCH_SIZE = 100


async def _prepare_seats(
    session: AsyncSession,
    organization: Organization,
) -> int:
    """Populate member_id and email on active seats.

    Unlike _backfill_seats(), this does NOT change seat.customer_id
    or set customer.type = team. It only adds member references
    so merchants can start reading them during Phase 1.
    """
    from polar.models import Order, Product, Subscription

    member_repository = MemberRepository.from_session(session)
    customer_repo = CustomerRepository.from_session(session)

    # Lazy cache of customer_id → owner member
    owner_members_map: dict[uuid.UUID, Member] = {}

    async def _get_owner_member(customer_id: uuid.UUID) -> Member | None:
        if customer_id not in owner_members_map:
            owner = await member_repository.get_owner_by_customer_id(
                session, customer_id
            )
            if owner is not None:
                owner_members_map[customer_id] = owner
        return owner_members_map.get(customer_id)

    sub_seats_stmt = (
        select(CustomerSeat)
        .join(Subscription, CustomerSeat.subscription_id == Subscription.id)
        .join(Product, Subscription.product_id == Product.id)
        .options(
            joinedload(CustomerSeat.subscription),
        )
        .where(
            Product.organization_id == organization.id,
            CustomerSeat.status != SeatStatus.revoked,
            CustomerSeat.subscription_id.is_not(None),
            CustomerSeat.member_id.is_(None),
        )
        .order_by(CustomerSeat.id)
    )
    order_seats_stmt = (
        select(CustomerSeat)
        .join(Order, CustomerSeat.order_id == Order.id)
        .join(Product, Order.product_id == Product.id)
        .options(
            joinedload(CustomerSeat.order),
        )
        .where(
            Product.organization_id == organization.id,
            CustomerSeat.status != SeatStatus.revoked,
            CustomerSeat.order_id.is_not(None),
            CustomerSeat.member_id.is_(None),
        )
        .order_by(CustomerSeat.id)
    )

    seats_found = 0
    count = 0

    for base_stmt in [sub_seats_stmt, order_seats_stmt]:
        offset = 0
        while True:
            batch_stmt = base_stmt.limit(_PREPARE_BATCH_SIZE).offset(offset)
            result = await session.execute(batch_stmt)
            seats = list(result.scalars().unique().all())
            if not seats:
                break
            seats_found += len(seats)
            offset += _PREPARE_BATCH_SIZE

            for seat in seats:
                if seat.subscription_id is not None and seat.subscription is not None:
                    billing_customer_id = seat.subscription.customer_id
                elif seat.order_id is not None and seat.order is not None:
                    billing_customer_id = seat.order.customer_id
                else:
                    continue
                old_seat_customer_id = seat.customer_id

                if old_seat_customer_id == billing_customer_id:
                    # Billing manager's own seat → use their owner member
                    owner_member = await _get_owner_member(billing_customer_id)
                    if owner_member is None:
                        continue
                    seat.member_id = owner_member.id
                    seat.email = owner_member.email
                elif old_seat_customer_id is not None:
                    # Someone else holds this seat → create member under billing customer
                    seat_holder = await customer_repo.get_by_id(old_seat_customer_id)
                    email = seat_holder.email if seat_holder else seat.email
                    if not email:
                        continue
                    member = await _get_or_create_member_for_backfill(
                        session,
                        member_repository,
                        billing_customer_id,
                        organization.id,
                        email,
                    )
                    seat.member_id = member.id
                    seat.email = email
                    if seat_holder and seat_holder._oauth_accounts:
                        member._oauth_accounts = {**seat_holder._oauth_accounts}
                elif seat.email:
                    # No customer assigned yet (pending invite) → create member
                    member = await _get_or_create_member_for_backfill(
                        session,
                        member_repository,
                        billing_customer_id,
                        organization.id,
                        seat.email,
                    )
                    seat.member_id = member.id
                # NOTE: Unlike _backfill_seats(), we do NOT change seat.customer_id

                count += 1

            await session.flush()

    return count


async def _prepare_benefit_grants(
    session: AsyncSession,
    organization: Organization,
) -> int:
    """Populate member_id on benefit grants.

    Unlike _backfill_benefit_grants(), this does NOT change grant.customer_id
    or transfer license keys/downloadables. It only links grants to members
    so merchants can read grant.member in API responses and webhooks.

    Since seat.customer_id is unchanged (prepare didn't rewrite it), we can
    match seats by customer_id + subscription/order to find the right member.
    """
    from polar.models import Order, Subscription

    member_repository = MemberRepository.from_session(session)

    # Find grants without member_id for this organization's customers
    statement = (
        select(BenefitGrant)
        .join(Customer, BenefitGrant.customer_id == Customer.id)
        .where(
            Customer.organization_id == organization.id,
            BenefitGrant.member_id.is_(None),
            BenefitGrant.is_deleted.is_(False),
        )
    )
    results = await session.stream_scalars(
        statement,
        execution_options={"yield_per": _PREPARE_BATCH_SIZE},
    )

    # Lazy caches
    owner_members_map: dict[uuid.UUID, Member] = {}
    billing_customer_cache: dict[uuid.UUID, uuid.UUID] = {}

    async def _get_billing_customer_id(grant: BenefitGrant) -> uuid.UUID | None:
        scope_id = grant.subscription_id or grant.order_id
        if scope_id is None:
            return None
        if scope_id in billing_customer_cache:
            return billing_customer_cache[scope_id]
        if grant.subscription_id is not None:
            cid = await session.scalar(
                select(Subscription.customer_id).where(
                    Subscription.id == grant.subscription_id
                )
            )
        else:
            cid = await session.scalar(
                select(Order.customer_id).where(Order.id == grant.order_id)
            )
        if cid is not None:
            billing_customer_cache[scope_id] = cid
        return cid

    grants_found = 0
    count = 0
    skipped_conflicts = 0
    try:
        async for grant in results:
            grants_found += 1

            billing_customer_id = await _get_billing_customer_id(grant)

            # Find the correct member for this grant.
            # Since seat.customer_id is still the original holder's ID,
            # we can match by customer_id + subscription/order.
            target_member_id: uuid.UUID | None = None

            if grant.subscription_id is not None:
                seat_member_id = await session.scalar(
                    select(CustomerSeat.member_id).where(
                        CustomerSeat.subscription_id == grant.subscription_id,
                        CustomerSeat.customer_id == grant.customer_id,
                        CustomerSeat.member_id.is_not(None),
                        CustomerSeat.status != SeatStatus.revoked,
                    )
                )
                if seat_member_id is not None:
                    target_member_id = seat_member_id
            elif grant.order_id is not None:
                seat_member_id = await session.scalar(
                    select(CustomerSeat.member_id).where(
                        CustomerSeat.order_id == grant.order_id,
                        CustomerSeat.customer_id == grant.customer_id,
                        CustomerSeat.member_id.is_not(None),
                        CustomerSeat.status != SeatStatus.revoked,
                    )
                )
                if seat_member_id is not None:
                    target_member_id = seat_member_id

            # Fallback to owner member
            if target_member_id is None:
                if grant.customer_id not in owner_members_map:
                    owner = await member_repository.get_owner_by_customer_id(
                        session, grant.customer_id
                    )
                    if owner is not None:
                        owner_members_map[grant.customer_id] = owner
                owner = owner_members_map.get(grant.customer_id)
                if owner is not None:
                    target_member_id = owner.id

            if target_member_id is not None:
                # Check for conflict with benefit_grants_smb_key constraint
                existing_id = await session.scalar(
                    select(BenefitGrant.id).where(
                        BenefitGrant.subscription_id == grant.subscription_id,
                        BenefitGrant.member_id == target_member_id,
                        BenefitGrant.benefit_id == grant.benefit_id,
                        BenefitGrant.id != grant.id,
                        BenefitGrant.is_deleted.is_(False),
                    )
                )
                if existing_id is not None:
                    if grant.order_id is not None:
                        grant.member_id = target_member_id
                        count += 1
                    else:
                        skipped_conflicts += 1
                else:
                    grant.member_id = target_member_id
                    count += 1

            if (count + skipped_conflicts) > 0 and (
                count + skipped_conflicts
            ) % _PREPARE_BATCH_SIZE == 0:
                await session.flush()
    finally:
        await results.close()

    await session.flush()

    return count


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
                Organization.blocked_at.is_(None),
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
    - A surviving sibling exists (same customer + benefit, different order, not deleted)

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
        # Find the surviving sibling to copy member_id from
        sibling_grant = await session.scalar(
            select(BenefitGrant).where(
                BenefitGrant.customer_id == grant.customer_id,
                BenefitGrant.benefit_id == grant.benefit_id,
                BenefitGrant.id != grant.id,
                BenefitGrant.order_id.is_not(None),
                BenefitGrant.deleted_at.is_(None),
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


if __name__ == "__main__":
    cli()
