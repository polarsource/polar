"""
Scripts supporting the member model migration.

Usage:
    Prepare orgs for the member model (Phase 0B, non-destructive):
        uv run python -m scripts.migrate_organizations_members prepare
        uv run python -m scripts.migrate_organizations_members prepare --slug my-org --no-dry-run
        uv run python -m scripts.migrate_organizations_members prepare --limit 10 --no-dry-run

    Find one-off order grants incorrectly deleted by the backfill:
        uv run python -m scripts.migrate_organizations_members restore-oneoff-grants
        uv run python -m scripts.migrate_organizations_members restore-oneoff-grants --verbose
        uv run python -m scripts.migrate_organizations_members restore-oneoff-grants --restore

    Backfill member_id on license keys and downloadables:
        uv run python -m scripts.migrate_organizations_members backfill-benefit-records --no-dry-run

    Report which orgs are left and how complete their Phase 1 is:
        uv run python -m scripts.migrate_organizations_members audit
        uv run python -m scripts.migrate_organizations_members audit --bucket active-integration
        uv run python -m scripts.migrate_organizations_members audit --gaps-only
"""

import asyncio
import logging.config
import uuid
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from enum import StrEnum
from functools import wraps
from typing import Any, cast

import structlog
import typer
from sqlalchemy import and_, func, or_, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import aliased, joinedload
from sqlalchemy.sql.expression import CTE

