import typing
from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select, update
from sqlalchemy.orm import joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.repository.base import Options
from polar.models import (
    Customer,
    Order,
    Organization,
    PayoutAccount,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.discount import (
    Discount,
    DiscountDuration,
    DiscountPercentage,
    DiscountType,
)
from polar.models.order import OrderStatus
from polar.models.organization import (
    OrganizationCapabilities,
    OrganizationStatus,
    SnoozeType,
)
from polar.models.organization_review import OrganizationReview
from polar.models.subscription import SubscriptionStatus
from polar.models.user_organization import OrganizationRole

from .sorting import OrganizationSortProperty

# Maximum orgs the unsnooze cron processes per run. Bounds worst-case
# transaction size when many time-based snoozes expire in the same window.
UNSNOOZE_EXPIRED_BATCH_SIZE = 500

# Maximum orgs the auto-offboard cron processes per run.
OFFBOARD_EXPIRED_BATCH_SIZE = 500

# Maximum orgs the subscription-cancellation cron processes per run.
CANCEL_SUBSCRIPTIONS_BATCH_SIZE = 500

# ``offboarded``, not ``offboarding``: offboarding intentionally keeps renewals
# on during the wind-down, so subscriptions are only cancelled once it completes.
SUBSCRIPTION_CANCELLATION_STATUSES = (
    OrganizationStatus.DENIED,
    OrganizationStatus.BLOCKED,
    OrganizationStatus.OFFBOARDED,
)


class OrganizationRepository(
    RepositorySortingMixin[Organization, OrganizationSortProperty],
    RepositorySoftDeletionIDMixin[Organization, UUID],
    RepositorySoftDeletionMixin[Organization],
    RepositoryBase[Organization],
):
    model = Organization

    @typing.overload
    async def get_by_id(
        self,
        id: UUID,
        *,
        options: Options = (),
        include_deleted: bool = False,
        include_blocked: bool = False,
        for_update: typing.Literal[False] = False,
    ) -> Organization | None: ...

    @typing.overload
    async def get_by_id(
        self,
        id: UUID,
        *,
        options: Options = (),
        include_deleted: bool = False,
        include_blocked: bool = False,
        for_update: typing.Literal[True],
        nowait: bool = False,
    ) -> Organization | None: ...

    async def get_by_id(
        self,
        id: UUID,
        *,
        options: Options = (),
        include_deleted: bool = False,
        include_blocked: bool = False,
        for_update: bool = False,
        nowait: bool = False,
    ) -> Organization | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(self.model.id == id)
            .options(*options)
        )

        if not include_blocked:
            statement = statement.where(self.model.status != OrganizationStatus.BLOCKED)

        if for_update:
            statement = statement.with_for_update(of=self.model, nowait=nowait)

        return await self.get_one_or_none(statement)

    async def get_by_account(self, account_id: UUID) -> Organization | None:
        """Get the organization that owns the given account."""
        statement = self.get_base_statement().where(
            Organization.account_id == account_id,
            Organization.status != OrganizationStatus.BLOCKED,
        )
        return await self.get_one_or_none(statement)

    async def get_by_payout_account(
        self, payout_account_id: UUID
    ) -> Organization | None:
        """Get the organization that uses the given payout account."""
        statement = self.get_base_statement().where(
            Organization.payout_account_id == payout_account_id,
            Organization.status != OrganizationStatus.BLOCKED,
        )
        return await self.get_one_or_none(statement)

    async def get_by_id_with_payout_account(
        self,
        id: UUID,
        *,
        include_deleted: bool = False,
        include_blocked: bool = True,
    ) -> Organization | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .options(
                joinedload(Organization.payout_account).subqueryload(
                    PayoutAccount.admin
                )
            )
            .where(self.model.id == id)
        )

        if not include_blocked:
            statement = statement.where(self.model.status != OrganizationStatus.BLOCKED)

        return await self.get_one_or_none(statement)

    async def get_by_slug(
        self, slug: str, include_deleted: bool = False
    ) -> Organization | None:
        statement = self.get_base_statement(include_deleted=include_deleted).where(
            Organization.slug == slug
        )
        return await self.get_one_or_none(statement)

    async def slug_exists(self, slug: str) -> bool:
        """Check if slug exists, including soft-deleted organizations.

        Soft-deleted organizations are included to prevent slug reuse,
        ensuring backoffice links continue to work.
        """
        statement = self.get_base_statement(include_deleted=True).where(
            Organization.slug == slug
        )
        result = await self.get_one_or_none(statement)
        return result is not None

    async def get_by_customer(self, customer_id: UUID) -> Organization:
        statement = (
            self.get_base_statement()
            .join(Customer, Customer.organization_id == Organization.id)
            .where(Customer.id == customer_id)
        )
        return await self.get_one(statement)

    async def get_all_by_user(self, user: UUID) -> Sequence[Organization]:
        statement = (
            self.get_base_statement()
            .join(UserOrganization)
            .where(
                UserOrganization.user_id == user,
                UserOrganization.is_deleted.is_(False),
                Organization.status != OrganizationStatus.BLOCKED,
            )
        )
        return await self.get_all(statement)

    async def get_all_by_account(
        self, account: UUID, *, options: Options = ()
    ) -> Sequence[Organization]:
        statement = (
            self.get_base_statement()
            .where(
                Organization.account_id == account,
                Organization.status != OrganizationStatus.BLOCKED,
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_expired_time_based_snoozes(
        self, now: datetime, *, limit: int = UNSNOOZE_EXPIRED_BATCH_SIZE
    ) -> Sequence[Organization]:
        """Snoozed orgs whose TIME_BASED deadline has passed."""
        statement = (
            self.get_base_statement()
            .where(
                Organization.status == OrganizationStatus.SNOOZED,
                Organization.snooze_type == SnoozeType.TIME_BASED,
                Organization.snoozed_until.is_not(None),
                Organization.snoozed_until <= now,
            )
            .order_by(Organization.snoozed_until.asc())
            .limit(limit)
        )
        return await self.get_all(statement)

    async def get_offboarding_past_period(
        self, cutoff: datetime, *, limit: int = OFFBOARD_EXPIRED_BATCH_SIZE
    ) -> Sequence[Organization]:
        """Offboarding orgs whose offboarding period has elapsed.

        Anchor = the later of (a) the most recent paid order that hasn't been
        fully refunded — the post-chargeback-risk window, and (b) when the org
        entered offboarding (``status_updated_at``) — the merchant wind-down
        floor. Both gates must clear, so a merchant freshly put into
        offboarding always gets the full wind-down period even if their last
        payment is already past the chargeback window. Orgs with no paid
        orders use ``status_updated_at`` alone (PostgreSQL ``GREATEST`` skips
        NULLs).

        ``FOR UPDATE`` on the org row: a concurrent admin status change either
        commits before our SELECT (and the row falls out of the WHERE clause)
        or waits behind our lock — eliminating the read/transition race.
        """
        last_paid_order_at = (
            select(func.max(Order.created_at))
            .where(
                Order.organization_id == Organization.id,
                Order.status.in_(OrderStatus.paid_statuses()),
                Order.deleted_at.is_(None),
            )
            .correlate(Organization)
            .scalar_subquery()
        )
        anchor = func.greatest(last_paid_order_at, Organization.status_updated_at)
        statement = (
            self.get_base_statement()
            .where(
                Organization.status == OrganizationStatus.OFFBOARDING,
                anchor <= cutoff,
            )
            .order_by(anchor.asc())
            .limit(limit)
            .with_for_update(of=Organization)
        )
        return await self.get_all(statement)

    async def get_status_cancellation_expired(
        self, cutoff: datetime, *, limit: int = CANCEL_SUBSCRIPTIONS_BATCH_SIZE
    ) -> Sequence[Organization]:
        """Orgs denied, blocked, or offboarded past the cutoff that still have a
        billable subscription to cancel.

        The ``EXISTS`` gate makes the scan idempotent: once an org's
        subscriptions are all cancelled it drops out and is not re-enqueued.
        Falls back to ``created_at`` when ``status_updated_at`` is unset, so a
        terminal org with a legacy null timestamp is still wound down.
        """
        has_billable_subscription = (
            select(Subscription.id)
            .where(
                Subscription.organization_id == Organization.id,
                Subscription.status.in_(SubscriptionStatus.billable_statuses()),
                Subscription.ended_at.is_(None),
                Subscription.deleted_at.is_(None),
            )
            .correlate(Organization)
            .exists()
        )
        status_entered_at = func.coalesce(
            Organization.status_updated_at, Organization.created_at
        )
        statement = (
            self.get_base_statement()
            .where(
                Organization.status.in_(SUBSCRIPTION_CANCELLATION_STATUSES),
                status_entered_at <= cutoff,
                has_billable_subscription,
            )
            .order_by(status_entered_at.asc())
            .limit(limit)
        )
        return await self.get_all(statement)

    async def get_last_paid_order_at(self, organization_id: UUID) -> datetime | None:
        """Most recent paid (not fully refunded) order date for an org.

        Same chargeback-risk anchor as ``get_offboarding_past_period``, but for
        a single organization — lets the backoffice surface how much of the
        offboarding wind-down period remains before an auto-offboard.
        """
        statement = select(func.max(Order.created_at)).where(
            Order.organization_id == organization_id,
            Order.status.in_(OrderStatus.paid_statuses()),
            Order.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    def get_sorting_clause(self, property: OrganizationSortProperty) -> SortingClause:
        match property:
            case OrganizationSortProperty.created_at:
                return self.model.created_at
            case OrganizationSortProperty.slug:
                return self.model.slug
            case OrganizationSortProperty.organization_name:
                return self.model.name
            case OrganizationSortProperty.next_review_threshold:
                return self.model.next_review_threshold
            case OrganizationSortProperty.days_in_status:
                # Calculate days since status was last updated
                return (
                    func.extract(
                        "epoch",
                        func.now()
                        - func.coalesce(
                            self.model.status_updated_at, self.model.modified_at
                        ),
                    )
                    / 86400
                )

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Organization]]:
        return self.get_base_statement().where(
            Organization.id.in_(org_ids),
            Organization.status != OrganizationStatus.BLOCKED,
        )

    async def get_owner_user(self, organization: Organization) -> User | None:
        """Get the owner of the organization."""
        statement = (
            select(User)
            .join(UserOrganization, UserOrganization.user_id == User.id)
            .where(
                UserOrganization.organization_id == organization.id,
                UserOrganization.role == OrganizationRole.owner,
                UserOrganization.is_deleted.is_(False),
                User.is_deleted.is_(False),
            )
        )
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def count_paid_orders_by_organization(self, organization_id: UUID) -> int:
        """Count non-zero orders for all customers of this organization.

        Excludes $0 orders (e.g. free products or fully discounted orders)
        so that test accounts with only free activity can self-serve delete.
        """
        statement = (
            select(func.count(Order.id))
            .join(Customer, Order.customer_id == Customer.id)
            .where(
                Customer.organization_id == organization_id,
                Customer.is_deleted.is_(False),
                Order.total_amount > 0,
            )
        )
        result = await self.session.execute(statement)
        return result.scalar() or 0

    async def count_paid_active_subscriptions_by_organization(
        self, organization_id: UUID
    ) -> int:
        """Count active subscriptions that involve real payments.

        Excludes free subscriptions (amount == 0) when they are inherently
        free or permanently free via a forever discount. Subscriptions made
        temporarily free by a once/repeating discount are still counted,
        since they will become paid when the discount expires.
        """
        statement = (
            select(func.count(Subscription.id))
            .join(Customer, Subscription.customer_id == Customer.id)
            .outerjoin(Discount, Subscription.discount_id == Discount.id)
            .where(
                Customer.organization_id == organization_id,
                Customer.is_deleted.is_(False),
                Subscription.status.in_(SubscriptionStatus.active_statuses()),
                ~(
                    (Subscription.amount == 0)
                    & (
                        Subscription.discount_id.is_(None)
                        | (
                            (Discount.type == DiscountType.percentage)
                            & (DiscountPercentage.basis_points == 10000)
                            & (Discount.duration == DiscountDuration.forever)
                        )
                    )
                ),
            )
        )
        result = await self.session.execute(statement)
        return result.scalar() or 0

    async def confirm_review_atomic(
        self,
        organization_id: UUID,
        *,
        next_review_threshold: int | None,
        min_threshold: int,
        active_capabilities: OrganizationCapabilities,
        now: datetime,
    ) -> Organization | None:
        """Atomically transition a REVIEW or SNOOZED organization to ACTIVE.

        Returns the updated ``Organization`` (also merged into the session's
        identity map via ``populate_existing``), or ``None`` if the row was
        no longer in a confirmable state — typically because another worker
        already won the race and flipped the org back to ACTIVE.

        When ``next_review_threshold`` is ``None``, the threshold is doubled
        server-side from the current row (floored at ``min_threshold``) so
        that N concurrent confirms doubling at once cannot collapse onto a
        shared stale snapshot.
        """
        threshold_expr = (
            func.greatest(Organization.next_review_threshold * 2, min_threshold)
            if next_review_threshold is None
            else next_review_threshold
        )

        stmt = (
            update(Organization)
            .where(
                Organization.id == organization_id,
                Organization.status.in_(
                    [OrganizationStatus.REVIEW, OrganizationStatus.SNOOZED]
                ),
            )
            .values(
                status=OrganizationStatus.ACTIVE,
                status_updated_at=now,
                capabilities=active_capabilities,
                next_review_threshold=threshold_expr,
                initially_reviewed_at=func.coalesce(
                    Organization.initially_reviewed_at, now
                ),
            )
            .returning(Organization)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def increment_customer_invoice_next_number(
        self, organization_id: UUID
    ) -> int:
        """
        Atomically increment customer_invoice_next_number and return the value
        before increment.
        """
        stmt = (
            update(Organization)
            .where(Organization.id == organization_id)
            .values(
                customer_invoice_next_number=Organization.customer_invoice_next_number
                + 1
            )
            .returning(Organization.customer_invoice_next_number)
        )
        result = await self.session.execute(stmt)
        next_number = result.scalar_one()
        return next_number - 1

    async def delete_payout_account(self, payout_account: UUID) -> None:
        """Reset Organization.payout_account_id to None for any organization linked to the payout account."""
        stmt = (
            update(Organization)
            .where(Organization.payout_account_id == payout_account)
            .values(payout_account_id=None)
        )
        await self.session.execute(stmt)

    async def get_all_by_payout_account(
        self, payout_account: UUID
    ) -> Sequence[Organization]:
        statement = self.get_base_statement().where(
            Organization.payout_account_id == payout_account,
        )
        return await self.get_all(statement)

    async def get_all_by_owner_user(self, user_id: UUID) -> Sequence[Organization]:
        statement = (
            self.get_base_statement()
            .join(
                UserOrganization,
                UserOrganization.organization_id == Organization.id,
            )
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.role == OrganizationRole.owner,
                UserOrganization.is_deleted.is_(False),
            )
        )
        return await self.get_all(statement)


class OrganizationReviewRepository(RepositoryBase[OrganizationReview]):
    model = OrganizationReview

    async def get_by_organization(
        self, organization_id: UUID
    ) -> OrganizationReview | None:
        statement = self.get_base_statement().where(
            OrganizationReview.organization_id == organization_id,
            OrganizationReview.is_deleted.is_(False),
        )
        return await self.get_one_or_none(statement)
