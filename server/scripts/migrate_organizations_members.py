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

    Detect only orgs with missing backfill:
        uv run python -m scripts.migrate_organizations_members repair --only-missing
        uv run python -m scripts.migrate_organizations_members repair --only-missing --slug my-org

    Prepare seat-based orgs for member model (Phase 0B, non-destructive):
        uv run python -m scripts.migrate_organizations_members prepare
        uv run python -m scripts.migrate_organizations_members prepare --slug my-org --no-dry-run
        uv run python -m scripts.migrate_organizations_members prepare --limit 10 --no-dry-run
"""

import asyncio
import dataclasses
import logging.config
import uuid
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from polar.customer.repository import CustomerRepository
from polar.kit.db.postgres import create_async_sessionmaker
from polar.member.repository import MemberRepository
from polar.models import (
    Customer,
    CustomerSeat,
    Order,
    Organization,
    Product,
    Subscription,
)
from polar.models.benefit_grant import BenefitGrant
from polar.models.customer_seat import SeatStatus
from polar.models.member import Member, MemberRole
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


@dataclasses.dataclass(slots=True)
class RepairCandidate:
    organization: Organization
    missing_owner_members: int = 0
    seats_missing_member: int = 0
    grants_missing_member: int = 0

    @property
    def has_missing(self) -> bool:
        return (
            self.missing_owner_members > 0
            or self.seats_missing_member > 0
            or self.grants_missing_member > 0
        )


def _build_repair_organization_statement(
    *,
    slug: str | None = None,
) -> Any:
    statement = (
        select(Organization)
        .where(
            Organization.deleted_at.is_(None),
            Organization.blocked_at.is_(None),
            Organization.feature_settings["member_model_enabled"]
            .as_boolean()
            .is_(True),
            or_(
                Organization.feature_settings["seat_based_pricing_enabled"].is_(None),
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

    return statement


def _build_repair_organization_ids_statement(
    *,
    slug: str | None = None,
) -> Any:
    statement = (
        select(Organization.id)
        .where(
            Organization.deleted_at.is_(None),
            Organization.blocked_at.is_(None),
            Organization.feature_settings["member_model_enabled"]
            .as_boolean()
            .is_(True),
            or_(
                Organization.feature_settings["seat_based_pricing_enabled"].is_(None),
                Organization.feature_settings["seat_based_pricing_enabled"]
                .as_boolean()
                .is_(False),
            ),
        )
    )

    if slug is not None:
        statement = statement.where(Organization.slug == slug)

    return statement


async def _get_missing_owner_member_counts(
    session: AsyncSession,
    *,
    eligible_org_ids_statement: Any,
) -> dict[uuid.UUID, int]:
    statement = (
        select(Customer.organization_id, func.count(Customer.id))
        .outerjoin(
            Member,
            (Customer.id == Member.customer_id)
            & (Member.role == MemberRole.owner)
            & (Member.is_deleted.is_(False)),
        )
        .where(
            Customer.organization_id.in_(eligible_org_ids_statement),
            Customer.is_deleted.is_(False),
            Member.id.is_(None),
        )
        .group_by(Customer.organization_id)
    )
    result = await session.execute(statement)
    return {organization_id: count for organization_id, count in result.all()}


async def _get_missing_seat_member_counts(
    session: AsyncSession,
    *,
    eligible_org_ids_statement: Any,
) -> dict[uuid.UUID, int]:
    subscription_statement = (
        select(Product.organization_id, func.count(CustomerSeat.id))
        .join(Subscription, CustomerSeat.subscription_id == Subscription.id)
        .join(Product, Subscription.product_id == Product.id)
        .where(
            Product.organization_id.in_(eligible_org_ids_statement),
            CustomerSeat.status != SeatStatus.revoked,
            CustomerSeat.subscription_id.is_not(None),
            CustomerSeat.member_id.is_(None),
        )
        .group_by(Product.organization_id)
    )
    order_statement = (
        select(Product.organization_id, func.count(CustomerSeat.id))
        .join(Order, CustomerSeat.order_id == Order.id)
        .join(Product, Order.product_id == Product.id)
        .where(
            Product.organization_id.in_(eligible_org_ids_statement),
            CustomerSeat.status != SeatStatus.revoked,
            CustomerSeat.order_id.is_not(None),
            CustomerSeat.member_id.is_(None),
        )
        .group_by(Product.organization_id)
    )

    counts: dict[uuid.UUID, int] = {}
    for statement in (subscription_statement, order_statement):
        result = await session.execute(statement)
        for organization_id, count in result.all():
            counts[organization_id] = counts.get(organization_id, 0) + count

    return counts


async def _get_missing_grant_member_counts(
    session: AsyncSession,
    *,
    eligible_org_ids_statement: Any,
) -> dict[uuid.UUID, int]:
    statement = (
        select(Customer.organization_id, func.count(BenefitGrant.id))
        .join(Customer, BenefitGrant.customer_id == Customer.id)
        .where(
            Customer.organization_id.in_(eligible_org_ids_statement),
            Customer.is_deleted.is_(False),
            BenefitGrant.member_id.is_(None),
            BenefitGrant.is_deleted.is_(False),
        )
        .group_by(Customer.organization_id)
    )
    result = await session.execute(statement)
    return {organization_id: count for organization_id, count in result.all()}


async def get_repair_candidates(
    session: AsyncSession,
    *,
    slug: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    only_missing: bool = False,
) -> tuple[list[RepairCandidate], int]:
    base_statement = _build_repair_organization_statement(slug=slug)
    eligible_org_ids_statement = _build_repair_organization_ids_statement(slug=slug)

    if only_missing:
        result = await session.execute(base_statement)
        organizations = list(result.scalars().all())
        if not organizations:
            return [], 0

        owner_counts = await _get_missing_owner_member_counts(
            session, eligible_org_ids_statement=eligible_org_ids_statement
        )
        seat_counts = await _get_missing_seat_member_counts(
            session, eligible_org_ids_statement=eligible_org_ids_statement
        )
        grant_counts = await _get_missing_grant_member_counts(
            session, eligible_org_ids_statement=eligible_org_ids_statement
        )

        candidates = [
            RepairCandidate(
                organization=organization,
                missing_owner_members=owner_counts.get(organization.id, 0),
                seats_missing_member=seat_counts.get(organization.id, 0),
                grants_missing_member=grant_counts.get(organization.id, 0),
            )
            for organization in organizations
        ]
        candidates = [candidate for candidate in candidates if candidate.has_missing]
        total_count = len(candidates)

        if offset > 0:
            candidates = candidates[offset:]

        if limit is not None:
            candidates = candidates[:limit]

        return candidates, total_count

    paginated_statement = base_statement
    if offset > 0:
        paginated_statement = paginated_statement.offset(offset)
    if limit is not None:
        paginated_statement = paginated_statement.limit(limit)

    result = await session.execute(paginated_statement)
    organizations = list(result.scalars().all())
    total_count = await session.scalar(
        select(func.count()).select_from(eligible_org_ids_statement.subquery())
    )

    return [RepairCandidate(organization=organization) for organization in organizations], (
        total_count or 0
    )


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
    only_missing: bool = typer.Option(
        False,
        help=(
            "Only include orgs where owner members, seats, or grants are still "
            "missing according to backfill invariants"
        ),
    ),
) -> None:
    """Re-run backfill for orgs that already have member_model_enabled.

    This is safe to run on all enabled orgs — every backfill step is idempotent
    and skips customers/seats/grants that already have members.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        candidates, total_count = await get_repair_candidates(
            session,
            slug=slug,
            limit=limit,
            offset=offset,
            only_missing=only_missing,
        )

    if not candidates:
        message = (
            "No missing organizations found."
            if only_missing
            else "No eligible organizations found."
        )
        typer.echo(message)
        return

    typer.echo(
        f"Found {len(candidates)} organization(s) to repair"
        f" (offset={offset}, total={total_count})"
    )
    typer.echo()

    if only_missing:
        typer.echo("Organizations with detected missing backfill:")
        typer.echo(
            f"{'Slug':<40} {'Owners':>8} {'Seats':>8} {'Grants':>8} {'ID'}"
        )
        typer.echo("-" * 110)
        for candidate in candidates:
            organization = candidate.organization
            typer.echo(
                f"{organization.slug:<40} "
                f"{candidate.missing_owner_members:>8} "
                f"{candidate.seats_missing_member:>8} "
                f"{candidate.grants_missing_member:>8} "
                f"{organization.id}"
            )
        typer.echo()

    if dry_run:
        typer.echo("DRY RUN - No changes will be made.")
        typer.echo(f"Would repair {len(candidates)} organization(s).")
        return

    typer.echo(f"Repairing {len(candidates)} organization(s)...")
    typer.echo()

    repaired_count = 0
    failed_count = 0
    skipped_count = 0

    for candidate in candidates:
        org = candidate.organization
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


if __name__ == "__main__":
    cli()