from polar.kit.db.postgres import AsyncReadSession, create_async_sessionmaker
from polar.models import (
    Customer,
    CustomerSeat,
    Member,
    Order,
    Organization,
    Product,
    ProductPrice,
    Subscription,
)
from polar.models.benefit_grant import BenefitGrant
from polar.models.customer_seat import SeatStatus
from polar.models.member import MemberRole
from polar.models.order import OrderStatus
from polar.models.organization import OrganizationStatus
from polar.models.product_price import ProductPriceAmountType
from polar.models.subscription import SubscriptionStatus
from polar.organization.member_backfill import (
    downloadable_member_backfill_statement,
    license_key_member_backfill_statement,
)
from polar.organization.repository import OrganizationRepository
from polar.organization.tasks import (
    _backfill_owner_members,
    _prepare_benefit_grants,
    _prepare_seats,
)
from polar.postgres import AsyncSession, create_async_engine
from scripts.helper import read_engine, run_batched_update

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
    """Prepare orgs for the member model migration (Phase 0B).

    Non-destructive: populates member_id/email on seats and grants without
    changing customer_id, deleting customers, or flipping any flags.

    Targets orgs with member_model_enabled=False.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        statement = (
            select(Organization)
            .where(
                Organization.deleted_at.is_(None),
                Organization.status != OrganizationStatus.BLOCKED,
                or_(
                    Organization.feature_settings["member_model_enabled"].is_(None),
                    ~Organization.feature_settings["member_model_enabled"].as_boolean(),
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
    """Backfill member_id on license keys from their linked benefit grant."""
    result = cast(
        CursorResult[Any],
        await session.execute(license_key_member_backfill_statement()),
    )
    return result.rowcount


async def _backfill_downloadables(session: AsyncSession) -> int:
    """Backfill member_id on downloadables from their linked benefit grant."""
    result = cast(
        CursorResult[Any],
        await session.execute(downloadable_member_backfill_statement()),
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
    to populate the missing member_id on the related benefit records. Runs in
    batches to avoid long locks on large tables.

    License keys are matched 1:1 via the grant's properties->>'license_key_id'.
    Downloadables are matched via (customer_id, benefit_id), taking the most
    recently granted grant.
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

    lk_updated = await run_batched_update(
        license_key_member_backfill_statement(member_model_only=True, batched=True)
    )
    typer.echo(f"License keys updated: {lk_updated}")

    dl_updated = await run_batched_update(
        downloadable_member_backfill_statement(member_model_only=True, batched=True)
    )
    typer.echo(f"Downloadables updated: {dl_updated}")

    typer.echo()
    typer.echo("Backfill complete.")


class Bucket(StrEnum):
    no_seat_product = "no-seat-product"
    no_sales = "no-sales"
    no_active_sale = "no-active-sale"
    seats_unclaimed = "seats-unclaimed"
    active_integration = "active-integration"


_BUCKET_LABELS: dict[Bucket, str] = {
    Bucket.no_seat_product: "No seat product configured",
    Bucket.no_sales: "Seat product, no sales",
    Bucket.no_active_sale: "Historical sale, none active",
    Bucket.seats_unclaimed: "Selling seats, none claimed",
    Bucket.active_integration: "Active seat integration",
}


@dataclass(frozen=True)
class OrganizationAudit:
    slug: str
    seat_products: int
    seat_subscriptions: int
    active_seat_subscriptions: int
    seat_orders: int
    claimed_seats: int
    seats_missing_member: int
    grants_missing_member: int
    customers_missing_owner: int

    @property
    def bucket(self) -> Bucket:
        if self.seat_products == 0:
            return Bucket.no_seat_product
        if self.seat_subscriptions == 0 and self.seat_orders == 0:
            return Bucket.no_sales
        # One-off seat orders are perpetual, so they never go inactive.
        if self.active_seat_subscriptions == 0 and self.seat_orders == 0:
            return Bucket.no_active_sale
        if self.claimed_seats == 0:
            return Bucket.seats_unclaimed
        return Bucket.active_integration

    @property
    def gaps(self) -> int:
        return (
            self.seats_missing_member
            + self.grants_missing_member
            + self.customers_missing_owner
        )


def _chunked(
    organization_ids: Sequence[uuid.UUID], size: int
) -> Iterator[Sequence[uuid.UUID]]:
    for start in range(0, len(organization_ids), size):
        yield organization_ids[start : start + size]


def _seat_products_cte(organization_ids: Sequence[uuid.UUID]) -> CTE:
    return (
        select(Product.id.label("product_id"), Product.organization_id)
        .join(ProductPrice, ProductPrice.product_id == Product.id)
        .where(
            Product.organization_id.in_(organization_ids),
            Product.deleted_at.is_(None),
            ProductPrice.deleted_at.is_(None),
            ProductPrice.is_archived.is_(False),
            ProductPrice.amount_type == ProductPriceAmountType.seat_based,
        )
        .distinct()
        .cte("seat_products")
    )


async def _count_seat_products(
    session: AsyncReadSession, seat_products: CTE
) -> dict[uuid.UUID, int]:
    result = await session.execute(
        select(seat_products.c.organization_id, func.count()).group_by(
            seat_products.c.organization_id
        )
    )
    return {organization_id: count for organization_id, count in result}


async def _count_seat_subscriptions(
    session: AsyncReadSession, seat_products: CTE
) -> dict[uuid.UUID, tuple[int, int]]:
    result = await session.execute(
        select(
            seat_products.c.organization_id,
            func.count(Subscription.id),
            func.count(Subscription.id).filter(
                Subscription.status.in_(SubscriptionStatus.active_statuses())
            ),
        )
        .select_from(seat_products)
        .join(Subscription, Subscription.product_id == seat_products.c.product_id)
        .where(
            Subscription.deleted_at.is_(None),
            Subscription.status.not_in(SubscriptionStatus.incomplete_statuses()),
        )
        .group_by(seat_products.c.organization_id)
    )
    return {
        organization_id: (total, active) for organization_id, total, active in result
    }


async def _count_seat_orders(
    session: AsyncReadSession, seat_products: CTE
) -> dict[uuid.UUID, int]:
    result = await session.execute(
        select(seat_products.c.organization_id, func.count(Order.id))
        .select_from(seat_products)
        .join(Order, Order.product_id == seat_products.c.product_id)
        .where(
            Order.deleted_at.is_(None),
            Order.subscription_id.is_(None),
            Order.status.in_(OrderStatus.paid_statuses()),
        )
        .group_by(seat_products.c.organization_id)
    )
    return {organization_id: count for organization_id, count in result}


async def _count_seats(
    session: AsyncReadSession, seat_products: CTE
) -> dict[uuid.UUID, tuple[int, int]]:
    """Claimed seats and seats still missing a member, per organization."""
    subscription_seats = (
        select(
            CustomerSeat.status.label("status"),
            CustomerSeat.member_id.label("member_id"),
            seat_products.c.organization_id.label("organization_id"),
        )
        .select_from(CustomerSeat)
        .join(Subscription, CustomerSeat.subscription_id == Subscription.id)
        .join(seat_products, seat_products.c.product_id == Subscription.product_id)
    )
    order_seats = (
        select(
            CustomerSeat.status,
            CustomerSeat.member_id,
            seat_products.c.organization_id,
        )
        .select_from(CustomerSeat)
        .join(Order, CustomerSeat.order_id == Order.id)
        .join(seat_products, seat_products.c.product_id == Order.product_id)
    )
    seats = subscription_seats.union_all(order_seats).subquery("seats")

    result = await session.execute(
        select(
            seats.c.organization_id,
            func.count().filter(seats.c.status == SeatStatus.claimed),
            func.count().filter(
                and_(
                    seats.c.member_id.is_(None),
                    seats.c.status != SeatStatus.revoked,
                )
            ),
        ).group_by(seats.c.organization_id)
    )
    return {
        organization_id: (claimed, missing_member)
        for organization_id, claimed, missing_member in result
    }


async def _count_grants_missing_member(
    session: AsyncReadSession,
    organization_ids: Sequence[uuid.UUID],
    chunk_size: int,
) -> dict[uuid.UUID, int]:
    counts: dict[uuid.UUID, int] = {}
    for chunk in _chunked(organization_ids, chunk_size):
        result = await session.execute(
            select(Customer.organization_id, func.count(BenefitGrant.id))
            .select_from(BenefitGrant)
            .join(Customer, BenefitGrant.customer_id == Customer.id)
            .where(
                Customer.organization_id.in_(chunk),
                BenefitGrant.member_id.is_(None),
                ~BenefitGrant.is_deleted,
            )
            .group_by(Customer.organization_id)
        )
        counts.update({organization_id: count for organization_id, count in result})
    return counts


async def _count_customers_missing_owner(
    session: AsyncReadSession,
    organization_ids: Sequence[uuid.UUID],
    chunk_size: int,
) -> dict[uuid.UUID, int]:
    owner_member = (
        select(Member.id)
        .where(
            Member.customer_id == Customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        .exists()
    )
    counts: dict[uuid.UUID, int] = {}
    for chunk in _chunked(organization_ids, chunk_size):
        result = await session.execute(
            select(Customer.organization_id, func.count(Customer.id))
            .where(
                Customer.organization_id.in_(chunk),
                Customer.deleted_at.is_(None),
                ~owner_member,
            )
            .group_by(Customer.organization_id)
        )
        counts.update({organization_id: count for organization_id, count in result})
    return counts


@cli.command()
@typer_async
async def audit(
    bucket: Bucket | None = typer.Option(None, help="Only show this bucket"),
    gaps_only: bool = typer.Option(
        False, help="Only show organizations with an incomplete Phase 1"
    ),
    slug: str | None = typer.Option(None, help="Audit a single organization by slug"),
    chunk_size: int = typer.Option(
        20, help="Organizations per query for the customer-wide counts"
    ),
    command_timeout: float = typer.Option(
        120.0, help="Seconds a single query may run before the server kills it"
    ),
) -> None:
    """Report the organizations left on the legacy model and their Phase 1 state.

    Buckets them by how much seat traffic they actually have, and counts what
    Phase 1 has not filled in: seats and grants without a member, customers
    without an owner member.

    The grant and owner-member counts scan every customer of every organization
    still on the legacy model, so they run in chunks. Lower --chunk-size if a
    query still times out.
    """
    engine = read_engine(command_timeout)
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        statement = (
            select(Organization.id, Organization.slug)
            .where(
                Organization.deleted_at.is_(None),
                Organization.status != OrganizationStatus.BLOCKED,
                or_(
                    Organization.feature_settings["member_model_enabled"].is_(None),
                    ~Organization.feature_settings["member_model_enabled"].as_boolean(),
                ),
            )
            .order_by(Organization.slug.asc())
        )
        if slug is not None:
            statement = statement.where(Organization.slug == slug)

        organizations = list(await session.execute(statement))
        if not organizations:
            typer.echo("No organizations left on the legacy model.")
            return

        organization_ids = [organization_id for organization_id, _ in organizations]
        seat_products = _seat_products_cte(organization_ids)

        seat_product_counts = await _count_seat_products(session, seat_products)
        subscription_counts = await _count_seat_subscriptions(session, seat_products)
        order_counts = await _count_seat_orders(session, seat_products)
        seat_counts = await _count_seats(session, seat_products)
        grant_gaps = await _count_grants_missing_member(
            session, organization_ids, chunk_size
        )
        owner_gaps = await _count_customers_missing_owner(
            session, organization_ids, chunk_size
        )

    audits = [
        OrganizationAudit(
            slug=organization_slug,
            seat_products=seat_product_counts.get(organization_id, 0),
            seat_subscriptions=subscription_counts.get(organization_id, (0, 0))[0],
            active_seat_subscriptions=subscription_counts.get(organization_id, (0, 0))[
                1
            ],
            seat_orders=order_counts.get(organization_id, 0),
            claimed_seats=seat_counts.get(organization_id, (0, 0))[0],
            seats_missing_member=seat_counts.get(organization_id, (0, 0))[1],
            grants_missing_member=grant_gaps.get(organization_id, 0),
            customers_missing_owner=owner_gaps.get(organization_id, 0),
        )
        for organization_id, organization_slug in organizations
    ]

    typer.echo(f"Organizations on the legacy model: {len(audits)}")
    typer.echo()

    typer.echo(f"{'Bucket':<32} {'Orgs':>6} {'Incomplete':>11}")
    typer.echo("-" * 51)
    for value in Bucket:
        in_bucket = [a for a in audits if a.bucket is value]
        incomplete = sum(1 for a in in_bucket if a.gaps > 0)
        typer.echo(f"{_BUCKET_LABELS[value]:<32} {len(in_bucket):>6} {incomplete:>11}")
    typer.echo()

    listed = audits
    if bucket is not None:
        listed = [a for a in listed if a.bucket is bucket]
    if gaps_only:
        listed = [a for a in listed if a.gaps > 0]

    if not listed:
        typer.echo("No organization matches the filters.")
        return

    listed.sort(key=lambda a: (a.bucket, a.slug))

    typer.echo(f"{'Slug':<40} {'Bucket':<20} {'Seats':>6} {'Grants':>7} {'Owners':>7}")
    typer.echo("-" * 84)
    for organization_audit in listed:
        typer.echo(
            f"{organization_audit.slug:<40} "
            f"{organization_audit.bucket.value:<20} "
            f"{organization_audit.seats_missing_member:>6} "
            f"{organization_audit.grants_missing_member:>7} "
            f"{organization_audit.customers_missing_owner:>7}"
        )
    typer.echo()
    typer.echo("Columns count what Phase 1 has not filled in, so 0 everywhere is done.")


if __name__ == "__main__":
    cli()
