import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.account.repository import AccountRepository
from polar.customer.repository import CustomerRepository
from polar.email.react import render_email_template
from polar.email.schemas import (
    OrganizationReviewedEmail,
    OrganizationReviewedProps,
)
from polar.email.sender import enqueue_email
from polar.exceptions import PolarTaskError
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.plain.service import plain as plain_service
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import Customer, CustomerSeat, Organization
from polar.models.benefit_grant import BenefitGrant
from polar.models.customer_seat import SeatStatus
from polar.models.member import Member, MemberRole
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import OrganizationRepository

log = structlog.get_logger()

_BACKFILL_BATCH_SIZE = 100


class OrganizationTaskError(PolarTaskError): ...


class OrganizationDoesNotExist(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message)


class OrganizationAccountNotSet(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = (
            f"The organization with id {organization_id} does not have an account set."
        )
        super().__init__(message)


class AccountDoesNotExist(OrganizationTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account with id {account_id} does not exist."
        super().__init__(message)


class UserDoesNotExist(OrganizationTaskError):
    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        message = f"The user with id {user_id} does not exist."
        super().__init__(message)


@actor(actor_name="organization.created", priority=TaskPriority.LOW)
async def organization_created(organization_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)


@actor(actor_name="organization.account_set", priority=TaskPriority.LOW)
async def organization_account_set(organization_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        if organization.account_id is None:
            raise OrganizationAccountNotSet(organization_id)

        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(organization.account_id)
        if account is None:
            raise AccountDoesNotExist(organization.account_id)

        await held_balance_service.release_account(session, account)


@actor(actor_name="organization.under_review", priority=TaskPriority.LOW)
async def organization_under_review(organization_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(
            organization_id, options=(joinedload(Organization.account),)
        )
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        await plain_service.create_organization_review_thread(session, organization)

        # We used to send an email manually too for initial reviews,
        # but we rely on Plain to do that now.
        # PR: https://github.com/polarsource/polar/pull/9633


@actor(actor_name="organization.reviewed", priority=TaskPriority.LOW)
async def organization_reviewed(
    organization_id: uuid.UUID, initial_review: bool = False
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        # Release held balance if account exists
        if organization.account_id:
            account_repository = AccountRepository.from_session(session)
            account = await account_repository.get_by_id(organization.account_id)
            if account:
                await held_balance_service.release_account(session, account)

        # Send an email after the initial review
        if initial_review:
            admin_user = await repository.get_admin_user(session, organization)
            if admin_user:
                email = OrganizationReviewedEmail(
                    props=OrganizationReviewedProps.model_validate(
                        {"email": admin_user.email, "organization": organization}
                    )
                )
                enqueue_email(
                    to_email_addr=admin_user.email,
                    subject="Your organization review is complete",
                    html_content=render_email_template(email),
                )


@actor(actor_name="organization.deletion_requested", priority=TaskPriority.HIGH)
async def organization_deletion_requested(
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    blocked_reasons: list[str],
) -> None:
    """Handle organization deletion request that requires support review."""
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        user_repository = UserRepository.from_session(session)
        user = await user_repository.get_by_id(user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        # Create Plain ticket for support handling
        await plain_service.create_organization_deletion_thread(
            session, organization, user, blocked_reasons
        )


@actor(
    actor_name="organization.backfill_members",
    priority=TaskPriority.LOW,
    time_limit=600_000,  # 10 min timeout
    max_retries=0,
)
async def backfill_members(organization_id: uuid.UUID) -> None:
    """
    Backfill members when member_model_enabled is turned on for an organization.

    Three steps:
    A. Create owner members for all customers without one
    B. Migrate active (non-revoked) seats to member model format
    C. Link existing benefit grants to the correct member (owner or seat)
    """
    # Validate organization and feature flag
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        if not organization.feature_settings.get("member_model_enabled", False):
            log.warning(
                "organization.backfill_members.skipped",
                reason="member_model_not_enabled",
                organization_id=str(organization_id),
            )
            return

    log.info(
        "organization.backfill_members.start",
        organization_id=str(organization_id),
    )

    # Each step runs in its own session/transaction so that:
    # - partial progress is preserved on failure (task is idempotent)
    # - DB connections are released between steps

    # Step A: Create owner members for all customers without one
    async with AsyncSessionMaker() as session:
        organization = await OrganizationRepository.from_session(session).get_by_id(
            organization_id
        )
        assert organization is not None
        owner_members_created = await _backfill_owner_members(session, organization)

    # Step B: Migrate active seats
    async with AsyncSessionMaker() as session:
        organization = await OrganizationRepository.from_session(session).get_by_id(
            organization_id
        )
        assert organization is not None
        seats_migrated, orphaned_customer_ids = await _backfill_seats(
            session, organization
        )

    # Step C: Link benefit grants to correct members (owner or seat)
    async with AsyncSessionMaker() as session:
        organization = await OrganizationRepository.from_session(session).get_by_id(
            organization_id
        )
        assert organization is not None
        grants_linked = await _backfill_benefit_grants(session, organization)

    # Step D: Soft-delete orphaned seat-holder customers
    async with AsyncSessionMaker() as session:
        organization = await OrganizationRepository.from_session(session).get_by_id(
            organization_id
        )
        assert organization is not None
        customers_deleted = await _cleanup_orphaned_seat_customers(
            session, organization, orphaned_customer_ids
        )

    log.info(
        "organization.backfill_members.complete",
        organization_id=str(organization_id),
        owner_members_created=owner_members_created,
        seats_migrated=seats_migrated,
        grants_linked=grants_linked,
        customers_deleted=customers_deleted,
    )


async def _backfill_owner_members(
    session: AsyncSession,
    organization: Organization,
) -> int:
    """Step A: Create owner members for all customers that don't have one."""
    # Find customers without an owner member
    statement = (
        select(Customer)
        .outerjoin(
            Member,
            (Customer.id == Member.customer_id)
            & (Member.role == MemberRole.owner)
            & (Member.deleted_at.is_(None)),
        )
        .where(
            Customer.organization_id == organization.id,
            Customer.deleted_at.is_(None),
            Member.id.is_(None),
        )
    )
    results = await session.stream_scalars(
        statement,
        execution_options={"yield_per": _BACKFILL_BATCH_SIZE},
    )

    customers_found = 0
    count = 0
    try:
        async for customer in results:
            customers_found += 1
            member = await member_service.create_owner_member(
                session, customer, organization, send_webhook=False
            )
            if member is not None:
                if customer._oauth_accounts:
                    member._oauth_accounts = {**customer._oauth_accounts}
                count += 1
            if count > 0 and count % _BACKFILL_BATCH_SIZE == 0:
                await session.flush()
    finally:
        await results.close()

    await session.flush()

    log.info(
        "organization.backfill_members.step_a_complete",
        organization_id=str(organization.id),
        customers_found=customers_found,
        members_created=count,
    )
    return count


async def _backfill_seats(
    session: AsyncSession,
    organization: Organization,
) -> tuple[int, set[uuid.UUID]]:
    """Step B: Migrate active (non-revoked) seats to member model format.

    Returns:
        Tuple of (seats_migrated, orphaned_customer_ids) where orphaned_customer_ids
        are seat-holder customers whose seats were migrated to a billing customer.
    """
    from polar.models import Order, Product, Subscription
    from polar.models.customer import CustomerType

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

    # Find non-revoked seats for this organization's products.
    # We need to join through subscription/order → product to filter by organization.
    # joinedload requires unique() which is incompatible with streaming,
    # so we use LIMIT/OFFSET batch pagination instead.
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
    orphaned_customer_ids: set[uuid.UUID] = set()
    billing_customer_ids_with_seats: set[uuid.UUID] = set()

    for base_stmt in [sub_seats_stmt, order_seats_stmt]:
        offset = 0
        while True:
            batch_stmt = base_stmt.limit(_BACKFILL_BATCH_SIZE).offset(offset)
            result = await session.execute(batch_stmt)
            seats = list(result.scalars().unique().all())
            if not seats:
                break
            seats_found += len(seats)
            offset += _BACKFILL_BATCH_SIZE

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
                    # Someone else holds this seat → create member, track orphan
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
                    orphaned_customer_ids.add(old_seat_customer_id)
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
                # else: no customer and no email — just set customer_id below

                seat.customer_id = billing_customer_id
                billing_customer_ids_with_seats.add(billing_customer_id)
                count += 1

            await session.flush()

    # Set billing customers with seats to team type
    for billing_cid in billing_customer_ids_with_seats:
        billing_customer = await customer_repo.get_by_id(billing_cid)
        if billing_customer is not None and billing_customer.type != CustomerType.team:
            billing_customer.type = CustomerType.team
    await session.flush()

    log.info(
        "organization.backfill_members.step_b_complete",
        organization_id=str(organization.id),
        seats_found=seats_found,
        seats_migrated=count,
        orphaned_customers=len(orphaned_customer_ids),
    )
    return count, orphaned_customer_ids


async def _get_or_create_member_for_backfill(
    session: AsyncSession,
    member_repository: MemberRepository,
    billing_customer_id: uuid.UUID,
    organization_id: uuid.UUID,
    email: str,
) -> Member:
    """Get or create a member under the billing customer for seat backfill."""
    existing = await member_repository.get_by_customer_id_and_email(
        billing_customer_id, email
    )
    if existing is not None:
        return existing

    member = Member(
        customer_id=billing_customer_id,
        organization_id=organization_id,
        email=email,
        role=MemberRole.member,
    )
    session.add(member)
    await session.flush()
    return member


async def _transfer_benefit_records(
    session: AsyncSession,
    old_customer_id: uuid.UUID,
    new_customer_id: uuid.UUID,
    new_member_id: uuid.UUID,
    benefit_ids: set[uuid.UUID],
) -> None:
    """Transfer benefit-specific records (license keys, downloadables)
    from the old customer to the new billing customer and member."""
    from polar.models.downloadable import Downloadable
    from polar.models.license_key import LicenseKey

    # Transfer license keys
    lk_stmt = select(LicenseKey).where(
        LicenseKey.customer_id == old_customer_id,
        LicenseKey.benefit_id.in_(benefit_ids),
    )
    lk_result = await session.execute(lk_stmt)
    for lk in lk_result.scalars().all():
        lk.customer_id = new_customer_id
        lk.member_id = new_member_id

    # Transfer downloadables
    dl_stmt = select(Downloadable).where(
        Downloadable.customer_id == old_customer_id,
        Downloadable.benefit_id.in_(benefit_ids),
    )
    dl_result = await session.execute(dl_stmt)
    for dl in dl_result.scalars().all():
        dl.customer_id = new_customer_id
        dl.member_id = new_member_id


async def _backfill_benefit_grants(
    session: AsyncSession,
    organization: Organization,
) -> int:
    """Step C: Link existing benefit grants to the correct member.

    Also transfers grants that belong to old seat-holder customers:
    if a grant's customer_id differs from the subscription/order's billing
    customer, the grant (and its benefit records) are transferred to the
    billing customer before linking.
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
            BenefitGrant.deleted_at.is_(None),
        )
    )
    results = await session.stream_scalars(
        statement,
        execution_options={"yield_per": _BACKFILL_BATCH_SIZE},
    )

    # Lazy caches
    owner_members_map: dict[uuid.UUID, Member] = {}
    billing_customer_cache: dict[uuid.UUID, uuid.UUID] = {}

    async def _get_billing_customer_id(grant: BenefitGrant) -> uuid.UUID | None:
        """Look up the billing customer for a grant's subscription/order."""
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
    try:
        async for grant in results:
            grants_found += 1

            # Check if grant belongs to an old seat-holder customer
            billing_customer_id = await _get_billing_customer_id(grant)
            needs_transfer = (
                billing_customer_id is not None
                and grant.customer_id != billing_customer_id
            )
            old_customer_id = grant.customer_id if needs_transfer else None
            if needs_transfer:
                assert billing_customer_id is not None
                grant.customer_id = billing_customer_id

            # Link to seat member or owner member
            seat_member_id = await _find_seat_member_for_grant(
                session,
                member_repository,
                grant,
                billing_customer_id=billing_customer_id,
                old_customer_id=old_customer_id,
            )
            if seat_member_id is not None:
                grant.member_id = seat_member_id
                count += 1
            else:
                if grant.customer_id not in owner_members_map:
                    owner = await member_repository.get_owner_by_customer_id(
                        session, grant.customer_id
                    )
                    if owner is not None:
                        owner_members_map[grant.customer_id] = owner
                owner = owner_members_map.get(grant.customer_id)
                if owner is not None:
                    grant.member_id = owner.id
                    count += 1

            # Transfer benefit records now that we know the member
            if needs_transfer and grant.member_id is not None:
                assert old_customer_id is not None
                assert billing_customer_id is not None
                await _transfer_benefit_records(
                    session,
                    old_customer_id,
                    billing_customer_id,
                    grant.member_id,
                    {grant.benefit_id},
                )

            if count > 0 and count % _BACKFILL_BATCH_SIZE == 0:
                await session.flush()
    finally:
        await results.close()

    await session.flush()

    log.info(
        "organization.backfill_members.step_c_complete",
        organization_id=str(organization.id),
        grants_found=grants_found,
        grants_linked=count,
    )
    return count


async def _find_seat_member_for_grant(
    session: AsyncSession,
    member_repository: MemberRepository,
    grant: BenefitGrant,
    billing_customer_id: uuid.UUID | None,
    old_customer_id: uuid.UUID | None,
) -> uuid.UUID | None:
    """Find the seat member for a grant, if the grant is seat-based.

    Returns the member_id from the matching CustomerSeat, or None if the
    grant is not seat-based (i.e. the customer purchased directly).

    For transferred grants (old_customer_id is set), we look up the member
    by the seat-holder's email rather than querying CustomerSeat directly,
    because step B already migrated seat.customer_id to the billing customer
    — so a subscription with multiple seats would return multiple rows.
    """
    if old_customer_id is not None and billing_customer_id is not None:
        # Transferred grant: find member via seat-holder customer email
        seat_holder = await session.get(Customer, old_customer_id)
        if seat_holder is not None and seat_holder.email:
            member = await member_repository.get_by_customer_id_and_email(
                billing_customer_id, seat_holder.email
            )
            if member is not None:
                return member.id
        return None

    # Non-transferred grant: single-seat lookup is safe
    if grant.subscription_id is not None:
        stmt = (
            select(CustomerSeat.member_id)
            .where(
                CustomerSeat.subscription_id == grant.subscription_id,
                CustomerSeat.member_id.is_not(None),
                CustomerSeat.status != SeatStatus.revoked,
            )
            .limit(1)
        )
    elif grant.order_id is not None:
        stmt = (
            select(CustomerSeat.member_id)
            .where(
                CustomerSeat.order_id == grant.order_id,
                CustomerSeat.member_id.is_not(None),
                CustomerSeat.status != SeatStatus.revoked,
            )
            .limit(1)
        )
    else:
        return None

    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def _cleanup_orphaned_seat_customers(
    session: AsyncSession,
    organization: Organization,
    orphaned_customer_ids: set[uuid.UUID],
) -> int:
    """Step D: Soft-delete seat-holder customers that have no subscriptions or orders."""
    from polar.models import Order, Subscription

    if not orphaned_customer_ids:
        return 0

    customer_repo = CustomerRepository.from_session(session)
    member_repository = MemberRepository.from_session(session)

    count = 0
    for customer_id in orphaned_customer_ids:
        customer = await customer_repo.get_by_id(customer_id)
        if customer is None or customer.deleted_at is not None:
            continue

        # Check if customer has any subscriptions
        sub_stmt = (
            select(Subscription.id)
            .where(
                Subscription.customer_id == customer_id,
            )
            .limit(1)
        )
        sub_result = await session.execute(sub_stmt)
        if sub_result.scalar_one_or_none() is not None:
            continue

        # Check if customer has any orders
        order_stmt = (
            select(Order.id)
            .where(
                Order.customer_id == customer_id,
            )
            .limit(1)
        )
        order_result = await session.execute(order_stmt)
        if order_result.scalar_one_or_none() is not None:
            continue

        # Soft-delete members first (FK restrict on customer_id)
        members = await member_repository.list_by_customer(session, customer_id)
        for member in members:
            await member_repository.soft_delete(member)

        await customer_repo.soft_delete(customer)
        count += 1

    await session.flush()

    log.info(
        "organization.backfill_members.step_d_complete",
        organization_id=str(organization.id),
        orphaned_candidates=len(orphaned_customer_ids),
        customers_deleted=count,
    )
    return count
