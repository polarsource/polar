from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select, update
from sqlalchemy.orm import joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.customer import Customer
from polar.models.member import Member, MemberRole
from polar.postgres import AsyncReadSession, AsyncSession


class MemberRepository(
    RepositorySoftDeletionIDMixin[Member, UUID],
    RepositorySoftDeletionMixin[Member],
    RepositoryBase[Member],
):
    model = Member

    async def get_by_customer_and_email(
        self,
        session: AsyncSession,
        customer: Customer,
        email: str | None = None,
    ) -> Member | None:
        """
        Get a member by customer and email.

        Returns:
            Member if found, None otherwise
        """
        email = email or customer.email
        if email is None:
            return None
        statement = select(Member).where(
            Member.customer_id == customer.id,
            func.lower(Member.email) == email.lower(),
            Member.is_deleted.is_(False),
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_customer_id_and_email(
        self,
        customer_id: UUID,
        email: str,
    ) -> Member | None:
        """
        Get a member by customer ID and email.

        Returns:
            Member if found, None otherwise
        """
        statement = select(Member).where(
            Member.customer_id == customer_id,
            func.lower(Member.email) == email.lower(),
            Member.is_deleted.is_(False),
        )
        return await self.get_one_or_none(statement)

    async def get_by_customer_id_and_external_id(
        self,
        customer_id: UUID,
        external_id: str,
    ) -> Member | None:
        """
        Get a member by customer ID and external ID.

        Returns:
            Member if found, None otherwise
        """
        statement = select(Member).where(
            Member.customer_id == customer_id,
            Member.external_id == external_id,
            Member.is_deleted.is_(False),
        )
        return await self.get_one_or_none(statement)

    async def get_by_id_and_customer_id(
        self,
        member_id: UUID,
        customer_id: UUID,
    ) -> Member | None:
        """
        Get a member by ID and customer ID.

        Returns:
            Member if found, None otherwise
        """
        statement = select(Member).where(
            Member.id == member_id,
            Member.customer_id == customer_id,
            Member.is_deleted.is_(False),
        )
        return await self.get_one_or_none(statement)

    async def list_by_customer(
        self,
        session: AsyncReadSession,
        customer_id: UUID,
    ) -> Sequence[Member]:
        statement = select(Member).where(
            Member.customer_id == customer_id,
            Member.is_deleted.is_(False),
        )
        result = await session.execute(statement)
        return result.scalars().all()

    async def get_owner_by_customer_id(
        self,
        session: AsyncReadSession,
        customer_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Member | None:
        """Get the owner member for a customer.

        A customer must have at most one active owner; raises
        `MultipleResultsFound` otherwise so the invariant violation is loud.
        """
        statement = (
            select(Member)
            .where(
                Member.customer_id == customer_id,
                Member.role == MemberRole.owner,
            )
            .options(joinedload(Member.customer).joinedload(Customer.organization))
        )
        if not include_deleted:
            statement = statement.where(Member.is_deleted.is_(False))
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def transfer_ownership(
        self,
        session: AsyncSession,
        *,
        current_owner: Member,
        new_owner: Member,
    ) -> None:
        """Swap the `owner` role from one member to another, and refresh both
        instances so their in-memory `role` matches the DB.

        The partial unique index on `(customer_id) WHERE role = 'owner'` is
        non-deferrable and evaluated per-row, so a single CASE-based UPDATE
        can momentarily produce two owner rows depending on physical row
        order and trip the constraint. We demote the current owner first so
        the customer briefly has zero owners (allowed by the partial index),
        then promote the new owner.
        """
        await session.execute(
            update(Member)
            .where(Member.id == current_owner.id)
            .values(role=MemberRole.billing_manager)
        )
        await session.execute(
            update(Member)
            .where(Member.id == new_owner.id)
            .values(role=MemberRole.owner)
        )
        await session.refresh(current_owner, attribute_names=["role"])
        await session.refresh(new_owner, attribute_names=["role"])

    async def list_by_email_and_organization(
        self,
        session: AsyncReadSession,
        email: str,
        organization_id: UUID,
    ) -> Sequence[Member]:
        """
        Get all members with the given email in the organization.
        Used for customer portal email disambiguation when a user's email
        belongs to multiple customers.
        """
        statement = (
            select(Member)
            .where(
                func.lower(Member.email) == email.lower(),
                Member.organization_id == organization_id,
                Member.is_deleted.is_(False),
            )
            .options(joinedload(Member.customer))
        )
        result = await session.execute(statement)
        return result.scalars().unique().all()

    async def list_by_customers(
        self,
        session: AsyncReadSession,
        customer_ids: Sequence[UUID],
    ) -> Sequence[Member]:
        """
        Get all members for multiple customers (batch loading to avoid N+1 queries).
        """
        if not customer_ids:
            return []

        statement = select(Member).where(
            Member.customer_id.in_(customer_ids),
            Member.is_deleted.is_(False),
        )
        result = await session.execute(statement)
        return result.scalars().all()

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Member]]:
        return self.get_base_statement().where(Member.organization_id.in_(org_ids))
