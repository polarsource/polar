from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, or_, select, update

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.repository.base import Options
from polar.models import (
    Account,
    Customer,
    Order,
    Organization,
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
from polar.models.organization_review import OrganizationReview
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncReadSession

from .sorting import OrganizationSortProperty


class OrganizationRepository(
    RepositorySortingMixin[Organization, OrganizationSortProperty],
    RepositorySoftDeletionIDMixin[Organization, UUID],
    RepositorySoftDeletionMixin[Organization],
    RepositoryBase[Organization],
):
    model = Organization

    async def get_by_id(
        self,
        id: UUID,
        *,
        options: Options = (),
        include_deleted: bool = False,
        include_blocked: bool = False,
    ) -> Organization | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(self.model.id == id)
            .options(*options)
        )

        if not include_blocked:
            statement = statement.where(self.model.blocked_at.is_(None))

        return await self.get_one_or_none(statement)

    async def get_by_id_with_account(
        self,
        id: UUID,
        *,
        include_deleted: bool = False,
        include_blocked: bool = True,
    ) -> Organization | None:
        from sqlalchemy.orm import joinedload

        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .options(joinedload(Organization.account))
            .where(self.model.id == id)
        )

        if not include_blocked:
            statement = statement.where(self.model.blocked_at.is_(None))

        return await self.get_one_or_none(statement)

    async def get_by_slug(self, slug: str) -> Organization | None:
        statement = self.get_base_statement().where(Organization.slug == slug)
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
                Organization.blocked_at.is_(None),
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
                Organization.blocked_at.is_(None),
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_all_by_account_admin(self, user_id: UUID) -> Sequence[Organization]:
        """Get all organizations where the user is the account admin."""
        statement = (
            self.get_base_statement()
            .join(Account, Organization.account_id == Account.id)
            .where(
                Account.admin_id == user_id,
                Organization.blocked_at.is_(None),
            )
        )
        return await self.get_all(statement)

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

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Organization]]:
        statement = self.get_base_statement().where(Organization.blocked_at.is_(None))

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Organization.id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Organization.id == auth_subject.subject.id,
            )

        return statement

    async def get_admin_user(
        self, session: AsyncReadSession, organization: Organization
    ) -> User | None:
        """Get the admin user of the organization from the associated account."""
        if not organization.account_id:
            return None

        statement = (
            select(User)
            .join(Account, Account.admin_id == User.id)
            .where(
                Account.id == organization.account_id,
                User.is_deleted.is_(False),
            )
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def enable_revops(self, organization_ids: set[UUID]) -> None:
        statement = self.get_base_statement().where(
            Organization.id.in_(organization_ids),
            or_(
                Organization.feature_settings["revops_enabled"].is_(None),
                Organization.feature_settings["revops_enabled"].as_boolean().is_(False),
            ),
        )
        orgs = await self.get_all(statement)
        for org in orgs:
            org.feature_settings = {**org.feature_settings, "revops_enabled": True}
            self.session.add(org)
        await self.session.flush()

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
