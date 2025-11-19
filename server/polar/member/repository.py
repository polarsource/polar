from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.customer import Customer
from polar.models.member import Member
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
        statement = select(Member).where(
            Member.customer_id == customer.id,
            Member.email == email,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def list_by_customer(
        self,
        session: AsyncReadSession,
        customer_id: UUID,
    ) -> Sequence[Member]:
        statement = select(Member).where(
            Member.customer_id == customer_id,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        return result.scalars().all()

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
            Member.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        return result.scalars().all()
